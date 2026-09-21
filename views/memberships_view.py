"""
views/memberships_view.py - Membership & Subscription Retention Analytics with Valid Members Tracking
"""
import tkinter as tk
from tkinter import ttk
import customtkinter as ctk
import matplotlib
matplotlib.use("TkAgg")
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg


class MembershipsView(ctk.CTkFrame):
    def __init__(self, parent, db_manager):
        super().__init__(parent, fg_color="transparent")
        self.db = db_manager
        self.analytics = {}
        self.setup_ui()

    def setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # 1. Top KPI Summary Cards (4 Cards)
        self.kpi_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.kpi_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 6))
        for col in range(5):
            self.kpi_frame.grid_columnconfigure(col, weight=1)

        self.card_valid = self._create_metric_card(
            self.kpi_frame, 0, "VALID SUBSCRIPTIONS (HERO)", "--", "Entitled to wash today", "#10b981"
        )
        self.card_active = self._create_metric_card(
            self.kpi_frame, 1, "ACTIVE SUBSCRIPTIONS", "--", "Paid & valid today", "#3b82f6"
        )
        self.card_frozen = self._create_metric_card(
            self.kpi_frame, 2, "FROZEN SUBSCRIPTIONS", "--", "Temporarily paused", "#06b6d4"
        )
        self.card_expiring_week = self._create_metric_card(
            self.kpi_frame, 3, "EXPIRING THIS WEEK", "--", "Due in next 7 days", "#f59e0b"
        )
        self.card_expiring_month = self._create_metric_card(
            self.kpi_frame, 4, "EXPIRING THIS MONTH", "--", "Due before month end", "#ef4444"
        )

        # 2. Main Analytics Body (Split: Chart on Left, Table on Right)
        self.body_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.body_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.body_frame.grid_columnconfigure(0, weight=4)
        self.body_frame.grid_columnconfigure(1, weight=5)
        self.body_frame.grid_rowconfigure(0, weight=1)

        # Left: Matplotlib Package Distribution Pie/Donut Chart
        self.chart_card = ctk.CTkFrame(self.body_frame, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.chart_card.grid(row=0, column=0, sticky="nsew", padx=(0, 6), pady=0)
        self.chart_card.grid_columnconfigure(0, weight=1)
        self.chart_card.grid_rowconfigure(1, weight=1)

        chart_head = ctk.CTkFrame(self.chart_card, fg_color="transparent")
        chart_head.grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 4))
        self.lbl_chart_title = ctk.CTkLabel(
            chart_head, text="Valid Members by Package Tier",
            font=ctk.CTkFont(size=13, weight="bold")
        )
        self.lbl_chart_title.pack(side="left")

        self.fig_pkg = Figure(figsize=(4.5, 4.2), dpi=100)
        self.fig_pkg.patch.set_facecolor("#1e293b")
        self.ax_pkg = self.fig_pkg.add_subplot(111)

        self.canvas_pkg = FigureCanvasTkAgg(self.fig_pkg, master=self.chart_card)
        self.canvas_pkg.get_tk_widget().grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

        # Right: Package Table & Retention Health
        self.table_card = ctk.CTkFrame(self.body_frame, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.table_card.grid(row=0, column=1, sticky="nsew", padx=(6, 0), pady=0)
        self.table_card.grid_columnconfigure(0, weight=1)
        self.table_card.grid_rowconfigure(1, weight=1)

        table_head = ctk.CTkFrame(self.table_card, fg_color="transparent")
        table_head.grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 4))

        ctk.CTkLabel(
            table_head, text="Package Breakdown & MRR Contribution",
            font=ctk.CTkFont(size=13, weight="bold")
        ).pack(side="left")

        # Cohort switcher: Valid Members vs Auto-Renew Active
        self.cohort_var = tk.StringVar(value="Valid Members")
        self.seg_cohort = ctk.CTkSegmentedButton(
            table_head,
            values=["Valid Members", "Auto-Renew Active"],
            variable=self.cohort_var,
            command=self._on_cohort_change,
            height=28
        )
        self.seg_cohort.pack(side="right")

        table_container = ctk.CTkFrame(self.table_card, fg_color="transparent")
        table_container.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        table_container.grid_columnconfigure(0, weight=1)
        table_container.grid_rowconfigure(0, weight=1)

        cols = ("pkg", "subscribers", "interior_addons", "mrr", "avg_price", "share")
        self.tree = ttk.Treeview(table_container, columns=cols, show="headings", height=9)

        style = ttk.Style()
        style.configure(
            "Members.Treeview",
            background="#0f172a",
            foreground="#f8fafc",
            rowheight=28,
            fieldbackground="#0f172a",
            font=("Segoe UI", 9)
        )
        style.configure(
            "Members.Treeview.Heading",
            background="#1e293b",
            foreground="#94a3b8",
            relief="flat",
            font=("Segoe UI", 9, "bold")
        )
        self.tree.configure(style="Members.Treeview")

        self.tree.heading("pkg", text="Package Tier")
        self.tree.heading("subscribers", text="Main Members")
        self.tree.heading("interior_addons", text="+ Interior Add-ons")
        self.tree.heading("mrr", text="Combined MRR")
        self.tree.heading("avg_price", text="Avg ARPU")
        self.tree.heading("share", text="MRR Share")

        self.tree.column("pkg", width=140, anchor="w")
        self.tree.column("subscribers", width=90, anchor="center")
        self.tree.column("interior_addons", width=110, anchor="center")
        self.tree.column("mrr", width=105, anchor="e")
        self.tree.column("avg_price", width=85, anchor="e")
        self.tree.column("share", width=80, anchor="center")

        scroll = ttk.Scrollbar(table_container, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        scroll.grid(row=0, column=1, sticky="ns")

        # Bottom Retention Summary within Table Card
        self.retention_bar = ctk.CTkFrame(self.table_card, fg_color="#0f172a", corner_radius=8)
        self.retention_bar.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 10))
        self.lbl_retention_summary = ctk.CTkLabel(
            self.retention_bar, text="Status: Loading subscription health metrics...",
            font=ctk.CTkFont(size=11), text_color="#94a3b8", padx=10, pady=8
        )
        self.lbl_retention_summary.pack(fill="x")

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

    def update_data(self):
        analytics = self.db.get_membership_analytics()
        self.apply_data(analytics)

    def apply_data(self, analytics):
        self.analytics = analytics or {}

        valid_cnt = self.analytics.get("valid_members_count", 0)
        valid_mrr = self.analytics.get("valid_mrr", 0.0)
        valid_interior = self.analytics.get("valid_interior_count", 0)

        active_cnt = self.analytics.get("total_active", 0)
        active_mrr = self.analytics.get("total_mrr", 0.0)
        active_interior = self.analytics.get("interior_addons_count", 0)

        pending_churn = self.analytics.get("pending_churn_count", 0)
        status_counts = self.analytics.get("status_counts", {})

        # 1. Update Health Cards (Section 2)
        hero_valid = self.analytics.get("valid_subscriptions", valid_cnt)
        active_valid = self.analytics.get("active_subscriptions", active_cnt)
        frozen_cnt = self.analytics.get("frozen_subscriptions", 0)
        exp_week = self.analytics.get("expiring_this_week", 0)
        exp_month = self.analytics.get("expiring_this_month", 0)

        auto_cnt = self.analytics.get("auto_renewing_count", 0)
        auto_pct = self.analytics.get("auto_renewing_pct", 0.0)
        one_cnt = self.analytics.get("one_time_count", 0)
        one_pct = self.analytics.get("one_time_pct", 0.0)

        self.card_valid["val"].configure(text=f"{hero_valid:,}")
        self.card_valid["sub"].configure(text=f"Active + Frozen + Cancelled in cycle")

        self.card_active["val"].configure(text=f"{active_valid:,}")
        self.card_active["sub"].configure(text=f"Active & renewal ≥ today")

        self.card_frozen["val"].configure(text=f"{frozen_cnt:,}")
        self.card_frozen["sub"].configure(text=f"Temporarily paused")

        self.card_expiring_week["val"].configure(text=f"{exp_week:,}")
        self.card_expiring_week["sub"].configure(text=f"Due within next 7 days")

        self.card_expiring_month["val"].configure(text=f"{exp_month:,}")
        self.card_expiring_month["sub"].configure(text=f"Due before month ends")

        # 2. Update Bottom Banner with New vs Renewal Ratio
        self.lbl_retention_summary.configure(
            text=f"New vs. Renewal Ratio: Auto-Renewing: {auto_pct:.1f}% ({auto_cnt:,}) | "
                 f"One-Time: {one_pct:.1f}% ({one_cnt:,}) | "
                 f"Contracted Run-Rate MRR: {valid_mrr:,.2f} SAR | "
                 f"Pending Churn (Still Valid): {pending_churn:,}"
        )

        # 3. Render selected cohort in table and donut chart
        self._render_cohort()

    def _on_cohort_change(self, value=None):
        self._render_cohort()

    def _render_cohort(self):
        cohort = self.cohort_var.get()
        if "Valid" in cohort:
            packages = self.analytics.get("valid_packages", [])
            total_mrr = self.analytics.get("valid_mrr", 0.0)
            total_cnt = self.analytics.get("valid_members_count", 0)
            self.lbl_chart_title.configure(text="Valid Members by Package Tier (Expiry ≥ Tomorrow)")
            donut_center = f"{total_cnt:,}\nValid"
        else:
            packages = self.analytics.get("active_packages", [])
            total_mrr = self.analytics.get("total_mrr", 0.0)
            total_cnt = self.analytics.get("total_active", 0)
            self.lbl_chart_title.configure(text="Auto-Renew Active Members by Package Tier")
            donut_center = f"{total_cnt:,}\nActive"

        # Update Treeview Table
        for itm in self.tree.get_children():
            self.tree.delete(itm)

        for p in packages:
            share = round((p["mrr"] / total_mrr * 100), 1) if total_mrr > 0 else 0.0
            self.tree.insert("", "end", values=(
                p["name"],
                f"{p['count']:,}",
                f"{p.get('interior_addons', 0):,}",
                f"{p['mrr']:,.2f} SAR",
                f"{p['avg_price']:.1f} SAR",
                f"{share}%"
            ))

        # Render Donut Chart
        self._render_package_chart(packages, donut_center)

    def _render_package_chart(self, packages, center_text=""):
        self.ax_pkg.clear()

        if not packages:
            self.ax_pkg.text(0.5, 0.5, "No Package Data", color="#94a3b8", ha="center", va="center")
            self.canvas_pkg.draw()
            return

        names = [p["name"] for p in packages]
        counts = [p["count"] for p in packages]
        colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"]

        wedges, texts, autotexts = self.ax_pkg.pie(
            counts,
            labels=names,
            autopct="%1.1f%%",
            startangle=120,
            colors=colors[:len(counts)],
            pctdistance=0.72,
            textprops={"color": "#e2e8f0", "fontsize": 8},
            wedgeprops={"width": 0.45, "edgecolor": "#1e293b", "linewidth": 2}
        )

        for autotext in autotexts:
            autotext.set_color("#ffffff")
            autotext.set_fontsize(7)
            autotext.set_weight("bold")

        self.ax_pkg.text(
            0, 0, center_text,
            ha="center", va="center",
            color="#f8fafc", fontsize=11, weight="bold"
        )

        self.fig_pkg.tight_layout()
        self.canvas_pkg.draw()
