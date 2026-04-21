# GitHub Pages + Supabase Setup

This project can run as a static GitHub Pages site while Supabase handles the API work that GitHub Pages cannot do by itself.

The local Node server still works for local testing and PNG export. Supabase is for the hosted app: fetching remote pages, team schedules, RPI snapshot storage, snapshot compare, history logs, and hourly snapshot capture.

## 1. Create The Supabase Project

1. Go to Supabase and create a new project.
2. Copy the project ref from the project URL. It looks like `abcdefghijklmnop`.
3. Install the Supabase CLI locally for this project if needed.

```powershell
npm install
```

The Supabase npm package does not support global installs with `npm install -g supabase`. This repo uses the supported local project install, so prefix CLI commands with `npx`.

4. From this folder, log in and link the project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Create The Snapshot Table

Run the migration:

```powershell
npx supabase db push
```

That creates `public.rpi_snapshots`.

The table has Row Level Security enabled. The Edge Function uses the service role key on the server side, so the browser never sees that key.

## 3. Add The Capture Secret

Create a long random secret. This protects the endpoints that write new snapshots.

```powershell
npx supabase secrets set RPI_CRON_SECRET="replace-this-with-a-long-random-secret"
```

Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

## 4. Deploy The API Function

Deploy the function:

```powershell
npx supabase functions deploy rpi-api
```

The `supabase/config.toml` file marks `rpi-api` as public with `verify_jwt = false`, so the browser can call read endpoints without a Supabase login.

Your API base URL will be:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/rpi-api
```

Test it:

```powershell
Invoke-RestMethod "https://YOUR_PROJECT_REF.supabase.co/functions/v1/rpi-api/rpi-snapshots/status"
```

## 5. Point The App At Supabase

Open `app-config.js` and set:

```js
window.RPI_APP_CONFIG = {
  apiBaseUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/rpi-api'
};
```

If `apiBaseUrl` is blank, the app keeps using the local server candidates like `http://localhost:8000`.

## 6. Capture A First Snapshot

Run this once after deploying so the compare/history tools have data.

```powershell
$secret = "replace-this-with-a-long-random-secret"
$url = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/rpi-api/rpi-snapshots/capture-all"
Invoke-RestMethod -Method Post -Uri $url -Headers @{ "x-rpi-cron-secret" = $secret }
```

If `capture-all` ever times out, use the same endpoint again. The function only saves when a sport/class snapshot changed.

## 7. Schedule Hourly Snapshots

In Supabase, open SQL Editor and run this after replacing the project ref and secret.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'rpi-snapshot-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/rpi-api/rpi-snapshots/capture-all',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rpi-cron-secret', 'replace-this-with-a-long-random-secret'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## 8. Push To GitHub

Create a GitHub repository, then from this folder:

```powershell
git add .
git commit -m "Add Supabase API backend"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Then in GitHub:

1. Open the repository settings.
2. Go to Pages.
3. Set Source to `Deploy from a branch`.
4. Pick `main` and `/ (root)`.
5. Save.

GitHub Pages will open `index.html`, which redirects into `playoff_board.html`.

## Notes

- Do not put the Supabase service role key in browser code or `app-config.js`.
- `app-config.js` only contains the public Edge Function URL.
- PNG export still needs the local Node server because GitHub Pages cannot run Playwright.
- The Supabase function only proxies allowed hosts: NCHSAA, Google Sheets, and MaxPreps.
