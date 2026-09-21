"""
Reusable UI Components for Wafeq Manager
"""
import threading
import tkinter as tk
from tkinter import ttk, messagebox
import customtkinter as ctk
from typing import Callable, Any, Optional, List, Dict, Tuple
from .theme import (
    COLOR_BG_DARK, COLOR_CARD_BG, COLOR_CARD_HOVER, COLOR_BORDER,
    COLOR_PRIMARY, COLOR_PRIMARY_HOVER, COLOR_SECONDARY, COLOR_SECONDARY_HOVER,
    COLOR_DANGER, COLOR_DANGER_HOVER, COLOR_WARNING, COLOR_SUCCESS, COLOR_INFO,
    COLOR_TEXT_WHITE, COLOR_TEXT_MUTED, COLOR_INPUT_BG,
    FONT_HEADING, FONT_SUBHEADING, FONT_BODY, FONT_BODY_BOLD, FONT_CAPTION
)

class AsyncWorker:
    """Executes blocking functions in a background thread and posts results back to Tkinter thread."""
    @staticmethod
    def run(root: tk.Misc, task_fn: Callable[[], Any], on_success: Optional[Callable[[Any], None]] = None,
            on_error: Optional[Callable[[Exception], None]] = None):
        def worker():
            try:
                res = task_fn()
                if on_success:
                    root.after(0, lambda: on_success(res))
            except Exception as e:
                if on_error:
                    root.after(0, lambda: on_error(e))
                else:
                    root.after(0, lambda: messagebox.showerror("Operation Failed", str(e)))

        t = threading.Thread(target=worker, daemon=True)
        t.start()


class ModernDataTable(ctk.CTkFrame):
    """Clean, high-performance table component using themed ttk.Treeview with search and sorting."""
    def __init__(self, master, columns: List[Tuple[str, str, int]], on_select: Optional[Callable[[Dict[str, Any]], None]] = None,
                 on_double_click: Optional[Callable[[Dict[str, Any]], None]] = None, **kwargs):
        super().__init__(master, fg_color=COLOR_CARD_BG, corner_radius=10, **kwargs)
        self.column_defs = columns # list of (col_id, display_name, min_width)
        self.on_select = on_select
        self.on_double_click = on_double_click
        self.rows_data: List[Dict[str, Any]] = []
        self.filtered_data: List[Dict[str, Any]] = []
        self._sort_col = None
        self._sort_reverse = False

        self._setup_style()
        self._build_ui()

    def _setup_style(self):
        style = ttk.Style()
        style.theme_use("clam")
        
        # Configure treeview styles
        style.configure(
            "Wafeq.Treeview",
            background="#161d26",
            foreground=COLOR_TEXT_WHITE,
            fieldbackground="#161d26",
            borderwidth=0,
            font=("Segoe UI", 10),
            rowheight=34
        )
        style.configure(
            "Wafeq.Treeview.Heading",
            background="#1e2735",
            foreground="#cbd5e1",
            borderwidth=0,
            relief="flat",
            font=("Segoe UI", 10, "bold")
        )
        style.map("Wafeq.Treeview.Heading",
            background=[("active", "#2a3749")]
        )
        style.map("Wafeq.Treeview",
            background=[("selected", "#00a884")],
            foreground=[("selected", "#ffffff")]
        )

    def _build_ui(self):
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)

        col_ids = [c[0] for c in self.column_defs]
        self.tree = ttk.Treeview(
            self,
            columns=col_ids,
            show="headings",
            style="Wafeq.Treeview",
            selectmode="browse"
        )

        for col_id, title, width in self.column_defs:
            self.tree.heading(col_id, text=title, command=lambda c=col_id: self._sort_by_column(c))
            self.tree.column(col_id, width=width, minwidth=60, anchor="w")

        # Scrollbar
        self.v_scrollbar = ttk.Scrollbar(self, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=self.v_scrollbar.set)

        self.tree.grid(row=0, column=0, sticky="nsew", padx=(6, 0), pady=6)
        self.v_scrollbar.grid(row=0, column=1, sticky="ns", padx=(0, 6), pady=6)

        self.tree.bind("<<TreeviewSelect>>", self._handle_select)
        self.tree.bind("<Double-1>", self._handle_double_click)

    def set_data(self, data: List[Dict[str, Any]]):
        self.rows_data = data
        self.filtered_data = list(data)
        self._refresh_tree()

    def filter_data(self, query: str, search_fields: Optional[List[str]] = None):
        query = query.strip().lower()
        if not query:
            self.filtered_data = list(self.rows_data)
        else:
            fields = search_fields or [c[0] for c in self.column_defs]
            filtered = []
            for item in self.rows_data:
                for f in fields:
                    val = str(item.get(f, "")).lower()
                    if query in val:
                        filtered.append(item)
                        break
            self.filtered_data = filtered
        self._refresh_tree()

    def _refresh_tree(self):
        self.tree.delete(*self.tree.get_children())
        for idx, item in enumerate(self.filtered_data):
            values = [self._format_value(c[0], item.get(c[0], "")) for c in self.column_defs]
            tag = "even" if idx % 2 == 0 else "odd"
            self.tree.insert("", "end", iid=str(idx), values=values, tags=(tag,))
        
        self.tree.tag_configure("even", background="#161d26")
        self.tree.tag_configure("odd", background="#1a232f")

    def _format_value(self, col_id: str, val: Any) -> str:
        if val is None:
            return "-"
        if isinstance(val, bool):
            return "Yes" if val else "No"
        if isinstance(val, float):
            if "rate" in col_id or "tax" in col_id:
                if val <= 1.0:
                    return f"{val * 100:.1f}%"
            return f"{val:,.2f}"
        return str(val)

    def _sort_by_column(self, col_id: str):
        if self._sort_col == col_id:
            self._sort_reverse = not self._sort_reverse
        else:
            self._sort_col = col_id
            self._sort_reverse = False

        def get_val(item):
            v = item.get(col_id, "")
            if v is None:
                return ""
            try:
                return float(v)
            except (ValueError, TypeError):
                return str(v).lower()

        self.filtered_data.sort(key=get_val, reverse=self._sort_reverse)
        self._refresh_tree()

    def _handle_select(self, event):
        sel = self.tree.selection()
        if sel and self.on_select:
            idx = int(sel[0])
            if idx < len(self.filtered_data):
                self.on_select(self.filtered_data[idx])

    def _handle_double_click(self, event):
        sel = self.tree.selection()
        if sel and self.on_double_click:
            idx = int(sel[0])
            if idx < len(self.filtered_data):
                self.on_double_click(self.filtered_data[idx])

    def get_selected(self) -> Optional[Dict[str, Any]]:
        sel = self.tree.selection()
        if sel:
            idx = int(sel[0])
            if idx < len(self.filtered_data):
                return self.filtered_data[idx]
        return None


