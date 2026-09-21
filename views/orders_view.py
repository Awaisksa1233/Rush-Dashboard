"""
views/orders_view.py - Interactive Orders and Transactions Explorer with Search & CSV Export
"""
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import customtkinter as ctk


class OrdersView(ctk.CTkFrame):
    def __init__(self, parent, db_manager):
        super().__init__(parent, fg_color="transparent")
        self.db = db_manager
        self.orders = []

        self.setup_ui()

    def setup_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # 1. Filter and Action Toolbar
        self.toolbar = ctk.CTkFrame(self, fg_color=("gray92", "#1e293b"), corner_radius=10)
        self.toolbar.grid(row=0, column=0, sticky="ew", padx=10, pady=(10, 8))

        # Search box
        self.search_var = tk.StringVar()
        self.entry_search = ctk.CTkEntry(
            self.toolbar, placeholder_text="Search order code, customer, plate, or phone...",
            textvariable=self.search_var, width=320, height=32
        )
        self.entry_search.pack(side="left", padx=10, pady=8)
        self.entry_search.bind("<Return>", lambda e: self.update_data())

        btn_search = ctk.CTkButton(
            self.toolbar, text="Search", width=70, height=32,
            command=self.update_data, fg_color="#3b82f6", hover_color="#2563eb"
        )
        btn_search.pack(side="left", padx=(0, 10), pady=8)

        # Type Filter
        self.type_var = tk.StringVar(value="All Types")
        self.opt_type = ctk.CTkOptionMenu(
            self.toolbar, values=["All Types", "Renewal", "New Sales", "One-Time Washes"],
            variable=self.type_var, command=lambda v: self.update_data(),
            width=140, height=32
        )
        self.opt_type.pack(side="left", padx=(0, 10), pady=8)

        # Limit dropdown
        self.limit_var = tk.StringVar(value="100 Rows")
        self.opt_limit = ctk.CTkOptionMenu(
            self.toolbar, values=["50 Rows", "100 Rows", "250 Rows", "500 Rows"],
            variable=self.limit_var, command=lambda v: self.update_data(),
            width=100, height=32
        )
        self.opt_limit.pack(side="left", padx=(0, 10), pady=8)

        # Export CSV Button
        self.btn_export = ctk.CTkButton(
            self.toolbar, text="📥 Export CSV", width=110, height=32,
            fg_color="#10b981", hover_color="#059669",
            command=self._export_csv
        )
        self.btn_export.pack(side="right", padx=10, pady=8)

        # 2. Table Container
        self.table_card = ctk.CTkFrame(self, fg_color=("gray92", "#1e293b"), corner_radius=12)
        self.table_card.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 8))
        self.table_card.grid_columnconfigure(0, weight=1)
        self.table_card.grid_rowconfigure(0, weight=1)

        cols = ("code", "customer", "phone", "plate", "amount", "kind", "gateway", "status", "date")
        self.tree = ttk.Treeview(self.table_card, columns=cols, show="headings", height=16)

        style = ttk.Style()
        style.configure(
            "Orders.Treeview",
            background="#0f172a",
            foreground="#f8fafc",
            rowheight=26,
            fieldbackground="#0f172a",
            font=("Segoe UI", 9)
        )
        style.configure(
            "Orders.Treeview.Heading",
            background="#1e293b",
            foreground="#94a3b8",
            relief="flat",
            font=("Segoe UI", 9, "bold")
        )
        self.tree.configure(style="Orders.Treeview")

        self.tree.heading("code", text="Order Code")
        self.tree.heading("customer", text="Customer")
        self.tree.heading("phone", text="Phone")
        self.tree.heading("plate", text="Plate")
        self.tree.heading("amount", text="Amount")
        self.tree.heading("kind", text="Order Type")
        self.tree.heading("gateway", text="Payment Gateway")
        self.tree.heading("status", text="Status")
        self.tree.heading("date", text="Date & Time")

        self.tree.column("code", width=105, anchor="center")
        self.tree.column("customer", width=150, anchor="w")
        self.tree.column("phone", width=105, anchor="center")
        self.tree.column("plate", width=95, anchor="center")
        self.tree.column("amount", width=105, anchor="e")
        self.tree.column("kind", width=105, anchor="center")
        self.tree.column("gateway", width=115, anchor="center")
        self.tree.column("status", width=75, anchor="center")
        self.tree.column("date", width=130, anchor="center")

        scroll_y = ttk.Scrollbar(self.table_card, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll_y.set)

        self.tree.grid(row=0, column=0, sticky="nsew", padx=(10, 0), pady=10)
        scroll_y.grid(row=0, column=1, sticky="ns", padx=(0, 10), pady=10)

        # 3. Footer Bar
        self.footer = ctk.CTkFrame(self, fg_color="transparent")
        self.footer.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 8))

        self.lbl_stats = ctk.CTkLabel(
            self.footer, text="Displaying 0 orders | Total Value: 0.00 SAR",
            font=ctk.CTkFont(size=11), text_color=("gray40", "gray65")
        )
        self.lbl_stats.pack(side="left")

    def update_data(self):
        search_txt = self.search_var.get().strip()
        selected_type = self.type_var.get()
        if selected_type == "All Types":
            filter_kind = "All"
        elif "Renewal" in selected_type:
            filter_kind = "Renewal"
        elif "New" in selected_type:
            filter_kind = "New Sales"
        else:
            filter_kind = "One-Time Washes"

        limit_str = self.limit_var.get().split()[0]
        limit = int(limit_str) if limit_str.isdigit() else 100

        orders = self.db.get_orders(
            limit=limit, search=search_txt, order_type=filter_kind,
            order_status=getattr(self.db, "order_status_filter", None),
            moyasar_only=getattr(self.db, "moyasar_only", True)
        )
        self.apply_data(orders)

    def apply_data(self, orders):
        self.orders = orders or []
        for itm in self.tree.get_children():
            self.tree.delete(itm)

        total_value = 0.0
        for o in self.orders:
            # parse numeric SAR amount
            try:
                amt = float(o["amount"].replace("SAR", "").replace(",", "").strip())
                total_value += amt
            except Exception:
                pass

            self.tree.insert("", "end", values=(
                o["code"],
                o["customer"],
                o["phone"],
                o["plate"],
                o["amount"],
                o["kind"],
                o.get("gateway", "N/A"),
                o["status"],
                o["date"]
            ))

        self.lbl_stats.configure(
            text=f"Displaying {len(self.orders):,} orders | Total Value: {total_value:,.2f} SAR"
        )

    def _export_csv(self):
        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            initialfile="rushwash_orders_export.csv",
            title="Export Orders to CSV"
        )
        if not file_path:
            return

        try:
            exported_count = self.db.export_orders_to_csv(file_path, limit=5000)
            messagebox.showinfo("Export Successful", f"Successfully exported {exported_count:,} orders to:\n{file_path}")
        except Exception as e:
            messagebox.showerror("Export Failed", f"Could not export orders:\n{str(e)}")
