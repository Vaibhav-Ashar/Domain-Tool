# Gmail API: Daily Data Fetch at a Fixed UTC Hour

The backend can fetch the latest CSV attachment from your Gmail every day at a fixed UTC time and reload the dashboard data automatically.

---

## 1. Google Cloud: Enable Gmail API and create OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select one) → **APIs & Services** → **Library**.
3. Search for **Gmail API** → open it → **Enable**.
4. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
5. If asked, set the **OAuth consent screen**: User type **External** (or Internal for workspace), add your email as test user, save.
6. Application type: **Desktop app**. Name it (e.g. "Domain Dashboard Gmail"). Click **Create**.
7. Copy the **Client ID** and **Client Secret**; you will use them as env vars.

---

## 2. Get a refresh token (one-time, on your machine)

The app uses a **refresh token** to access Gmail without logging in every day.

1. In your project folder, set the client ID and secret (PowerShell):

   ```powershell
   $env:GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com"
   $env:GOOGLE_CLIENT_SECRET = "your-client-secret"
   ```

2. Install dependencies if needed:

   ```bash
   pip install google-auth-oauthlib google-api-python-client
   ```

3. Run the one-time script:

   ```bash
   python get_gmail_refresh_token.py
   ```

4. A browser opens → sign in with the **Gmail account that receives the daily data emails** → allow access.
5. The script prints something like:

   ```
   GMAIL_REFRESH_TOKEN=1//0abc...
   ```

6. Copy that **entire value** (the long string after `GMAIL_REFRESH_TOKEN=`). You will add it to your server environment (e.g. Railway) as **GMAIL_REFRESH_TOKEN**.

---

## 3. Environment variables on the server (e.g. Railway)

Add these to your **backend** service:

| Variable | Description | Example |
|----------|-------------|---------|
| **GOOGLE_CLIENT_ID** | OAuth Client ID from step 1 | `xxxx.apps.googleusercontent.com` |
| **GOOGLE_CLIENT_SECRET** | OAuth Client secret from step 1 | `GOCSPX-...` |
| **GMAIL_REFRESH_TOKEN** | Token from step 2 (one-time script) | `1//0abc...` |
| **GMAIL_FETCH_UTC_HOUR** | Hour (0–23) in UTC to run the daily fetch | `9` (for 09:00 UTC) |
| **GMAIL_SUBJECT_FILTER** | Only fetch emails with this exact subject (e.g. daily report) | `Analytics Scheduled Dataset : Daily Advertiser Data` |

Optional:

- **DATA_CSV_PATH** – Path where the CSV is saved (default: `domain_data.csv`). The fetcher overwrites this file and the app reloads from it.
- **GMAIL_SEARCH_QUERY** – Custom Gmail search (advanced). If **GMAIL_SUBJECT_FILTER** is set, it is used to build the query instead.

---

## 4. How it works

- When the backend starts, it starts a **scheduler** (only if **GMAIL_REFRESH_TOKEN** is set).
- Every day at **GMAIL_FETCH_UTC_HOUR:00 UTC**, the backend:
  1. Connects to Gmail with the refresh token.
  2. Searches for recent emails with attachments (default: last 3 days).
  3. Takes the **first CSV attachment** from the newest matching email.
  4. Saves it to **domain_data.csv** (or **DATA_CSV_PATH**).
  5. Reloads the in-memory data so the dashboard uses the new file immediately.
- No manual upload or redeploy needed after the first setup.

---

## 5. Production note (Gunicorn)

The scheduler runs inside the Flask process. If you use **gunicorn** with multiple workers, each worker would run its own scheduler and the job could run more than once. To avoid that, use **one worker** when Gmail fetch is enabled:

```bash
gunicorn --workers 1 --bind 0.0.0.0:$PORT backend_api:app
```

---

## 6. Test the fetcher right now (local)

1. **Set env vars** (PowerShell, from your project folder):

   ```powershell
   $env:GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com"
   $env:GOOGLE_CLIENT_SECRET = "your-client-secret"
   $env:GMAIL_REFRESH_TOKEN = "paste-the-token-from-step-2"
   $env:GMAIL_SUBJECT_FILTER = "Analytics Scheduled Dataset : Daily Advertiser Data"
   ```

2. **Run the fetcher:**

   ```bash
   python gmail_fetcher.py
   ```

   It will look for the **latest email** with subject **"Analytics Scheduled Dataset : Daily Advertiser Data"** (with a CSV attachment in the last 7 days), download the CSV, and save it as **domain_data.csv** in the current directory.

3. If you see **Saved: domain_data.csv**, start or restart your backend and open the dashboard to confirm the new data.
