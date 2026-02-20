# Step-by-Step: What You Need to Do

Follow these steps in order. After this, you can fetch data from Gmail and run the dashboard on localhost.

---

## Part 1: Google Cloud – Get Client ID and Client Secret (one-time)

1. Open **https://console.cloud.google.com/** in your browser and sign in.

2. Create or select a project:
   - Top bar: click the project name → **New Project** (or pick an existing one).

3. Enable Gmail API:
   - Left menu: **APIs & Services** → **Library**.
   - Search for **Gmail API** → open it → click **Enable**.

4. Set up OAuth consent (if not done before):
   - **APIs & Services** → **OAuth consent screen**.
   - User type: **External** → **Create**.
   - App name: e.g. **Dashboard Gmail**.
   - User support email: your email.
   - Developer contact: your email.
   - **Save and Continue** → Scopes: **Add or Remove Scopes** → search **Gmail** → tick **.../auth/gmail.readonly** → **Update** → **Save and Continue**.
   - Test users: **Add Users** → add the Gmail address that receives the daily data email → **Save and Continue**.

5. Create OAuth credentials:
   - **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Desktop app**.
   - Name: e.g. **Dashboard Gmail**.
   - **Create**.
   - Copy the **Client ID** (long string ending in `.apps.googleusercontent.com`).
   - Copy the **Client Secret** (starts with `GOCSPX-`).
   - Keep these safe; you will use them in Part 2 and Part 3.

---

## Part 2: Get Your Gmail Refresh Token (one-time)

1. Open a terminal (PowerShell or Command Prompt).

2. Go to your project folder:
   ```text
   cd "c:\Users\ashar.v\Desktop\Vaibhav Domain And Keyword Analysis React V1\Vaibhav Domain and Keyword Analysis React\react-dashboard"
   ```

3. Install dependencies (if not already done):
   ```text
   pip install python-dotenv google-auth-oauthlib google-api-python-client
   ```

4. Get the refresh token:
   - Either paste your **Client ID** and **Client Secret** into the top of **get_gmail_refresh_token.py** (the two variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`),  
   - Or set them in the terminal (PowerShell):
     ```powershell
     $env:GOOGLE_CLIENT_ID = "paste-your-client-id-here"
     $env:GOOGLE_CLIENT_SECRET = "paste-your-client-secret-here"
     ```
   - Run:
     ```text
     python get_gmail_refresh_token.py
     ```

5. A browser window will open. Sign in with the **Gmail account that receives the daily “Analytics Scheduled Dataset : Daily Advertiser Data”** email. Allow access when asked.

6. In the terminal you will see something like:
   ```text
   GMAIL_REFRESH_TOKEN=1//0abc...long-string...
   ```
   Copy the **entire value** (the part after `GMAIL_REFRESH_TOKEN=`). You will use it in Part 3.

---

## Part 3: Create Your .env File (one-time)

1. In the same project folder, find the file **.env.example**.

2. Copy it and rename the copy to **.env** (so you have a new file named `.env` in the same folder as `backend_api.py`).

3. Open **.env** in a text editor and fill in (replace the placeholders with your real values):
   ```text
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
   GMAIL_REFRESH_TOKEN=paste-the-long-refresh-token-from-Part-2
   GMAIL_SUBJECT_FILTER=Analytics Scheduled Dataset : Daily Advertiser Data
   ```
   - No quotes needed.
   - No spaces around the `=` sign.
   - **GMAIL_SUBJECT_FILTER** must be exactly: `Analytics Scheduled Dataset : Daily Advertiser Data`.

4. Save and close **.env**. Do not commit this file to Git (it is already in `.gitignore`).

---

## Part 4: Fetch Data from Gmail (when you want new data)

1. Double-click **fetch_from_gmail.bat** in the project folder,  
   **or** in a terminal in the project folder run:
   ```text
   python gmail_fetcher.py
   ```

2. If it works, you will see: **Saved: domain_data.csv**.  
   If you see an error, check that **.env** has the correct Client ID, Client Secret, and Refresh Token (from Parts 1 and 2).

3. After a successful fetch, **domain_data.csv** in the project folder is updated. The dashboard will use this file when you run the app (Part 5).

---

## Part 5: Run the Dashboard on Localhost

1. Start the backend and frontend:
   - Double-click **start.bat** in the project folder,  
   **or** open two terminals and run:
   - Terminal 1 (backend):
     ```text
     cd "c:\Users\ashar.v\Desktop\Vaibhav Domain And Keyword Analysis React V1\Vaibhav Domain and Keyword Analysis React\react-dashboard"
     python backend_api.py
     ```
   - Terminal 2 (frontend):
     ```text
     cd "c:\Users\ashar.v\Desktop\Vaibhav Domain And Keyword Analysis React V1\Vaibhav Domain and Keyword Analysis React\react-dashboard\frontend"
     npm run dev
     ```

2. In the frontend terminal, note the URL (e.g. **http://localhost:3000** or **http://localhost:3002**).

3. Open that URL in your browser. The dashboard will show data from **domain_data.csv** (from the last Gmail fetch).

4. To refresh data from Gmail: run **Part 4** again, then restart the backend (close the backend terminal and run `python backend_api.py` again), or wait for the next automatic fetch if you have the scheduler enabled (e.g. on Railway).

---

## Quick Reference

| What you want to do        | What to run / use |
|---------------------------|-------------------|
| Get refresh token (once)  | Fill credentials in **get_gmail_refresh_token.py** or env, then `python get_gmail_refresh_token.py` |
| Create/update .env (once) | Copy **.env.example** to **.env**, fill in ID, secret, refresh token, subject |
| Fetch latest CSV from Gmail | **fetch_from_gmail.bat** or `python gmail_fetcher.py` |
| Run dashboard locally     | **start.bat** or run backend + frontend in two terminals |

---

## If Something Fails

- **“Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN”**  
  Your **.env** is missing or wrong. Check that **.env** is in the project folder (same folder as `backend_api.py`) and has all three variables filled in.

- **“No messages found for query”**  
  No recent email with subject **“Analytics Scheduled Dataset : Daily Advertiser Data”** and a CSV attachment. Send a test email with that subject and a CSV attached, or check the subject spelling in **.env** (**GMAIL_SUBJECT_FILTER**).

- **“FileNotFoundError: domain_data.csv”**  
  Run **Part 4** at least once to create **domain_data.csv**, or copy your CSV into the project folder and name it **domain_data.csv**.

- **Dashboard is empty**  
  Run **Part 4** to fetch from Gmail, then restart the backend so it reloads **domain_data.csv**.
