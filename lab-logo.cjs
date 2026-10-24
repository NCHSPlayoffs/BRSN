const cache=new Map();
async function logoImage(raw) {
  const url=new URL(raw);
  if(url.protocol!=='https:'||!['nchslogos.com','iili.io','lh3.googleusercontent.com','drive.google.com'].includes(url.hostname))throw new Error('Unsupported logo host');
  if(!cache.has(url.href)) {
    if(cache.size>=256)cache.delete(cache.keys().next().value);
    const pending=fetch(url,{signal:AbortSignal.timeout(15000)}).then(async response=>{
      if(!response.ok)throw new Error('Logo request failed');
      const type=response.headers.get('content-type')||'';
      if(!type.startsWith('image/'))throw new Error('Logo is not an image');
      if(Number(response.headers.get('content-length'))>8*1024*1024)throw new Error('Logo is too large');
      const data=Buffer.from(await response.arrayBuffer());
      if(data.length>8*1024*1024)throw new Error('Logo is too large');
      return {data,type};
    }).catch(error=>{cache.delete(url.href);throw error;});
    cache.set(url.href,pending);
  }
  return cache.get(url.href);
}
module.exports={logoImage};