class StatusBadge(ctk.CTkFrame):
    """Small colored badge for statuses like DRAFT, PAID, REPORTED, PASS, FAIL"""
    COLORS = {
        "PAID": (COLOR_SUCCESS, "#052e16"),
        "REPORTED": (COLOR_SUCCESS, "#052e16"),
        "PASS": (COLOR_SUCCESS, "#052e16"),
        "APPROVED": (COLOR_SUCCESS, "#052e16"),
        "DRAFT": (COLOR_WARNING, "#451a03"),
        "PENDING": (COLOR_WARNING, "#451a03"),
        "SUBMITTED": (COLOR_INFO, "#172554"),
        "FAILED": (COLOR_DANGER, "#450a0a"),
        "ERROR": (COLOR_DANGER, "#450a0a"),
        "UNREPORTED": (COLOR_TEXT_MUTED, "#1e293b"),
    }

    def __init__(self, master, text: str, **kwargs):
        up = text.upper()
        fg_col, bg_col = self.COLORS.get(up, (COLOR_TEXT_MUTED, "#1e293b"))
        super().__init__(master, fg_color=bg_col, corner_radius=6, border_width=1, border_color=fg_col, **kwargs)
        
        self.label = ctk.CTkLabel(
            self,
            text=f" {up} ",
            text_color=fg_col,
            font=("Segoe UI", 9, "bold")
        )
        self.label.pack(padx=4, pady=2)


class BaseDialog(ctk.CTkToplevel):
    """Base modal dialog with modern styling, escape handling, and centering"""
    def __init__(self, parent, title: str, width: int = 600, height: int = 500):
        super().__init__(parent)
        self.title(title)
        self.geometry(f"{width}x{height}")
        self.configure(fg_color=COLOR_BG_DARK)
        self.transient(parent)
        self.grab_set()
        
        # Center dialog relative to parent
        self.update_idletasks()
        try:
            px = parent.winfo_rootx() + (parent.winfo_width() // 2) - (width // 2)
            py = parent.winfo_rooty() + (parent.winfo_height() // 2) - (height // 2)
            self.geometry(f"+{max(0, px)}+{max(0, py)}")
        except Exception:
            pass

        self.bind("<Escape>", lambda e: self.destroy())


class ConfirmDialog:
    """Helper for user confirmation prompts"""
    @staticmethod
    def ask(parent, title: str, message: str) -> bool:
        return messagebox.askyesno(title, message, parent=parent)
