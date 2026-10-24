const assert = require('node:assert/strict');
const { roundsFor, advance } = require('../live_bracket.js');
for (let count = 0; count <= 32; count++) {
  const slots = Array.from({length: count}, (_, i) => ({firstRound: {top: {type:'team',team:{regionRank:i+1}}},secondRound:{}}));
  const rounds = roundsFor({slots}, 'east');
  const first = rounds[0];
  assert.deepEqual(rounds.flat().map(game=>game.number), Array.from({length:rounds.flat().length},(_,i)=>i+1));
  rounds.slice(1).forEach((games,index)=>games.forEach(game=>{
    assert.equal(game.round,index+2);
    game.entries.filter(entry=>entry.type==='text'&&!entry.bye).forEach(entry=>assert.match(entry.text,/^Game #\d+ - Round \d+ Winner$/));
  }));
  assert.equal(first.flatMap(g=>g.entries).filter(e=>e.type==='team').length,count);
  const size = first.length * 2;
  for (const game of first) {
    const seeds = game.entries.filter(e=>e.type==='team').map(e=>e.team.regionRank);
    if (seeds.length===2) assert.equal(seeds[0]+seeds[1],size+1);
  }
  assert.equal(rounds.at(-1).length,1);
  if(count===13) {
    const game = rounds[1].find(g=>g.entries.every(e=>e.type==='text' && !e.bye));
    assert.ok(game, 'Two first-round winners meet in second round');
  }
}
assert.equal(advance([{type:'text',text:'BYE',bye:true},{type:'text',text:'BYE',bye:true}],'Winner').type,'empty');
console.log('Live bracket fields 0-32, seed pairs, BYEs, and later rounds passed.');
