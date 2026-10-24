# Winter Whiteboard Fork

This is a separate local Git checkout on `codex/winter-whiteboard`, created from the current Style Lab files, including its uncommitted improvements. The fall checkout at `C:/RPIRANKINGS/BRSN-STYLE-LAB` is unchanged. Nothing has been committed or pushed.

Run `START-WINTER.cmd`, then open http://localhost:8138/playoff_board.html. Both East/West Playoff Picture buttons now use the whiteboard magnets. Other views and the existing data, compare, logs, team settings, ghost teams, and PNG exporter remain available. For a fresh install run `npm install` and `npx playwright install chromium` first.

The saved design is preserved in `whiteboard-assets/design.json`. CSS matches that design, with equal 290px-wide cards, 125px card height, 18px row gaps, and its magnet finish, fonts, logo placement and deterministic rotation. Only cards that would overflow the available space are reduced equally. The logical board is 1122 x 1402.5; the export board is 1600 x 2000 rendered at 2x for 3200 x 4000 PNGs.

`whiteboard-playoff.js` adapts the existing seeded matchup rows. All bracket strokes are SVG with rounded caps; all round labels and VS markers are HTML. No brackets are baked into the background, so the count follows the actual playoff field, including paired winner placeholders and BYEs. The two backgrounds contain only the frame, region/brand artwork and footer accent strokes. West is red and East is blue; the brand wordmark stays black/red.

Highlight and exclusion notes are placed inside the board above the marker footer, using the marker font and appropriate region colors. Team log trigger attributes and comparison values are preserved on the magnet elements.

Design entry points:
- `whiteboard-playoff.css`: visual appearance, marker notes, fonts, outlines, depth, reflection, rank divider.
- `whiteboard-playoff.js`: saved layout coordinates and dynamic connector/VS placement.
- `whiteboard-assets/design.json`: original settings reference, not fetched during rendering.

The fork shares the configured Supabase backend with fall, so admin data changes still affect the shared data source. It does not create a separate hosted GitHub repository or deploy anything.

Verification: `node tests/whiteboard-playoff.cjs` and `node tests/card-region-rank-change.cjs`.
