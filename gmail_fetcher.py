"""
Fetch the latest CSV attachment from Gmail and save as domain_data.csv.
Supports .csv and .csv.gz (gzipped) attachments.
Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (and optional GMAIL_SUBJECT_FILTER).
You can put them in a .env file in this folder.
"""
import os
import base64
import gzip
from pathlib import Path

# Load .env from project folder so credentials can be stored there
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
else:
    try:
        from dotenv import load_dotenv
        load_dotenv(_root / ".env")
    except ImportError:
        pass

def get_gmail_service():
    """Build Gmail API service using refresh token from env."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    refresh_token = os.environ.get("GMAIL_REFRESH_TOKEN")
    if not all([client_id, client_secret, refresh_token]):
        raise ValueError(
            "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN"
        )
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    return service


def find_csv_attachment_id(message):
    """From a Gmail message (full format), find first attachment with .csv or .csv.gz filename; return (attachment_id, filename)."""
    payload = message.get("payload") or {}
    parts = payload.get("parts") or []
    for part in parts:
        filename = (part.get("filename") or "").strip()
        lower = filename.lower()
        if not (lower.endswith(".csv") or lower.endswith(".csv.gz") or lower.endswith(".gz")):
            continue
        att_id = part.get("body", {}).get("attachmentId")
        if att_id:
            return att_id, filename
    return None, None


def fetch_and_save(
    output_path="domain_data.csv",
    search_query=None,
    subject_filter=None,
    max_days_back=7,
):
    """
    Fetch the latest email matching the query, save its first CSV attachment to output_path.
    Use search_query for a full Gmail query, or subject_filter for subject line (e.g. daily report).
    Returns (True, path) on success.
    """
    service = get_gmail_service()
    if search_query:
        query = search_query
    elif subject_filter:
        # Gmail subject search: escape double quotes in subject
        sub = subject_filter.replace('"', '\\"')
        query = f'subject:"{sub}" has:attachment newer_than:{max_days_back}d'
    else:
        query = f"has:attachment newer_than:{max_days_back}d"
    response = (
        service.users()
        .messages()
        .list(userId="me", q=query, maxResults=10)
        .execute()
    )
    messages = response.get("messages") or []
    if not messages:
        return False, f"No messages found for query: {query}"

    # Prefer newest first (list is often newest first)
    for msg_ref in messages:
        msg = (
            service.users()
            .messages()
            .get(userId="me", id=msg_ref["id"], format="full")
            .execute()
        )
        att_id, filename = find_csv_attachment_id(msg)
        if not att_id:
            continue
        att = (
            service.users()
            .messages()
            .attachments()
            .get(userId="me", messageId=msg_ref["id"], id=att_id)
            .execute()
        )
        data_b64 = att.get("data")
        if not data_b64:
            continue
        # Gmail API returns base64url; replace URL-safe chars and add padding if needed
        data_b64 = data_b64.replace("-", "+").replace("_", "/")
        pad = 4 - len(data_b64) % 4
        if pad != 4:
            data_b64 += "=" * pad
        content = base64.b64decode(data_b64)
        # Decompress if attachment is gzipped (.csv.gz or .gz)
        lower = (filename or "").lower()
        if lower.endswith(".gz") or lower.endswith(".csv.gz"):
            content = gzip.decompress(content)
        out = Path(output_path)
        out.write_bytes(content)
        return True, str(out)
    return False, f"No CSV attachment found in last {len(messages)} messages"


if __name__ == "__main__":
    import sys
    # Use GMAIL_SUBJECT_FILTER to fetch only emails with this subject (e.g. daily report)
    subject = os.environ.get("GMAIL_SUBJECT_FILTER", "").strip()
    ok, result = fetch_and_save(subject_filter=subject or None)
    if ok:
        print("Saved:", result)
        sys.exit(0)
    else:
        print("Error:", result)
        sys.exit(1)
