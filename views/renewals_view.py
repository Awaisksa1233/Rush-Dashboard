"""
views/renewals_view.py - Section 3: Subscription Renewals & Payment Recovery View
"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import customtkinter as ctk
import csv


class RenewalsView(ctk.CTkFrame):
    """
    Implements Section 3: Subscription Renewals & Payment Recovery:
    - Total Renewal Revenue & Count
    - First-Attempt Renewal Revenue & Count
    - Recovered Retry Revenue & Count
    - Failed Renewal Revenue & Count (Moyasar Retry Queue)
    - Searchable table of queued failed renewals with recovery status & CSV export
    """

    def __init__(self, parent, db_manager):
        super().__init__(parent, fg_color="transparent")
        self.db = db_manager
        self.raw_failed_queue = []
        self.current_data = {}
        self.setup_ui()

    def setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # 1. Top Section 3 Metric Cards Row (4 Cards)
        self.cards_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.cards_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 8))
        for col in range(4):
            self.cards_frame.grid_columnconfigure(col, weight=1)

        self.card_total_renewal = self._create_metric_card(
            self.cards_frame, 0, "TOTAL RENEWAL REVENUE", "-- SAR",
            "-- renewals paid", accent_color="#8b5cf6", badge="Existing Members"
        )
        self.card_first_attempt = self._create_metric_card(
            self.cards_frame, 1, "FIRST-ATTEMPT RENEWALS", "-- SAR",
            "-- morning auto-runs", accent_color="#10b981", badge="Clean Inflow"
        )
        self.card_recovered_retry = self._create_metric_card(
            self.cards_frame, 2, "RECOVERED RETRY REVENUE", "-- SAR",
            "-- saved from decline", accent_color="#3b82f6", badge="Auto-Recovery"
        )
        self.card_failed_renewal = self._create_metric_card(
            self.cards_frame, 3, "FAILED RENEWAL REVENUE", "-- SAR",
            "-- unpaid / retry queue", accent_color="#ef4444", badge="At Risk"
        )

        # 2. Filter & Controls Bar
        self.filter_bar = ctk.CTkFrame(self, fg_color=("gray90", "#1e293b"), corner_radius=10)
        self.filter_bar.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 8))

        ctk.CTkLabel(
            self.filter_bar, text="⚠️ Moyasar Failed Renewals & Payment Recovery Queue",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=("gray10", "gray95")
        ).pack(side="left", padx=14, pady=10)

        # Search box
        self.search_var = tk.StringVar()
        self.search_entry = ctk.CTkEntry(
            self.filter_bar, placeholder_text="🔍 Search by customer, phone, car...",
            width=260, height=32, textvariable=self.search_var
        )
        self.search_entry.pack(side="right", padx=12, pady=8)
        self.search_entry.bind("<KeyRelease>", lambda e: self._filter_table())

        # Export CSV Button
        self.btn_export = ctk.CTkButton(
            self.filter_bar, text="📥 Export CSV", width=105, height=32,
            fg_color="#334155", hover_color="#475569",
            command=self._export_csv
        )
        self.btn_export.pack(side="right", padx=(0, 6), pady=8)

        # 3. Interactive Table Card
        self.table_card = ctk.CTkFrame(self, fg_color=("gray90", "#1e293b"), corner_radius=10)
        self.table_card.grid(row=2, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.table_card.grid_columnconfigure(0, weight=1)
        self.table_card.grid_rowconfigure(0, weight=1)

        columns = ("id", "customer", "phone", "car", "pkg", "amount", "reason", "attempts", "status")
        self.tree = ttk.Treeview(self.table_card, columns=columns, show="headings", height=14)

        self.tree.heading("id", text="Queue ID")
        self.tree.heading("customer", text="Customer")
        self.tree.heading("phone", text="Phone")
        self.tree.heading("car", text="Vehicle Plate")
        self.tree.heading("pkg", text="Package")
        self.tree.heading("amount", text="Amount")
        self.tree.heading("reason", text="Decline Reason")
        self.tree.heading("attempts", text="Attempts")
        self.tree.heading("status", text="Recovery Status")

        self.tree.column("id", width=90, anchor="center")
        self.tree.column("customer", width=130, anchor="w")
        self.tree.column("phone", width=120, anchor="center")
        self.tree.column("car", width=110, anchor="center")
        self.tree.column("pkg", width=110, anchor="center")
        self.tree.column("amount", width=90, anchor="e")
        self.tree.column("reason", width=220, anchor="w")
        self.tree.column("attempts", width=70, anchor="center")
        self.tree.column("status", width=140, anchor="center")

        scroll_y = ttk.Scrollbar(self.table_card, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll_y.set)

        self.tree.grid(row=0, column=0, sticky="nsew", padx=(10, 0), pady=10)
        scroll_y.grid(row=0, column=1, sticky="ns", padx=(0, 10), pady=10)

    def _create_metric_card(self, parent, col, title, value, subtext, accent_color, badge):
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
        """Update metrics and queue table with refreshed Section 3 analytics."""
        self.current_data = data or {}
        self.raw_failed_queue = data.get("failed_queue") or []

        # 1. Total Renewal
        tot_rev = data.get("total_renewal_rev", 0.0)
        tot_cnt = data.get("total_renewal_count", 0)
        self.card_total_renewal["val"].configure(text=f"{tot_rev:,.2f} SAR")
        self.card_total_renewal["sub"].configure(text=f"{tot_cnt:,} total renewals paid")

        # 2. First Attempt
        fa_rev = data.get("first_attempt_rev", 0.0)
        fa_cnt = data.get("first_attempt_count", 0)
        self.card_first_attempt["val"].configure(text=f"{fa_rev:,.2f} SAR")
        self.card_first_attempt["sub"].configure(text=f"{fa_cnt:,} charged first try")

        # 3. Recovered Retry
        rr_rev = data.get("recovered_retry_rev", 0.0)
        rr_cnt = data.get("recovered_retry_count", 0)
        self.card_recovered_retry["val"].configure(text=f"{rr_rev:,.2f} SAR")
        self.card_recovered_retry["sub"].configure(text=f"{rr_cnt:,} saved via auto-retries")

        # 4. Failed Renewal (Unpaid Queue)
        fl_rev = data.get("failed_renewal_rev", 0.0)
        fl_cnt = data.get("failed_renewal_count", 0)
        self.card_failed_renewal["val"].configure(text=f"{fl_rev:,.2f} SAR")
        self.card_failed_renewal["sub"].configure(text=f"{fl_cnt:,} currently sitting unpaid")

        # Populate queue
        self._filter_table()

    def _filter_table(self):
        query = self.search_var.get().strip().lower()
        for itm in self.tree.get_children():
            self.tree.delete(itm)

        for item in self.raw_failed_queue:
            if query:
                match = (
                    query in item.get("customer", "").lower()
                    or query in item.get("phone", "").lower()
                    or query in item.get("car", "").lower()
                    or query in item.get("id", "").lower()
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
                item.get("amount"),
                item.get("reason"),
                item.get("attempts"),
                item.get("status")
            ))

    def _export_csv(self):
        if not self.raw_failed_queue:
            messagebox.showinfo("Export", "No queued failed renewal records to export.")
            return

        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            initialfile="rushwash_failed_renewals_recovery_queue.csv",
            title="Export Failed Renewals Queue"
        )
        if not file_path:
            return

        try:
            with open(file_path, mode="w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["Queue ID", "Customer", "Phone", "Car", "Package", "Amount", "Reason", "Attempts", "Status"])
                for item in self.raw_failed_queue:
                    writer.writerow([
                        item.get("id"), item.get("customer"), item.get("phone"),
                        item.get("car"), item.get("pkg"), item.get("amount"),
                        item.get("reason"), item.get("attempts"), item.get("status")
                    ])
            messagebox.showinfo("Export Successful", f"Successfully exported {len(self.raw_failed_queue)} records to:\n{file_path}")
        except Exception as e:
            messagebox.showerror("Export Failed", str(e))
