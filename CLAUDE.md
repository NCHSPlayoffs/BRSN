# CLAUDE.md

## Project Role

You are helping with the BRSN / NCHSAA RPI Rankings project.

This project is a public-facing HTML/CSS/JS web app for NCHSAA RPI rankings, region standings, East/West line, playoff picture, team logs, and PNG exports.

## Project Structure

Important files:

- `playoff_board.html` — main app page.
- `playoff_board.js` — main board/rendering/data logic.
- `playoff_board.runtime.js` — runtime helpers and app behavior.
- `playoff_board.css` — stylesheet entrypoint that imports the split CSS files.
- `playoff_board.themes.css` — root variables, theme tokens, and theme overrides.
- `playoff_board.desktop.css` — desktop layout and component styles.
- `playoff_board.mobile.css` — mobile layout and responsive overrides.
- `app-config.js` — public app configuration.
- `server-headless-export-v2.js` — local Node/Playwright PNG export server.
- `README.md` — project overview and local/GitHub Pages setup.
- `SUPABASE_GITHUB_SETUP.md` — Supabase setup for hosted API, snapshots, history logs, and scheduled captures.

## Hosting / Backend Context

- GitHub Pages hosts the static app.
- Supabase handles hosted API work, snapshot storage, snapshot compare, team schedules, history logs, and hourly snapshot capture.
- Local high-quality PNG export still needs the Node/Playwright server.
- Do not put private keys, Supabase service role keys, secrets, or tokens in browser code or committed files.
- `app-config.js` may contain the public Edge Function URL only.

## Core Design Rules

Preserve the current BRSN visual identity unless explicitly asked to change it.

Important preferences:

- Keep the red/blue BRSN playoff header gradient.
- Keep Big Red Sports Network branding prominent.
- Preserve square game boxes unless specifically asked otherwise.
- Avoid hover highlights in playoff bracket areas unless specifically requested.
- Avoid brownish transparent color mixes.
- Do not let themes override the red/blue regional playoff header gradient.
- West is red; East is blue.
- West team boxes display left-to-right: seed → logo → team.
- East team boxes may have mirrored/aligned styling where the existing code requires it, but mobile usually normalizes to left-to-right.
- Home teams should display on the bottom of game pairings.
- Connector lines must align to the exact center points of the relevant game boxes/slots.

## Playoff Logic Context

Default assumptions:

- Classes 1A–7A use 24 teams per region when enough teams are available.
- 8A uses 12 teams per region.
- Top 8 seeds receive byes in 1A–7A full 24-team regions.
- First-round pairings for 24-team regions are:
  - 24 vs 9
  - 23 vs 10
  - 22 vs 11
  - 21 vs 12
  - 20 vs 13
  - 19 vs 14
  - 18 vs 15
  - 17 vs 16
- Round 2 shows seeds #1 through #8 positioned so #1 faces the 17/16 winner, #2 faces the 18/15 winner, and so on.
- If a region has fewer than 24 teams, byes extend automatically to additional seeds.
- If both regions have 16 teams or fewer, round count may reduce so regionals are round 4 and championship follows a one-week bye.
- Placeholder winner labels should be like `16vs17 winner` only when there are exactly two possible future opponents; otherwise placeholders may be blank.

Do not change bracket/playoff data logic while fixing CSS/layout unless the task specifically requires it.

## Working Style

Follow these rules when making code changes:

1. Make targeted changes only.
2. Do not do broad refactors unless explicitly requested.
3. Inspect the relevant files before changing anything.
4. Explain the likely cause before giving a fix.
5. Give exact file names.
6. Give exact find-and-replace blocks when possible.
7. If a full replacement is safer, provide the complete replacement section or complete file.
8. Do not provide vague snippets such as “something like this.”
9. Do not remove comments, section headers, tuning variables, or config variables unless asked.
10. Preserve existing naming conventions and project structure.
11. Be careful with CSS cascade order and specificity.
12. Check whether a style belongs in `playoff_board.themes.css`, `playoff_board.desktop.css`, `playoff_board.mobile.css`, or inline JS-generated markup.
13. Keep desktop and mobile behavior separate when appropriate.
14. When editing CSS, prefer adjusting existing variables before adding duplicate hard-coded rules.
15. When a user says “make changes entirely,” provide complete replacement files or complete sections rather than patch-style hints.

## Response Format For Bug Fixes

Use this structure for most fixes:

1. **Likely cause** — short explanation.
2. **File** — exact file to edit.
3. **Find** — exact code block to find.
4. **Replace with** — exact replacement code block.
5. **Test** — what to reload/click/check after the edit.

Keep explanations practical and avoid over-long responses unless asked for an audit or plan.

## CSS Guidance

- `playoff_board.css` should remain a lightweight import entrypoint.
- Theme variables and shared tokens belong in `playoff_board.themes.css`.
- Desktop layout and normal large-screen components belong in `playoff_board.desktop.css`.
- Mobile-only behavior belongs in `playoff_board.mobile.css`.
- Be mindful that later imports override earlier imports:
  1. themes
  2. desktop
  3. mobile
- If a desktop rule is not working, check whether a later mobile rule, more specific selector, inline style, or JS-applied class is overriding it.
- Avoid adding `!important` unless needed to beat an existing unavoidable rule.
- If using `!important`, explain why.

## JavaScript Guidance

- Do not change data fetching, parsing, playoff seeding, export logic, or snapshot behavior unless the task is about that area.
- Prefer small helper functions over large rewrites.
- Preserve existing function names unless renaming is part of an explicit refactor.
- Avoid changing public IDs/classes used by CSS unless all references are updated.
- Watch for code that generates bracket HTML/classes dynamically before assuming a CSS selector exists in the HTML file.

## Export Guidance

- PNG export should mirror the in-browser layout as closely as possible.
- Do not include UI panels in export screenshots unless requested.
- Local high-quality PNG export depends on `server-headless-export-v2.js` and Playwright.
- GitHub Pages cannot run the local Node export server.
- Keep export filenames in the format `[Class] Playoff Picture` and `[Class] Region Standings` when working in that area.

## Security / Safety

- Never expose secrets in committed files.
- Never add service role keys to browser-side files.
- Be cautious with npm/package changes.
- Do not add new dependencies unless there is a clear reason.
- If a change affects public GitHub hosting, mention whether it exposes anything sensitive.

## Preferred Tone

Be direct, practical, and specific.

The user prefers exact instructions over theory. Avoid vague language. If something is uncertain, say what you checked and what still needs verification.
