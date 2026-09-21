"""
views/sales_team_view.py - Sales Team Performance Leaderboard & Visual Analytics
"""
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import customtkinter as ctk
import csv
import matplotlib
matplotlib.use("TkAgg")
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg


class RepCommissionDetailModal(ctk.CTkToplevel):
    """
    Modal window showing complete commission calculation breakdown and ledger for a salesperson,
    with built-in option to export raw data for that representative.
    """
    def __init__(self, parent, rep_data, audit_records):
        super().__init__(parent)
        self.rep_data = rep_data or {}
        self.audit_records = audit_records or []
        self.filtered_records = list(self.audit_records)

        rep_name = self.rep_data.get("name", "Sales Rep")
        rep_code = self.rep_data.get("code", "EMP-UNKNOWN")
        self.title(f"Commission Calculation Detail — {rep_name} ({rep_code})")
        self.geometry("1040x720")
        self.minsize(850, 550)
        self.configure(fg_color="#0f172a")

        self.after(100, self.lift)
        self.after(150, self.focus_force)

        self.setup_ui()

    def setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        rep_name = self.rep_data.get("name", "Sales Rep")
        rep_code = self.rep_data.get("code", "EMP-UNKNOWN")
        rep_role = self.rep_data.get("role", "Advisor")

        # 1. Header Bar
        header = ctk.CTkFrame(self, fg_color="#1e293b", corner_radius=0, height=65)
        header.grid(row=0, column=0, sticky="ew")
        header.grid_columnconfigure(0, weight=1)

        title_frame = ctk.CTkFrame(header, fg_color="transparent")
        title_frame.pack(side="left", padx=18, pady=12)

        ctk.CTkLabel(
            title_frame,
            text=f"Advisor Commission Detail: {rep_name}",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="#f8fafc"
        ).pack(anchor="w")

        ctk.CTkLabel(
            title_frame,
            text=f"Employee Code: {rep_code}  |  Role: {rep_role}  |  Orders Handled: {self.rep_data.get('total_orders', 0):,}",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
        ).pack(anchor="w", pady=(2, 0))

        # Header Action Buttons
        btn_frame = ctk.CTkFrame(header, fg_color="transparent")
        btn_frame.pack(side="right", padx=16, pady=12)

        self.btn_export = ctk.CTkButton(
            btn_frame,
            text="📥 Export Rep's Data (CSV)",
            width=175,
            height=32,
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._export_csv
        )
        self.btn_export.pack(side="left", padx=(0, 10))

        btn_close = ctk.CTkButton(
            btn_frame,
            text="✕ Close",
            width=80,
            height=32,
            fg_color="#334155",
            hover_color="#475569",
            font=ctk.CTkFont(size=11),
            command=self.destroy
        )
        btn_close.pack(side="left")

        # 2. Metric Cards Row
        cards_frame = ctk.CTkFrame(self, fg_color="transparent")
        cards_frame.grid(row=1, column=0, sticky="ew", padx=16, pady=(12, 6))
        for col in range(4):
            cards_frame.grid_columnconfigure(col, weight=1)

        total_comm = self.rep_data.get("commission", 0.0)
        renewals_count = self.rep_data.get("qualifying_renewals", len(self.audit_records))
        upg_comm = self.rep_data.get("upgrade_commission", 0.0)
        interior_comm = self.rep_data.get("interior_commission", 0.0)
        base_comm = max(0.0, total_comm - upg_comm - interior_comm)

        self._create_card(cards_frame, 0, "TOTAL COMMISSION EARNED", f"{total_comm:,.2f} SAR", "Qualifying full-price renewals", "#8b5cf6")
        self._create_card(cards_frame, 1, "QUALIFYING RENEWALS", f"{renewals_count:,} Deals", "1st full-price renewals paid", "#10b981")
        self._create_card(cards_frame, 2, "PACKAGE UPGRADES COMM.", f"{upg_comm:,.2f} SAR", "Incremental tier differences", "#3b82f6")
        self._create_card(cards_frame, 3, "INTERIOR DETAIL COMM.", f"{interior_comm:,.2f} SAR", "Attributed add-on sales", "#f59e0b")

        # 3. Calculation Explanation Banner
        explainer_box = ctk.CTkFrame(self, fg_color="#1e293b", corner_radius=8, border_width=1, border_color="#334155")
        explainer_box.grid(row=2, column=0, sticky="ew", padx=16, pady=(4, 8))

        info_text = (
            "📌 Calculation Rules Applied:\n"
            "• Rates: Fresh = 2 SAR  |  Shiny = 6 SAR  |  Nano = 10 SAR  |  Interior Clean = 10 SAR\n"
            "• Upgrade Splitting: Original rep retains initial tier rate; upgrade rep receives incremental differential (e.g. Fresh→Nano: 2 SAR orig + 8 SAR upg)\n"
            "• Qualifying Condition: Successfully collected first full-price renewal (initial purchase = 0 SAR; retries qualified; discounted renewals excluded)\n"
            "• Winbacks: 50% commission multiplier for customers inactive ≥ 60 days  |  Strictly awarded 1x per subscription lifecycle"
        )
        ctk.CTkLabel(
            explainer_box,
            text=info_text,
            font=ctk.CTkFont(size=10),
            text_color="#cbd5e1",
            justify="left",
            anchor="w"
        ).pack(fill="x", padx=14, pady=8)

        # 4. Filter Bar & Ledger Table Card
        table_card = ctk.CTkFrame(self, fg_color="#1e293b", corner_radius=10)
        table_card.grid(row=3, column=0, sticky="nsew", padx=16, pady=(0, 14))
        table_card.grid_columnconfigure(0, weight=1)
        table_card.grid_rowconfigure(1, weight=1)

        filter_bar = ctk.CTkFrame(table_card, fg_color="transparent")
        filter_bar.grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 6))

        ctk.CTkLabel(
            filter_bar,
            text=f"Qualifying Renewal Deals Ledger ({len(self.audit_records)} records)",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#f8fafc"
        ).pack(side="left")

        self.search_var = tk.StringVar()
        search_entry = ctk.CTkEntry(
            filter_bar,
            placeholder_text="🔍 Filter customer, subscription, package...",
            width=260,
            height=28,
            textvariable=self.search_var
        )
        search_entry.pack(side="right")
        search_entry.bind("<KeyRelease>", lambda e: self._filter_table())

        # Treeview Container
        tree_container = ctk.CTkFrame(table_card, fg_color="transparent")
        tree_container.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        tree_container.grid_columnconfigure(0, weight=1)
        tree_container.grid_rowconfigure(0, weight=1)

        columns = ("date", "sub", "customer", "package", "component", "role", "winback", "amount")
        self.tree = ttk.Treeview(tree_container, columns=columns, show="headings", height=12)

        self.tree.heading("date", text="Renewal Date")
        self.tree.heading("sub", text="Subscription")
        self.tree.heading("customer", text="Customer")
        self.tree.heading("package", text="Package Renewed")
        self.tree.heading("component", text="Commission Component")
        self.tree.heading("role", text="Rep Role in Deal")
        self.tree.heading("winback", text="Winback Status")
        self.tree.heading("amount", text="Commission")

        self.tree.column("date", width=115, anchor="center")
        self.tree.column("sub", width=95, anchor="center")
        self.tree.column("customer", width=150, anchor="w")
        self.tree.column("package", width=140, anchor="w")
        self.tree.column("component", width=160, anchor="w")
        self.tree.column("role", width=130, anchor="center")
        self.tree.column("winback", width=110, anchor="center")
        self.tree.column("amount", width=95, anchor="e")

        scrollbar = ttk.Scrollbar(tree_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        scrollbar.grid(row=0, column=1, sticky="ns")

        self._populate_table()

    def _create_card(self, parent, col, title, value, subtext, color):
        card = ctk.CTkFrame(parent, fg_color="#1e293b", corner_radius=10, border_width=1, border_color=color)
        card.grid(row=0, column=col, sticky="ew", padx=6, pady=4)

        ctk.CTkLabel(
            card, text=title, font=ctk.CTkFont(size=9, weight="bold"),
            text_color="#94a3b8", anchor="w"
        ).pack(fill="x", padx=10, pady=(6, 1))

        ctk.CTkLabel(
            card, text=value, font=ctk.CTkFont(size=15, weight="bold"),
            text_color="#f8fafc", anchor="w"
        ).pack(fill="x", padx=10, pady=(0, 1))

        ctk.CTkLabel(
            card, text=subtext, font=ctk.CTkFont(size=9),
            text_color="#64748b", anchor="w"
        ).pack(fill="x", padx=10, pady=(0, 6))

    def _populate_table(self):
        for item in self.tree.get_children():
            self.tree.delete(item)

        rep_code = self.rep_data.get("code")

        for r in self.filtered_records:
            e_date = str(r.get("earned_date", ""))[:19]
            sub_code = r.get("subscription", "")
            cust_name = r.get("customer_name") or r.get("customer", "")
            pkg = r.get("package_service_display", "")
            winback_str = "Winback (50%)" if r.get("is_winback") else "Standard"

            # Filter to items attributed to this representative
            rep_items = [
                it for it in r.get("items", [])
                if it.get("salesperson_code") == rep_code or not rep_code
            ]
            if not rep_items:
                # If rep was listed at top level
                rep_items = r.get("items", [])

            for it in rep_items:
                comp_name = it.get("component", "Commission")
                role_name = (
                    "Original Rep" if it.get("role_in_sale") == "original_salesperson"
                    else ("Upgrade Rep" if it.get("role_in_sale") == "upgrade_salesperson" else "Add-on Rep")
                )
                comm_val = f"{it.get('commission_amount', 0.0):,.2f} SAR"

                self.tree.insert("", "end", values=(
                    e_date,
                    sub_code,
                    cust_name,
                    pkg,
                    comp_name,
                    role_name,
                    winback_str,
                    comm_val
                ))

    def _filter_table(self):
        q = self.search_var.get().lower().strip()
        if not q:
            self.filtered_records = list(self.audit_records)
        else:
            self.filtered_records = [
                r for r in self.audit_records
                if q in str(r.get("subscription", "")).lower()
                or q in str(r.get("customer", "")).lower()
                or q in str(r.get("customer_name", "")).lower()
                or q in str(r.get("package_service_display", "")).lower()
                or any(q in str(it.get("component", "")).lower() for it in r.get("items", []))
            ]
        self._populate_table()

    def _export_csv(self):
        if not self.audit_records:
            messagebox.showinfo("Export", "No records to export.")
            return

        rep_code = self.rep_data.get("code", "rep")
        rep_name = self.rep_data.get("name", "rep")

        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            initialfile=f"commission_ledger_{rep_code}_{rep_name.lower()}.csv",
            title=f"Export Commission Ledger for {rep_name}"
        )
        if not file_path:
            return

        try:
            with open(file_path, mode="w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Renewal Date",
                    "Subscription Code",
                    "Customer Code",
                    "Customer Name",
                    "Package Renewed",
                    "Commission Component",
                    "Role in Deal",
                    "Winback Eligibility",
                    "Is Winback",
                    "Days Inactive",
                    "Component Base Rate (SAR)",
                    "Commission Earned (SAR)",
                    "Qualifying Renewal Order",
                    "Payment ID",
                    "Promotion Status"
                ])

                for r in self.audit_records:
                    rep_items = [
                        it for it in r.get("items", [])
                        if it.get("salesperson_code") == rep_code or not rep_code
                    ]
                    if not rep_items:
                        rep_items = r.get("items", [])

                    for it in rep_items:
                        writer.writerow([
                            str(r.get("earned_date", ""))[:19],
                            r.get("subscription"),
                            r.get("customer"),
                            r.get("customer_name"),
                            r.get("package_service_display"),
                            it.get("component"),
                            it.get("role_in_sale"),
                            r.get("winback_eligibility"),
                            "Yes" if r.get("is_winback") else "No",
                            r.get("days_inactive") if r.get("days_inactive") is not None else "",
                            it.get("base_rate"),
                            it.get("commission_amount"),
                            r.get("qualifying_renewal_order"),
                            r.get("qualifying_payment_id"),
                            r.get("promotion_status")
                        ])

            messagebox.showinfo(
                "Export Successful",
                f"Exported {len(self.audit_records)} commission records for {rep_name} to:\n{file_path}"
            )
        except Exception as e:
            messagebox.showerror("Export Error", f"Failed to export representative data:\n{e}")


