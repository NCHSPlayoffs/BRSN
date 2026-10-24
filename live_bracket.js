/* Projected rounds use the card board's field size and complementary seed pairs. */
(function (root) {
  function advance(entries, label) {
    const active = entries.filter(entry => entry && entry.type !== 'empty' && !entry.bye);
    return active.length === 1 ? active[0] : active.length ? { type: 'text', text: label } : { type: 'empty' };
  }

  function roundsFor(bracket, side) {
    const teams = new Map();
    bracket.slots.forEach(slot => [slot.firstRound.top, slot.firstRound.bottom, slot.secondRound.bottom].forEach(entry => {
      if (entry?.type === 'team') teams.set(Number(entry.team.regionRank), entry);
    }));
    // Same power-of-two field and complementary seeds as the regional cards.
    const size = 2 ** Math.ceil(Math.log2(Math.max(2, ...teams.keys())));
    let order = [1, 2];
    while (order.length < size) order = order.flatMap(seed => [seed, order.length * 2 + 1 - seed]);
    const first = [];
    let gameNumber = 0;
    for (let i = 0; i < order.length; i += 2) first.push({
      id: `${side}-1-${i / 2 + 1}`, number: ++gameNumber, round: 1, entries: order.slice(i, i + 2).map(seed => teams.get(seed) || { type: 'text', text: 'BYE', bye: true }), y: i / 2 * 150 + 100
    });
    const rounds = [first];
    while (rounds.at(-1).length > 1) {
      const prior = rounds.at(-1), round = rounds.length + 1, next = [];
      for (let i = 0; i < prior.length; i += 2) {
        const pair = prior.slice(i, i + 2);
        next.push({ id: `${side}-${round}-${next.length + 1}`,
          number: ++gameNumber, round,
          entries: pair.map(game => advance(game.entries, `Game #${game.number} - Round ${game.round} Winner`)),
          sources: pair.map(game => game.id), y: pair.reduce((n, game) => n + game.y, 0) / pair.length });
      }
      rounds.push(next);
    }
    return rounds;
  }

  function render(brackets, teamHtml) {
    const regions = ['west', 'east'].map(side => ({ side, rounds: roundsFor(brackets[side], side) }));
    const columns = Math.max(1, ...regions.map(region => region.rounds.length - 1));
    const step = 345, cardWidth = 325, centerGap = 300;
    const width = columns * step * 2 + centerGap + 40;
    const regionalX = 20 + (columns - 1) * step;
    const stateX = width - 20 - cardWidth - (columns - 1) * step;
    const maxGames = Math.max(...regions.map(region => region.rounds[0].length));
    const middle = 120 + maxGames * 100;
    const height = Math.max(950, maxGames * 200 + 480);
    let lines = '', html = '';
    const finalists = [];
    const card = (game, side, x, y, extra = '') => {
      const bye = game.entries.some(entry => entry?.bye);
      const label = `${side[0].toUpperCase() + side.slice(1)} - Game #${game.number} - Round ${game.round}`;
      return `<div class="matchup-container brsn-${side} live-game ${extra}" data-game="${game.id}" style="left:${x}px;top:${y - 81}px"><div class="matchup"><div class="contest-header" title="${bye ? 'BYE' : 'Projected matchup'}"><span class="game-number">${label}</span></div><div class="teams">${game.entries.map(teamHtml).join('')}</div></div></div>`;
    };
    regions.forEach(({ side, rounds }, regionIndex) => {
      const east = side === 'east', positions = new Map();
      let cards = '';
      const outer = rounds.length > 1 ? rounds.slice(0, -1) : [];
      outer.forEach((games, r) => {
        const x = east ? width - 20 - cardWidth - r * step : 20 + r * step;
        const title = r === rounds.length - 2 ? 'QUARTERFINALS' : ['FIRST ROUND', 'SECOND ROUND', 'THIRD ROUND'][r] || `ROUND ${r + 1}`;
        cards += `<h3 class="live-round-title ${side}" style="left:${x}px">${title}</h3>`;
        games.forEach((game, i) => {
          let y;
          if (r === 0) {
            const unit = maxGames / games.length;
            const slot = (i + .5) * unit;
            y = 120 + slot * 200 + (slot >= maxGames / 2 ? 400 : 0);
          } else {
            y = game.sources.reduce((sum, id) => sum + positions.get(id).y, 0) / game.sources.length;
          }
          positions.set(game.id, {x,y});
          for (const source of game.sources || []) {
            const from = positions.get(source), start = east ? from.x : from.x + cardWidth;
            const end = east ? x + cardWidth : x, mid = east ? end + 10 : end - 10;
            lines += `<path d="M${start},${from.y} H${mid} V${y} H${end}"/>`;
          }
          cards += card(game, side, x, y);
        });
      });
      html += `<section class="live-region live-${side}">${cards}</section>`;
      const final = rounds.at(-1)[0];
      finalists.push(advance(final.entries, `${side[0].toUpperCase() + side.slice(1)} Game #${final.number} - Round ${final.round} Winner`));
      const finalX = regionalX, finalY = middle + 115 + (1 - regionIndex) * 180;
      html += card(final, side, finalX, finalY, 'live-regional-final');
    });
    const stateY = middle + 205;
    [middle + 115, middle + 295].forEach(y => {
      lines += `<path d="M${regionalX + cardWidth},${y} H${width / 2} V${stateY} H${stateX}"/>`;
    });
    html += `<h2 class="live-finals-title" style="left:${regionalX}px;width:${stateX + cardWidth - regionalX}px;top:${middle - 55}px">FINAL FOUR</h2><h3 class="live-finals-label" style="left:${regionalX}px;top:${middle - 10}px">REGIONAL</h3><h3 class="live-finals-label" style="left:${stateX}px;top:${middle - 10}px">STATE</h3>`;
    html += card({id:'State - Game 1',number:1,round:Math.max(...regions.map(region => region.rounds.length))+1,entries:finalists.reverse()}, 'state', stateX, stateY, 'live-championship');
    html += `<img class="live-center-brand" src="https://iili.io/Bga3mQe.png" alt="Big Red Sports Network" style="left:${width / 2 - 100}px"><span class="live-region-label west" style="left:20px;top:${middle + 170}px">WEST</span><span class="live-region-label east" style="right:20px;top:${middle + 170}px">EAST</span>`;
    return {live:true, canvasWidth:width, html:`<div class="live-bracket" style="width:${width}px;height:${height}px"><svg class="live-connectors" width="${width}" height="${height}" aria-hidden="true">${lines}</svg>${html}</div>`};
  }
  root.BRSNLiveBracket = { roundsFor, advance, render };
  if (typeof module !== 'undefined') module.exports = root.BRSNLiveBracket;
})(typeof window !== 'undefined' ? window : globalThis);
