"""
dashboard_app.py - Main Desktop Application Window for Rush Wash MongoDB Analytics Dashboard
"""
import sys
import threading
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox
import customtkinter as ctk

# Ensure UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# CustomTkinter setup
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

from db_manager import MongoManager
from views.overview_view import OverviewView
from views.sales_team_view import SalesTeamView
from views.memberships_view import MembershipsView
from views.renewals_view import RenewalsView
from views.retention_churn_view import RetentionChurnView
from views.orders_view import OrdersView
from views.settings_view import SettingsView


class RushWashDashboard(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Rush Wash — MongoDB Executive Analytics Dashboard")
        self.geometry("1320x840")
        self.minsize(1100, 720)

        # Database Manager
        self.db = MongoManager()

        # State tracking
        self.current_view = "overview"
        self.date_filter = "All Time"
        self.order_status = "Paid + Active"
        self.moyasar_only = True
        self.db.order_status_filter = self.order_status
        self.db.moyasar_only = self.moyasar_only
        self.is_loading = False
        self._live_timer_id = None

        # Thread communication cache
        self.cached_refresh_data = {}
        self.cached_refresh_error = None
        self.bind("<<DataLoaded>>", self._on_data_loaded_event)

        # Main Layout Configuration
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._create_sidebar()
        self._create_main_content()

        # Initial data load & schedule live auto-sync
        self.refresh_all_views()
        self._schedule_live_sync()

    def _create_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=220, corner_radius=0, fg_color=("#f1f5f9", "#0f172a"))
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_rowconfigure(7, weight=1)

        # Logo & App Title
        brand_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        brand_frame.grid(row=0, column=0, padx=16, pady=(18, 14), sticky="w")

        ctk.CTkLabel(
            brand_frame, text="⚡ RUSH WASH",
            font=ctk.CTkFont(size=17, weight="bold"),
            text_color="#38bdf8"
        ).pack(anchor="w")

        ctk.CTkLabel(
            brand_frame, text="MongoDB Enterprise Analytics",
            font=ctk.CTkFont(size=11),
            text_color=("gray45", "gray60")
        ).pack(anchor="w")

        # Connection status badge
        self.status_pill = ctk.CTkFrame(self.sidebar, fg_color=("#e2e8f0", "#1e293b"), corner_radius=20)
        self.status_pill.grid(row=1, column=0, padx=16, pady=(0, 16), sticky="ew")

        self.lbl_conn_dot = ctk.CTkLabel(
            self.status_pill, text="●",
            font=ctk.CTkFont(size=14),
            text_color="#4ade80" if self.db.is_connected else "#ef4444"
        )
        self.lbl_conn_dot.pack(side="left", padx=(10, 4), pady=4)

        self.lbl_conn_status = ctk.CTkLabel(
            self.status_pill,
            text=f"Connected ({self.db.last_ping_ms} ms)" if self.db.is_connected else "Disconnected",
            font=ctk.CTkFont(size=11),
            text_color=("gray20", "gray85")
        )
        self.lbl_conn_status.pack(side="left", padx=(0, 10), pady=4)

        # Navigation Buttons
        self.nav_buttons = {}
        nav_items = [
            ("overview", "📊 General Sales & Ops"),
            ("memberships", "💳 Membership Health"),
            ("renewals", "🔄 Renewals & Recovery"),
            ("retention_churn", "📈 Retention & Churn"),
            ("sales_team", "👥 Sales Team"),
            ("orders", "📑 Orders Explorer"),
            ("settings", "⚙️ Database Settings")
        ]

        for idx, (key, label) in enumerate(nav_items, start=2):
            btn = ctk.CTkButton(
                self.sidebar,
                text=label,
                anchor="w",
                height=38,
                corner_radius=8,
                font=ctk.CTkFont(size=13, weight="normal"),
                fg_color="transparent",
                text_color=("gray20", "gray85"),
                hover_color=("#cbd5e1", "#1e293b"),
                command=lambda k=key: self.switch_view(k)
            )
            btn.grid(row=idx, column=0, padx=12, pady=3, sticky="ew")
            self.nav_buttons[key] = btn

        # Bottom appearance mode toggle
        bottom_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        bottom_frame.grid(row=8, column=0, padx=16, pady=16, sticky="ew")

        ctk.CTkLabel(
            bottom_frame, text="Appearance:",
            font=ctk.CTkFont(size=11),
            text_color=("gray45", "gray60")
        ).pack(anchor="w", pady=(0, 4))

        self.mode_switch = ctk.CTkOptionMenu(
            bottom_frame, values=["Dark", "Light", "System"],
            command=self._change_appearance_mode,
            width=180, height=30
        )
        self.mode_switch.set("Dark")
        self.mode_switch.pack(anchor="w")

    def _create_main_content(self):
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.grid(row=0, column=1, sticky="nsew")
        self.main_container.grid_columnconfigure(0, weight=1)
        self.main_container.grid_rowconfigure(1, weight=1)

        # Top Header Bar
        self.header = ctk.CTkFrame(self.main_container, height=56, fg_color=("gray95", "#0f172a"), corner_radius=0)
        self.header.grid(row=0, column=0, sticky="ew")
        self.header.grid_columnconfigure(0, weight=1)

        # View Title
        self.lbl_view_title = ctk.CTkLabel(
            self.header, text="Executive Overview & KPI Dashboard",
            font=ctk.CTkFont(size=17, weight="bold"),
            text_color=("gray10", "gray95")
        )
        self.lbl_view_title.pack(side="left", padx=20, pady=12)

        # Header Right Controls
        controls = ctk.CTkFrame(self.header, fg_color="transparent")
        controls.pack(side="right", padx=16, pady=10)

        # Order Status Filter
        ctk.CTkLabel(
            controls, text="Status:", font=ctk.CTkFont(size=11, weight="bold"),
            text_color=("gray40", "gray70")
        ).pack(side="left", padx=(0, 5))

        self.opt_status = ctk.CTkOptionMenu(
            controls,
            values=["Paid + Active", "Paid Only", "Active Only", "All Orders"],
            command=self._on_status_filter_change,
            width=125, height=32
        )
        self.opt_status.set("Paid + Active")
        self.opt_status.pack(side="left", padx=(0, 8))

        # Moyasar Paid Verification Switch
        self.moyasar_switch = ctk.CTkSwitch(
            controls, text="💳 Moyasar Paid", font=ctk.CTkFont(size=11, weight="bold"),
            command=self._toggle_moyasar_filter, width=135, height=32,
            progress_color="#10b981"
        )
        self.moyasar_switch.select()
        self.moyasar_switch.pack(side="left", padx=(0, 10))

        # Date Range Filter
        ctk.CTkLabel(
            controls, text="Date Filter:", font=ctk.CTkFont(size=11, weight="bold"),
            text_color=("gray40", "gray70")
        ).pack(side="left", padx=(0, 6))

        self.opt_date = ctk.CTkOptionMenu(
            controls,
            values=["All Time", "MTD (Month to Date)", "Last 30 Days", "Last 7 Days", "Last Month", "This Month", "Year to Date", "Today"],
            command=self._on_date_filter_change,
            width=165, height=32
        )
        self.opt_date.set("All Time")
        self.opt_date.pack(side="left", padx=(0, 10))

        # Realtime Live Sync Toggle Switch
        self.live_sync_switch = ctk.CTkSwitch(
            controls, text="⚡ Live Sync (10s)", font=ctk.CTkFont(size=11, weight="bold"),
            command=self._toggle_live_sync, width=120, height=32
        )
        self.live_sync_switch.select()
        self.live_sync_switch.pack(side="left", padx=(0, 10))

        # Manual Refresh Button
        self.btn_refresh = ctk.CTkButton(
            controls, text="🔄 Refresh", width=85, height=32,
            fg_color="#3b82f6", hover_color="#2563eb",
            command=self.refresh_all_views
        )
        self.btn_refresh.pack(side="left", padx=(0, 6))

        # Dump MongoDB Data Quick Button
        self.btn_dump = ctk.CTkButton(
            controls, text="💾 Dump DB", width=85, height=32,
            fg_color="#0d9488", hover_color="#0f766e",
            command=self.dump_database_quick
        )
        self.btn_dump.pack(side="left", padx=(0, 6))

        # Restart App Button
        self.btn_restart = ctk.CTkButton(
            controls, text="⚡ Restart", width=80, height=32,
            fg_color="#334155", hover_color="#dc2626",
            command=self.restart_app
        )
        self.btn_restart.pack(side="left", padx=(0, 10))

        # Last updated label
        self.lbl_last_updated = ctk.CTkLabel(
            controls, text="Updated: --",
            font=ctk.CTkFont(size=10),
            text_color=("gray45", "gray60")
        )
        self.lbl_last_updated.pack(side="left", padx=(2, 0))

        # View Panels Container
        self.view_container = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.view_container.grid(row=1, column=0, sticky="nsew")
        self.view_container.grid_columnconfigure(0, weight=1)
        self.view_container.grid_rowconfigure(0, weight=1)

        # Initialize View Frames
        self.views = {
            "overview": OverviewView(self.view_container, self.db),
            "memberships": MembershipsView(self.view_container, self.db),
            "renewals": RenewalsView(self.view_container, self.db),
            "retention_churn": RetentionChurnView(self.view_container, self.db),
            "sales_team": SalesTeamView(self.view_container, self.db),
            "orders": OrdersView(self.view_container, self.db),
            "settings": SettingsView(self.view_container, self.db, on_reconnect_callback=self._on_db_reconnected)
        }

        for view in self.views.values():
            view.grid(row=0, column=0, sticky="nsew")

        self.switch_view("overview")

    def switch_view(self, view_key):
        self.current_view = view_key

        # Update button visual active states
        for k, btn in self.nav_buttons.items():
            if k == view_key:
                btn.configure(fg_color="#2563eb", text_color="#ffffff")
            else:
                btn.configure(fg_color="transparent", text_color=("gray20", "gray85"))

        # Update title
        titles = {
            "overview": "General Sales & Operations Dashboard (Section 1)",
            "memberships": "Membership & Subscription Health (Section 2)",
            "renewals": "Subscription Renewals & Payment Recovery (Section 3)",
            "retention_churn": "Customer Lifetime Value (LTV) & Churn Analytics (Sections 4 & 5)",
            "sales_team": "Sales Team Performance & Commissions Leaderboard",
            "orders": "Live Orders & Transactions Explorer",
            "settings": "MongoDB Cluster Configuration & Health Diagnostics"
        }
        self.lbl_view_title.configure(text=titles.get(view_key, "Dashboard"))

        # Raise selected frame to front
        view = self.views.get(view_key)
        if view:
            view.tkraise()

    def _on_date_filter_change(self, choice):
        self.date_filter = choice
        self.refresh_all_views()

    def _on_status_filter_change(self, choice):
        self.order_status = choice
        self.db.order_status_filter = choice
        self.refresh_all_views()

    def _toggle_moyasar_filter(self):
        self.moyasar_only = bool(self.moyasar_switch.get())
        self.db.moyasar_only = self.moyasar_only
        self.refresh_all_views()

    def refresh_all_views(self):
        """Asynchronously refresh data so GUI does not freeze."""
        if self.is_loading:
            return
        self.is_loading = True
        self.btn_refresh.configure(text="⏳ Loading...", state="disabled")
        self.update_idletasks()

        thread = threading.Thread(target=self._worker_refresh, daemon=True)
        thread.start()

    def _worker_refresh(self):
        error_occurred = None
        data = {}
        try:
            # Query all data off the UI thread
            data["kpis"] = self.db.get_kpi_summary(self.date_filter, order_status=self.order_status, moyasar_only=self.moyasar_only)
            data["trend"] = self.db.get_revenue_trend(days=30, order_status=self.order_status, moyasar_only=self.moyasar_only)
            data["reps"] = self.db.get_sales_rep_performance(self.date_filter, order_status=self.order_status, moyasar_only=self.moyasar_only)
            data["members"] = self.db.get_membership_analytics()
            data["renewals"] = self.db.get_renewals_recovery_analytics(self.date_filter, order_status=self.order_status, moyasar_only=self.moyasar_only)
            data["retention_churn"] = self.db.get_retention_and_churn_analytics(self.date_filter)
            data["orders"] = self.db.get_orders(limit=100, order_status=self.order_status, moyasar_only=self.moyasar_only)
            data["stats"] = self.db.get_database_stats()
        except Exception as e:
            error_occurred = str(e)

        self.cached_refresh_data = data
        self.cached_refresh_error = error_occurred

        # Safely notify UI main thread using event_generate
        try:
            self.event_generate("<<DataLoaded>>")
        except Exception:
            pass

    def _on_data_loaded_event(self, event=None):
        self._apply_refreshed_data(self.cached_refresh_data, self.cached_refresh_error)

    def _apply_refreshed_data(self, data, error):
        self.is_loading = False
        try:
            self.btn_refresh.configure(text="🔄 Refresh", state="normal")

            if error:
                messagebox.showwarning("Data Refresh Notice", f"An issue occurred while refreshing data:\n{error}")
            elif data:
                # Apply data to views on main thread
                if "kpis" in data and "trend" in data:
                    self.views["overview"].apply_data(data["kpis"], data["trend"])
                if "members" in data:
                    self.views["memberships"].apply_data(data["members"])
                if "renewals" in data:
                    self.views["renewals"].apply_data(data["renewals"])
                if "retention_churn" in data:
                    self.views["retention_churn"].apply_data(data["retention_churn"])
                if "reps" in data:
                    self.views["sales_team"].apply_data(data["reps"])
                if "orders" in data:
                    self.views["orders"].apply_data(data["orders"])
                if "stats" in data:
                    self.views["settings"].apply_data(data["stats"])

            # Update status pill
            if self.db.is_connected:
                self.lbl_conn_dot.configure(text_color="#4ade80")
                self.lbl_conn_status.configure(text=f"Connected ({self.db.last_ping_ms} ms)")
            else:
                self.lbl_conn_dot.configure(text_color="#ef4444")
                self.lbl_conn_status.configure(text="Disconnected")

            now_str = datetime.now().strftime("%H:%M:%S")
            is_live = hasattr(self, "live_sync_switch") and self.live_sync_switch.get() == 1
            self.lbl_last_updated.configure(text=f"Updated: {now_str} (Live)" if is_live else f"Updated: {now_str}")
        except Exception:
            pass

    def _toggle_live_sync(self):
        """Enable or disable background realtime polling."""
        if hasattr(self, "live_sync_switch") and self.live_sync_switch.get() == 1:
            self._schedule_live_sync()
        else:
            if self._live_timer_id:
                try:
                    self.after_cancel(self._live_timer_id)
                except Exception:
                    pass
                self._live_timer_id = None

    def _schedule_live_sync(self):
        """Schedule next realtime poll in 10 seconds."""
        if hasattr(self, "live_sync_switch") and self.live_sync_switch.get() == 1:
            if self._live_timer_id:
                try:
                    self.after_cancel(self._live_timer_id)
                except Exception:
                    pass
            self._live_timer_id = self.after(10000, self._on_live_tick)

    def _on_live_tick(self):
        """Periodic background refresh callback."""
        if hasattr(self, "live_sync_switch") and self.live_sync_switch.get() == 1:
            if not self.is_loading:
                self.refresh_all_views()
            self._schedule_live_sync()

    def restart_app(self):
        """Restart the dashboard application cleanly without manual terminal interaction."""
        import subprocess
        try:
            if self._live_timer_id:
                try:
                    self.after_cancel(self._live_timer_id)
                except Exception:
                    pass
            subprocess.Popen([sys.executable, sys.argv[0]])
            self.destroy()
        except Exception as e:
            messagebox.showerror("Restart Error", f"Could not restart automatically:\n{e}")

    def dump_database_quick(self):
        """Quickly triggers an asynchronous MongoDB data dump from the header bar."""
        if not self.db.is_connected:
            messagebox.showwarning("Database Disconnected", "Cannot dump data while disconnected from MongoDB.")
            return

        self.btn_dump.configure(text="⏳ Dumping...", state="disabled")
        self.lbl_last_updated.configure(text="Dumping MongoDB...")
        self.update_idletasks()

        def _worker():
            res = self.db.dump_database()
            self.after(0, lambda: self._on_dump_completed(res))

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()

    def _on_dump_completed(self, res):
        self.btn_dump.configure(text="💾 Dump DB", state="normal")
        now_str = datetime.now().strftime("%H:%M:%S")
        self.lbl_last_updated.configure(text=f"Updated: {now_str}")

        if res.get("success"):
            out_dir = res["output_dir"]
            msg = (
                f"✓ MongoDB Data Dump Completed Successfully!\n\n"
                f"• Collections: {res['collections_count']}\n"
                f"• Total Documents: {res['total_documents']:,}\n"
                f"• Size: {res['size_mb']} MB\n"
                f"• Time Taken: {res['duration_seconds']} seconds\n\n"
                f"Location:\n{out_dir}\n\n"
                f"Would you like to open the dump folder in Windows Explorer?"
            )
            if messagebox.askyesno("MongoDB Dump Complete", msg):
                try:
                    os.startfile(out_dir)
                except Exception as e:
                    messagebox.showerror("Open Folder", f"Could not open directory:\n{e}")

            if "settings" in self.views and hasattr(self.views["settings"], "refresh_dumps_list"):
                self.views["settings"].refresh_dumps_list()
        else:
            messagebox.showerror("Dump Failed", f"An error occurred while dumping MongoDB:\n{res.get('error')}")

    def _on_db_reconnected(self):
        self.refresh_all_views()

    def _change_appearance_mode(self, mode):
        ctk.set_appearance_mode(mode)


def main():
    app = RushWashDashboard()
    app.mainloop()


if __name__ == "__main__":
    main()
