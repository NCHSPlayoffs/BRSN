# NCHSAA RPI Rankings Board

## Winter White Board 2

This branch contains the latest whiteboard design, saved magnet settings, local
fonts and artwork, canonical display-name fixes, and loading optimizations.

```powershell
npm ci
npx playwright install chromium
$env:PORT = '8139'
npm start
```

Open http://localhost:8139/playoff_board.html. See [WHITEBOARD2.md](WHITEBOARD2.md)
for design settings and export details.

Live site: https://nchsplayoffs.github.io/BRSN/playoff_board.html

GitHub Pages loads the published design from `data/whiteboard-design.json`,
uses the separate Supabase `team-logo` function for CORS-safe logos, and renders
PNG downloads in the browser. No local Node server is required on the live site.
The Node server retains local-folder export and headless rendering for desktop use.

Broadcast-style RPI rankings, region standings, playoff picture, and PNG export tooling.

## GitHub Pages

This repo includes an `index.html` redirect so GitHub Pages can open the app from the site root.

1. Create a new GitHub repository.
2. Push this folder to the repository.
3. In GitHub, open **Settings > Pages**.
4. Set **Source** to **Deploy from a branch**.
5. Choose the `main` branch and `/ (root)`.
6. Save, then open the Pages URL GitHub gives you.

For the hosted version, configure Supabase first so live table fetching, team schedules, RPI snapshots, compare changes, and history logs work without your local Node server. See `SUPABASE_GITHUB_SETUP.md`.

## Local PNG Export Server

GitHub Pages only hosts static files. The high-quality PNG export endpoint uses the local Node/Playwright server in `server-headless-export-v2.js`, so that part needs to run locally or on a Node host.

```bash
npm install
npm start
```

Then open `http://localhost:8000`.

By default, the local server does not create local RPI snapshots anymore. Supabase handles snapshot capture/history for the hosted app. To intentionally test local snapshots, start the server with `RPI_LOCAL_SNAPSHOTS=1`.
