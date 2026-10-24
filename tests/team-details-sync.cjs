const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
 const code = fs.readFileSync('supabase/functions/_shared/team-details.js','utf8');
 const {parseTeamDetailsSheet} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const table = {cols:[{id:'A'},{id:'B'},{id:'C',label:'Name'},{id:'D'}],rows:[{c:[null,null,{v:'Team A'},{v:12,f:'Formatted value'}]},{c:[null,null,null]}]};
 const result = parseTeamDetailsSheet('google.visualization.Query.setResponse('+JSON.stringify({table})+');');
 assert.equal(result.rows.length,1);
 assert.deepEqual(result.rows[0],table.rows[0]);
 assert.deepEqual(result.cols,table.cols);
 assert.throws(()=>parseTeamDetailsSheet('<html>Error</html>'));
 assert.throws(()=>parseTeamDetailsSheet('google.visualization.Query.setResponse({"status":"error"});'));
 assert.throws(()=>parseTeamDetailsSheet('google.visualization.Query.setResponse('+JSON.stringify({table:{...table,rows:[]}})+');'));
 const backend=fs.readFileSync('supabase/functions/rpi-api/index.ts','utf8');
 const endpoint=backend.slice(backend.indexOf('path === "/admin/team-details/sync"'),backend.indexOf('path === "/admin/config"',backend.indexOf('path === "/admin/team-details/sync"')));
 assert.ok(endpoint.indexOf('isAuthorizedAdmin') < endpoint.indexOf('await fetch'));
 assert.ok(endpoint.indexOf('parseTeamDetailsSheet') < endpoint.indexOf('await restRequest'));
 console.log('TeamDetails sync validation, field preservation, and admin guard passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
