"""
Main Application Window & Navigation
"""
import sys
import os

# Ensure project root is in sys.path regardless of how or where script is executed
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_APP_ROOT = os.path.dirname(_CURRENT_DIR)
_REPO_ROOT = os.path.dirname(_APP_ROOT)
for p in [_REPO_ROOT, _APP_ROOT, _CURRENT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

import tkinter as tk
import customtkinter as ctk
from typing import Dict, Any, Optional

try:
    from .theme import (
        apply_app_theme, COLOR_BG_DARK, COLOR_SIDEBAR_BG, COLOR_CARD_BG, COLOR_BORDER,
        COLOR_PRIMARY, COLOR_PRIMARY_HOVER, COLOR_SECONDARY, COLOR_SUCCESS, COLOR_TEXT_WHITE,
        COLOR_TEXT_MUTED, FONT_HEADING, FONT_SUBHEADING, FONT_BODY, FONT_BODY_BOLD, FONT_CAPTION
    )
    from .dashboard import DashboardView
    from .invoices_view import InvoicesView
    from .credit_notes_view import CreditNotesView
    from .contacts_view import ContactsView
    from .items_view import ItemsView
    from .tax_rates_view import TaxRatesView
    from ..config import API_KEY, BASE_URL, APP_TITLE, APP_VERSION, WINDOW_SIZE, MIN_WINDOW_SIZE
    from ..api.client import WafeqClient
except (ImportError, ValueError):
    from wafeq_app.ui.theme import (
        apply_app_theme, COLOR_BG_DARK, COLOR_SIDEBAR_BG, COLOR_CARD_BG, COLOR_BORDER,
        COLOR_PRIMARY, COLOR_PRIMARY_HOVER, COLOR_SECONDARY, COLOR_SUCCESS, COLOR_TEXT_WHITE,
        COLOR_TEXT_MUTED, FONT_HEADING, FONT_SUBHEADING, FONT_BODY, FONT_BODY_BOLD, FONT_CAPTION
    )
    from wafeq_app.ui.dashboard import DashboardView
    from wafeq_app.ui.invoices_view import InvoicesView
    from wafeq_app.ui.credit_notes_view import CreditNotesView
    from wafeq_app.ui.contacts_view import ContactsView
    from wafeq_app.ui.items_view import ItemsView
    from wafeq_app.ui.tax_rates_view import TaxRatesView
    from wafeq_app.config import API_KEY, BASE_URL, APP_TITLE, APP_VERSION, WINDOW_SIZE, MIN_WINDOW_SIZE
    from wafeq_app.api.client import WafeqClient

class WafeqApp(ctk.CTk):
    def __init__(self, client: Optional[WafeqClient] = None):
        super().__init__()
        if client is None:
            client = WafeqClient(api_key=API_KEY, base_url=BASE_URL)
        self.client = client

        # Window settings
        self.title(f"{APP_TITLE} v{APP_VERSION}")
        self.geometry(WINDOW_SIZE)
        self.minsize(*MIN_WINDOW_SIZE)
        self.configure(fg_color=COLOR_BG_DARK)

        apply_app_theme()

        self.current_view_name = ""
        self.views: Dict[str, ctk.CTkFrame] = {}
        self.sidebar_buttons: Dict[str, ctk.CTkButton] = {}

        self._build_layout()
        self.navigate_to("dashboard")

    def _build_layout(self):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=0) # Sidebar
        self.grid_columnconfigure(1, weight=1) # Main View Container

        # 1. Sidebar Navigation
        sidebar = ctk.CTkFrame(self, fg_color=COLOR_SIDEBAR_BG, width=220, corner_radius=0)
        sidebar.grid(row=0, column=0, sticky="nsew")
        sidebar.grid_rowconfigure(8, weight=1) # spacer
        sidebar.grid_columnconfigure(0, weight=1)

        # Brand / App Title
        brand_frame = ctk.CTkFrame(sidebar, fg_color="transparent")
        brand_frame.grid(row=0, column=0, sticky="ew", padx=16, pady=(20, 25))

        lbl_logo = ctk.CTkLabel(
            brand_frame,
            text="WAFEQ",
            font=("Segoe UI", 20, "bold"),
            text_color=COLOR_PRIMARY
        )
        lbl_logo.pack(anchor="w")

        lbl_subtitle = ctk.CTkLabel(
            brand_frame,
            text="Desktop Manager",
            font=FONT_CAPTION,
            text_color=COLOR_TEXT_MUTED
        )
        lbl_subtitle.pack(anchor="w")

        # Nav Buttons
        nav_items = [
            ("dashboard", "📊  Dashboard"),
            ("invoices", "📄  Invoices (B2C)"),
            ("credit_notes", "↺   Credit Notes"),
            ("contacts", "👥  Contacts"),
            ("items", "📦  Products / Items"),
            ("tax_rates", "🏷  Tax Rates"),
        ]

        for idx, (view_id, label) in enumerate(nav_items, start=1):
            btn = ctk.CTkButton(
                sidebar,
                text=label,
                height=42,
                font=FONT_BODY_BOLD,
                fg_color="transparent",
                text_color=COLOR_TEXT_MUTED,
                hover_color=COLOR_CARD_BG,
                anchor="w",
                command=lambda v=view_id: self.navigate_to(v)
            )
            btn.grid(row=idx, column=0, sticky="ew", padx=12, pady=4)
            self.sidebar_buttons[view_id] = btn

        # Bottom Connection Status Card
        status_card = ctk.CTkFrame(sidebar, fg_color=COLOR_CARD_BG, corner_radius=8)
        status_card.grid(row=9, column=0, sticky="ew", padx=12, pady=16)

        dot_lbl = ctk.CTkLabel(
            status_card,
            text="● Connected",
            font=FONT_CAPTION,
            text_color=COLOR_SUCCESS
        )
        dot_lbl.pack(anchor="w", padx=10, pady=(8, 2))

        api_lbl = ctk.CTkLabel(
            status_card,
            text="Wafeq API v1 • SAR",
            font=("Segoe UI", 9),
            text_color=COLOR_TEXT_MUTED
        )
        api_lbl.pack(anchor="w", padx=10, pady=(0, 8))

        # 2. Main Container
        self.main_container = ctk.CTkFrame(self, fg_color=COLOR_BG_DARK, corner_radius=0)
        self.main_container.grid(row=0, column=1, sticky="nsew")
        self.main_container.grid_rowconfigure(0, weight=1)
        self.main_container.grid_columnconfigure(0, weight=1)

    def navigate_to(self, view_name: str):
        if view_name == "new_invoice":
            self.navigate_to("invoices")
            inv_view: InvoicesView = self.views.get("invoices")
            if inv_view:
                self.after(200, inv_view.open_new_invoice_dialog)
            return

        # Update button styles
        for v_id, btn in self.sidebar_buttons.items():
            if v_id == view_name:
                btn.configure(fg_color=COLOR_PRIMARY, text_color=COLOR_TEXT_WHITE)
            else:
                btn.configure(fg_color="transparent", text_color=COLOR_TEXT_MUTED)

        # Hide current view
        if self.current_view_name and self.current_view_name in self.views:
            self.views[self.current_view_name].grid_forget()

        # Instantiate or show target view
        if view_name not in self.views:
            if view_name == "dashboard":
                self.views[view_name] = DashboardView(self.main_container, self.client, nav_callback=self.navigate_to)
            elif view_name == "invoices":
                self.views[view_name] = InvoicesView(self.main_container, self.client)
            elif view_name == "credit_notes":
                self.views[view_name] = CreditNotesView(self.main_container, self.client)
            elif view_name == "contacts":
                self.views[view_name] = ContactsView(self.main_container, self.client)
            elif view_name == "items":
                self.views[view_name] = ItemsView(self.main_container, self.client)
            elif view_name == "tax_rates":
                self.views[view_name] = TaxRatesView(self.main_container, self.client)

        view = self.views[view_name]
        view.grid(row=0, column=0, sticky="nsew")
        self.current_view_name = view_name

if __name__ == "__main__":
    app = WafeqApp()
    app.mainloop()
