"""
Contacts Management View — Customer and Supplier Management
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
from ..api.contacts import ContactsAPI

class ContactFormDialog(BaseDialog):
    def __init__(self, parent, client, contact: Optional[Dict[str, Any]] = None, on_saved=None):
        title = "Edit Contact" if contact else "New Contact"
        super().__init__(parent, title, width=650, height=620)
        self.client = client
        self.contact = contact
        self.on_saved = on_saved
        self.api = ContactsAPI(client)

        self._build_form()

    def _build_form(self):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        scroll.grid(row=0, column=0, sticky="nsew", padx=20, pady=20)
        scroll.grid_columnconfigure(1, weight=1)

        row = 0
        def add_field(label_text: str, default_val: str = "", placeholder: str = "") -> ctk.CTkEntry:
            nonlocal row
            lbl = ctk.CTkLabel(scroll, text=label_text, font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE, anchor="w")
            lbl.grid(row=row, column=0, sticky="w", padx=(0, 10), pady=8)
            entry = ctk.CTkEntry(scroll, placeholder_text=placeholder, fg_color=COLOR_INPUT_BG, border_color=COLOR_BORDER)
            entry.insert(0, default_val)
            entry.grid(row=row, column=1, sticky="ew", pady=8)
            row += 1
            return entry

        c = self.contact or {}
        
        self.ent_name = add_field("Contact / Company Name *", c.get("name", ""), "e.g. Al-Amal Trading Corp")
        
        # Relationship
        lbl_rel = ctk.CTkLabel(scroll, text="Relationship *", font=FONT_BODY_BOLD, text_color=COLOR_TEXT_WHITE, anchor="w")
        lbl_rel.grid(row=row, column=0, sticky="w", padx=(0, 10), pady=8)
        current_rel = (c.get("relationship") or ["Customer"])[0] if c.get("relationship") else "Customer"
        self.cmb_relationship = ctk.CTkComboBox(
            scroll,
            values=["Customer", "Supplier", "Partner", "Other"],
            fg_color=COLOR_INPUT_BG,
            border_color=COLOR_BORDER
        )
        self.cmb_relationship.set(current_rel)
        self.cmb_relationship.grid(row=row, column=1, sticky="ew", pady=8)
        row += 1

        self.ent_phone = add_field("Phone Number", c.get("phone", ""), "+966501234567")
        self.ent_email = add_field("Email Address", c.get("email", ""), "info@example.com")
        self.ent_city = add_field("City", c.get("city", ""), "Riyadh")
        self.ent_district = add_field("District", c.get("district", ""), "Al-Olaya")
        self.ent_building = add_field("Building Number", c.get("building_number", ""), "4-digit number (e.g. 1234)")
        self.ent_postal = add_field("Postal Code", c.get("postal_code", ""), "5-digit KSA code (e.g. 12211)")
        self.ent_address = add_field("Street Address", c.get("address", ""), "King Fahd Road")
        self.ent_tax_number = add_field("Tax Registration (VAT)", c.get("tax_registration_number", ""), "15-digit VAT number")

        # Bottom Buttons
        btn_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, height=60)
        btn_frame.grid(row=1, column=0, sticky="ew")
        btn_frame.grid_columnconfigure(0, weight=1)

        btn_cancel = ctk.CTkButton(
            btn_frame,
            text="Cancel",
            width=100,
            fg_color=COLOR_SECONDARY,
            hover_color=COLOR_SECONDARY_HOVER,
            command=self.destroy
        )
        btn_cancel.pack(side="right", padx=(10, 20), pady=12)

        self.btn_save = ctk.CTkButton(
            btn_frame,
            text="Save Contact",
            width=120,
            fg_color=COLOR_PRIMARY,
            hover_color=COLOR_PRIMARY_HOVER,
            command=self._save
        )
        self.btn_save.pack(side="right", pady=12)

    def _save(self):
        name = self.ent_name.get().strip()
        if not name:
            messagebox.showerror("Validation Error", "Contact Name is required.", parent=self)
            return

        payload = {
            "name": name,
            "relationship": [self.cmb_relationship.get()],
            "phone": self.ent_phone.get().strip(),
            "email": self.ent_email.get().strip(),
            "country": "SA",
            "city": self.ent_city.get().strip(),
            "district": self.ent_district.get().strip(),
            "building_number": self.ent_building.get().strip(),
            "postal_code": self.ent_postal.get().strip(),
            "address": self.ent_address.get().strip(),
            "tax_registration_number": self.ent_tax_number.get().strip(),
        }

        self.btn_save.configure(state="disabled", text="Saving...")

        def do_save():
            if self.contact:
                return self.api.update_contact(self.contact["id"], payload)
            else:
                return self.api.create_contact(payload)

        def on_success(res):
            messagebox.showinfo("Success", f"Contact '{name}' saved successfully!", parent=self)
            self.destroy()
            if self.on_saved:
                self.on_saved()

        def on_error(e):
            self.btn_save.configure(state="normal", text="Save Contact")
            messagebox.showerror("Save Failed", str(e), parent=self)

        AsyncWorker.run(self, do_save, on_success=on_success, on_error=on_error)


class ContactsView(ctk.CTkFrame):
    def __init__(self, master, client, **kwargs):
        super().__init__(master, fg_color=COLOR_BG_DARK, **kwargs)
        self.client = client
        self.api = ContactsAPI(client)
        self.contacts_list: List[Dict[str, Any]] = []

        self._build_ui()
        self.load_contacts()

    def _build_ui(self):
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Top Bar
        top_bar = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=12)
        top_bar.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 15))
        top_bar.grid_columnconfigure(1, weight=1)

        title_lbl = ctk.CTkLabel(top_bar, text="Contacts & Customers", font=FONT_HEADING, text_color=COLOR_TEXT_WHITE)
        title_lbl.grid(row=0, column=0, sticky="w", padx=20, pady=15)

        btn_add = ctk.CTkButton(
            top_bar,
            text="＋  Add Contact",
            fg_color=COLOR_PRIMARY,
            hover_color=COLOR_PRIMARY_HOVER,
            command=self._open_new_dialog
        )
        btn_add.grid(row=0, column=2, padx=10, pady=15)

        btn_refresh = ctk.CTkButton(
            top_bar,
            text="↻ Refresh",
            width=90,
            fg_color=COLOR_SECONDARY,
            hover_color=COLOR_SECONDARY_HOVER,
            command=self.load_contacts
        )
        btn_refresh.grid(row=0, column=3, padx=(0, 20), pady=15)

        # Search Bar and Action Buttons
        ctrl_bar = ctk.CTkFrame(self, fg_color="transparent")
        ctrl_bar.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 12))
        ctrl_bar.grid_columnconfigure(0, weight=1)

        self.ent_search = ctk.CTkEntry(
            ctrl_bar,
            placeholder_text="🔍  Search contacts by name, email, phone, or VAT...",
            fg_color=COLOR_INPUT_BG,
            border_color=COLOR_BORDER,
            height=38
        )
        self.ent_search.grid(row=0, column=0, sticky="ew", padx=(0, 15))
        self.ent_search.bind("<KeyRelease>", self._handle_search)

        self.btn_edit = ctk.CTkButton(
            ctrl_bar,
            text="✏ Edit",
            width=90,
            height=38,
            fg_color=COLOR_SECONDARY,
            hover_color=COLOR_SECONDARY_HOVER,
            command=self._open_edit_dialog
        )
        self.btn_edit.grid(row=0, column=1, padx=(0, 10))

        self.btn_delete = ctk.CTkButton(
            ctrl_bar,
            text="🗑 Delete",
            width=90,
            height=38,
            fg_color=COLOR_DANGER,
            hover_color=COLOR_DANGER_HOVER,
            command=self._delete_selected
        )
        self.btn_delete.grid(row=0, column=2)

        # Table
        cols = [
            ("name", "Name", 180),
            ("relationship_display", "Relationship", 110),
            ("phone", "Phone", 130),
            ("email", "Email", 170),
            ("city", "City", 120),
            ("tax_registration_number", "VAT Number", 150),
        ]
        self.table = ModernDataTable(
            self,
            columns=cols,
            on_double_click=lambda item: self._open_edit_dialog()
        )
        self.table.grid(row=2, column=0, sticky="nsew", padx=20, pady=(0, 20))

    def load_contacts(self):
        def fetch():
            return self.api.list_contacts()

        def on_done(data):
            self.contacts_list = data
            display_rows = []
            for c in data:
                rels = c.get("relationship", [])
                rel_str = ", ".join(rels) if isinstance(rels, list) else str(rels)
                display_rows.append({
                    "id": c.get("id"),
                    "name": c.get("name", ""),
                    "relationship_display": rel_str or "Customer",
                    "phone": c.get("phone", ""),
                    "email": c.get("email", ""),
                    "city": c.get("city", ""),
                    "tax_registration_number": c.get("tax_registration_number", ""),
                    "_raw": c
                })
            self.table.set_data(display_rows)

        AsyncWorker.run(self, fetch, on_success=on_done)

    def _handle_search(self, event=None):
        q = self.ent_search.get()
        self.table.filter_data(q, ["name", "phone", "email", "city", "tax_registration_number"])

    def _open_new_dialog(self):
        ContactFormDialog(self, self.client, on_saved=self.load_contacts)

    def _open_edit_dialog(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Contact", "Please select a contact from the table to edit.")
            return
        ContactFormDialog(self, self.client, contact=selected.get("_raw"), on_saved=self.load_contacts)

    def _delete_selected(self):
        selected = self.table.get_selected()
        if not selected:
            messagebox.showwarning("Select Contact", "Please select a contact to delete.")
            return
        
        name = selected.get("name")
        cid = selected.get("id")
        if ConfirmDialog.ask(self, "Delete Contact", f"Are you sure you want to delete '{name}'?"):
            def do_del():
                return self.api.delete_contact(cid)

            def on_ok(res):
                messagebox.showinfo("Deleted", f"Contact '{name}' was deleted.")
                self.load_contacts()

            AsyncWorker.run(self, do_del, on_success=on_ok)
