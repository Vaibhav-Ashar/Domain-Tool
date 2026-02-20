"""
One-time script to get a Gmail refresh token for the daily data fetch.
Run: python get_gmail_refresh_token.py

1. Paste your Google OAuth Client ID and Client Secret below (or set env vars
   GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).
2. Run this script; it opens a browser for you to sign in with the Gmail account
   that receives the daily data emails.
3. Copy the printed refresh token into your env as GMAIL_REFRESH_TOKEN.
"""
import os
from google_auth_oauthlib.flow import InstalledAppFlow

# Paste your credentials here (from Google Cloud Console > APIs & Services > Credentials)
# Or leave empty and set env vars GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET instead.
GOOGLE_CLIENT_ID = ""
GOOGLE_CLIENT_SECRET = ""

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def main():
    client_id = (GOOGLE_CLIENT_ID or os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    client_secret = (GOOGLE_CLIENT_SECRET or os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        print("Usage: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then run:")
        print("  python get_gmail_refresh_token.py")
        print("You can create OAuth credentials at: https://console.cloud.google.com/apis/credentials")
        return
    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uris": ["http://localhost"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
    )
    creds = flow.run_local_server(port=0)
    print("\n--- Add this to your environment (e.g. Railway / .env) ---")
    print("GMAIL_REFRESH_TOKEN=" + (creds.refresh_token or ""))
    print("---")

if __name__ == "__main__":
    main()
