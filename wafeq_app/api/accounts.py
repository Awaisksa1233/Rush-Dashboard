"""
Wafeq Accounts API
"""
from typing import List, Dict, Any, Optional
from .client import WafeqClient

class AccountsAPI:
    def __init__(self, client: WafeqClient):
        self.client = client

    def list_accounts(self) -> List[Dict[str, Any]]:
        """Retrieve all accounts in the chart of accounts"""
        return self.client.get_all_pages("accounts")

    def get_posting_accounts(self) -> List[Dict[str, Any]]:
        """Get accounts that transactions can be directly posted to"""
        all_accounts = self.list_accounts()
        return [a for a in all_accounts if a.get("is_posting") is True]

    def get_revenue_accounts(self) -> List[Dict[str, Any]]:
        """Get revenue / sales accounts for invoice line items"""
        all_accounts = self.list_accounts()
        return [
            a for a in all_accounts
            if a.get("is_posting") is True and a.get("classification") in ["REVENUE", "INCOME"]
        ]

    def get_payment_accounts(self) -> List[Dict[str, Any]]:
        """Get bank/cash accounts that can receive payments (paid_through_account)"""
        all_accounts = self.list_accounts()
        return [
            a for a in all_accounts
            if a.get("is_payment_enabled") is True
        ]
