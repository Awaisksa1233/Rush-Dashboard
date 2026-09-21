"""
Dashboard View — Overview and summary metrics
"""
import tkinter as tk
from tkinter import messagebox
import customtkinter as ctk
from typing import Callable, Optional, Dict, Any, List
from .theme import (
    COLOR_BG_DARK, COLOR_CARD_BG, COLOR_CARD_HOVER, COLOR_BORDER,
    COLOR_PRIMARY, COLOR_PRIMARY_HOVER, COLOR_SECONDARY, COLOR_SECONDARY_HOVER,
    COLOR_SUCCESS, COLOR_INFO, COLOR_WARNING, COLOR_TEXT_WHITE, COLOR_TEXT_MUTED,
    FONT_HEADING, FONT_SUBHEADING, FONT_BODY, FONT_BODY_BOLD, FONT_CAPTION
)
from .components import ModernDataTable, AsyncWorker

class DashboardView(ctk.CTkFrame):
    def __init__(self, master, client, nav_callback: Callable[[str], None], **kwargs):
        super().__init__(master, fg_color=COLOR_BG_DARK, **kwargs)
        self.client = client
        self.nav_callback = nav_callback

        self.org_data: Dict[str, Any] = {}
        self.invoices: List[Dict[str, Any]] = []
        self.contacts: List[Dict[str, Any]] = []
        self.items: List[Dict[str, Any]] = []

        self._build_ui()
        self.refresh()

    def _build_ui(self):
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # 1. Header Banner
        header_frame = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=12)
        header_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 15))
        header_frame.grid_columnconfigure(0, weight=1)

        self.lbl_org_name = ctk.CTkLabel(
            header_frame,
            text="Wafeq Accounting Dashboard",
            font=("Segoe UI", 20, "bold"),
            text_color=COLOR_TEXT_WHITE,
            anchor="w"
        )
        self.lbl_org_name.grid(row=0, column=0, sticky="w", padx=20, pady=(15, 2))

        self.lbl_org_sub = ctk.CTkLabel(
            header_frame,
            text="Connected to Wafeq Public API • Saudi Arabia (SAR) • ZATCA Phase 2 Enabled",
            font=FONT_CAPTION,
            text_color=COLOR_TEXT_MUTED,
            anchor="w"
        )
        self.lbl_org_sub.grid(row=1, column=0, sticky="w", padx=20, pady=(0, 15))

        btn_refresh = ctk.CTkButton(
            header_frame,
            text="↻ Refresh",
            width=100,
            height=34,
            fg_color=COLOR_SECONDARY,
            hover_color=COLOR_SECONDARY_HOVER,
            command=self.refresh
        )
        btn_refresh.grid(row=0, column=1, rowspan=2, padx=20, pady=15)

        # 2. Metric Stat Cards
        stats_frame = ctk.CTkFrame(self, fg_color="transparent")
        stats_frame.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 15))
        stats_frame.grid_columnconfigure((0, 1, 2, 3), weight=1, uniform="stats")

        self.card_invoices = self._create_stat_card(stats_frame, 0, "TOTAL INVOICES", "0", "0.00 SAR", COLOR_PRIMARY)
        self.card_zatca = self._create_stat_card(stats_frame, 1, "ZATCA COMPLIANCE", "0 Reported", "Simplified B2C", COLOR_INFO)
        self.card_contacts = self._create_stat_card(stats_frame, 2, "CONTACTS / CUSTOMERS", "0", "Registered", COLOR_WARNING)
        self.card_items = self._create_stat_card(stats_frame, 3, "PRODUCTS / ITEMS", "0", "Catalog items", COLOR_SUCCESS)

        # 3. Main Body: Left (Recent Invoices) & Right (Quick Actions)
        body_frame = ctk.CTkFrame(self, fg_color="transparent")
        body_frame.grid(row=2, column=0, sticky="nsew", padx=20, pady=(0, 20))
        body_frame.grid_rowconfigure(0, weight=1)
        body_frame.grid_columnconfigure(0, weight=3)
        body_frame.grid_columnconfigure(1, weight=1)

        # Recent Invoices Section
        table_container = ctk.CTkFrame(body_frame, fg_color=COLOR_CARD_BG, corner_radius=12)
        table_container.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        table_container.grid_rowconfigure(1, weight=1)
        table_container.grid_columnconfigure(0, weight=1)

        tbl_header = ctk.CTkLabel(
            table_container,
            text="Recent Simplified Invoices",
            font=FONT_SUBHEADING,
            text_color=COLOR_TEXT_WHITE,
            anchor="w"
        )
        tbl_header.grid(row=0, column=0, sticky="w", padx=16, pady=12)

        cols = [
            ("invoice_number", "Invoice #", 120),
            ("invoice_date", "Date", 100),
            ("contact_name", "Customer", 160),
            ("amount", "Amount (SAR)", 120),
            ("status", "Status", 100),
            ("zatca_status", "ZATCA Status", 130),
        ]
        self.recent_table = ModernDataTable(
            table_container,
            columns=cols,
            on_double_click=lambda item: self.nav_callback("invoices")
        )
        self.recent_table.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 12))

        # Quick Actions Section
        actions_panel = ctk.CTkFrame(body_frame, fg_color=COLOR_CARD_BG, corner_radius=12)
        actions_panel.grid(row=0, column=1, sticky="nsew", padx=(10, 0))
        actions_panel.grid_columnconfigure(0, weight=1)

        actions_title = ctk.CTkLabel(
            actions_panel,
            text="Quick Actions",
            font=FONT_SUBHEADING,
            text_color=COLOR_TEXT_WHITE,
            anchor="w"
        )
        actions_title.grid(row=0, column=0, sticky="w", padx=16, pady=12)

        btn_sync = ctk.CTkButton(
            actions_panel,
            text="⚡  Sync Today's Data",
            height=42,
            font=FONT_BODY_BOLD,
            fg_color="#0284c7",
            hover_color="#0369a1",
            command=self._trigger_sync
        )
        btn_sync.grid(row=1, column=0, sticky="ew", padx=16, pady=(10, 6))

        btn_new_inv = ctk.CTkButton(
            actions_panel,
            text="＋  New Simplified Invoice",
            height=38,
            font=FONT_BODY,
            fg_color=COLOR_PRIMARY,
            hover_color=COLOR_PRIMARY_HOVER,
            command=lambda: self.nav_callback("new_invoice")
        )
        btn_new_inv.grid(row=2, column=0, sticky="ew", padx=16, pady=6)

        btn_new_cn = ctk.CTkButton(
            actions_panel,
            text="↺  New Credit Note",
            height=38,
            font=FONT_BODY,
            fg_color="#334155",
            hover_color="#475569",
            command=lambda: self.nav_callback("credit_notes")
        )
        btn_new_cn.grid(row=3, column=0, sticky="ew", padx=16, pady=6)

        btn_new_cust = ctk.CTkButton(
            actions_panel,
            text="👤  Add New Contact",
            height=38,
            font=FONT_BODY,
            fg_color="#334155",
            hover_color="#475569",
            command=lambda: self.nav_callback("contacts")
        )
        btn_new_cust.grid(row=4, column=0, sticky="ew", padx=16, pady=6)

        btn_new_item = ctk.CTkButton(
            actions_panel,
            text="📦  Add New Item",
            height=38,
            font=FONT_BODY,
            fg_color="#334155",
            hover_color="#475569",
            command=lambda: self.nav_callback("items")
        )
        btn_new_item.grid(row=5, column=0, sticky="ew", padx=16, pady=6)

        # Quick Tip
        tip_frame = ctk.CTkFrame(actions_panel, fg_color="#121820", corner_radius=8)
        tip_frame.grid(row=6, column=0, sticky="ew", padx=16, pady=20)
        tip_lbl = ctk.CTkLabel(
            tip_frame,
            text="💡 Tip:\nSimplified invoices in Saudi Arabia require ZATCA reporting within 24 hours of issuance.",
            font=FONT_CAPTION,
            text_color=COLOR_TEXT_MUTED,
            justify="left",
            wraplength=200
        )
        tip_lbl.pack(padx=12, pady=12)

    def _create_stat_card(self, parent, col: int, title: str, main_val: str, sub_val: str, accent_color: str):
        card = ctk.CTkFrame(parent, fg_color=COLOR_CARD_BG, corner_radius=10, border_width=1, border_color=COLOR_BORDER)
        card.grid(row=0, column=col, sticky="ew", padx=6)
        card.grid_columnconfigure(0, weight=1)

        t_lbl = ctk.CTkLabel(card, text=title, font=FONT_CAPTION, text_color=COLOR_TEXT_MUTED, anchor="w")
        t_lbl.grid(row=0, column=0, sticky="w", padx=14, pady=(12, 0))

        v_lbl = ctk.CTkLabel(card, text=main_val, font=("Segoe UI", 20, "bold"), text_color=COLOR_TEXT_WHITE, anchor="w")
        v_lbl.grid(row=1, column=0, sticky="w", padx=14, pady=(2, 0))

        s_lbl = ctk.CTkLabel(card, text=sub_val, font=FONT_CAPTION, text_color=accent_color, anchor="w")
        s_lbl.grid(row=2, column=0, sticky="w", padx=14, pady=(0, 12))

        return {"main": v_lbl, "sub": s_lbl}

    def refresh(self):
        """Load data from API asynchronously"""
        from ..api.organization import OrganizationAPI
        from ..api.invoices import InvoicesAPI
        from ..api.contacts import ContactsAPI
        from ..api.items import ItemsAPI

        def fetch_data():
            org = OrganizationAPI(self.client).get_organization()
            invs = InvoicesAPI(self.client).list_invoices()
            conts = ContactsAPI(self.client).list_contacts()
            itms = ItemsAPI(self.client).list_items()
            return {"org": org, "invoices": invs, "contacts": conts, "items": itms}

        def on_done(data):
            self.org_data = data["org"]
            self.invoices = data["invoices"]
            self.contacts = data["contacts"]
            self.items = data["items"]

            # Update Org Header
            org_name = ""
            name_field = self.org_data.get("name") or self.org_data.get("legal_name") or {}
            if isinstance(name_field, dict):
                org_name = name_field.get("en") or name_field.get("ar") or ""
            elif isinstance(name_field, str):
                org_name = name_field
            if not org_name:
                org_name = "Wafeq Organization"
            self.lbl_org_name.configure(text=f"Welcome, {org_name}")

            # Calculate metrics
            total_inv_count = len(self.invoices)
            total_inv_vol = sum(float(i.get("amount") or 0) for i in self.invoices)
            
            zatca_reported = 0
            for i in self.invoices:
                tax_auth = i.get("tax_authority") or {}
                if tax_auth.get("status") in ["REPORTED", "PASS", "CLEARED"]:
                    zatca_reported += 1

            self.card_invoices["main"].configure(text=str(total_inv_count))
            self.card_invoices["sub"].configure(text=f"{total_inv_vol:,.2f} SAR Total")

            self.card_zatca["main"].configure(text=f"{zatca_reported} / {total_inv_count}")
            zatca_pct = (zatca_reported / total_inv_count * 100) if total_inv_count > 0 else 100
            self.card_zatca["sub"].configure(text=f"{zatca_pct:.0f}% Compliant")

            self.card_contacts["main"].configure(text=str(len(self.contacts)))
            self.card_items["main"].configure(text=str(len(self.items)))

            # Populate recent table (last 10)
            contacts_map = {c.get("id"): c.get("name", "") for c in self.contacts}
            table_rows = []
            for inv in self.invoices[:10]:
                cid = inv.get("contact")
                cname = contacts_map.get(cid, "-") if cid else "Walk-in Customer"
                
                # ZATCA status display
                tax_meta = inv.get("tax_authority") or {}
                z_st = tax_meta.get("status") or "NOT_REPORTED"
                
                table_rows.append({
                    "id": inv.get("id"),
                    "invoice_number": inv.get("invoice_number") or inv.get("id", "")[:12],
                    "invoice_date": inv.get("invoice_date", ""),
                    "contact_name": cname,
                    "amount": float(inv.get("amount") or 0),
                    "status": inv.get("status", "DRAFT"),
                    "zatca_status": z_st
                })

            self.recent_table.set_data(table_rows)

        AsyncWorker.run(self, fetch_data, on_success=on_done)

    def _trigger_sync(self):
        """Run today's order sync directly from the dashboard"""
        from wafeq_app.sync_engine import WafeqSyncEngine

        if not messagebox.askyesno("Sync Today's Data", "Synchronize today's sales orders with Wafeq accounting?"):
            return

        def do_sync():
            engine = WafeqSyncEngine(client=self.client)
            return engine.sync_today()

        def on_done(res):
            msg = (
                f"Sync Completed!\n\n"
                f"• Orders Examined: {res['total_orders']}\n"
                f"• Invoices Created: {res['synced']}\n"
                f"• Already Synced: {res['skipped']}\n"
                f"• Errors: {res['errors']}\n"
                f"• Revenue Synced: {res['synced_amount_sar']:,.2f} SAR"
            )
            messagebox.showinfo("Sync Results", msg)
            self.refresh()

        AsyncWorker.run(self, do_sync, on_success=on_done)
