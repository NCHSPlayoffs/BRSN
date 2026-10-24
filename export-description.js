(function(root) {
  const bold = text => String(text).replace(/[A-Za-z0-9]/g, c => String.fromCodePoint(c >= 'a' && c <= 'z' ? 0x1d5ee+c.charCodeAt(0)-97 : c >= 'A' && c <= 'Z' ? 0x1d5d4+c.charCodeAt(0)-65 : 0x1d7ec+c.charCodeAt(0)-48));
  function movers(rows) {
    return [1,-1].map(direction => rows.filter(row => Number.isFinite(row.regionRankChange) && row.regionRankChange * direction > 0)
      .slice().sort((a,b) => direction*(b.regionRankChange-a.regionRankChange) || Math.abs(Number(b.rpiChange)||0)-Math.abs(Number(a.rpiChange)||0) || String(a.school).localeCompare(String(b.school)))[0]).filter(Boolean);
  }
  function movement(value, digits) {
    if (value == null || !Number.isFinite(Number(value))) return 'N/A';
    if (!Number(value)) return '\u2014';
    return (Number(value)>0?'\u25b2':'\u25bc') + (digits ? Math.abs(Number(value)).toFixed(digits).replace(/^0\./,'.') : Math.abs(Number(value)));
  }
  function description(items) {
    const selected=items.filter(item=>item.kind==='playoff' && item.side && item.movers);
    if (!selected.length) return '';
    const sport=selected[0].sportLabel;
    const icon=/volleyball/i.test(sport)?'\u{1f3d0}':/football/i.test(sport)?'\u{1f3c8}':/basketball/i.test(sport)?'\u{1f3c0}':/soccer/i.test(sport)?'\u26bd':/softball/i.test(sport)?'\u{1f94e}':'\u26be';
    const lines=[icon+bold(`NCHSAA ${sport} Playoff Picture Results`),'',bold('Biggest Movers:'),''];
    selected.slice().sort((a,b)=>parseInt(a.classShort)-parseInt(b.classShort)||a.side.localeCompare(b.side)).forEach(item=>{
      lines.push(bold(`${item.classShort} ${item.side==='east'?'East':'West'}`));
      if (!item.movers.length) lines.push(item.comparisonAvailable === false ? 'No regional rank comparison available.' : 'No regional rank movement in the selected comparison.');
      item.movers.forEach(row=>lines.push(`${row.school} - RPI: ${movement(row.rpiChange,5)} - Rank: ${movement(row.regionRankChange)}`));
      lines.push('');
    });
    return lines.join('\n');
  }
  root.BRSNExportDescription={movers,description};
  if(typeof module!=='undefined') module.exports=root.BRSNExportDescription;
})(typeof window!=='undefined'?window:globalThis);