class SalesTeamView(ctk.CTkFrame):
    def __init__(self, parent, db_manager):
        super().__init__(parent, fg_color="transparent")
        self.db = db_manager
        self.reps_data = []

        self.setup_ui()

    def setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # 1. Summary Header Cards
        self.summary_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.summary_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 6))
        for c in range(4):
            self.summary_frame.grid_columnconfigure(c, weight=1)

        self.card_top_rep = self._create_metric_card(
            self.summary_frame, 0, "TOP PERFORMER", "--", "Leader in Total Revenue", "#3b82f6"
        )
        self.card_team_rev = self._create_metric_card(
            self.summary_frame, 1, "TEAM REVENUE", "-- SAR", "Attributed to POS Sessions", "#10b981"
        )
        self.card_team_deals = self._create_metric_card(
            self.summary_frame, 2, "TOTAL DEALS CLOSED", "--", "Orders registered", "#8b5cf6"
        )
        self.card_commissions = self._create_metric_card(
            self.summary_frame, 3, "COMMISSIONS EARNED", "-- SAR", "Qualifying Renewals", "#f59e0b"
        )

        # 2. Top Half: Bar Chart of Top Reps
        self.chart_card = ctk.CTkFrame(self, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.chart_card.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 8))
        self.chart_card.grid_columnconfigure(0, weight=1)

        chart_header = ctk.CTkFrame(self.chart_card, fg_color="transparent")
        chart_header.pack(fill="x", padx=14, pady=(10, 2))
        ctk.CTkLabel(
            chart_header, text="Sales Rep Revenue Ranking",
            font=ctk.CTkFont(size=13, weight="bold")
        ).pack(side="left")

        self.fig_reps = Figure(figsize=(8, 2.8), dpi=100)
        self.fig_reps.patch.set_facecolor("#1e293b")
        self.ax_reps = self.fig_reps.add_subplot(111)
        self._style_axis(self.ax_reps)

        self.canvas_reps = FigureCanvasTkAgg(self.fig_reps, master=self.chart_card)
        self.canvas_reps.get_tk_widget().pack(fill="x", padx=10, pady=(0, 8))

        # 3. Bottom Half: Interactive Table
        self.table_card = ctk.CTkFrame(self, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.table_card.grid(row=2, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.table_card.grid_columnconfigure(0, weight=1)
        self.table_card.grid_rowconfigure(1, weight=1)

        table_header = ctk.CTkFrame(self.table_card, fg_color="transparent")
        table_header.grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 6))

        ctk.CTkLabel(
            table_header, text="Sales Representative Leaderboard & Breakdown",
            font=ctk.CTkFont(size=14, weight="bold")
        ).pack(side="left")

        self.btn_export_raw = ctk.CTkButton(
            table_header, text="📥 Export Raw Data (CSV)", width=170, height=28,
            fg_color="#1e3a8a", hover_color="#1d4ed8",
            font=ctk.CTkFont(size=11, weight="bold"),
            command=self._export_raw_data
        )
        self.btn_export_raw.pack(side="right", padx=(10, 4))

        self.lbl_selected_rep = ctk.CTkLabel(
            table_header, text="Click a rep row to see detailed statistics",
            font=ctk.CTkFont(size=11), text_color=("gray40", "gray65")
        )
        self.lbl_selected_rep.pack(side="right")

        # Treeview styling & container
        table_container = ctk.CTkFrame(self.table_card, fg_color="transparent")
        table_container.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        table_container.grid_columnconfigure(0, weight=1)
        table_container.grid_rowconfigure(0, weight=1)

        columns = ("rank", "name", "role", "deals", "revenue", "new_sales", "renewals", "avg_ticket", "commission")
        self.tree = ttk.Treeview(table_container, columns=columns, show="headings", height=8)

        # Style Treeview
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(
            "Treeview",
            background="#0f172a",
            foreground="#f8fafc",
            rowheight=26,
            fieldbackground="#0f172a",
            bordercolor="#334155",
            borderwidth=0,
            font=("Segoe UI", 9)
        )
        style.configure(
            "Treeview.Heading",
            background="#1e293b",
            foreground="#94a3b8",
            relief="flat",
            font=("Segoe UI", 9, "bold")
        )
        style.map("Treeview", background=[("selected", "#2563eb")], foreground=[("selected", "#ffffff")])

        # Headings
        self.tree.heading("rank", text="#")
        self.tree.heading("name", text="Representative")
        self.tree.heading("role", text="Role")
        self.tree.heading("deals", text="Orders")
        self.tree.heading("revenue", text="Total Revenue")
        self.tree.heading("new_sales", text="New Sales")
        self.tree.heading("renewals", text="Renewals")
        self.tree.heading("avg_ticket", text="Avg Ticket")
        self.tree.heading("commission", text="Commission (SAR)")

        # Column widths
        self.tree.column("rank", width=40, anchor="center")
        self.tree.column("name", width=140, anchor="w")
        self.tree.column("role", width=100, anchor="w")
        self.tree.column("deals", width=80, anchor="center")
        self.tree.column("revenue", width=110, anchor="e")
        self.tree.column("new_sales", width=100, anchor="e")
        self.tree.column("renewals", width=100, anchor="e")
        self.tree.column("avg_ticket", width=90, anchor="e")
        self.tree.column("commission", width=100, anchor="e")

        scrollbar = ttk.Scrollbar(table_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        scrollbar.grid(row=0, column=1, sticky="ns")

        self.tree.bind("<<TreeviewSelect>>", self._on_row_select)
        self.tree.bind("<Double-1>", self._on_row_select)

    def _create_metric_card(self, parent, col, title, value, subtext, color):
        card = ctk.CTkFrame(parent, fg_color=("gray92", "#1e293b"), corner_radius=10, border_width=1, border_color=color)
        card.grid(row=0, column=col, sticky="ew", padx=6, pady=4)
        
        lbl_title = ctk.CTkLabel(
            card, text=title, font=ctk.CTkFont(size=10, weight="bold"),
            text_color=("gray40", "gray70"), anchor="w"
        )
        lbl_title.pack(fill="x", padx=12, pady=(8, 2))

        lbl_val = ctk.CTkLabel(
            card, text=value, font=ctk.CTkFont(size=17, weight="bold"),
            text_color=("gray10", "gray95"), anchor="w"
        )
        lbl_val.pack(fill="x", padx=12, pady=(0, 2))

        lbl_sub = ctk.CTkLabel(
            card, text=subtext, font=ctk.CTkFont(size=10),
            text_color=("gray50", "gray60"), anchor="w"
        )
        lbl_sub.pack(fill="x", padx=12, pady=(0, 8))

        return {"val": lbl_val, "sub": lbl_sub}

    def _style_axis(self, ax):
        ax.set_facecolor("#1e293b")
        for spine in ax.spines.values():
            spine.set_color("#334155")
        ax.tick_params(colors="#94a3b8", labelsize=8)
        ax.grid(True, linestyle="--", alpha=0.15, color="#cbd5e1", axis="x")

    def update_data(self, date_filter="All Time"):
        reps_data = self.db.get_sales_rep_performance(date_filter)
        self.apply_data(reps_data)

    def apply_data(self, reps_data):
        self.reps_data = reps_data or []

        # Clear existing table rows
        for item in self.tree.get_children():
            self.tree.delete(item)

        if not self.reps_data:
            self.card_top_rep["val"].configure(text="None")
            self.card_team_rev["val"].configure(text="0 SAR")
            self.card_team_deals["val"].configure(text="0")
            self.card_commissions["val"].configure(text="0 SAR")
            self.ax_reps.clear()
            self.canvas_reps.draw()
            return

        total_team_rev = sum(r["revenue"] for r in self.reps_data)
        total_deals = sum(r["total_orders"] for r in self.reps_data)
        total_comm = sum(r["commission"] for r in self.reps_data)
        top_rep = self.reps_data[0]

        self.card_top_rep["val"].configure(text=top_rep["name"])
        self.card_top_rep["sub"].configure(text=f"{top_rep['revenue']:,.0f} SAR ({top_rep['total_orders']} orders)")

        self.card_team_rev["val"].configure(text=f"{total_team_rev:,.2f} SAR")
        self.card_team_deals["val"].configure(text=f"{total_deals:,}")
        self.card_commissions["val"].configure(text=f"{total_comm:,.2f} SAR")

        # Populate table
        for r in self.reps_data:
            self.tree.insert("", "end", values=(
                f"#{r['rank']}",
                r["name"],
                r["role"],
                f"{r['total_orders']:,}",
                f"{r['revenue']:,.2f} SAR",
                f"{r['new_sales_rev']:,.2f} SAR",
                f"{r['renewal_rev']:,.2f} SAR",
                f"{r['avg_ticket']:,.2f} SAR",
                f"{r['commission']:,.2f} SAR"
            ))

        # Render Rep Ranking Chart
        self._render_reps_chart(self.reps_data[:8])

    def _render_reps_chart(self, top_reps):
        self.ax_reps.clear()
        self._style_axis(self.ax_reps)

        if not top_reps:
            self.canvas_reps.draw()
            return

        # Reverse order for horizontal bar chart so #1 is at top
        reps_rev = list(reversed(top_reps))
        names = [r["name"] for r in reps_rev]
        revs = [r["revenue"] for r in reps_rev]
        y_pos = range(len(names))

        bars = self.ax_reps.barh(y_pos, revs, color="#3b82f6", height=0.55, edgecolor="#1d4ed8")
        self.ax_reps.set_yticks(list(y_pos))
        self.ax_reps.set_yticklabels(names, color="#e2e8f0", fontsize=8)
        self.ax_reps.set_xlabel("Revenue Generated (SAR)", color="#94a3b8", fontsize=8)

        # Label values on bars
        for bar in bars:
            width = bar.get_width()
            self.ax_reps.text(
                width + (max(revs) * 0.01), bar.get_y() + bar.get_height() / 2,
                f"{width:,.0f} SAR",
                va="center", color="#cbd5e1", fontsize=7, weight="bold"
            )

        self.ax_reps.set_xlim(0, max(revs) * 1.18)
        self.fig_reps.tight_layout()
        self.canvas_reps.draw()

    def _on_row_select(self, event):
        selected = self.tree.selection()
        if not selected:
            return
        item = self.tree.item(selected[0])
        vals = item["values"]
        if vals and len(vals) >= 9:
            rep_name = vals[1]
            rep_rev = vals[4]
            rep_comm = vals[8]
            deals = vals[3]
            self.lbl_selected_rep.configure(
                text=f"Viewing: {rep_name} ({deals} Deals | Comm: {rep_comm})",
                text_color="#60a5fa"
            )

            # Find representative data object
            target_rep = next((r for r in self.reps_data if r.get("name") == rep_name), None)
            if target_rep:
                self._open_rep_detail_modal(target_rep)

    def _open_rep_detail_modal(self, rep_data):
        if hasattr(self, "_detail_modal") and self._detail_modal and self._detail_modal.winfo_exists():
            try:
                self._detail_modal.destroy()
            except Exception:
                pass

        rep_code = rep_data.get("code")
        records = self.db.get_commission_audit_records(rep_code=rep_code)
        self._detail_modal = RepCommissionDetailModal(self, rep_data, records)

    def _export_raw_data(self):
        records = self.db.get_commission_audit_records()
        if not records:
            messagebox.showinfo("Export", "No raw commission records found to export.")
            return

        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            initialfile="rushwash_commission_audit_raw_data.csv",
            title="Export Raw Commission Data"
        )
        if not file_path:
            return

        try:
            with open(file_path, mode="w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Subscription", "Customer Code", "Customer Name",
                    "Qualifying Renewal Order", "Payment Provider ID",
                    "Package Tier", "Interior Cleaning Included", "Package Service Display",
                    "Total Commission (SAR)", "Original Salesperson Code", "Original Salesperson Name",
                    "Upgrade Salesperson Code", "Addon Salesperson Code",
                    "Is Winback", "Winback Eligibility", "Days Inactive",
                    "Promotion Status", "Full Price Qualified", "Commission Status", "Earned Date",
                    "Breakdown Items"
                ])
                for r in records:
                    items_summary = "; ".join([
                        f"{it.get('component')}: {it.get('salesperson_name')} ({it.get('salesperson_code')}) = {it.get('commission_amount')} SAR"
                        for it in r.get("items", [])
                    ])
                    writer.writerow([
                        r.get("subscription"),
                        r.get("customer"),
                        r.get("customer_name"),
                        r.get("qualifying_renewal_order"),
                        r.get("qualifying_payment_id"),
                        r.get("package_tier"),
                        "Yes" if r.get("has_interior") else "No",
                        r.get("package_service_display"),
                        r.get("commission_amount"),
                        r.get("original_salesperson"),
                        r.get("original_salesperson_name"),
                        r.get("upgrade_salesperson") or "",
                        r.get("addon_salesperson") or "",
                        "Yes" if r.get("is_winback") else "No",
                        r.get("winback_eligibility"),
                        r.get("days_inactive") if r.get("days_inactive") is not None else "",
                        r.get("promotion_status"),
                        "Yes" if r.get("is_full_price") else "No",
                        r.get("commission_status"),
                        str(r.get("earned_date", ""))[:19],
                        items_summary
                    ])
            messagebox.showinfo("Export Successful", f"Exported {len(records)} raw commission records to:\n{file_path}")
        except Exception as e:
            messagebox.showerror("Export Error", f"Failed to export raw commission data:\n{e}")

