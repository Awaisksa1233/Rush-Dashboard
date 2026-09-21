"""
Simplified Invoices Management View — Full B2C E-Invoicing & ZATCA Integration
"""
import os
import datetime
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import customtkinter as ctk
from typing import Dict, Any, List, Optional
from .theme import (
    COLOR_BG_DARK, COLOR_CARD_BG, COLOR_CARD_HOVER, COLOR_BORDER, COLOR_INPUT_BG,
    COLOR_PRIMARY, COLOR_PRIMARY_HOVER, COLOR_SECONDARY, COLOR_SECONDARY_HOVER,
    COLOR_DANGER, COLOR_DANGER_HOVER, COLOR_WARNING, COLOR_SUCCESS, COLOR_INFO,
    COLOR_TEXT_WHITE, COLOR_TEXT_MUTED,
    FONT_HEADING, FONT_SUBHEADING, FONT_BODY, FONT_BODY_BOLD, FONT_CAPTION
)
from .components import ModernDataTable, BaseDialog, ConfirmDialog, AsyncWorker
from ..api.invoices import InvoicesAPI
from ..api.contacts import ContactsAPI
from ..api.items import ItemsAPI
from ..api.accounts import AccountsAPI
from ..api.tax_rates import TaxRatesAPI


class LineItemRow(ctk.CTkFrame):
    """Row component in the invoice creation line items list"""
    def __init__(self, master, items_catalog: List[Dict[str, Any]], accounts: List[Dict[str, Any]],
                 tax_rates: List[Dict[str, Any]], on_change_callback, on_delete_callback,
                 initial_data: Optional[Dict[str, Any]] = None):
        super().__init__(master, fg_color="#18202b", corner_radius=6, border_width=1, border_color=COLOR_BORDER)
        self.items_catalog = items_catalog
        self.accounts = accounts
        self.tax_rates = tax_rates
        self.on_change = on_change_callback
        self.on_delete = on_delete_callback

        self._build_row(initial_data)

    def _build_row(self, d: Optional[Dict[str, Any]] = None):
        self.grid_columnconfigure(1, weight=3) # description
        self.grid_columnconfigure(2, weight=2) # account
        d = d or {}

        # 0. Item Catalog Selector Dropdown
        item_names = ["-- Select Catalog Item --"] + [it.get("name", "") for it in self.items_catalog]
        self.cmb_item = ctk.CTkComboBox(self, values=item_names, width=150, height=32,
                                        fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER,
                                        command=self._on_catalog_item_picked)
        self.cmb_item.grid(row=0, column=0, padx=4, pady=6)

        # 1. Description
        self.ent_desc = ctk.CTkEntry(self, placeholder_text="Description *", height=32,
                                     fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_desc.insert(0, d.get("description", ""))
        self.ent_desc.grid(row=0, column=1, sticky="ew", padx=4, pady=6)
        self.ent_desc.bind("<KeyRelease>", lambda e: self.on_change())

        # 2. Account dropdown
        acc_names = [f"{a.get('name_en') or a.get('name_ar')} ({a.get('account_code', '')})" for a in self.accounts]
        if not acc_names:
            acc_names = ["Sales"]
        self.cmb_acc = ctk.CTkComboBox(self, values=acc_names, width=140, height=32,
                                       fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER,
                                       command=lambda v: self.on_change())
        # Default to Sales account if exists
        def_acc = acc_names[0]
        for i, a in enumerate(self.accounts):
            if "sales" in (a.get("name_en") or "").lower() or a.get("id") == d.get("account"):
                def_acc = acc_names[i]
                break
        self.cmb_acc.set(def_acc)
        self.cmb_acc.grid(row=0, column=2, sticky="ew", padx=4, pady=6)

        # 3. Quantity
        self.ent_qty = ctk.CTkEntry(self, placeholder_text="Qty", width=60, height=32,
                                    fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_qty.insert(0, str(d.get("quantity") or "1"))
        self.ent_qty.grid(row=0, column=3, padx=4, pady=6)
        self.ent_qty.bind("<KeyRelease>", lambda e: self.on_change())

        # 4. Unit Price
        self.ent_price = ctk.CTkEntry(self, placeholder_text="Price (SAR)", width=90, height=32,
                                      fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_price.insert(0, str(d.get("unit_amount") or "0.00"))
        self.ent_price.grid(row=0, column=4, padx=4, pady=6)
        self.ent_price.bind("<KeyRelease>", lambda e: self.on_change())

        # 5. Tax Rate dropdown
        tax_names = [f"{t.get('name')} ({float(t.get('rate', 0))*100:.0f}%)" for t in self.tax_rates]
        if not tax_names:
            tax_names = ["15% VAT on Sales"]
        self.cmb_tax = ctk.CTkComboBox(self, values=tax_names, width=120, height=32,
                                       fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER,
                                       command=lambda v: self.on_change())
        # Default to 15% VAT on Sales
        def_tax = tax_names[0]
        for i, t in enumerate(self.tax_rates):
            if "vat on sales" in (t.get("name") or "").lower() or t.get("id") == d.get("tax_rate"):
                def_tax = tax_names[i]
                break
        self.cmb_tax.set(def_tax)
        self.cmb_tax.grid(row=0, column=5, padx=4, pady=6)

        # 6. Discount %
        self.ent_disc = ctk.CTkEntry(self, placeholder_text="Disc %", width=55, height=32,
                                     fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_disc.insert(0, str(d.get("discount") or "0"))
        self.ent_disc.grid(row=0, column=6, padx=4, pady=6)
        self.ent_disc.bind("<KeyRelease>", lambda e: self.on_change())

        # 7. Total preview label
        self.lbl_row_total = ctk.CTkLabel(self, text="0.00 SAR", width=80, font=FONT_BODY_BOLD,
                                          text_color=COLOR_TEXT_WHITE)
        self.lbl_row_total.grid(row=0, column=7, padx=4, pady=6)

        # 8. Remove Button
        btn_del = ctk.CTkButton(self, text="✕", width=28, height=28, fg_color=COLOR_DANGER,
                                hover_color=COLOR_DANGER_HOVER, command=lambda: self.on_delete(self))
        btn_del.grid(row=0, column=8, padx=(4, 8), pady=6)

    def _on_catalog_item_picked(self, val):
        if val == "-- Select Catalog Item --":
            return
        # Find item in catalog
        for it in self.items_catalog:
            if it.get("name") == val:
                self.ent_desc.delete(0, "end")
                self.ent_desc.insert(0, it.get("description") or it.get("name", ""))
                self.ent_price.delete(0, "end")
                self.ent_price.insert(0, str(it.get("unit_price") or "0.00"))
                # Match account if item has one
                rev_acc = it.get("revenue_account")
                if rev_acc:
                    for i, a in enumerate(self.accounts):
                        if a.get("id") == rev_acc:
                            self.cmb_acc.set(self.cmb_acc.cget("values")[i])
                            break
                break
        self.on_change()

    def get_values(self) -> Dict[str, Any]:
        """Calculates line amount and returns payload dictionary"""
        try:
            qty = float(self.ent_qty.get().strip() or "0")
        except ValueError:
            qty = 1.0

        try:
            unit_price = float(self.ent_price.get().strip() or "0")
        except ValueError:
            unit_price = 0.0

        try:
            disc = float(self.ent_disc.get().strip() or "0")
        except ValueError:
            disc = 0.0

        # Account ID
        acc_idx = 0
        if self.cmb_acc.get() in self.cmb_acc.cget("values"):
            acc_idx = self.cmb_acc.cget("values").index(self.cmb_acc.get())
        acc_id = self.accounts[acc_idx]["id"] if acc_idx < len(self.accounts) else None

        # Tax Rate ID & Rate
        tax_idx = 0
        if self.cmb_tax.get() in self.cmb_tax.cget("values"):
            tax_idx = self.cmb_tax.cget("values").index(self.cmb_tax.get())
        tax_rate_obj = self.tax_rates[tax_idx] if tax_idx < len(self.tax_rates) else None
        tax_id = tax_rate_obj.get("id") if tax_rate_obj else None
        rate = float(tax_rate_obj.get("rate") or 0.0) if tax_rate_obj else 0.0

        subtotal = qty * unit_price * (1.0 - (disc / 100.0))
        tax_amount = subtotal * rate
        total = subtotal + tax_amount

        self.lbl_row_total.configure(text=f"{total:,.2f}")

        return {
            "account": acc_id,
            "description": self.ent_desc.get().strip(),
            "quantity": qty,
            "unit_amount": unit_price,
            "discount": disc if disc > 0 else None,
            "tax_rate": tax_id,
            "_subtotal": subtotal,
            "_tax": tax_amount,
            "_total": total
        }


class InvoiceFormDialog(BaseDialog):
    def __init__(self, parent, client, invoice: Optional[Dict[str, Any]] = None, on_saved=None):
        title = "Edit Simplified Invoice" if invoice else "Create Simplified Invoice (B2C)"
        super().__init__(parent, title, width=1050, height=720)
        self.client = client
        self.invoice = invoice
        self.on_saved = on_saved
        self.api = InvoicesAPI(client)

        self.contacts: List[Dict[str, Any]] = []
        self.items_catalog: List[Dict[str, Any]] = []
        self.revenue_accounts: List[Dict[str, Any]] = []
        self.payment_accounts: List[Dict[str, Any]] = []
        self.tax_rates: List[Dict[str, Any]] = []
        self.line_rows: List[LineItemRow] = []

        self._build_ui()
        self._load_dependencies()

    def _build_ui(self):
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # 1. Top Meta Form Frame
        meta_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=10)
        meta_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 10))
        meta_frame.grid_columnconfigure((0, 1, 2, 3), weight=1)

        # Invoice Date
        ctk.CTkLabel(meta_frame, text="Invoice Date *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=0, sticky="w", padx=12, pady=(10, 2))
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        self.ent_date = ctk.CTkEntry(meta_frame, placeholder_text="YYYY-MM-DD", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.ent_date.insert(0, (self.invoice or {}).get("invoice_date") or today_str)
        self.ent_date.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 10))

        # Invoice Number
        ctk.CTkLabel(meta_frame, text="Invoice # (Auto if blank)", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=1, sticky="w", padx=12, pady=(10, 2))
        self.ent_inv_num = ctk.CTkEntry(meta_frame, placeholder_text="e.g. INV-0001", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        if self.invoice and self.invoice.get("invoice_number"):
            self.ent_inv_num.insert(0, self.invoice["invoice_number"])
        self.ent_inv_num.grid(row=1, column=1, sticky="ew", padx=12, pady=(0, 10))

        # Customer / Contact
        ctk.CTkLabel(meta_frame, text="Customer", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=2, sticky="w", padx=12, pady=(10, 2))
        self.cmb_contact = ctk.CTkComboBox(meta_frame, values=["Walk-in Customer (None)"], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_contact.grid(row=1, column=2, sticky="ew", padx=12, pady=(0, 10))

        # Paid Through Account
        ctk.CTkLabel(meta_frame, text="Paid Through Account *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=0, column=3, sticky="w", padx=12, pady=(10, 2))
        self.cmb_payment_acc = ctk.CTkComboBox(meta_frame, values=["Loading..."], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_payment_acc.grid(row=1, column=3, sticky="ew", padx=12, pady=(0, 10))

        # Status & Tax Type
        ctk.CTkLabel(meta_frame, text="Invoice Status", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=2, column=0, sticky="w", padx=12, pady=(4, 2))
        self.cmb_status = ctk.CTkComboBox(meta_frame, values=["PAID", "DRAFT"], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_status.set((self.invoice or {}).get("status") or "PAID")
        self.cmb_status.grid(row=3, column=0, sticky="ew", padx=12, pady=(0, 10))

        ctk.CTkLabel(meta_frame, text="Tax Treatment", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=2, column=1, sticky="w", padx=12, pady=(4, 2))
        self.cmb_tax_mode = ctk.CTkComboBox(meta_frame, values=["TAX_EXCLUSIVE", "TAX_INCLUSIVE"], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_tax_mode.set((self.invoice or {}).get("tax_amount_type") or "TAX_EXCLUSIVE")
        self.cmb_tax_mode.grid(row=3, column=1, sticky="ew", padx=12, pady=(0, 10))

        # Reference
        ctk.CTkLabel(meta_frame, text="Reference", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=2, column=2, sticky="w", padx=12, pady=(4, 2))
        self.ent_ref = ctk.CTkEntry(meta_frame, placeholder_text="Order # / POS Ref", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        if self.invoice and self.invoice.get("reference"):
            self.ent_ref.insert(0, self.invoice["reference"])
        self.ent_ref.grid(row=3, column=2, sticky="ew", padx=12, pady=(0, 10))

        # Notes
        ctk.CTkLabel(meta_frame, text="Notes", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE).grid(row=2, column=3, sticky="w", padx=12, pady=(4, 2))
        self.ent_notes = ctk.CTkEntry(meta_frame, placeholder_text="Optional customer notes", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        if self.invoice and self.invoice.get("notes"):
            self.ent_notes.insert(0, self.invoice["notes"])
        self.ent_notes.grid(row=3, column=3, sticky="ew", padx=12, pady=(0, 10))

        # 2. Line Items Frame
        lines_container = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=10)
        lines_container.grid(row=1, column=0, sticky="nsew", padx=20, pady=(0, 10))
        lines_container.grid_rowconfigure(1, weight=1)
        lines_container.grid_columnconfigure(0, weight=1)

        # Line items header bar
        lines_header = ctk.CTkFrame(lines_container, fg_color="transparent")
        lines_header.grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 4))
        lines_header.grid_columnconfigure(0, weight=1)

        lbl_lines_title = ctk.CTkLabel(lines_header, text="Invoice Line Items", font=FONT_SUBHEADING, text_color=COLOR_TEXT_WHITE)
        lbl_lines_title.grid(row=0, column=0, sticky="w")

        btn_add_line = ctk.CTkButton(
            lines_header,
            text="＋ Add Line Item",
            width=130,
            height=30,
            fg_color=COLOR_PRIMARY,
            hover_color=COLOR_PRIMARY_HOVER,
            command=self._add_empty_line
        )
        btn_add_line.grid(row=0, column=1)

        # Scrollable area for lines
        self.lines_scroll = ctk.CTkScrollableFrame(lines_container, fg_color="transparent")
        self.lines_scroll.grid(row=1, column=0, sticky="nsew", padx=12, pady=4)
        self.lines_scroll.grid_columnconfigure(0, weight=1)

        # 3. Bottom Summary & Action Bar
        bottom_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=10)
        bottom_frame.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 20))
        bottom_frame.grid_columnconfigure(0, weight=1)

        # Left: Totals Breakdown
        totals_frame = ctk.CTkFrame(bottom_frame, fg_color="transparent")
        totals_frame.pack(side="left", padx=20, pady=12)

        self.lbl_subtotal = ctk.CTkLabel(totals_frame, text="Subtotal: 0.00 SAR", font=FONT_BODY, text_color=COLOR_TEXT_MUTED)
        self.lbl_subtotal.pack(side="left", padx=10)

        self.lbl_vat = ctk.CTkLabel(totals_frame, text="VAT (15%): 0.00 SAR", font=FONT_BODY, text_color=COLOR_TEXT_MUTED)
        self.lbl_vat.pack(side="left", padx=10)

        self.lbl_grand_total = ctk.CTkLabel(totals_frame, text="Total: 0.00 SAR", font=("Segoe UI", 14, "bold"), text_color=COLOR_SUCCESS)
        self.lbl_grand_total.pack(side="left", padx=15)

        # Right: Buttons
        btn_cancel = ctk.CTkButton(bottom_frame, text="Cancel", width=100, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self.destroy)
        btn_cancel.pack(side="right", padx=(10, 20), pady=12)

        self.btn_save = ctk.CTkButton(bottom_frame, text="Create Invoice", width=130, fg_color=COLOR_PRIMARY, hover_color=COLOR_PRIMARY_HOVER, command=self._save_invoice)
        self.btn_save.pack(side="right", pady=12)

    def _load_dependencies(self):
        def fetch():
            conts = ContactsAPI(self.client).list_contacts()
            itms = ItemsAPI(self.client).list_items()
            rev_accs = AccountsAPI(self.client).get_revenue_accounts()
            pay_accs = AccountsAPI(self.client).get_payment_accounts()
            taxes = TaxRatesAPI(self.client).list_tax_rates()
            return conts, itms, rev_accs, pay_accs, taxes

        def on_done(res):
            conts, itms, rev_accs, pay_accs, taxes = res
            self.contacts = conts
            self.items_catalog = itms
            self.revenue_accounts = rev_accs
            self.payment_accounts = pay_accs
            self.tax_rates = taxes

            # Populate Contacts dropdown
            contact_names = ["Walk-in Customer (None)"] + [c.get("name", "") for c in conts]
            self.cmb_contact.configure(values=contact_names)
            if self.invoice and self.invoice.get("contact"):
                for i, c in enumerate(conts):
                    if c.get("id") == self.invoice["contact"]:
                        self.cmb_contact.set(contact_names[i + 1])
                        break

            # Populate Payment Accounts dropdown
            pay_names = [f"{a.get('name_en') or a.get('name_ar')} ({a.get('account_code', '')})" for a in pay_accs]
            if not pay_names:
                pay_names = ["Cash"]
            self.cmb_payment_acc.configure(values=pay_names)
            
            # Select default payment account: prefer Petty Cash or Undeposited Funds
            def_pay = pay_names[0]
            for i, a in enumerate(pay_accs):
                aname = (a.get("name_en") or "").lower()
                if "petty cash" in aname or "undeposited" in aname:
                    def_pay = pay_names[i]
                    break
            self.cmb_payment_acc.set(def_pay)

            # Add existing or first line item
            existing_lines = (self.invoice or {}).get("line_items", [])
            if existing_lines:
                for line in existing_lines:
                    self._add_line(line)
            else:
                self._add_empty_line()

        AsyncWorker.run(self, fetch, on_success=on_done)

    def _add_line(self, data: Optional[Dict[str, Any]] = None):
        row = LineItemRow(
            self.lines_scroll,
            items_catalog=self.items_catalog,
            accounts=self.revenue_accounts,
            tax_rates=self.tax_rates,
            on_change_callback=self._recalculate_totals,
            on_delete_callback=self._remove_line,
            initial_data=data
        )
        row.pack(fill="x", expand=True, pady=3)
        self.line_rows.append(row)
        self._recalculate_totals()

    def _add_empty_line(self):
        self._add_line(None)

    def _remove_line(self, row: LineItemRow):
        if len(self.line_rows) <= 1:
            messagebox.showwarning("Warning", "Invoice must have at least one line item.", parent=self)
            return
        row.destroy()
        self.line_rows.remove(row)
        self._recalculate_totals()

    def _recalculate_totals(self):
        subtotal = 0.0
        tax_total = 0.0
        grand_total = 0.0
        for r in self.line_rows:
            try:
                v = r.get_values()
                subtotal += v["_subtotal"]
                tax_total += v["_tax"]
                grand_total += v["_total"]
            except Exception:
                pass

        self.lbl_subtotal.configure(text=f"Subtotal: {subtotal:,.2f} SAR")
        self.lbl_vat.configure(text=f"VAT: {tax_total:,.2f} SAR")
        self.lbl_grand_total.configure(text=f"Total: {grand_total:,.2f} SAR")

    def _save_invoice(self):
        # Validate Date
        inv_date = self.ent_date.get().strip()
        if not inv_date:
            messagebox.showerror("Validation Error", "Invoice Date is required.", parent=self)
            return

        # Payment Account
        pay_idx = 0
        if self.cmb_payment_acc.get() in self.cmb_payment_acc.cget("values"):
            pay_idx = self.cmb_payment_acc.cget("values").index(self.cmb_payment_acc.get())
        if not self.payment_accounts:
            messagebox.showerror("Error", "No payment accounts available in Wafeq.", parent=self)
            return
        paid_account_id = self.payment_accounts[pay_idx]["id"]

        # Contact
        contact_id = None
        c_val = self.cmb_contact.get()
        if c_val != "Walk-in Customer (None)":
            for c in self.contacts:
                if c.get("name") == c_val:
                    contact_id = c.get("id")
                    break

        # Line Items
        formatted_lines = []
        for r in self.line_rows:
            v = r.get_values()
            if not v["description"]:
                messagebox.showerror("Validation Error", "All line items must have a description.", parent=self)
                return
            if v["quantity"] <= 0:
                messagebox.showerror("Validation Error", "Quantity must be greater than 0.", parent=self)
                return
            
            line_payload = {
                "description": v["description"],
                "quantity": v["quantity"],
                "unit_amount": v["unit_amount"],
                "account": v["account"]
            }
            if v["tax_rate"]:
                line_payload["tax_rate"] = v["tax_rate"]
            if v["discount"]:
                line_payload["discount"] = v["discount"]
            formatted_lines.append(line_payload)

        payload = {
            "invoice_date": inv_date,
            "currency": "SAR",
            "paid_through_account": paid_account_id,
            "line_items": formatted_lines,
            "status": self.cmb_status.get(),
            "tax_amount_type": self.cmb_tax_mode.get(),
        }
        if contact_id:
            payload["contact"] = contact_id
        if self.ent_inv_num.get().strip():
            payload["invoice_number"] = self.ent_inv_num.get().strip()
        if self.ent_ref.get().strip():
            payload["reference"] = self.ent_ref.get().strip()
        if self.ent_notes.get().strip():
            payload["notes"] = self.ent_notes.get().strip()

        self.btn_save.configure(state="disabled", text="Processing...")

        def do_save():
            if self.invoice:
                return self.api.update_invoice(self.invoice["id"], payload)
            else:
                return self.api.create_invoice(payload)

        def on_ok(res):
            inv_no = res.get("invoice_number") or res.get("id", "")[:12]
            messagebox.showinfo("Success", f"Invoice #{inv_no} saved successfully in Wafeq!", parent=self)
            self.destroy()
            if self.on_saved:
                self.on_saved()

        def on_err(e):
            self.btn_save.configure(state="normal", text="Create Invoice")
            messagebox.showerror("Invoice Creation Failed", str(e), parent=self)

        AsyncWorker.run(self, do_save, on_success=on_ok, on_error=on_err)


class InvoicesView(ctk.CTkFrame):
    def __init__(self, master, client, **kwargs):
        super().__init__(master, fg_color=COLOR_BG_DARK, **kwargs)
        self.client = client
        self.api = InvoicesAPI(client)
        self.invoices_list: List[Dict[str, Any]] = []
        self.contacts_map: Dict[str, str] = {}

        self._build_ui()
        self.load_invoices()

    def _build_ui(self):
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # 1. Top Header Bar
        top_bar = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=12)
        top_bar.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 15))
        top_bar.grid_columnconfigure(1, weight=1)

        title_lbl = ctk.CTkLabel(top_bar, text="Simplified Invoices (B2C & POS)", font=FONT_HEADING, text_color=COLOR_TEXT_WHITE)
        title_lbl.grid(row=0, column=0, sticky="w", padx=20, pady=15)

        btn_create = ctk.CTkButton(top_bar, text="＋  New Invoice", fg_color=COLOR_PRIMARY, hover_color=COLOR_PRIMARY_HOVER, command=self.open_new_invoice_dialog)
        btn_create.grid(row=0, column=2, padx=10, pady=15)

        btn_refresh = ctk.CTkButton(top_bar, text="↻ Refresh", width=90, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self.load_invoices)
        btn_refresh.grid(row=0, column=3, padx=(0, 20), pady=15)

        # 2. Action Toolbar and Filters
        ctrl_bar = ctk.CTkFrame(self, fg_color="transparent")
        ctrl_bar.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 12))
        ctrl_bar.grid_columnconfigure(0, weight=1)

        self.ent_search = ctk.CTkEntry(ctrl_bar, placeholder_text="🔍  Search by invoice #, customer, amount, or status...", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER, height=38)
        self.ent_search.grid(row=0, column=0, sticky="ew", padx=(0, 15))
        self.ent_search.bind("<KeyRelease>", self._handle_search)

        # Status filter dropdown
        self.cmb_filter = ctk.CTkComboBox(ctrl_bar, values=["All Statuses", "PAID", "DRAFT", "ZATCA Reported", "ZATCA Pending"], width=150, height=38, fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER, command=self._handle_filter)
        self.cmb_filter.grid(row=0, column=1, padx=(0, 10))

        # ZATCA Report Button
        btn_zatca = ctk.CTkButton(ctrl_bar, text="⚡ Report to ZATCA", width=140, height=38, fg_color="#0284c7", hover_color="#0369a1", command=self._report_selected_to_zatca)
        btn_zatca.grid(row=0, column=2, padx=(0, 10))

        # PDF Download Button
        btn_pdf = ctk.CTkButton(ctrl_bar, text="📥 Download PDF", width=130, height=38, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self._download_pdf)
        btn_pdf.grid(row=0, column=3, padx=(0, 10))

        # Delete Button
        btn_del = ctk.CTkButton(ctrl_bar, text="🗑 Delete", width=90, height=38, fg_color=COLOR_DANGER, hover_color=COLOR_DANGER_HOVER, command=self._delete_selected)
        btn_del.grid(row=0, column=4)

        # 3. Invoices Table
        cols = [
            ("invoice_number", "Invoice #", 130),
            ("invoice_date", "Date", 105),
            ("contact_name", "Customer", 170),
            ("amount", "Total (SAR)", 120),
            ("tax_amount", "VAT (SAR)", 100),
            ("status", "Status", 95),
            ("zatca_status", "ZATCA Status", 140),
            ("reference", "Reference", 130),
        ]
        self.table = ModernDataTable(self, columns=cols, on_double_click=lambda item: self._view_details(item))
        self.table.grid(row=2, column=0, sticky="nsew", padx=20, pady=(0, 20))

    def load_invoices(self):
        def fetch():
            conts = ContactsAPI(self.client).list_contacts()
            invs = self.api.list_invoices()
            return conts, invs

        def on_done(res):
            conts, invs = res
            self.contacts_map = {c.get("id"): c.get("name", "") for c in conts}
            self.invoices_list = invs

            display_rows = []
            for inv in invs:
                cid = inv.get("contact")
                cname = self.contacts_map.get(cid, "Walk-in Customer") if cid else "Walk-in Customer"

                # ZATCA Status
                tax_meta = inv.get("tax_authority") or {}
                z_st = tax_meta.get("status") or "NOT_REPORTED"

                display_rows.append({
                    "id": inv.get("id"),
                    "invoice_number": inv.get("invoice_number") or inv.get("id", "")[:12],
                    "invoice_date": inv.get("invoice_date", ""),
                    "contact_name": cname,
                    "amount": float(inv.get("amount") or 0),
                    "tax_amount": float(inv.get("tax_amount") or 0),
                    "status": inv.get("status", "DRAFT"),
                    "zatca_status": z_st,
                    "reference": inv.get("reference", "-"),
                    "_raw": inv
                })
            self.table.set_data(display_rows)

        AsyncWorker.run(self, fetch, on_success=on_done)

    def _handle_search(self, event=None):
        q = self.ent_search.get()
        self.table.filter_data(q, ["invoice_number", "contact_name", "reference", "status", "zatca_status"])

    def _handle_filter(self, choice):
        if choice == "All Statuses":
            self.table.filter_data("")
        elif choice in ["PAID", "DRAFT"]:
            self.table.filter_data(choice, ["status"])
        elif choice == "ZATCA Reported":
            self.table.filter_data("REPORTED", ["zatca_status"])
        elif choice == "ZATCA Pending":
            self.table.filter_data("NOT_REPORTED", ["zatca_status"])

    def open_new_invoice_dialog(self):
        InvoiceFormDialog(self, self.client, on_saved=self.load_invoices)

    def _view_details(self, item: Dict[str, Any]):
        raw = item.get("_raw")
        if raw:
            InvoiceFormDialog(self, self.client, invoice=raw, on_saved=self.load_invoices)

    def _report_selected_to_zatca(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Invoice", "Please select an invoice from the table to report to ZATCA.")
            return

        inv_id = selected.get("id")
        inv_no = selected.get("invoice_number")

        if not ConfirmDialog.ask(self, "Report to ZATCA", f"Are you sure you want to submit Invoice #{inv_no} to the Saudi Tax Authority (ZATCA)?"):
            return

        def do_report():
            return self.api.report_to_zatca(inv_id)

        def on_ok(res):
            st = res.get("status", "SUCCESS")
            meta = res.get("metadata") or {}
            warns = meta.get("warnings", [])
            errs = meta.get("errors", [])

            msg = f"ZATCA Submission Response: {st}\nReported Time: {res.get('reported_ts', 'Now')}"
            if warns:
                msg += f"\n\nWarnings:\n" + "\n".join(str(w) for w in warns)
            if errs:
                msg += f"\n\nErrors:\n" + "\n".join(str(e) for e in errs)

            messagebox.showinfo("ZATCA Status", msg)
            self.load_invoices()

        def on_err(e):
            messagebox.showerror("ZATCA Reporting Error", f"Failed to report to ZATCA:\n{str(e)}")

        AsyncWorker.run(self, do_report, on_success=on_ok, on_error=on_err)

    def _download_pdf(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Invoice", "Please select an invoice to download PDF.")
            return

        inv_id = selected.get("id")
        inv_no = selected.get("invoice_number") or inv_id[:8]

        save_path = filedialog.asksaveasfilename(
            parent=self,
            title="Save Invoice PDF",
            defaultextension=".pdf",
            filetypes=[("PDF Documents", "*.pdf")],
            initialfile=f"Invoice_{inv_no}.pdf"
        )
        if not save_path:
            return

        def do_download():
            pdf_bytes = self.api.download_pdf(inv_id)
            with open(save_path, "wb") as f:
                f.write(pdf_bytes)
            return save_path

        def on_ok(path):
            if messagebox.askyesno("PDF Downloaded", f"Invoice PDF saved successfully.\nWould you like to open it now?"):
                webbrowser.open(os.path.abspath(path))

        AsyncWorker.run(self, do_download, on_success=on_ok)

    def _delete_selected(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Invoice", "Please select an invoice to delete.")
            return

        inv_id = selected.get("id")
        inv_no = selected.get("invoice_number")

        if ConfirmDialog.ask(self, "Delete Invoice", f"Are you sure you want to delete Invoice #{inv_no}? This cannot be undone."):
            def do_del():
                return self.api.delete_invoice(inv_id)

            def on_ok(res):
                messagebox.showinfo("Deleted", f"Invoice #{inv_no} was successfully deleted.")
                self.load_invoices()

            AsyncWorker.run(self, do_del, on_success=on_ok)
