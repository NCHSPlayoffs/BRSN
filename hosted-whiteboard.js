(() => {
  const base=new URL('./',document.currentScript.src);
  const hosted=window.RPI_APP_CONFIG?.staticHosting ?? !['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  const asset=path=>new URL(path,base).href;
  const imageUrl=value=>{
    if(!hosted||!value)return value;
    const url=new URL(value,base);
    const api=String(window.RPI_APP_CONFIG?.apiBaseUrl||'').replace(/\/$/,'');
    const logoEndpoint=api.replace(/\/rpi-api$/,'')+'/team-logo';
    if(url.origin===location.origin||!/^https?:$/.test(url.protocol)||url.href.startsWith(logoEndpoint+'?'))return url.href;
    return logoEndpoint+'?url='+encodeURIComponent(url.href);
  };
  let rendererReady;
  function loadRenderer(){
    if(!rendererReady)rendererReady=fetch(asset('vendor/html-to-image.js')).then(response=>{
      if(!response.ok)throw new Error('Could not load PNG renderer');
      return response.text();
    }).catch(error=>{rendererReady=null;throw error;});
    return rendererReady;
  }
  let queue=Promise.resolve();
  function renderPng(payload){
    const job=queue.catch(()=>{}).then(()=>renderSnapshot(payload));
    queue=job;return job;
  }
  async function renderSnapshot(payload){
    const rendererSource=await loadRenderer();
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-same-origin allow-scripts');
    frame.style.cssText='position:fixed;left:-100000px;top:0;width:1800px;height:2200px;border:0;pointer-events:none';
    try{
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(new Error('Export assets took too long to load')),30000);
        frame.onload=()=>{clearTimeout(timeout);resolve();};
        const snapshot=new DOMParser().parseFromString(payload.html,'text/html');
        snapshot.querySelectorAll('script').forEach(script=>script.remove());
        frame.srcdoc='<!doctype html>'+snapshot.documentElement.outerHTML;document.body.append(frame);
      });
      const doc=frame.contentDocument,target=doc.querySelector(payload.selector);
      if(!target)throw new Error('Export graphic is missing');
      const rendererScript=doc.createElement('script');rendererScript.textContent=rendererSource;doc.head.append(rendererScript);
      const renderer=frame.contentWindow.htmlToImage;
      target.style.zoom='1';target.style.transform='none';target.style.margin='0';
      await doc.fonts.ready;
      await Promise.all([...target.querySelectorAll('img')].map(async image=>{
        image.loading='eager';
        try{await image.decode();}catch{throw new Error('A logo or board image could not load; retry the export');}
      }));
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      // SVG descendants and image-backed pseudo-elements need explicit styles
      // when the graphic is serialized outside its original stylesheets.
      const view=frame.contentWindow;
      for(const svg of target.querySelectorAll('svg')){
        for(const node of svg.querySelectorAll('*')){
          const css=view.getComputedStyle(node);
          for(const property of ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','fill-opacity','stroke-opacity','opacity','color','vector-effect','font-family','font-size','font-weight']){
            node.style.setProperty(property,css.getPropertyValue(property));
          }
        }
      }
      const pseudoStyle=doc.createElement('style');doc.head.append(pseudoStyle);
      let pseudoId=0;
      for(const node of [target,...target.querySelectorAll('*')]){
        for(const pseudo of ['before','after']){
          const css=view.getComputedStyle(node,'::'+pseudo);
          if(css.content==='none'||!css.backgroundImage.includes('url('))continue;
          const layer=doc.createElement('span');
          for(const property of css)layer.style.setProperty(property,css.getPropertyValue(property));
          const attribute='data-export-'+pseudo;
          node.setAttribute(attribute,String(++pseudoId));
          pseudoStyle.sheet.insertRule('['+attribute+'="'+pseudoId+'"]::'+pseudo+'{content:none!important}');
          if(pseudo==='before')node.prepend(layer);else node.append(layer);
        }
      }
      const width=target.offsetWidth,height=target.offsetHeight;
      if(!width||!height)throw new Error('Export graphic has no dimensions');
      const blob=await renderer.toBlob(target,{
        width,height,pixelRatio:2,skipAutoScale:true,backgroundColor:payload.background||'#fff',
        style:{zoom:'1',transform:'none',margin:'0'},
      });
      if(!blob||blob.size<1000)throw new Error('PNG rendering failed');
      return blob;
    }finally{frame.remove();}
  }
  window.BRSNHosted={enabled:hosted,asset,imageUrl,renderPng};
})();
