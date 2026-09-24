const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'brsn-exports-'));
  const output=path.join(root,'chosen');fs.mkdirSync(output);
  const handler=require('../local-exports.cjs')(root,async()=>output);
  const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,`http://${req.headers.host}`)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/local-exports/`;
  try{
    assert.equal((await fetch(base+'browse?sport=football',{method:'POST'})).status,200);
    const png=Buffer.from([137,80,78,71,13,10,26,10]);
    const save=async(batch,filename)=>{const r=await fetch(base+'save?'+new URLSearchParams({sport:'football',batch,filename}),{method:'POST',body:png});return {status:r.status,...await r.json()}};
    const a=await save('batch1','01 1A Region Standings.png');
    const b=await save('batch1','02 1A Playoff Picture.png');
    const c=await save('batch2','01 1A Region Standings.png');
    const d=await save('batch3','01 1A Region Standings.png');
    assert.equal(a.status,200);assert.equal(a.folder,b.folder);
    assert.equal(c.folder,a.folder+' v2');assert.equal(d.folder,a.folder+' v3');
    assert.deepEqual(fs.readdirSync(a.folder),['01 1A Region Standings.png','02 1A Playoff Picture.png']);
    assert.equal((await save('batch4','../bad.png')).status,400);
    const jpgResponse=await fetch(base+'save?'+new URLSearchParams({sport:'football',batch:'jpeg-test',filename:'01 1A Region Standings.jpg'}),{method:'POST',body:Buffer.from([255,216,255,224])});
    assert.equal(jpgResponse.status,200);
    assert.equal((await fetch(base+'browse?sport=football',{method:'POST',headers:{origin:'https://bad.example'}})).status,403);
    console.log('Passed: remembered sport folder, batch grouping, v2/v3 collisions, sorted files, traversal/origin rejection.');
  }finally{await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exitCode=1});
