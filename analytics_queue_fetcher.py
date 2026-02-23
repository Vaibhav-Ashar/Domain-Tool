"""
Analytics queue flow: (1) POST submit queue, (2) poll status until succeeded, (3) GET download.
Requests last N days (default 45) so the dashboard has enough range for WoW comparison.
Set ANALYTICS_API_KEY (Bearer token), optionally ANALYTICS_BASE_URL and ANALYTICS_QUEUE_DAYS (default 45).
Loads .env from this folder.
"""
import os
import json
import time
import gzip
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Load .env from project folder
_root = Path(__file__).resolve().parent
_env_file = _root / ".env"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and value and key not in os.environ:
                os.environ[key] = value

try:
    import requests
except ImportError:
    requests = None

BASE_URL = os.environ.get("ANALYTICS_BASE_URL", "https://analytics.mn/rest/model").rstrip("/")
# Default payload template; startDate/endDate are replaced for the requested date
QUEUE_PAYLOAD_TEMPLATE = {
    "query": {
        "pool": "Low",
        "isCusGroup": 1,
        "cusGroup": "000000",
        "startDate": "{start_date}",
        "endDate": "{end_date}",
        "limit": 50,
        "metrics": ["1038025", "1038024", "7644"],
        "dimensions": ["-1", "3078", "3370", "598"],
        "showQuery": 1,
        "isDownload": 1,
        "modelId": "907",
        "modelName": "Max Learning",
        "adminId": 18491,
        "queryId": "MAX_A18491_M907_1771837593353710",
        "buId": "7",
        "buName": "MAX",
        "granularity": "All",
        "isNADisabled": "0",
        "isNestedEnabled": 0,
        "dataFormat": 1,
        "SSOGroups": ["AUTOOPT-DEV", "AUTOOPT-Tech-Devs-SSO", "AUTOOPT-Tech-Devs-SSH"],
        "filters": {},
        "showGrandTotal": True,
        "showReportTotal": True,
        "reportId": None,
        "nestedFilter": {
            "condition": "and",
            "fields": [
                {"dimensionId": "7152", "type": "Equal", "isEnabled": True, "values": ["Media.net - [1]"]},
                {"dimensionId": "16548", "type": "Equal", "isEnabled": True, "values": ["MX", ""], "isSql": False},
                {"id": "ebff40", "type": "Equal", "values": ["search", "redirect"], "dimensionId": "5700", "isSql": False, "isEnabled": True},
            ],
        },
        "infoOnly": True,
    },
    "hash": "367520b041c52168e0693cca0463c44a",
    "name": "Max Learning_07Jan2026_0000-20Feb2026_2359",
    "timestamp": 1771837593354,
    "optimized": False,
    "emailId": "ashar.v@media.net",
}


def _headers():
    token = os.environ.get("ANALYTICS_API_KEY", "").strip() or os.environ.get("ANALYTICS_BEARER_TOKEN", "").strip()
    if not token:
        raise ValueError("Set ANALYTICS_API_KEY or ANALYTICS_BEARER_TOKEN (Bearer token) in .env")
    return {
        "Authorization": token if token.startswith("Bearer ") else f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _date_range_for_day(date_utc):
    """Return (start_date, end_date) strings for that day in UTC (ISO format for API)."""
    start = date_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1) - timedelta(seconds=1)
    return start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ")


