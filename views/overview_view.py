"""
views/overview_view.py - Executive Dashboard Overview View with KPIs & Matplotlib Visualizations
"""
import tkinter as tk
from tkinter import ttk
import customtkinter as ctk
import matplotlib
matplotlib.use("TkAgg")
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg


class OverviewView(ctk.CTkFrame):
    def __init__(self, parent, db_manager):
        super().__init__(parent, fg_color="transparent")
        self.db = db_manager

        # Data holders
        self.current_kpis = {}
        self.current_trend = {}

        self.setup_ui()

    def setup_ui(self):
        # Configure layout
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # 1. Primary KPIs Row (5 Cards)
        self.kpi_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.kpi_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 6))
        for col in range(5):
            self.kpi_frame.grid_columnconfigure(col, weight=1)

        self.card_total_sales = self._create_kpi_card(
            self.kpi_frame, col=0, title="TOTAL SALES (NEW + RENEWAL)", value="-- SAR",
            subtext="-- paid orders • Avg -- SAR", accent_color="#3b82f6", badge="Total Inflow"
        )
        self.card_new_sales = self._create_kpi_card(
            self.kpi_frame, col=1, title="NEW SALES REVENUE", value="-- SAR",
            subtext="-- new sales • --% share", accent_color="#8b5cf6", badge="Acquisitions"
        )
        self.card_renewal_sales = self._create_kpi_card(
            self.kpi_frame, col=2, title="RENEWAL REVENUE", value="-- SAR",
            subtext="-- renewals • --% share", accent_color="#10b981", badge="Recurring"
        )
        self.card_washes = self._create_kpi_card(
            self.kpi_frame, col=3, title="TOTAL CAR WASHES", value="--",
            subtext="Avg -- washes / member", accent_color="#f59e0b", badge="Operations"
        )
        self.card_members = self._create_kpi_card(
            self.kpi_frame, col=4, title="VALID MEMBERS & MRR", value="--",
            subtext="MRR: -- SAR", accent_color="#06b6d4", badge="Membership"
        )

        # 2. Secondary Mini Metrics Bar
        self.secondary_frame = ctk.CTkFrame(self, fg_color=("gray88", "#1e293b"), corner_radius=10)
        self.secondary_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 10))
        for col in range(5):
            self.secondary_frame.grid_columnconfigure(col, weight=1)

        self.sec_new_cars = self._create_mini_stat(self.secondary_frame, 0, "New Cars Registered", "--")
        self.sec_active_accounts = self._create_mini_stat(self.secondary_frame, 1, "Active Client Accounts", "--")
        self.sec_avg_new_ticket = self._create_mini_stat(self.secondary_frame, 2, "Avg Ticket (New Sales)", "-- SAR")
        self.sec_avg_ren_ticket = self._create_mini_stat(self.secondary_frame, 3, "Avg Ticket (Renewals)", "-- SAR")
        self.sec_onetime_rev = self._create_mini_stat(self.secondary_frame, 4, "One-Time Washes Revenue", "-- SAR")

        # 3. Charts Area (2 Columns: Trend Line/Bar + Donut Chart)
        self.charts_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.charts_frame.grid(row=2, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.charts_frame.grid_columnconfigure(0, weight=3)
        self.charts_frame.grid_columnconfigure(1, weight=2)
        self.charts_frame.grid_rowconfigure(0, weight=1)

        # Left: Revenue Trend Chart Card
        self.trend_card = ctk.CTkFrame(self.charts_frame, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.trend_card.grid(row=0, column=0, sticky="nsew", padx=(0, 6), pady=0)
        self.trend_card.grid_columnconfigure(0, weight=1)
        self.trend_card.grid_rowconfigure(1, weight=1)

        trend_header = ctk.CTkFrame(self.trend_card, fg_color="transparent")
        trend_header.grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 4))
        ctk.CTkLabel(
            trend_header, text="Daily Revenue Trend (Last 30 Days)",
            font=ctk.CTkFont(size=14, weight="bold")
        ).pack(side="left")

        # Trend Matplotlib Figure
        self.fig_trend = Figure(figsize=(6, 3.8), dpi=100)
        self.fig_trend.patch.set_facecolor("#1e293b")
        self.ax_trend = self.fig_trend.add_subplot(111)
        self._style_axis(self.ax_trend)

        self.canvas_trend = FigureCanvasTkAgg(self.fig_trend, master=self.trend_card)
        self.canvas_trend.get_tk_widget().grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

        # Right: Revenue Composition Donut Chart Card
        self.donut_card = ctk.CTkFrame(self.charts_frame, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.donut_card.grid(row=0, column=1, sticky="nsew", padx=(6, 0), pady=0)
        self.donut_card.grid_columnconfigure(0, weight=1)
        self.donut_card.grid_rowconfigure(1, weight=1)

        donut_header = ctk.CTkFrame(self.donut_card, fg_color="transparent")
        donut_header.grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 4))
        ctk.CTkLabel(
            donut_header, text="Revenue Inflow Composition",
            font=ctk.CTkFont(size=14, weight="bold")
        ).pack(side="left")

        # Donut Matplotlib Figure
        self.fig_donut = Figure(figsize=(4.2, 3.8), dpi=100)
        self.fig_donut.patch.set_facecolor("#1e293b")
        self.ax_donut = self.fig_donut.add_subplot(111)

        self.canvas_donut = FigureCanvasTkAgg(self.fig_donut, master=self.donut_card)
        self.canvas_donut.get_tk_widget().grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

    def _create_kpi_card(self, parent, col, title, value, subtext, accent_color, badge):
        card = ctk.CTkFrame(parent, fg_color=("gray92", "#1e293b"), corner_radius=12, border_width=1, border_color=accent_color)
        card.grid(row=0, column=col, sticky="ew", padx=6, pady=4)
        card.grid_columnconfigure(0, weight=1)

        # Header with Title and Badge
        h_frame = ctk.CTkFrame(card, fg_color="transparent")
        h_frame.pack(fill="x", padx=12, pady=(10, 2))

        title_lbl = ctk.CTkLabel(
            h_frame, text=title,
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=("gray40", "gray70")
        )
        title_lbl.pack(side="left")

        badge_lbl = ctk.CTkLabel(
            h_frame, text=badge,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=accent_color,
            text_color="#ffffff",
            corner_radius=6,
            padx=6, pady=1
        )
        badge_lbl.pack(side="right")

        # Big Value
        val_lbl = ctk.CTkLabel(
            card, text=value,
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color=("gray10", "gray95"),
            anchor="w"
        )
        val_lbl.pack(fill="x", padx=12, pady=(2, 2))

        # Subtext
        sub_lbl = ctk.CTkLabel(
            card, text=subtext,
            font=ctk.CTkFont(size=11),
            text_color=("gray50", "gray60"),
            anchor="w"
        )
        sub_lbl.pack(fill="x", padx=12, pady=(0, 10))

        return {
            "card": card,
            "title": title_lbl,
            "badge": badge_lbl,
            "value": val_lbl,
            "subtext": sub_lbl
        }

    def _create_mini_stat(self, parent, col, label, value):
        f = ctk.CTkFrame(parent, fg_color="transparent")
        f.grid(row=0, column=col, sticky="ew", padx=12, pady=8)
        
        lbl = ctk.CTkLabel(
            f, text=label,
            font=ctk.CTkFont(size=11),
            text_color=("gray45", "gray65")
        )
        lbl.pack(anchor="w")

        val = ctk.CTkLabel(
            f, text=value,
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=("gray15", "gray90")
        )
        val.pack(anchor="w")

        return val

    def _style_axis(self, ax):
        ax.set_facecolor("#1e293b")
        for spine in ax.spines.values():
            spine.set_color("#334155")
        ax.tick_params(colors="#94a3b8", labelsize=8)
        ax.grid(True, linestyle="--", alpha=0.15, color="#cbd5e1")

    def update_data(self, date_filter="All Time", custom_start=None, custom_end=None):
        """Fetch fresh analytics and update all visual elements synchronously."""
        kpis = self.db.get_kpi_summary(date_filter, custom_start, custom_end)
        trend = self.db.get_revenue_trend(days=30)
        self.apply_data(kpis, trend)

    def apply_data(self, kpis, trend):
        """Apply pre-computed analytics to UI widgets on the main thread."""
        self.current_kpis = kpis or {}
        self.current_trend = trend or {}

        # 1. Update Primary Cards
        tot_rev = self.current_kpis.get("total_revenue", 0.0)
        tot_orders = self.current_kpis.get("total_orders", 0)
        new_rev = self.current_kpis.get("new_sales_revenue", 0.0)
        new_orders = self.current_kpis.get("orders_count", 0)
        ren_rev = self.current_kpis.get("renewal_revenue", 0.0)
        ren_orders = self.current_kpis.get("renewal_count", 0)
        one_rev = self.current_kpis.get("onetime_revenue", 0.0)
        washes_cnt = self.current_kpis.get("total_washes", 0)
        valid_members = self.current_kpis.get("valid_members", 0)
        valid_mrr = self.current_kpis.get("valid_mrr", 0.0)

        avg_ticket = self.current_kpis.get("avg_ticket", 0.0)
        avg_new_ticket = round(new_rev / new_orders, 2) if new_orders > 0 else 0.0
        avg_ren_ticket = round(ren_rev / ren_orders, 2) if ren_orders > 0 else 0.0

        new_pct = round((new_rev / tot_rev * 100), 1) if tot_rev > 0 else 0.0
        ren_pct = round((ren_rev / tot_rev * 100), 1) if tot_rev > 0 else 0.0
        washes_per_member = round(washes_cnt / valid_members, 1) if valid_members > 0 else 0.0

        # Card 1: TOTAL SALES (NEW + RENEWAL)
        self.card_total_sales["value"].configure(text=f"{tot_rev:,.2f} SAR")
        self.card_total_sales["subtext"].configure(text=f"{tot_orders:,} paid orders • Avg {avg_ticket:,.2f} SAR")

        # Card 2: NEW SALES REVENUE
        self.card_new_sales["value"].configure(text=f"{new_rev:,.2f} SAR")
        self.card_new_sales["subtext"].configure(text=f"{new_orders:,} new sales • {new_pct}% share")

        # Card 3: RENEWAL REVENUE
        self.card_renewal_sales["value"].configure(text=f"{ren_rev:,.2f} SAR")
        self.card_renewal_sales["subtext"].configure(text=f"{ren_orders:,} renewals • {ren_pct}% share")

        # Card 4: TOTAL CAR WASHES
        self.card_washes["value"].configure(text=f"{washes_cnt:,}")
        self.card_washes["subtext"].configure(text=f"Avg {washes_per_member} washes / member")

        # Card 5: VALID MEMBERS & MRR
        self.card_members["value"].configure(text=f"{valid_members:,}")
        self.card_members["subtext"].configure(text=f"MRR: {valid_mrr:,.2f} SAR")

        # 2. Update Secondary Mini Stats
        self.sec_new_cars.configure(text=f"{self.current_kpis.get('new_cars_count', 0):,}")
        self.sec_active_accounts.configure(text=f"{self.current_kpis.get('active_client_accounts', 0):,}")
        self.sec_avg_new_ticket.configure(text=f"{avg_new_ticket:,.2f} SAR")
        self.sec_avg_ren_ticket.configure(text=f"{avg_ren_ticket:,.2f} SAR")
        self.sec_onetime_rev.configure(text=f"{one_rev:,.2f} SAR")

        # 3. Render Trend Chart
        self._render_trend_chart(self.current_trend)

        # 4. Render Donut Chart
        self._render_donut_chart(new_rev, ren_rev, one_rev)

    def _render_trend_chart(self, trend):
        self.ax_trend.clear()
        self._style_axis(self.ax_trend)

        dates = trend.get("dates", [])
        if not dates:
            self.ax_trend.text(0.5, 0.5, "No Trend Data Available", color="#94a3b8", ha="center", va="center")
            self.canvas_trend.draw()
            return

        x = range(len(dates))
        renewal = trend.get("renewal", [])
        new_sales = trend.get("new_sales", [])
        onetime = trend.get("onetime", [])

        # Plot stacked bar chart for clean visibility
        self.ax_trend.bar(x, renewal, label="Renewal", color="#8b5cf6", width=0.6)
        bottom_new = renewal
        self.ax_trend.bar(x, new_sales, bottom=bottom_new, label="New Sales", color="#10b981", width=0.6)
        bottom_one = [r + n for r, n in zip(renewal, new_sales)]
        self.ax_trend.bar(x, onetime, bottom=bottom_one, label="One-Time", color="#f59e0b", width=0.6)

        # Format labels - sample every 4th label if too many
        step = max(1, len(dates) // 8)
        self.ax_trend.set_xticks(list(x)[::step])
        self.ax_trend.set_xticklabels([dates[i] for i in list(x)[::step]], rotation=25, ha="right")

        self.ax_trend.set_ylabel("Revenue (SAR)", color="#94a3b8", fontsize=9)
        self.ax_trend.legend(
            loc="upper left", facecolor="#0f172a", edgecolor="#334155",
            fontsize=8, labelcolor="#e2e8f0"
        )
        self.fig_trend.tight_layout()
        self.canvas_trend.draw()

    def _render_donut_chart(self, new_rev, ren_rev, one_rev):
        self.ax_donut.clear()

        values = [new_rev, ren_rev, one_rev]
        labels = ["New Sales", "Renewal", "One-Time"]
        colors = ["#10b981", "#8b5cf6", "#f59e0b"]

        total = sum(values)
        if total <= 0:
            self.ax_donut.text(0.5, 0.5, "No Data", color="#94a3b8", ha="center", va="center")
            self.canvas_donut.draw()
            return

        wedges, texts, autotexts = self.ax_donut.pie(
            values,
            labels=labels,
            autopct="%1.1f%%",
            startangle=140,
            colors=colors,
            pctdistance=0.75,
            textprops={"color": "#e2e8f0", "fontsize": 9},
            wedgeprops={"width": 0.45, "edgecolor": "#1e293b", "linewidth": 2}
        )

        for autotext in autotexts:
            autotext.set_color("#ffffff")
            autotext.set_fontsize(8)
            autotext.set_weight("bold")

        # Center text with total revenue
        self.ax_donut.text(
            0, 0, f"{total:,.0f}\nSAR",
            ha="center", va="center",
            color="#f8fafc", fontsize=11, weight="bold"
        )

        self.fig_donut.tight_layout()
        self.canvas_donut.draw()
