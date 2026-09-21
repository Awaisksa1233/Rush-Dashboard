"""
Wafeq Tax Rates API
"""
from typing import List, Dict, Any, Optional
from .client import WafeqClient

class TaxRatesAPI:
    def __init__(self, client: WafeqClient):
        self.client = client

    def list_tax_rates(self) -> List[Dict[str, Any]]:
        """Retrieve all active tax rates"""
        return self.client.get_all_pages("tax-rates")

    def get_standard_sales_vat(self) -> Optional[Dict[str, Any]]:
        """Find the default VAT on Sales tax rate (e.g. 15% KSA VAT)"""
        taxes = self.list_tax_rates()
        # Prefer "VAT on Sales"
        for t in taxes:
            name = (t.get("name") or "").lower()
            if "vat on sales" in name or ("sales" in name and t.get("rate", 0) == 0.15):
                return t
        # Fallback to any 15% rate
        for t in taxes:
            if t.get("rate") == 0.15:
                return t
        return taxes[0] if taxes else None
