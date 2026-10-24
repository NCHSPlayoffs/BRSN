const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

(async()=>{
 for(const root of ['C:/RPIRANKINGS/winter-white-board2','C:/RPIRANKINGS/BRSN-WINTER-WHITEBOARD']){
  const source=fs.readFileSync(root+'/playoff_board.js','utf8');
  const start=source.indexOf('    const snapshotReadCache_ = new Map();');
  const end=source.indexOf('    async function requestSnapshotApiJson_',start);
  let now=1000;
  const scope={structuredClone,Date:{now:()=>now}};
  vm.createContext(scope);
  vm.runInContext(source.slice(start,end)+'\nglobalThis.api={cachedLiveRead_,refreshLiveRpiReads_,snapshotReadCache_,liveRpiReadCache_,liveCompareReadCache_};',scope);
  const api=scope.api;
  let reads=0,release;
  const read=()=>{reads++;return new Promise(resolve=>{release=resolve;});};
  const a=api.cachedLiveRead_(api.liveRpiReadCache_,'football3a',read);
  const b=api.cachedLiveRead_(api.liveRpiReadCache_,'football3a',read);
  await Promise.resolve();assert.equal(reads,1);
  release({rows:[{school:'TC Roberson',rpi:'.5'}],lastUpdated:'unchanged'});
  const [first,second]=await Promise.all([a,b]);
  first.rows[0].school='mutated';first.changeCompare={bad:true};
  assert.equal(second.rows[0].school,'TC Roberson');
  const cached=await api.cachedLiveRead_(api.liveRpiReadCache_,'football3a',()=>{throw new Error('unexpected read');});
  assert.equal(cached.rows[0].school,'TC Roberson');assert.equal(cached.changeCompare,undefined);
  await api.cachedLiveRead_(api.liveRpiReadCache_,'football6a',async()=>({rows:[]}));
  now+=30001;
  const fresh=await api.cachedLiveRead_(api.liveRpiReadCache_,'football3a',async()=>{reads++;return {rows:[{school:'new'}]};});
  assert.equal(reads,2);assert.equal(fresh.rows[0].school,'new');
  await assert.rejects(api.cachedLiveRead_(api.liveRpiReadCache_,'failure',async()=>{throw new Error('offline');}),/offline/);
  assert.equal(api.liveRpiReadCache_.has('failure'),false);
  assert.equal((await api.cachedLiveRead_(api.liveRpiReadCache_,'failure',async()=>({retried:true}))).retried,true);
  api.liveCompareReadCache_.set('compare',{});
  const list=JSON.stringify(['/rpi-snapshots/list',[]]),snapshot=JSON.stringify(['/rpi-snapshots/snapshot',[]]);
  api.snapshotReadCache_.set(list,{});api.snapshotReadCache_.set(snapshot,{});
  api.refreshLiveRpiReads_();
  assert.equal(api.liveRpiReadCache_.size,0);assert.equal(api.liveCompareReadCache_.size,0);
  assert.equal(api.snapshotReadCache_.has(list),false);assert.equal(api.snapshotReadCache_.has(snapshot),true);
  for(let i=0;i<70;i++)await api.cachedLiveRead_(api.liveRpiReadCache_,String(i),async()=>({i}));
  assert.equal(api.liveRpiReadCache_.size,64);
 }
 console.log('PASS: concurrent deduplication, isolated results, 30-second expiry, selection keys, retries, fresh reload invalidation, immutable snapshots, and cache bounds.');
})().catch(error=>{console.error(error);process.exitCode=1;});
