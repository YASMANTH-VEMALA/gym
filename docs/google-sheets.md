# Google Sheets attendance sync

## Google Cloud setup

1. Enable the Google Sheets API in the Google Cloud project.
2. Configure the OAuth consent screen and add the administrators who may connect as test users while the app is in testing.
3. Create an OAuth 2.0 Client ID with the **Web application** type.
4. Add this authorized redirect URI exactly:

   ```text
   http://localhost:3001/api/v1/google-sheets/oauth/callback
   ```

   Use the public API URL instead of localhost in production.

5. Add the credentials to the root `.env` file. These are server-only values and must never use a `NEXT_PUBLIC_` prefix.

   ```dotenv
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/google-sheets/oauth/callback
   ```

`GOOGLE_TOKEN_ENCRYPTION_KEY` is optional when the existing 32-byte `QR_ENCRYPTION_KEY` is configured. A separate 32-byte base64 key is recommended in production.

## How synchronization works

- An owner or admin connects Google from **Attendance → Monthly sheet → Google Sheets**.
- The first export creates a `Gym attendance` spreadsheet when no spreadsheet URL is supplied.
- Each branch and month uses a separate worksheet tab, for example `2026-09 Central`.
- **Send app data to Google** replaces that monthly tab with the current application data.
- **Import changes from Google** reads day cells back into the application. Accepted values are `P`, `A`, `R`, `PRESENT`, `ABSENT`, `REST`, or blank.
- A blank day cell clears that attendance entry in the application for the corresponding member and date.

The Google refresh token is encrypted before it is stored. Client credentials and tokens are never returned to the browser.

Official references:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/sheets/api/guides/values
