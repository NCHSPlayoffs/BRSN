const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('playoff_board.js', 'utf8');
const start = source.indexOf('    function cardPlayoffColorStyle_(team)');
const end = source.indexOf('\n    function ', start + 1);
const colorStyle = new Function('teamDetailsRowForName_', 'escapeHtml', `${source.slice(start, end)}; return cardPlayoffColorStyle_;`)(() => ({}), value => value);
for (const [primary, secondary, expected] of [
  ['#000040', '#ffffff', '#0000be'],
  ['#003300', '#cccccc', '#00be00'],
  ['#ffffff', '#990000', '#be0000'],
  ['#cc0000', '#0000cc', '#cc0000'],
  ['#000000', '#ffffff', '#ffffff'],
  ['#000000', '#000000', '#ffffff'],
  ['#000000', '#cccccc', '#cccccc'],
  ['#000000', '#990000', '#be0000'],
  ['#000000', '', '#ffffff'],
]) {
  assert.ok(colorStyle({ dominantHex: primary, secondaryHex: secondary }).includes(`--team-accent:${expected}`), `${primary} / ${secondary}`);
}
console.log('Card accents prefer saturated colors and preserve hue.');
