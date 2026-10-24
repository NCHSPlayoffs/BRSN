# Winter White Board 2

Independent official board with the lab cutout magnets. Original winter board and lab are unchanged.

Run START-WINTER.cmd and open http://localhost:8139/playoff_board.html.

Official sport/class selectors, admin, shared team API, brackets and exports are retained. Admin edits affect the same shared backend as the original. The legacy magnet renderer remains in whiteboard-playoff.js.

Save Design at http://localhost:8125/board.html publishes card, layout, typography, colors, connectors, and individual logo settings to data/whiteboard-design.json. Refresh the lab after installing this integration, then click Save Design once to publish existing browser-saved settings. Winter board 2 loads the shared design on startup and when its window regains focus; a refresh also reloads it. Unsaved slider edits remain lab-only. PNG exports capture the loaded shared design.

Without a published design, the tuned source preset in cutout-board.js is used. Lab-only controls and admin-hiding styles are disabled on the official board.

PNG export uses hardware-accelerated Chromium, a shared asset-cache context, and up to two simultaneous render jobs. Snapshots include only the selected graphic and its styles, at the original 3200x4000 resolution. Set RPI_EXPORT_PROFILE=1 before starting the server to log render-stage timings. GPU rasterization may have minor antialiasing differences from software rendering; graphic geometry, fonts and effects are unchanged.
