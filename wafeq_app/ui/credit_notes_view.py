"""
Credit Notes Management View — Refunds & Returns with ZATCA Reporting
"""
import os
import datetime
import webbrowser
import tkinter as tk
from tkinter import messagebox, filedialog
import customtkinter as ctk
from typing import Dict, Any, List, Optional
from .theme import (
    COLOR_BG_DARK, COLOR_CARD_BG, COLOR_BORDER, COLOR_INPUT_BG,
    COLOR_PRIMARY, COLOR_PRIMARY_HOVER, COLOR_SECONDARY, COLOR_SECONDARY_HOVER,
    COLOR_DANGER, COLOR_DANGER_HOVER, COLOR_INFO, COLOR_TEXT_WHITE, COLOR_TEXT_MUTED,
    FONT_HEADING, FONT_SUBHEADING, FONT_BODY, FONT_BODY_BOLD, FONT_CAPTION
)
from .components import ModernDataTable, BaseDialog, ConfirmDialog, AsyncWorker
from ..api.credit_notes import CreditNotesAPI
from ..api.contacts import ContactsAPI
from ..api.accounts import AccountsAPI
from ..api.tax_rates import TaxRatesAPI


class CreditNoteFormDialog(BaseDialog):
    def __init__(self, parent, client, on_saved=None):
        super().__init__(parent, "Create Credit Note (Refund / Return)", width=950, height=650)
        self.client = client
        self.on_saved = on_saved
        self.api = CreditNotesAPI(client)

        self.contacts: List[Dict[str, Any]] = []
        self.accounts: List[Dict[str, Any]] = []
        self.tax_rates: List[Dict[str, Any]] = []

        self._build_ui()
        self._load_dependencies()

    def _build_ui(self):
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Meta Form
        meta_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=10)
        meta_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 10))
        meta_frame.grid_columnconfigure((0, 1, 2, 3), weight=1)

        # Date
        ctk.CTkLabel(meta_frame, text="Credit Note Date *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=0, sticky="w", padx=12, pady=(10, 2))
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        self.ent_date = ctk.CTkEntry(meta_frame, placeholder_text="YYYY-MM-DD", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_date.insert(0, today_str)
        self.ent_date.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 10))

        # Credit Note #
        ctk.CTkLabel(meta_frame, text="Credit Note # *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=1, sticky="w", padx=12, pady=(10, 2))
        self.ent_cn_num = ctk.CTkEntry(meta_frame, placeholder_text="e.g. CN-0001", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_cn_num.insert(0, f"CN-{datetime.datetime.now().strftime('%m%d%H%M')}")
        self.ent_cn_num.grid(row=1, column=1, sticky="ew", padx=12, pady=(0, 10))

        # Customer (Required by Wafeq credit notes endpoint)
        ctk.CTkLabel(meta_frame, text="Customer *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=2, sticky="w", padx=12, pady=(10, 2))
        self.cmb_contact = ctk.CTkComboBox(meta_frame, values=["Loading contacts..."], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_contact.grid(row=1, column=2, sticky="ew", padx=12, pady=(0, 10))

        # Reference Invoice
        ctk.CTkLabel(meta_frame, text="Original Invoice Ref", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=3, sticky="w", padx=12, pady=(10, 2))
        self.ent_ref = ctk.CTkEntry(meta_frame, placeholder_text="e.g. INV-0012", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_ref.grid(row=1, column=3, sticky="ew", padx=12, pady=(0, 10))

        # Reason / Notes
        ctk.CTkLabel(meta_frame, text="Reason / Notes", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=2, column=0, sticky="w", padx=12, pady=(4, 2))
        self.ent_notes = ctk.CTkEntry(meta_frame, placeholder_text="Reason for refund or credit", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_notes.grid(row=3, column=0, columnspan=4, sticky="ew", padx=12, pady=(0, 10))

        # Line Items Area
        line_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=10)
        line_frame.grid(row=1, column=0, sticky="nsew", padx=20, pady=(0, 10))
        line_frame.grid_columnconfigure((0, 1, 2, 3, 4), weight=1)

        ctk.CTkLabel(line_frame, text="Credit Details", font=FONT_SUBHEADING, text_color=COLOR_TEXT_WHITE).grid(row=0, column=0, sticky="w", padx=16, pady=12)

        # Line inputs
        ctk.CTkLabel(line_frame, text="Description *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=1, column=0, sticky="w", padx=16, pady=2)
        self.ent_line_desc = ctk.CTkEntry(line_frame, placeholder_text="e.g. Refund for return item", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_line_desc.grid(row=2, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 10))

        ctk.CTkLabel(line_frame, text="Account *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=1, column=2, sticky="w", padx=16, pady=2)
        self.cmb_acc = ctk.CTkComboBox(line_frame, values=["Sales"], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_acc.grid(row=2, column=2, sticky="ew", padx=16, pady=(0, 10))

        ctk.CTkLabel(line_frame, text="Quantity", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=1, column=3, sticky="w", padx=16, pady=2)
        self.ent_qty = ctk.CTkEntry(line_frame, placeholder_text="1", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_qty.insert(0, "1")
        self.ent_qty.grid(row=2, column=3, sticky="ew", padx=16, pady=(0, 10))

        ctk.CTkLabel(line_frame, text="Amount (SAR) *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=1, column=4, sticky="w", padx=16, pady=2)
        self.ent_amount = ctk.CTkEntry(line_frame, placeholder_text="0.00", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_amount.grid(row=2, column=4, sticky="ew", padx=16, pady=(0, 10))

        # Bottom Bar
        bottom_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=10)
        bottom_frame.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 20))

        btn_cancel = ctk.CTkButton(bottom_frame, text="Cancel", width=100, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self.destroy)
        btn_cancel.pack(side="right", padx=(10, 20), pady=12)

        self.btn_save = ctk.CTkButton(bottom_frame, text="Create Credit Note", width=140, fg_color=COLOR_PRIMARY, hover_color=COLOR_PRIMARY_HOVER, command=self._save)
        self.btn_save.pack(side="right", pady=12)

    def _load_dependencies(self):
        def fetch():
            conts = ContactsAPI(self.client).list_contacts()
            accs = AccountsAPI(self.client).get_revenue_accounts()
            taxes = TaxRatesAPI(self.client).list_tax_rates()
            return conts, accs, taxes

        def on_done(res):
            conts, accs, taxes = res
            self.contacts = conts
            self.accounts = accs
            self.tax_rates = taxes

            if conts:
                cnames = [c.get("name", "") for c in conts]
                self.cmb_contact.configure(values=cnames)
                self.cmb_contact.set(cnames[0])
            else:
                self.cmb_contact.configure(values=["No contacts found - Add Contact first"])

            acc_names = [f"{a.get('name_en') or a.get('name_ar')} ({a.get('account_code', '')})" for a in accs]
            if acc_names:
                self.cmb_acc.configure(values=acc_names)
                self.cmb_acc.set(acc_names[0])

        AsyncWorker.run(self, fetch, on_success=on_done)

    def _save(self):
        cn_num = self.ent_cn_num.get().strip()
        if not cn_num:
            messagebox.showerror("Validation Error", "Credit Note Number is required.", parent=self)
            return

        # Contact is required
        if not self.contacts:
            messagebox.showerror("Validation Error", "A contact is required for credit notes. Please create a contact first.", parent=self)
            return
        
        c_val = self.cmb_contact.get()
        c_id = None
        for c in self.contacts:
            if c.get("name") == c_val:
                c_id = c.get("id")
                break
        if not c_id:
            messagebox.showerror("Validation Error", "Please select a valid customer.", parent=self)
            return

        desc = self.ent_line_desc.get().strip()
        if not desc:
            messagebox.showerror("Validation Error", "Line item description is required.", parent=self)
            return

        try:
            amt = float(self.ent_amount.get().strip() or "0")
            qty = float(self.ent_qty.get().strip() or "1")
        except ValueError:
            messagebox.showerror("Validation Error", "Quantity and Amount must be valid numbers.", parent=self)
            return

        # Account ID
        acc_idx = 0
        if self.cmb_acc.get() in self.cmb_acc.cget("values"):
            acc_idx = self.cmb_acc.cget("values").index(self.cmb_acc.get())
        acc_id = self.accounts[acc_idx]["id"] if acc_idx < len(self.accounts) else None

        # Standard VAT tax rate
        tax_id = None
        for t in self.tax_rates:
            if "vat on sales" in (t.get("name") or "").lower():
                tax_id = t.get("id")
                break
        if not tax_id and self.tax_rates:
            tax_id = self.tax_rates[0].get("id")

        payload = {
            "credit_note_number": cn_num,
            "credit_note_date": self.ent_date.get().strip(),
            "currency": "SAR",
            "contact": c_id,
            "reference": self.ent_ref.get().strip(),
            "notes": self.ent_notes.get().strip(),
            "line_items": [
                {
                    "description": desc,
                    "quantity": qty,
                    "unit_amount": amt,
                    "account": acc_id,
                    "tax_rate": tax_id
                }
            ]
        }

        self.btn_save.configure(state="disabled", text="Processing...")

        def do_save():
            return self.api.create_credit_note(payload)

        def on_ok(res):
            messagebox.showinfo("Success", f"Credit Note #{cn_num} created successfully!", parent=self)
            self.destroy()
            if self.on_saved:
                self.on_saved()

        def on_err(e):
            self.btn_save.configure(state="normal", text="Create Credit Note")
            messagebox.showerror("Failed to Create Credit Note", str(e), parent=self)

        AsyncWorker.run(self, do_save, on_success=on_ok, on_error=on_err)


class CreditNotesView(ctk.CTkFrame):
    def __init__(self, master, client, **kwargs):
        super().__init__(master, fg_color=COLOR_BG_DARK, **kwargs)
        self.client = client
        self.api = CreditNotesAPI(client)
        self.credit_notes: List[Dict[str, Any]] = []

        self._build_ui()
        self.load_credit_notes()

    def _build_ui(self):
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Header
        top_bar = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=12)
        top_bar.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 15))
        top_bar.grid_columnconfigure(1, weight=1)

        title_lbl = ctk.CTkLabel(top_bar, text="Credit Notes (Refunds & Returns)", font=FONT_HEADING, text_color=COLOR_TEXT_WHITE)
        title_lbl.grid(row=0, column=0, sticky="w", padx=20, pady=15)

        btn_new = ctk.CTkButton(top_bar, text="＋  New Credit Note", fg_color=COLOR_PRIMARY, hover_color=COLOR_PRIMARY_HOVER, command=self._open_new_dialog)
        btn_new.grid(row=0, column=2, padx=10, pady=15)

        btn_refresh = ctk.CTkButton(top_bar, text="↻ Refresh", width=90, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self.load_credit_notes)
        btn_refresh.grid(row=0, column=3, padx=(0, 20), pady=15)

        # Toolbar
        ctrl_bar = ctk.CTkFrame(self, fg_color="transparent")
        ctrl_bar.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 12))
        ctrl_bar.grid_columnconfigure(0, weight=1)

        self.ent_search = ctk.CTkEntry(ctrl_bar, placeholder_text="🔍  Search credit notes...", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER, height=38)
        self.ent_search.grid(row=0, column=0, sticky="ew", padx=(0, 15))
        self.ent_search.bind("<KeyRelease>", self._handle_search)

        btn_zatca = ctk.CTkButton(ctrl_bar, text="⚡ Report to ZATCA", width=140, height=38, fg_color="#0284c7", hover_color="#0369a1", command=self._report_selected_to_zatca)
        btn_zatca.grid(row=0, column=1, padx=(0, 10))

        btn_pdf = ctk.CTkButton(ctrl_bar, text="📥 Download PDF", width=130, height=38, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self._download_pdf)
        btn_pdf.grid(row=0, column=2, padx=(0, 10))

        btn_del = ctk.CTkButton(ctrl_bar, text="🗑 Delete", width=90, height=38, fg_color=COLOR_DANGER, hover_color=COLOR_DANGER_HOVER, command=self._delete_selected)
        btn_del.grid(row=0, column=3)

        # Table
        cols = [
            ("credit_note_number", "Credit Note #", 140),
            ("credit_note_date", "Date", 110),
            ("contact_name", "Customer", 180),
            ("amount", "Total (SAR)", 120),
            ("tax_amount", "VAT (SAR)", 100),
            ("status", "Status", 95),
            ("zatca_status", "ZATCA Status", 140),
            ("reference", "Ref Invoice", 120),
        ]
        self.table = ModernDataTable(self, columns=cols)
        self.table.grid(row=2, column=0, sticky="nsew", padx=20, pady=(0, 20))

    def load_credit_notes(self):
        def fetch():
            conts = ContactsAPI(self.client).list_contacts()
            cns = self.api.list_credit_notes()
            return conts, cns

        def on_done(res):
            conts, cns = res
            cmap = {c.get("id"): c.get("name", "") for c in conts}
            display_rows = []
            for cn in cns:
                cid = cn.get("contact")
                cname = cmap.get(cid, "Customer") if cid else "Customer"
                tax_meta = cn.get("tax_authority") or {}
                z_st = tax_meta.get("status") or "NOT_REPORTED"

                display_rows.append({
                    "id": cn.get("id"),
                    "credit_note_number": cn.get("credit_note_number") or cn.get("id", "")[:12],
                    "credit_note_date": cn.get("credit_note_date", ""),
                    "contact_name": cname,
                    "amount": float(cn.get("amount") or 0),
                    "tax_amount": float(cn.get("tax_amount") or 0),
                    "status": cn.get("status", "DRAFT"),
                    "zatca_status": z_st,
                    "reference": cn.get("reference", "-"),
                    "_raw": cn
                })
            self.table.set_data(display_rows)

        AsyncWorker.run(self, fetch, on_success=on_done)

    def _handle_search(self, event=None):
        q = self.ent_search.get()
        self.table.filter_data(q, ["credit_note_number", "contact_name", "reference", "status"])

    def _open_new_dialog(self):
        CreditNoteFormDialog(self, self.client, on_saved=self.load_credit_notes)

    def _report_selected_to_zatca(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Credit Note", "Please select a credit note to report to ZATCA.")
            return

        cn_id = selected.get("id")
        cn_no = selected.get("credit_note_number")

        if not ConfirmDialog.ask(self, "Report to ZATCA", f"Report Credit Note #{cn_no} to ZATCA?"):
            return

        def do_report():
            return self.api.report_to_zatca(cn_id)

        def on_ok(res):
            st = res.get("status", "SUCCESS")
            messagebox.showinfo("ZATCA Status", f"Credit note reported to ZATCA.\nStatus: {st}")
            self.load_credit_notes()

        AsyncWorker.run(self, do_report, on_success=on_ok)

    def _download_pdf(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Credit Note", "Please select a credit note to download PDF.")
            return

        cn_id = selected.get("id")
        cn_no = selected.get("credit_note_number") or cn_id[:8]

        save_path = filedialog.asksaveasfilename(
            parent=self,
            title="Save Credit Note PDF",
            defaultextension=".pdf",
            filetypes=[("PDF Documents", "*.pdf")],
            initialfile=f"CreditNote_{cn_no}.pdf"
        )
        if not save_path:
            return

        def do_download():
            pdf_bytes = self.api.download_pdf(cn_id)
            with open(save_path, "wb") as f:
                f.write(pdf_bytes)
            return save_path

        def on_ok(path):
            if messagebox.askyesno("PDF Downloaded", "Credit note PDF saved.\nOpen now?"):
                webbrowser.open(os.path.abspath(path))

        AsyncWorker.run(self, do_download, on_success=on_ok)

    def _delete_selected(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Credit Note", "Please select a credit note to delete.")
            return

        cn_id = selected.get("id")
        cn_no = selected.get("credit_note_number")

        if ConfirmDialog.ask(self, "Delete Credit Note", f"Delete Credit Note #{cn_no}?"):
            def do_del():
                return self.api.delete_credit_note(cn_id)

            def on_ok(res):
                messagebox.showinfo("Deleted", f"Credit note #{cn_no} was deleted.")
                self.load_credit_notes()

            AsyncWorker.run(self, do_del, on_success=on_ok)
