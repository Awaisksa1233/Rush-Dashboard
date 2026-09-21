"""
Tax Rates Reference View
"""
import tkinter as tk
import customtkinter as ctk
from typing import Dict, Any, List
from .theme import (
    COLOR_BG_DARK, COLOR_CARD_BG, COLOR_SECONDARY, COLOR_SECONDARY_HOVER,
    COLOR_TEXT_WHITE, COLOR_TEXT_MUTED, FONT_HEADING
)
from .components import ModernDataTable, AsyncWorker
from ..api.tax_rates import TaxRatesAPI

class TaxRatesView(ctk.CTkFrame):
    def __init__(self, master, client, **kwargs):
        super().__init__(master, fg_color=COLOR_BG_DARK, **kwargs)
        self.client = client
        self.api = TaxRatesAPI(client)

        self._build_ui()
        self.load_tax_rates()

    def _build_ui(self):
        self.grid_rowconfigure(1, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # Header
        top_bar = ctk.CTkFrame(self, fg_color=COLOR_CARD_BG, corner_radius=12)
        top_bar.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 15))
        top_bar.grid_columnconfigure(1, weight=1)

        title_lbl = ctk.CTkLabel(top_bar, text="Tax Rates & VAT Rules", font=FONT_HEADING, text_color=COLOR_TEXT_WHITE)
        title_lbl.grid(row=0, column=0, sticky="w", padx=20, pady=15)

        btn_refresh = ctk.CTkButton(top_bar, text="↻ Refresh", width=90, fg_color=COLOR_SECONDARY, hover_color=COLOR_SECONDARY_HOVER, command=self.load_tax_rates)
        btn_refresh.grid(row=0, column=2, padx=20, pady=15)

        # Table
        cols = [
            ("name", "Tax Rate Name", 240),
            ("percentage_display", "Rate %", 100),
            ("tax_type", "Type / Category", 180),
            ("description", "Description", 260),
            ("id", "Tax Rate ID", 220),
        ]
        self.table = ModernDataTable(self, columns=cols)
        self.table.grid(row=1, column=0, sticky="nsew", padx=20, pady=(0, 20))

    def load_tax_rates(self):
        def fetch():
            return self.api.list_tax_rates()

        def on_done(data):
            display_rows = []
            for t in data:
                rate = float(t.get("rate") or 0)
                display_rows.append({
                    "id": t.get("id"),
                    "name": t.get("name", ""),
                    "percentage_display": f"{rate * 100:.1f}%",
                    "tax_type": t.get("tax_type", "-"),
                    "description": t.get("description", "-"),
                })
            self.table.set_data(display_rows)

        AsyncWorker.run(self, fetch, on_success=on_done)
