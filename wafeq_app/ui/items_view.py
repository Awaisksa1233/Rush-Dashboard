"""
Items / Products Catalog View
"""
import tkinter as tk
from tkinter import messagebox
import customtkinter as ctk
from typing import Dict, Any, List, Optional
from .theme import (
    COLOR_BG_DARK, COLOR_CARD_BG, COLOR_BORDER, COLOR_INPUT_BG,
    COLOR_PRIMARY, COLOR_PRIMARY_HOVER, COLOR_SECONDARY, COLOR_SECONDARY_HOVER,
    COLOR_DANGER, COLOR_DANGER_HOVER, COLOR_TEXT_WHITE, COLOR_TEXT_MUTED,
    FONT_HEADING, FONT_SUBHEADING, FONT_BODY, FONT_BODY_BOLD, FONT_CAPTION
)
from .components import ModernDataTable, BaseDialog, ConfirmDialog, AsyncWorker
from ..api.items import ItemsAPI
from ..api.accounts import AccountsAPI
from ..api.tax_rates import TaxRatesAPI

class ItemFormDialog(BaseDialog):
    def __init__(self, parent, client, item: Optional[Dict[str, Any]] = None, on_saved=None):
        title = "Edit Item" if item else "New Item / Product"
        super().__init__(parent, title, width=640, height=580)
        self.client = client
        self.item = item
        self.on_saved = on_saved
        self.api = ItemsAPI(client)

        self.revenue_accounts: List[Dict[str, Any]] = []
        self.tax_rates: List[Dict[str, Any]] = []

        self._build_form()
        self._load_dependencies()

    def _build_form(self):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        scroll.grid(row=0, column=0, sticky="nsew", padx=20, pady=20)
        scroll.grid_columnconfigure(1, weight=1)

        row = 0
        def add_entry(label_text: str, default_val: str = "", placeholder: str = "") -> ctk.CTkEntry:
            nonlocal row
            lbl = ctk.CTkLabel(scroll, text=label_text, font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE, anchor="w")
            lbl.grid(row=row, column=0, sticky="w", padx=(0, 10), pady=8)
            entry = ctk.CTkEntry(scroll, placeholder_text=placeholder, fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
            entry.insert(0, default_val)
            entry.grid(row=row, column=1, sticky="ew", pady=8)
            row += 1
            return entry

        it = self.item or {}
        self.ent_name = add_entry("Item Name *", it.get("name", ""), "e.g. Premium Car Wash")
        self.ent_sku = add_entry("SKU / Code", it.get("sku", ""), "e.g. WASH-001")
        self.ent_desc = add_entry("Description", it.get("description", ""), "Full interior & exterior wash")
        self.ent_price = add_entry("Selling Price (SAR) *", str(it.get("unit_price") or ""), "0.00")
        self.ent_cost = add_entry("Cost Price (SAR)", str(it.get("unit_cost") or ""), "0.00")

        # Revenue Account dropdown
        lbl_acc = ctk.CTkLabel(scroll, text="Revenue Account", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE, anchor="w")
        lbl_acc.grid(row=row, column=0, sticky="w", padx=(0, 10), pady=8)
        self.cmb_account = ctk.CTkComboBox(scroll, values=["Loading accounts..."], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_account.grid(row=row, column=1, sticky="ew", pady=8)
        row += 1

        # Tax Rate dropdown
        lbl_tax = ctk.CTkLabel(scroll, text="VAT / Tax Rate", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE, anchor="w")
        lbl_tax.grid(row=row, column=0, sticky="w", padx=(0, 10), pady=8)
        self.cmb_tax = ctk.CTkComboBox(scroll, values=["Loading tax rates..."], fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
        self.cmb_tax.grid(row=row, column=1, sticky="ew", pady=8)
        row += 1

        # Active Checkbox
        self.chk_active = ctk.CTkCheckBox(scroll, text="Item is active", font=FONT_BODY, text_color=COLOR_TEXT_WHITE)
        self.chk_active.select() if it.get("is_active", True) else self.chk_active.deselect()
        self.chk_active.grid(row=row, column=1, sticky="w", pady=10)
        row += 1

        # Bottom Buttons
        btn_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, height=60)
        btn_frame.grid(row=1, column=0, sticky="ew")
        btn_frame.grid_columnconfigure(0, weight=1)

        btn_cancel = ctk.CTkButton(btn_frame, text="Cancel", width=100, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self.destroy)
        btn_cancel.pack(side="right", padx=(10, 20), pady=12)

        self.btn_save = ctk.CTkButton(btn_frame, text="Save Item", width=120, fg_color=COLOR_PRIMARY, hover_color=COLOR_PRIMARY_HOVER, command=self._save)
        self.btn_save.pack(side="right", pady=12)

    def _load_dependencies(self):
        def fetch():
            accs = AccountsAPI(self.client).get_revenue_accounts()
            taxes = TaxRatesAPI(self.client).list_tax_rates()
            return accs, taxes

        def on_done(res):
            accs, taxes = res
            self.revenue_accounts = accs
            self.tax_rates = taxes

            acc_names = [f"{a.get('name_en') or a.get('name_ar') or 'Account'} ({a.get('account_code', '')})" for a in accs]
            if not acc_names:
                acc_names = ["Default Sales Account"]
            self.cmb_account.configure(values=acc_names)
            
            # Select current or default account
            selected_acc = None
            if self.item and self.item.get("revenue_account"):
                target_id = self.item["revenue_account"]
                for i, a in enumerate(accs):
                    if a.get("id") == target_id:
                        selected_acc = acc_names[i]
                        break
            if not selected_acc and acc_names:
                selected_acc = acc_names[0]
            if selected_acc:
                self.cmb_account.set(selected_acc)

            # Tax rates
            tax_names = [f"{t.get('name')} ({float(t.get('rate', 0))*100:.0f}%)" for t in taxes]
            self.cmb_tax.configure(values=tax_names)
            
            # Default to 15% VAT on Sales
            default_tax = None
            for i, t in enumerate(taxes):
                if "vat on sales" in (t.get("name") or "").lower():
                    default_tax = tax_names[i]
                    break
            if not default_tax and tax_names:
                default_tax = tax_names[0]
            if default_tax:
                self.cmb_tax.set(default_tax)

        AsyncWorker.run(self, fetch, on_success=on_done)

    def _save(self):
        name = self.ent_name.get().strip()
        if not name:
            messagebox.showerror("Validation Error", "Item Name is required.", parent=self)
            return

        price_str = self.ent_price.get().strip() or "0"
        cost_str = self.ent_cost.get().strip() or "0"
        try:
            unit_price = float(price_str)
            unit_cost = float(cost_str)
        except ValueError:
            messagebox.showerror("Validation Error", "Price and Cost must be valid numbers.", parent=self)
            return

        # Selected account ID
        acc_idx = self.cmb_account.cget("values").index(self.cmb_account.get()) if self.cmb_account.get() in self.cmb_account.cget("values") else 0
        account_id = self.revenue_accounts[acc_idx]["id"] if acc_idx < len(self.revenue_accounts) else None

        # Selected tax rate ID
        tax_idx = self.cmb_tax.cget("values").index(self.cmb_tax.get()) if self.cmb_tax.get() in self.cmb_tax.cget("values") else 0
        tax_id = self.tax_rates[tax_idx]["id"] if tax_idx < len(self.tax_rates) else None

        payload = {
            "name": name,
            "sku": self.ent_sku.get().strip(),
            "description": self.ent_desc.get().strip(),
            "unit_price": unit_price,
            "unit_cost": unit_cost,
            "is_active": self.chk_active.get() == 1,
        }
        if account_id:
            payload["revenue_account"] = account_id
        if tax_id:
            payload["revenue_tax_rate"] = tax_id

        self.btn_save.configure(state="disabled", text="Saving...")

        def do_save():
            if self.item:
                return self.api.update_item(self.item["id"], payload)
            else:
                return self.api.create_item(payload)

        def on_ok(res):
            messagebox.showinfo("Success", f"Item '{name}' saved successfully!", parent=self)
            self.destroy()
            if self.on_saved:
                self.on_saved()

        def on_err(e):
            self.btn_save.configure(state="normal", text="Save Item")
            messagebox.showerror("Save Failed", str(e), parent=self)

        AsyncWorker.run(self, do_save, on_success=on_ok, on_error=on_err)


class ItemsView(ctk.CTkFrame):
    def __init__(self, master, client, **kwargs):
        super().__init__(master, fg_color=COLOR_BG_DARK, **kwargs)
        self.client = client
        self.api = ItemsAPI(client)
        self.items_list: List[Dict[str, Any]] = []

        self._build_ui()
        self.load_items()

    def _build_ui(self):
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Header
        top_bar = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=12)
        top_bar.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 15))
        top_bar.grid_columnconfigure(1, weight=1)

        title_lbl = ctk.CTkLabel(top_bar, text="Items & Products Catalog", font=FONT_HEADING, text_color=COLOR_TEXT_WHITE)
        title_lbl.grid(row=0, column=0, sticky="w", padx=20, pady=15)

        btn_add = ctk.CTkButton(top_bar, text="＋  Add Item", fg_color=COLOR_PRIMARY, hover_color=COLOR_PRIMARY_HOVER, command=self._open_new_dialog)
        btn_add.grid(row=0, column=2, padx=10, pady=15)

        btn_refresh = ctk.CTkButton(top_bar, text="↻ Refresh", width=90, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self.load_items)
        btn_refresh.grid(row=0, column=3, padx=(0, 20), pady=15)

        # Controls
        ctrl_bar = ctk.CTkFrame(self, fg_color="transparent")
        ctrl_bar.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 12))
        ctrl_bar.grid_columnconfigure(0, weight=1)

        self.ent_search = ctk.CTkEntry(ctrl_bar, placeholder_text="🔍  Search items by name, SKU, or description...", fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER, height=38)
        self.ent_search.grid(row=0, column=0, sticky="ew", padx=(0, 15))
        self.ent_search.bind("<KeyRelease>", self._handle_search)

        self.btn_edit = ctk.CTkButton(ctrl_bar, text="✏ Edit", width=90, height=38, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self._open_edit_dialog)
        self.btn_edit.grid(row=0, column=1, padx=(0, 10))

        self.btn_delete = ctk.CTkButton(ctrl_bar, text="🗑 Delete", width=90, height=38, fg_color=COLOR_DANGER, hover_color=COLOR_DANGER_HOVER, command=self._delete_selected)
        self.btn_delete.grid(row=0, column=2)

        # Table
        cols = [
            ("name", "Item Name", 200),
            ("sku", "SKU / Code", 120),
            ("unit_price", "Selling Price (SAR)", 140),
            ("unit_cost", "Cost Price (SAR)", 130),
            ("description", "Description", 240),
            ("is_active_display", "Status", 90),
        ]
        self.table = ModernDataTable(self, columns=cols, on_double_click=lambda item: self._open_edit_dialog())
        self.table.grid(row=2, column=0, sticky="nsew", padx=20, pady=(0, 20))

    def load_items(self):
        def fetch():
            return self.api.list_items()

        def on_done(data):
            self.items_list = data
            display_rows = []
            for it in data:
                display_rows.append({
                    "id": it.get("id"),
                    "name": it.get("name", ""),
                    "sku": it.get("sku", "-"),
                    "unit_price": float(it.get("unit_price") or 0),
                    "unit_cost": float(it.get("unit_cost") or 0),
                    "description": it.get("description", "-"),
                    "is_active_display": "Active" if it.get("is_active", True) else "Inactive",
                    "_raw": it
                })
            self.table.set_data(display_rows)

        AsyncWorker.run(self, fetch, on_success=on_done)

    def _handle_search(self, event=None):
        q = self.ent_search.get()
        self.table.filter_data(q, ["name", "sku", "description"])

    def _open_new_dialog(self):
        ItemFormDialog(self, self.client, on_saved=self.load_items)

    def _open_edit_dialog(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Item", "Please select an item from the table to edit.")
            return
        ItemFormDialog(self, self.client, item=selected.get("_raw"), on_saved=self.load_items)

    def _delete_selected(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Item", "Please select an item to delete.")
            return
        
        name = selected.get("name")
        iid = selected.get("id")
        if ConfirmDialog.ask(self, "Delete Item", f"Are you sure you want to delete '{name}'?"):
            def do_del():
                return self.api.delete_item(iid)

            def on_ok(res):
                messagebox.showinfo("Deleted", f"Item '{name}' was deleted.")
                self.load_items()

            AsyncWorker.run(self, do_del, on_success=on_ok)
