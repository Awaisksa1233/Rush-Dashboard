"""
UI Theme and Styling Constants
"""
import customtkinter as ctk

# Color Palette (Wafeq-inspired Emerald/Slate Dark Theme)
COLOR_BG_DARK = "#12171e"
COLOR_SIDEBAR_BG = "#0f1319"
COLOR_CARD_BG = "#1b232e"
COLOR_CARD_HOVER = "#232e3d"
COLOR_INPUT_BG = "#161d26"
COLOR_BORDER = "#2a3749"

COLOR_PRIMARY = "#00a884"       # Wafeq Emerald
COLOR_PRIMARY_HOVER = "#008a6c"
COLOR_SECONDARY = "#334155"
COLOR_SECONDARY_HOVER = "#475569"

COLOR_DANGER = "#ef4444"
COLOR_DANGER_HOVER = "#dc2626"
COLOR_WARNING = "#f59e0b"
COLOR_SUCCESS = "#10b981"
COLOR_INFO = "#3b82f6"

COLOR_TEXT_WHITE = "#f8fafc"
COLOR_TEXT_MUTED = "#94a3b8"
COLOR_TEXT_SUBTLE = "#64748b"

# Fonts
FONT_HEADING = ("Segoe UI", 18, "bold")
FONT_SUBHEADING = ("Segoe UI", 14, "bold")
FONT_BODY = ("Segoe UI", 12)
FONT_BODY_BOLD = ("Segoe UI", 12, "bold")
FONT_CAPTION = ("Segoe UI", 10)
FONT_MONO = ("Consolas", 11)

def apply_app_theme():
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")
