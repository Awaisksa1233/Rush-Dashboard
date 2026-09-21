"""
views/settings_view.py - MongoDB Connection Configuration, Health Diagnostics & Data Dump
"""
import os
import threading
import tkinter as tk
from tkinter import ttk, messagebox
import customtkinter as ctk


class SettingsView(ctk.CTkFrame):
    def __init__(self, parent, db_manager, on_reconnect_callback=None):
        super().__init__(parent, fg_color="transparent")
        self.db = db_manager
        self.on_reconnect_callback = on_reconnect_callback
        self.is_dumping = False

        self.setup_ui()
        self.refresh_dumps_list()

    def setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # 1. Connection Settings Card
        self.conn_card = ctk.CTkFrame(self, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.conn_card.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 8))
        self.conn_card.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            self.conn_card, text="MongoDB Connection & Cluster Configuration",
            font=ctk.CTkFont(size=14, weight="bold")
        ).grid(row=0, column=0, columnspan=2, sticky="w", padx=16, pady=(12, 8))

        # Quick preset buttons
        preset_frame = ctk.CTkFrame(self.conn_card, fg_color="transparent")
        preset_frame.grid(row=1, column=0, columnspan=2, sticky="w", padx=16, pady=(0, 8))

        ctk.CTkLabel(preset_frame, text="Quick Presets: ", font=ctk.CTkFont(size=11, weight="bold")).pack(side="left")
        btn_local = ctk.CTkButton(
            preset_frame, text="Localhost (127.0.0.1:27017)", width=170, height=28,
            fg_color="#334155", hover_color="#475569",
            command=self._preset_local
        )
        btn_local.pack(side="left", padx=6)

        btn_atlas = ctk.CTkButton(
            preset_frame, text="Atlas Cloud (.env URI)", width=150, height=28,
            fg_color="#334155", hover_color="#475569",
            command=self._preset_atlas
        )
        btn_atlas.pack(side="left", padx=6)

        # URI Input
        ctk.CTkLabel(
            self.conn_card, text="Connection URI:",
            font=ctk.CTkFont(size=11, weight="bold")
        ).grid(row=2, column=0, sticky="w", padx=16, pady=4)

        self.entry_uri = ctk.CTkEntry(self.conn_card, height=32, font=ctk.CTkFont(family="Consolas", size=11))
        self.entry_uri.insert(0, self.db.uri)
        self.entry_uri.grid(row=2, column=1, sticky="ew", padx=(0, 16), pady=4)

        # DB Name Input
        ctk.CTkLabel(
            self.conn_card, text="Database Name:",
            font=ctk.CTkFont(size=11, weight="bold")
        ).grid(row=3, column=0, sticky="w", padx=16, pady=4)

        self.entry_db = ctk.CTkEntry(self.conn_card, height=32, font=ctk.CTkFont(family="Consolas", size=11))
        self.entry_db.insert(0, self.db.db_name)
        self.entry_db.grid(row=3, column=1, sticky="ew", padx=(0, 16), pady=4)

        # Buttons and Status Row
        btn_row = ctk.CTkFrame(self.conn_card, fg_color="transparent")
        btn_row.grid(row=4, column=0, columnspan=2, sticky="ew", padx=16, pady=(8, 12))

        self.btn_test = ctk.CTkButton(
            btn_row, text="⚡ Test Connection", width=140, height=30,
            fg_color="#3b82f6", hover_color="#2563eb",
            command=self._test_connection
        )
        self.btn_test.pack(side="left", padx=(0, 10))

        self.btn_save = ctk.CTkButton(
            btn_row, text="💾 Apply & Connect", width=140, height=30,
            fg_color="#10b981", hover_color="#059669",
            command=self._apply_connection
        )
        self.btn_save.pack(side="left")

        self.lbl_status = ctk.CTkLabel(
            btn_row, text="Status: Ready",
            font=ctk.CTkFont(size=11), text_color="#94a3b8"
        )
        self.lbl_status.pack(side="left", padx=16)

        # 2. Database Diagnostics Card
        self.diag_card = ctk.CTkFrame(self, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.diag_card.grid(row=1, column=0, sticky="ew", padx=10, pady=(0, 8))
        self.diag_card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            self.diag_card, text="Live Database Health & Document Counts",
            font=ctk.CTkFont(size=13, weight="bold")
        ).pack(anchor="w", padx=16, pady=(10, 6))

        self.stats_grid = ctk.CTkFrame(self.diag_card, fg_color="transparent")
        self.stats_grid.pack(fill="x", padx=16, pady=(0, 10))
        for col in range(6):
            self.stats_grid.grid_columnconfigure(col, weight=1)

        self.diag_items = {}
        items = [
            ("orders_count", "Sales Orders", "#3b82f6"),
            ("subscriptions_count", "Subscriptions", "#10b981"),
            ("washes_count", "Wash Records", "#8b5cf6"),
            ("customers_count", "Customers", "#f59e0b"),
            ("employees_count", "Employees", "#ec4899"),
            ("sessions_count", "POS Sessions", "#06b6d4")
        ]

        for idx, (key, title, color) in enumerate(items):
            card = ctk.CTkFrame(self.stats_grid, fg_color="#0f172a", corner_radius=8, border_width=1, border_color=color)
            card.grid(row=0, column=idx, sticky="ew", padx=4, pady=2)
            
            ctk.CTkLabel(card, text=title, font=ctk.CTkFont(size=10), text_color="#94a3b8").pack(anchor="w", padx=8, pady=(4, 1))
            val = ctk.CTkLabel(card, text="--", font=ctk.CTkFont(size=14, weight="bold"), text_color="#f8fafc")
            val.pack(anchor="w", padx=8, pady=(0, 4))
            self.diag_items[key] = val

        # 3. Database Backup & Data Dump Card
        self.dump_card = ctk.CTkFrame(self, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.dump_card.grid(row=2, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.dump_card.grid_columnconfigure(0, weight=1)
        self.dump_card.grid_rowconfigure(3, weight=1)

        ctk.CTkLabel(
            self.dump_card, text="📦 MongoDB Data Dump & Local Backups",
            font=ctk.CTkFont(size=14, weight="bold")
        ).grid(row=0, column=0, sticky="w", padx=16, pady=(12, 8))

        dump_ctrls = ctk.CTkFrame(self.dump_card, fg_color="transparent")
        dump_ctrls.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 8))

        ctk.CTkLabel(dump_ctrls, text="Dump Scope:", font=ctk.CTkFont(size=11, weight="bold")).pack(side="left", padx=(0, 6))

        self.opt_dump_scope = ctk.CTkOptionMenu(
            dump_ctrls,
            values=[
                "Full Database (All 38 Collections, ~385k Docs)",
                "Core Analytics Only (Orders, Subs, Washes, Customers, Cars)"
            ],
            width=360, height=32
        )
        self.opt_dump_scope.set("Full Database (All 38 Collections, ~385k Docs)")
        self.opt_dump_scope.pack(side="left", padx=(0, 12))

        self.btn_dump_now = ctk.CTkButton(
            dump_ctrls, text="📦 Dump Latest MongoDB Data", width=220, height=32,
            fg_color="#0d9488", hover_color="#0f766e",
            command=self._start_dump
        )
        self.btn_dump_now.pack(side="left", padx=(0, 8))

        self.btn_open_dumps = ctk.CTkButton(
            dump_ctrls, text="📁 Open Dumps Folder", width=150, height=32,
            fg_color="#334155", hover_color="#475569",
            command=self._open_dumps_folder
        )
        self.btn_open_dumps.pack(side="left")

        # Progress bar and status
        prog_frame = ctk.CTkFrame(self.dump_card, fg_color="transparent")
        prog_frame.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 10))

        self.dump_progress = ctk.CTkProgressBar(prog_frame, height=10)
        self.dump_progress.set(0)
        self.dump_progress.pack(fill="x", pady=(0, 4))

        self.lbl_dump_status = ctk.CTkLabel(
            prog_frame, text="Ready to export latest MongoDB snapshot to local disk.",
            font=ctk.CTkFont(size=11), text_color="#94a3b8"
        )
        self.lbl_dump_status.pack(anchor="w")

        # Recent Dumps Treeview
        recent_frame = ctk.CTkFrame(self.dump_card, fg_color="transparent")
        recent_frame.grid(row=3, column=0, sticky="nsew", padx=16, pady=(0, 12))
        recent_frame.grid_columnconfigure(0, weight=1)
        recent_frame.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(
            recent_frame, text="Recent Local Database Dumps (in ./dumps):",
            font=ctk.CTkFont(size=12, weight="bold")
        ).grid(row=0, column=0, sticky="w", pady=(0, 4))

        columns = ("date", "folder", "colls", "docs", "size")
        self.dump_tree = ttk.Treeview(recent_frame, columns=columns, show="headings", height=5)
        self.dump_tree.heading("date", text="Dump Date & Time")
        self.dump_tree.heading("folder", text="Folder Name")
        self.dump_tree.heading("colls", text="Collections")
        self.dump_tree.heading("docs", text="Documents")
        self.dump_tree.heading("size", text="Size (MB)")

        self.dump_tree.column("date", width=150, anchor="center")
        self.dump_tree.column("folder", width=260, anchor="w")
        self.dump_tree.column("colls", width=90, anchor="center")
        self.dump_tree.column("docs", width=110, anchor="e")
        self.dump_tree.column("size", width=90, anchor="e")

        scroll_dump = ttk.Scrollbar(recent_frame, orient="vertical", command=self.dump_tree.yview)
        self.dump_tree.configure(yscrollcommand=scroll_dump.set)

        self.dump_tree.grid(row=1, column=0, sticky="nsew")
        scroll_dump.grid(row=1, column=1, sticky="ns")

        self.dump_tree.bind("<Double-1>", self._on_double_click_dump)

    def _preset_local(self):
        self.entry_uri.delete(0, "end")
        self.entry_uri.insert(0, "mongodb://127.0.0.1:27017/rushwash")
        self.entry_db.delete(0, "end")
        self.entry_db.insert(0, "rushwash")

    def _preset_atlas(self):
        import os
        from dotenv import load_dotenv
        load_dotenv()
        atlas_uri = os.getenv("MONGODB_URI", "mongodb+srv://Awais:Awais%40123@prod-cluster000.djidvip.mongodb.net/rushwash")
        self.entry_uri.delete(0, "end")
        self.entry_uri.insert(0, atlas_uri)
        self.entry_db.delete(0, "end")
        self.entry_db.insert(0, "rushwash")

    def _test_connection(self):
        uri = self.entry_uri.get().strip()
        db_name = self.entry_db.get().strip()
        self.lbl_status.configure(text="Pinging MongoDB...", text_color="#38bdf8")
        self.update_idletasks()

        success, msg = self.db.connect(uri, db_name)
        if success:
            self.lbl_status.configure(text=f"✓ Success: {msg}", text_color="#4ade80")
            self.update_data()
        else:
            self.lbl_status.configure(text=f"✗ Error: {msg}", text_color="#f87171")

    def _apply_connection(self):
        self._test_connection()
        if self.db.is_connected and self.on_reconnect_callback:
            self.on_reconnect_callback()
            messagebox.showinfo("MongoDB Connected", "Connection established and dashboard metrics refreshed!")

    def update_data(self):
        stats = self.db.get_database_stats()
        self.apply_data(stats)
        self.refresh_dumps_list()

    def apply_data(self, stats):
        stats = stats or {}
        for key, widget in self.diag_items.items():
            count = stats.get(key, 0)
            widget.configure(text=f"{count:,}")
        
        if self.db.is_connected:
            self.lbl_status.configure(
                text=f"Connected to {self.db.db_name} ({self.db.last_ping_ms} ms)",
                text_color="#4ade80"
            )

    def _start_dump(self):
        if self.is_dumping:
            return
        if not self.db.is_connected:
            messagebox.showwarning("Database Not Connected", "Please connect to MongoDB before dumping.")
            return

        self.is_dumping = True
        self.btn_dump_now.configure(text="⏳ Dumping Database...", state="disabled")
        self.dump_progress.set(0.0)
        self.lbl_dump_status.configure(text="Preparing MongoDB export...", text_color="#38bdf8")

        scope = self.opt_dump_scope.get()
        if "Core Analytics" in scope:
            colls = [
                "rushwash_sale_orders", "rushwash_subscriptions", "rushwash_wash_histories",
                "rushwash_customers", "rushwash_vehicles", "rushwash_pos_sessions",
                "rushwash_employees", "failedRenewals", "voluntaryChurns", "validMembers",
                "packages", "metadata"
            ]
        else:
            colls = None  # Full database (all collections)

        def _worker():
            def _on_prog(p):
                self.after(0, lambda: self._update_dump_progress(p))

            res = self.db.dump_database(collections=colls, progress_callback=_on_prog)
            self.after(0, lambda: self._on_dump_finished(res))

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()

    def _update_dump_progress(self, p):
        idx = p.get("coll_index", 0)
        total = p.get("total_colls", 1)
        ratio = idx / total if total > 0 else 0
        self.dump_progress.set(ratio)
        self.lbl_dump_status.configure(
            text=f"{p.get('status')} ({p.get('total_docs_so_far', 0):,} documents dumped so far)",
            text_color="#38bdf8"
        )

    def _on_dump_finished(self, res):
        self.is_dumping = False
        self.btn_dump_now.configure(text="📦 Dump Latest MongoDB Data", state="normal")
        self.refresh_dumps_list()

        if res.get("success"):
            self.dump_progress.set(1.0)
            self.lbl_dump_status.configure(
                text=f"✓ Dump complete! {res['total_documents']:,} docs ({res['size_mb']} MB) in {res['duration_seconds']}s",
                text_color="#4ade80"
            )
            out_dir = res["output_dir"]
            msg = (
                f"✓ MongoDB Data Dump Completed Successfully!\n\n"
                f"• Collections: {res['collections_count']}\n"
                f"• Total Documents: {res['total_documents']:,}\n"
                f"• Size: {res['size_mb']} MB\n"
                f"• Duration: {res['duration_seconds']}s\n\n"
                f"Saved to:\n{out_dir}\n\n"
                f"Would you like to open this dump folder now?"
            )
            if messagebox.askyesno("Dump Succeeded", msg):
                try:
                    os.startfile(out_dir)
                except Exception as e:
                    messagebox.showerror("Error", f"Could not open directory: {e}")
        else:
            self.lbl_dump_status.configure(text=f"✗ Dump error: {res.get('error')}", text_color="#f87171")
            messagebox.showerror("Dump Failed", f"An error occurred while dumping MongoDB: {res.get('error')}")

    def _open_dumps_folder(self):
        base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dumps")
        os.makedirs(base_dir, exist_ok=True)
        try:
            os.startfile(base_dir)
        except Exception as e:
            messagebox.showerror("Error", f"Could not open dumps directory: {e}")

    def refresh_dumps_list(self):
        for itm in self.dump_tree.get_children():
            self.dump_tree.delete(itm)

        dumps = self.db.get_recent_dumps()
        for d in dumps:
            self.dump_tree.insert("", "end", values=(
                d["date"],
                d["folder"],
                f"{d['colls']} colls",
                f"{d['docs']:,}",
                f"{d['size_mb']} MB"
            ))

    def _on_double_click_dump(self, event):
        item_id = self.dump_tree.focus()
        if not item_id:
            return
        vals = self.dump_tree.item(item_id, "values")
        if vals and len(vals) >= 2:
            folder_name = vals[1]
            base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dumps")
            folder_path = os.path.join(base_dir, folder_name)
            if os.path.exists(folder_path):
                try:
                    os.startfile(folder_path)
                except Exception:
                    pass
