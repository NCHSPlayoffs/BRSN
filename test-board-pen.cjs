const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1150,height:680},deviceScaleFactor:2});
  await page.goto('http://localhost:8125/cutout.html');
  await page.setContent(`<style>
   @font-face{font-family:Original;src:url('http://localhost:8125/assets/Kalam-Bold.ttf');font-weight:700}
   @font-face{font-family:Modified;src:url('http://localhost:8125/assets/BoardPen-Triangular4-Bold.ttf');font-weight:700}
   body{margin:0;padding:24px;background:#fff;color:#111;font:16px Arial}
   section{display:grid;grid-template-columns:150px 1fr;align-items:center;border-bottom:1px solid #ddd}
   p{margin:8px 0;font-size:100px;line-height:1.5;font-weight:700}
   .original{font-family:Original}.modified{font-family:Modified}
  </style>
  <section><label>Original</label><p class="original">4 9 14-13 11-4-10</p></section>
  <section><label>Triangular four</label><p class="modified">4 9 14-13 11-4-10</p></section>
  <section><label>Other digits</label><p class="modified">012356789</p></section>`);
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.fonts.check('700 100px Modified')));
  const metrics=await page.evaluate(()=>{
   const context=document.createElement('canvas').getContext('2d');
   return ['Original','Modified'].map(font=>{context.font='700 100px '+font;return context.measureText('0123456789').width;});
  });
  assert.equal(metrics[0],metrics[1]);
  await page.screenshot({path:'board-pen-comparison.png'});
  console.log('PASS: custom font loads, number spacing is unchanged; comparison rendered.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
