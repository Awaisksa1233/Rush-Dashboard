"""
Configuration settings for Wafeq Tkinter App
"""
import os

# Wafeq API Configuration
API_KEY = os.environ.get("WAFEQ_API_KEY", "725ozoRs.kUrZmrgQ7bUOpTPlmcPZyQKKxEvZRseM")
BASE_URL = "https://api.wafeq.com/v1"

# Organization Defaults
DEFAULT_CURRENCY = "SAR"
DEFAULT_COUNTRY = "SA"
DEFAULT_LANGUAGE = "en"

# App Metadata
APP_TITLE = "Wafeq Invoice & Accounting Manager"
APP_VERSION = "1.0.0"
WINDOW_SIZE = "1280x780"
MIN_WINDOW_SIZE = (1050, 650)
