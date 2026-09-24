# Sport Background Editor

On localhost the lab server saves settings and uploads under
`data/graphic-backgrounds/` (gitignored). These persist across restarts but do not
publish to Supabase. The local API accepts only loopback, same-origin requests.
GitHub-hosted pages continue using the configured Supabase API.

The existing admin secret protects publishing. Open Region Standings or Playoff
Picture, unlock admin tools, and choose Background Editor. Each sport has an
independent image, brightness, saturation, and shadow setting. Save Changes
publishes only the selected sport. Reset This Sport is a draft until saved.
Closing discards unsaved drafts. Original turf and court assets are never changed.

## Deployment

1. Apply `supabase/migrations/20260916000000_graphic_backgrounds.sql` to the intended project.
2. Deploy the `rpi-api` Edge Function, including its shared background validator.
3. Ensure `RPI_ADMIN_SECRET` is configured. Background writes fail closed without it.
4. Publish the site files, including `graphic-backgrounds.js`,
   `graphic-backgrounds.css`, and `supabase/functions/_shared/graphic-backgrounds.js`.

GitHub Pages serves the editor; Supabase stores shared settings and image uploads.
No admin credential is included in export HTML or saved by this editor.
Images are public, PNG/JPEG/WebP only, limited to 5 MB. Uploads use unique paths
and are retained when reset; resetting never deletes another sport's image.
Settings use independent `background:<sport>` rows in `app_admin_config`.
The PNG renderer receives the currently loaded settings in its HTML snapshot.
Other open tabs receive new published settings when refreshed.

Until the backend is deployed, the editor previews changes but reports publishing
errors; the site keeps existing default backgrounds. The backend was not deployed
as part of this lab change.

Run `node tests/graphic-backgrounds.cjs` against the lab server for mocked API
workflow checks. These do not replace a post-deployment upload/save smoke test.