def _date_range_last_n_days(days_utc):
    """Return (start_date, end_date) for the last N days ending yesterday UTC (ISO for API)."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    end = (now - timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=999999)
    start = (now - timedelta(days=days_utc)).replace(hour=0, minute=0, second=0, microsecond=0)
    return start.strftime("%Y-%m-%dT%H:%M:%SZ"), end.strftime("%Y-%m-%dT%H:%M:%SZ")


def _report_name_from_dates(start_date_str, end_date_str):
    """Build dynamic report name from date range, e.g. Max Learning_09Jan2026_0000-22Feb2026_2359."""
    def to_short(s):
        # "2026-01-09T00:00:00Z" -> "09Jan2026", "2026-02-22T23:59:59Z" -> "22Feb2026"
        try:
            dt = datetime.strptime(s[:10], "%Y-%m-%d")
            return dt.strftime("%d%b%Y")
        except Exception:
            return s[:10].replace("-", "")
    start_short = to_short(start_date_str)
    end_short = to_short(end_date_str)
    return "Max Learning_{}_0000-{}_2359".format(start_short, end_short)


def submit_queue(start_date_str=None, end_date_str=None, for_date_utc=None):
    """Step 1: POST submitQueueRequest. Returns queue_id from response.
    Pass either (start_date_str, end_date_str) in ISO format, or for_date_utc (single day)."""
    if not requests:
        raise RuntimeError("Install requests: pip install requests")
    if start_date_str is not None and end_date_str is not None:
        start_date, end_date = start_date_str, end_date_str
    elif for_date_utc is not None:
        start_date, end_date = _date_range_for_day(for_date_utc)
    else:
        raise ValueError("Pass (start_date_str, end_date_str) or for_date_utc")
    payload = json.loads(json.dumps(QUEUE_PAYLOAD_TEMPLATE))
    payload["query"]["startDate"] = start_date
    payload["query"]["endDate"] = end_date
    payload["name"] = _report_name_from_dates(start_date, end_date)
    payload["timestamp"] = int(time.time() * 1000)
    url = f"{BASE_URL}/submitQueueRequest"
    r = requests.post(url, headers=_headers(), json=payload, timeout=60)
    if not r.ok:
        try:
            data = r.json()
            resp = data.get("response") or {}
            repeated_id = resp.get("repeatedQueryId")
            if repeated_id:
                print("Request already in progress; using existing queue ID:", repeated_id)
                return repeated_id
        except Exception:
            pass
        print("API response ({}): {}".format(r.status_code, r.text[:500] if r.text else "(empty)"))
        r.raise_for_status()
    data = r.json()
    queue_id = data.get("queueId") or data.get("queryId")
    if not queue_id and isinstance(data.get("data"), dict):
        queue_id = data["data"].get("queueId") or data["data"].get("queryId")
    if not queue_id:
        raise ValueError("No queueId/queryId in response: " + str(data)[:200])
    return queue_id


def _status_summary(data):
    """Extract status, percentage, dataSize, message from getAllQueueStatus response.
    API returns: status (RUNNING/SUCCESS), percentage (e.g. "24.87"), queryId, name, dataSize ("0 bytes")."""
    status = None
    progress = None
    data_size = None
    message = None

    def get_first_obj(obj):
        if isinstance(obj, dict):
            return obj
        if isinstance(obj, list) and obj and isinstance(obj[0], dict):
            return obj[0]
        return {}

    if isinstance(data, dict):
        inner = get_first_obj(data.get("data")) or data
        status = data.get("status") or inner.get("status")
        progress = (
            data.get("percentage") or data.get("progress") or data.get("percent")
            or data.get("progressPercent") or data.get("completionPercentage")
            or inner.get("percentage") or inner.get("progress") or inner.get("percent")
            or inner.get("progressPercent") or inner.get("completionPercentage")
        )
        data_size = data.get("dataSize") or inner.get("dataSize")
        message = data.get("message") or inner.get("message") or (data.get("response") or {}).get("message")
    if isinstance(data, list) and data and isinstance(data[0], dict):
        row = data[0]
        status = status or row.get("status")
        progress = progress or row.get("percentage") or row.get("progress") or row.get("percent") or row.get("progressPercent")
        data_size = data_size or row.get("dataSize")
        message = message or row.get("message")
    return status, progress, data_size, message


def poll_until_succeeded(queue_id, max_wait_seconds=1200, poll_interval=30):
    """Step 2: Poll getAllQueueStatus until status indicates success. Prints queue ID, then status/progress every poll."""
    if not requests:
        raise RuntimeError("Install requests: pip install requests")
    url = f"{BASE_URL}/getAllQueueStatus"
    params = {"queueId": queue_id}
    deadline = time.time() + max_wait_seconds
    attempt = 0
    start = time.time()
    while time.time() < deadline:
        attempt += 1
        r = requests.get(url, headers=_headers(), params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        status, progress, data_size, message = _status_summary(data)
        status_str = str(status) if status is not None else "unknown"
        success = status and "succe" in str(status).lower()
        ts = time.strftime("%H:%M:%S", time.gmtime())
        elapsed = int(time.time() - start)
        parts = ["[{}] {} (+{}s) - Status: {}".format(attempt, ts, elapsed, status_str)]
        if progress is not None:
            try:
                pct = float(progress)
                parts.append("| {}%".format(pct))
            except (TypeError, ValueError):
                parts.append("| {}".format(progress))
        if data_size is not None:
            parts.append("| dataSize: {}".format(data_size))
        if message:
            parts.append("| {}".format(str(message)[:60]))
        print("  " + " ".join(parts))
        if success:
            print("  Step 2 complete: status = Success.")
            return queue_id
        time.sleep(poll_interval)
    raise TimeoutError(f"Queue {queue_id} did not succeed within {max_wait_seconds}s")


def download_queue_file(query_id, output_path):
    """Step 3: GET queueDownload and save to output_path. Handles gzip if needed."""
    if not requests:
        raise RuntimeError("Install requests: pip install requests")
    url = f"{BASE_URL}/queueDownload"
    params = {"queryId": query_id}
    r = requests.get(url, headers=_headers(), params=params, timeout=120)
    r.raise_for_status()
    content = r.content
    if r.headers.get("Content-Encoding") == "gzip":
        content = gzip.decompress(content)
    Path(output_path).write_bytes(content)
    return output_path


def fetch_and_save(output_path="domain_data.csv", for_date_utc=None, last_n_days=None):
    """
    Run full flow: submit queue, poll until succeeded, download file.
    - If last_n_days is set (or ANALYTICS_QUEUE_DAYS in env, default 45): request last N days ending yesterday UTC.
    - Else if for_date_utc is set: request that single day.
    - Else: request last 45 days.
    Returns (True, path) on success.
    """
    days = last_n_days
    if days is None:
        try:
            days = int(os.environ.get("ANALYTICS_QUEUE_DAYS", "45").strip())
        except ValueError:
            days = 45
    start_str, end_str = _date_range_last_n_days(days)
    print("")
    print("=== Step 1: Submit queue request ===")
    print("Requesting range: {} to {} (last {} days)".format(start_str, end_str, days))
    queue_id = submit_queue(start_date_str=start_str, end_date_str=end_str)
    print("")
    print(">>> Queue ID: {}".format(queue_id))
    print("    (You can verify this ID on your analytics system.)")
    print("")
    print("=== Step 2: Polling status (every 30 s, up to 20 min) ===")
    poll_until_succeeded(queue_id, max_wait_seconds=1200, poll_interval=30)
    print("")
    print("=== Step 3: Downloading file ===")
    download_queue_file(queue_id, output_path)
    print("Step 3 complete: saved to {}".format(output_path))
    return True, output_path


if __name__ == "__main__":
    import sys
    try:
        ok, result = fetch_and_save()
        if ok:
            print("Saved:", result)
            sys.exit(0)
    except Exception as e:
        print("Error:", e)
        sys.exit(1)
