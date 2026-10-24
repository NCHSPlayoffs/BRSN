const assert=require('node:assert/strict');
const {movers,description}=require('../export-description.js');
const rows=[
 {school:'A',regionRankChange:7,rpiChange:.02},
 {school:'B',regionRankChange:7,rpiChange:.09225},
 {school:'C',regionRankChange:6,rpiChange:.2},
 {school:'D',regionRankChange:-3,rpiChange:-.01},
 {school:'E',regionRankChange:-3,rpiChange:-.03009},
 {school:'Unknown',regionRankChange:null,rpiChange:.5}
];
assert.deepEqual(movers(rows).map(r=>r.school),['B','E']);
assert.equal(movers([{regionRankChange:0}]).length,0);
const text=description([{kind:'playoff',side:'east',classShort:'1A',sportLabel:'Volleyball',movers:movers(rows)}]);
assert.ok(text.includes('B - RPI: \u25b2.09225 - Rank: \u25b27'));
assert.ok(text.includes('E - RPI: \u25bc.03009 - Rank: \u25bc3'));
assert.equal(description([]),'');
console.log('Caption rank ordering, RPI tie breaks, and text formatting passed.');
