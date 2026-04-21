# NCHSAA RPI Rankings Board

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
