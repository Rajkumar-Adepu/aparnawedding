# Adepu Aparna & Gaddamidi Aravind Wedding Invitation

A standalone ivory-and-gold wedding invitation website for Sunday, 05 July 2026 at 8:25AM IST.

## Open locally

Open `index.html` directly in a browser, or serve the folder with any static web server.

```sh
python3 -m http.server 4177
```

Then visit `http://localhost:4177/`.

## RSVP preview server

To save and view RSVPs locally, run:

```sh
RSVP_ADMIN_TOKEN=choose-a-private-token node server.js
```

Responses are saved to `data/rsvps.json`.

Spreadsheet-friendly responses are also saved to `data/rsvps.csv`.

The public website does not show the RSVP guest list. To download the private CSV
spreadsheet from the preview server, open:

```txt
http://localhost:4177/api/rsvps.csv?token=choose-a-private-token
```

Optional email notifications can be enabled with SMTP environment variables:

```sh
RSVP_ADMIN_TOKEN=choose-a-private-token \
SMTP_HOST=smtp.gmail.com \
SMTP_PORT=465 \
SMTP_USER=your-email@gmail.com \
SMTP_PASS=your-app-password \
SMTP_FROM=your-email@gmail.com \
RSVP_NOTIFY_EMAIL=gtest5833@gmail.com \
node server.js
```

Without SMTP credentials, RSVPs are still collected in the local CSV/JSON files.

## Test RSVP locally

1. Start the preview server:

   ```sh
   RSVP_ADMIN_TOKEN=brother2026 node server.js
   ```

2. Open `http://localhost:4177/?preview=20260629-gallery-compliments#rsvp`.
3. Fill the RSVP form and click **Send message**.
4. Confirm the guest appears in the private CSV:

   ```txt
   http://localhost:4177/api/rsvps.csv?token=brother2026
   ```

5. The same details are also saved in `data/rsvps.json` and `data/rsvps.csv`.
