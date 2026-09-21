"""
Wafeq Base API Client
"""
import requests
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("wafeq_api")

class WafeqAPIError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details

class WafeqClient:
    def __init__(self, api_key: str, base_url: str = "https://api.wafeq.com/v1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Api-Key {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        })

    def _url(self, endpoint: str) -> str:
        ep = endpoint.strip("/")
        return f"{self.base_url}/{ep}/"

    def _parse_error(self, response: requests.Response) -> str:
        try:
            data = response.json()
            if isinstance(data, dict):
                # Standard Wafeq error formats
                if "detail" in data:
                    return str(data["detail"])
                if "error" in data:
                    return str(data["error"])
                # Field errors e.g. {"field": ["msg"]}
                errors = []
                for k, v in data.items():
                    if isinstance(v, list):
                        errors.append(f"{k}: {', '.join(str(i) for i in v)}")
                    else:
                        errors.append(f"{k}: {v}")
                if errors:
                    return "; ".join(errors)
            elif isinstance(data, list):
                return ", ".join(str(d) for d in data)
            return response.text[:200]
        except Exception:
            return response.text[:200] or f"HTTP {response.status_code}"

    def request(self, method: str, endpoint: str, **kwargs) -> Any:
        url = self._url(endpoint)
        try:
            response = self.session.request(method, url, timeout=30, **kwargs)
            
            if response.status_code == 204:
                return True
                
            if not response.ok:
                err_msg = self._parse_error(response)
                raise WafeqAPIError(
                    f"API Error ({response.status_code}): {err_msg}",
                    status_code=response.status_code,
                    details=response.text
                )
                
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return response.json()
            return response.content
        except requests.exceptions.RequestException as e:
            raise WafeqAPIError(f"Network connection failed: {str(e)}")

    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        return self.request("GET", endpoint, params=params)

    def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Any:
        return self.request("POST", endpoint, json=data)

    def patch(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Any:
        return self.request("PATCH", endpoint, json=data)

    def delete(self, endpoint: str) -> Any:
        return self.request("DELETE", endpoint)

    def get_all_pages(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Automatically traverse paginated results"""
        results = []
        p = dict(params or {})
        p.setdefault("page_size", 100)
        
        url = self._url(endpoint)
        while url:
            try:
                resp = self.session.get(url, params=p if url == self._url(endpoint) else None, timeout=30)
                if not resp.ok:
                    raise WafeqAPIError(f"Error fetching {endpoint}: {self._parse_error(resp)}", resp.status_code)
                data = resp.json()
                if isinstance(data, dict):
                    batch = data.get("results", [])
                    results.extend(batch)
                    url = data.get("next")
                elif isinstance(data, list):
                    results.extend(data)
                    url = None
                else:
                    url = None
            except requests.exceptions.RequestException as e:
                raise WafeqAPIError(f"Network error: {str(e)}")
        return results

    def download_file(self, endpoint: str) -> bytes:
        url = self._url(endpoint)
        resp = self.session.get(url, timeout=45)
        if not resp.ok:
            raise WafeqAPIError(f"Failed to download: {self._parse_error(resp)}", resp.status_code)
        return resp.content
