"""
views/retention_churn_view.py - Sections 4 & 5: Value & Retention Analytics and Churn Analytics
"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import customtkinter as ctk
import csv


class RetentionChurnView(ctk.CTkFrame):
    """
    Implements:
    - Section 4: Value & Retention Analytics (LTV, Avg Subscription Life, Prior Period Growth %)
    - Section 5: Churn Analytics (Active Base Month Start, Voluntary Churn, Involuntary Churn, Total Churn Rate)
    - Interactive table of churned customer accounts and cancellation reasons
    """

    def __init__(self, parent, db_manager):
        super().__init__(parent, fg_color="transparent")
        self.db = db_manager
        self.raw_churn_list = []
        self.current_data = {}
        self.setup_ui()

    def setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        # 1. Section 4: Value & Retention Metrics Row (4 Cards)
        self.row1_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.row1_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 4))
        for col in range(4):
            self.row1_frame.grid_columnconfigure(col, weight=1)

        self.card_ltv = self._create_card(
            self.row1_frame, 0, "CUSTOMER LIFETIME VALUE (LTV)", "-- SAR",
            "Avg Price × (Lifespan ÷ 30)", accent_color="#38bdf8", badge="LTV Formula"
        )
        self.card_lifespan = self._create_card(
            self.row1_frame, 1, "AVERAGE SUBSCRIPTION LIFE", "-- Days",
            "-- months average tenure", accent_color="#10b981", badge="Retention"
        )
        self.card_growth = self._create_card(
            self.row1_frame, 2, "PRIOR PERIOD GROWTH", "--%",
            "vs prior equal window", accent_color="#f59e0b", badge="Velocity"
        )
        self.card_active_base = self._create_card(
            self.row1_frame, 3, "ACTIVE BASE (MONTH START)", "--",
            "Starting pool on 1st of month", accent_color="#8b5cf6", badge="Base Pool"
        )

        # 2. Section 5: Churn Analytics Row (3 Cards)
        self.row2_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.row2_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 8))
        for col in range(3):
            self.row2_frame.grid_columnconfigure(col, weight=1)

        self.card_vol_churn = self._create_card(
            self.row2_frame, 0, "VOLUNTARY CHURN", "--%",
            "-- intentional cancellations", accent_color="#f97316", badge="Customer Opt-out"
        )
        self.card_invol_churn = self._create_card(
            self.row2_frame, 1, "INVOLUNTARY CHURN", "--%",
            "-- card/payment lapses", accent_color="#ef4444", badge="Billing Failures"
        )
        self.card_total_churn = self._create_card(
            self.row2_frame, 2, "TOTAL CHURN RATE", "--%",
            "Overall subscriber loss rate", accent_color="#ec4899", badge="Net Attrition"
        )

        # 3. Controls & Filter Bar
        self.filter_bar = ctk.CTkFrame(self, fg_color=("gray90", "#1e293b"), corner_radius=10)
        self.filter_bar.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 8))

        ctk.CTkLabel(
            self.filter_bar, text="📉 Voluntary Churn Customer Log & Exit Feedback",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=("gray10", "gray95")
        ).pack(side="left", padx=14, pady=10)

        self.search_var = tk.StringVar()
        self.search_entry = ctk.CTkEntry(
            self.filter_bar, placeholder_text="🔍 Search churned members, reasons...",
            width=260, height=32, textvariable=self.search_var
        )
        self.search_entry.pack(side="right", padx=12, pady=8)
        self.search_entry.bind("<KeyRelease>", lambda e: self._filter_table())

        self.btn_export = ctk.CTkButton(
            self.filter_bar, text="📥 Export CSV", width=105, height=32,
            fg_color="#334155", hover_color="#475569",
            command=self._export_csv
        )
        self.btn_export.pack(side="right", padx=(0, 6), pady=8)

        # 4. Interactive Churn Log Table
        self.table_card = ctk.CTkFrame(self, fg_color=("gray90", "#1e293b"), corner_radius=10)
        self.table_card.grid(row=3, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.table_card.grid_columnconfigure(0, weight=1)
        self.table_card.grid_rowconfigure(0, weight=1)

        columns = ("id", "customer", "phone", "car", "pkg", "mrr", "tenure", "ltv", "reason", "date")
        self.tree = ttk.Treeview(self.table_card, columns=columns, show="headings", height=12)

        self.tree.heading("id", text="Churn ID")
        self.tree.heading("customer", text="Customer")
        self.tree.heading("phone", text="Phone")
        self.tree.heading("car", text="Vehicle Plate")
        self.tree.heading("pkg", text="Package")
        self.tree.heading("mrr", text="MRR Lost")
        self.tree.heading("tenure", text="Tenure")
        self.tree.heading("ltv", text="Achieved LTV")
        self.tree.heading("reason", text="Cancellation Reason")
        self.tree.heading("date", text="Date")

        self.tree.column("id", width=90, anchor="center")
        self.tree.column("customer", width=120, anchor="w")
        self.tree.column("phone", width=120, anchor="center")
        self.tree.column("car", width=110, anchor="center")
        self.tree.column("pkg", width=100, anchor="center")
        self.tree.column("mrr", width=85, anchor="e")
        self.tree.column("tenure", width=75, anchor="center")
        self.tree.column("ltv", width=95, anchor="e")
        self.tree.column("reason", width=220, anchor="w")
        self.tree.column("date", width=95, anchor="center")

        scroll_y = ttk.Scrollbar(self.table_card, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll_y.set)

        self.tree.grid(row=0, column=0, sticky="nsew", padx=(10, 0), pady=10)
        scroll_y.grid(row=0, column=1, sticky="ns", padx=(0, 10), pady=10)

    def _create_card(self, parent, col, title, value, subtext, accent_color, badge):
        card = ctk.CTkFrame(parent, fg_color=("gray90", "#1e293b"), corner_radius=10)
        card.grid(row=0, column=col, sticky="nsew", padx=4, pady=0)
        card.grid_columnconfigure(0, weight=1)

        top_row = ctk.CTkFrame(card, fg_color="transparent")
        top_row.pack(fill="x", padx=14, pady=(10, 2))

        lbl_title = ctk.CTkLabel(
            top_row, text=title,
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color=("gray40", "gray70")
        )
        lbl_title.pack(side="left")

        lbl_badge = ctk.CTkLabel(
            top_row, text=badge,
            font=ctk.CTkFont(size=9, weight="bold"),
            text_color=accent_color,
            fg_color=("gray80", "#0f172a"),
            corner_radius=4, padx=6, pady=2
        )
        lbl_badge.pack(side="right")

        lbl_val = ctk.CTkLabel(
            card, text=value,
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=("gray10", "gray95")
        )
        lbl_val.pack(anchor="w", padx=14, pady=(2, 0))

        lbl_sub = ctk.CTkLabel(
            card, text=subtext,
            font=ctk.CTkFont(size=11),
            text_color=("gray45", "gray60")
        )
        lbl_sub.pack(anchor="w", padx=14, pady=(0, 10))

        return {"val": lbl_val, "sub": lbl_sub, "badge": lbl_badge}

    def apply_data(self, data):
        """Update value, retention, and churn metrics."""
        self.current_data = data or {}
        self.raw_churn_list = data.get("churn_list") or []

        # 1. LTV
        ltv = data.get("ltv", 0.0)
        avg_p = data.get("avg_price", 0.0)
        self.card_ltv["val"].configure(text=f"{ltv:,.2f} SAR")
        self.card_ltv["sub"].configure(text=f"Avg Price: {avg_p:,.2f} SAR / month")

        # 2. Avg Lifespan
        days = data.get("avg_lifespan_days", 0.0)
        months = data.get("avg_lifespan_months", 0.0)
        self.card_lifespan["val"].configure(text=f"{days:.1f} Days")
        self.card_lifespan["sub"].configure(text=f"{months:.1f} months average customer life")

        # 3. Growth %
        growth = data.get("growth_pct", 0.0)
        prefix = "+" if growth > 0 else ""
        self.card_growth["val"].configure(text=f"{prefix}{growth:.1f}%")
        self.card_growth["badge"].configure(text="Growing" if growth >= 0 else "Decline")

        # 4. Active Base
        base = data.get("active_base", 0)
        self.card_active_base["val"].configure(text=f"{base:,}")

        # 5. Churn Metrics
        vol_cnt = data.get("voluntary_churn_count", 0)
        vol_rate = data.get("voluntary_churn_rate", 0.0)
        self.card_vol_churn["val"].configure(text=f"{vol_rate:.1f}%")
        self.card_vol_churn["sub"].configure(text=f"{vol_cnt:,} voluntary cancellations")

        invol_cnt = data.get("involuntary_churn_count", 0)
        invol_rate = data.get("involuntary_churn_rate", 0.0)
        self.card_invol_churn["val"].configure(text=f"{invol_rate:.1f}%")
        self.card_invol_churn["sub"].configure(text=f"{invol_cnt:,} expired / billing lapses")

        tot_rate = data.get("total_churn_rate", 0.0)
        self.card_total_churn["val"].configure(text=f"{tot_rate:.1f}%")

        self._filter_table()

    def _filter_table(self):
        query = self.search_var.get().strip().lower()
        for itm in self.tree.get_children():
            self.tree.delete(itm)

        for item in self.raw_churn_list:
            if query:
                match = (
                    query in item.get("customer", "").lower()
                    or query in item.get("phone", "").lower()
                    or query in item.get("car", "").lower()
                    or query in item.get("reason", "").lower()
                )
                if not match:
                    continue

            self.tree.insert("", "end", values=(
                item.get("id"),
                item.get("customer"),
                item.get("phone"),
                item.get("car"),
                item.get("pkg"),
                item.get("mrr"),
                item.get("tenure_months"),
                item.get("ltv"),
                item.get("reason"),
                item.get("date")
            ))

    def _export_csv(self):
        if not self.raw_churn_list:
            messagebox.showinfo("Export", "No churn records to export.")
            return

        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            initialfile="rushwash_voluntary_churn_log.csv",
            title="Export Churn Log"
        )
        if not file_path:
            return

        try:
            with open(file_path, mode="w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["ID", "Customer", "Phone", "Car", "Package", "MRR Lost", "Tenure", "LTV", "Reason", "Date"])
                for item in self.raw_churn_list:
                    writer.writerow([
                        item.get("id"), item.get("customer"), item.get("phone"),
                        item.get("car"), item.get("pkg"), item.get("mrr"),
                        item.get("tenure_months"), item.get("ltv"), item.get("reason"), item.get("date")
                    ])
            messagebox.showinfo("Export Successful", f"Successfully exported {len(self.raw_churn_list)} records to:\n{file_path}")
        except Exception as e:
            messagebox.showerror("Export Failed", str(e))
