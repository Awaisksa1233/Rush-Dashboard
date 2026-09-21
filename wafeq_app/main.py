"""
Wafeq Invoice Manager — Application Entry Point
"""
import sys
import os

# Ensure package root is in Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wafeq_app.config import API_KEY, BASE_URL
from wafeq_app.api.client import WafeqClient
from wafeq_app.ui.app import WafeqApp

def main():
    if not API_KEY:
        print("Error: WAFEQ_API_KEY is not configured.", file=sys.stderr)
        sys.exit(1)

    print("Initializing Wafeq API Client...")
    client = WafeqClient(api_key=API_KEY, base_url=BASE_URL)

    print("Launching Desktop UI...")
    app = WafeqApp(client=client)
    app.mainloop()

if __name__ == "__main__":
    main()
