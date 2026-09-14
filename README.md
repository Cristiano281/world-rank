# World Rank

Pay-to-rank project board with real PayPal checkout. The server creates and
captures the PayPal order itself, so the ranking only updates after PayPal
confirms the payment — nothing is trusted from the browser alone.

## 1. Get your PayPal credentials

1. Go to https://developer.paypal.com and log in (or create an account).
2. Under **Apps & Credentials**, create an app (Sandbox first, for testing).
3. Copy the **Client ID** and **Secret**.
4. When ready to accept real money, switch to a **Live** app and get a
   Live Client ID/Secret from a verified PayPal Business account.

## 2. Configure

Create a `.env` file in the project root (do not commit this file):

```
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_ENV=sandbox    # change to "live" when ready to launch for real
PORT=3000
```

In `public/index.html`, replace `YOUR_PAYPAL_CLIENT_ID` in the `<script src="https://www.paypal.com/sdk/js?...">`
tag with the same Client ID (this one is public and safe to expose in the browser —
the Secret never goes in the frontend).

## 3. Run locally

```
npm install
node -r dotenv/config server.js
```
(or add `require('dotenv').config()` at the top of `server.js`, and
`npm install dotenv`, if you prefer not to use `-r`)

Visit http://localhost:3000

## 4. Deploy live today

This needs a host that runs a Node.js server (not a static-only host like
Netlify Drop, since this version has a backend). Easiest options:

- **Render.com** — free tier, connect a GitHub repo, set the environment
  variables above in the dashboard, done.
- **Railway.app** — similar, very quick for small Node apps.

Steps: push this folder to a GitHub repo → create a new Web Service on
Render/Railway pointing to it → set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_ENV` as environment variables → deploy.

## Notes

- Data is stored in `projects.json` on the server — fine to start, but it
  resets if the host wipes the filesystem on redeploy. Move to a real
  database (Postgres, MongoDB) once traffic picks up.
- Add Terms of Service clarifying that ranking position reflects amount
  paid, not an endorsement — important for trust and to avoid disputes,
  especially with an international audience (US/Canada/worldwide).
- Test everything in Sandbox mode first (fake PayPal accounts at
  developer.paypal.com) before switching `PAYPAL_ENV` to `live`.
