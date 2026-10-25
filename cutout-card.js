(() => {
  const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function panelColor(primary,lightening=0,darkening=0){
    const raw=String(primary||'').trim();
    const hex=/^#[0-9a-f]{3}$/i.test(raw)?'#'+[...raw.slice(1)].map(c=>c+c).join(''):raw;
    const channels=/^#[0-9a-f]{6}$/i.test(hex)?[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)):[50,105,120];
    const light=Math.max(0,Math.min(1,lightening/100)),dark=Math.max(0,Math.min(1,darkening/100));
    return '#'+channels.map(value=>Math.round((value*(1-light)+255*light)*(1-dark)).toString(16).padStart(2,'0')).join('');
  }
  function mascotColor(primary,secondary,lightening=12,minimumContrast=3,secondaryLightening=0,darkening=0){
    const rgb=hex=>/^#[0-9a-f]{6}$/i.test(hex||'')?[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255):null;
    const base=rgb(primary)||rgb('#326978'),mix=Math.max(0,Math.min(1,lightening/100));
    const dark=Math.max(0,Math.min(1,darkening/100));
    const background=base.map(channel=>(channel*(1-mix)+mix)*(1-dark));
    const luminance=channels=>channels.map(channel=>channel<=.04045?channel/12.92:Math.pow((channel+.055)/1.055,2.4)).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0);
    const back=luminance(background);
    const contrast=color=>{const value=luminance(rgb(color));return (Math.max(back,value)+.05)/(Math.min(back,value)+.05);};
    const hex=channels=>'#'+channels.map(channel=>Math.round(channel*255).toString(16).padStart(2,'0')).join('');
    const source=rgb(secondary);
    if(source){
      if(contrast(secondary)>=minimumContrast)return secondary;
      const adjustment=Math.max(-1,Math.min(1,secondaryLightening/100));
      const color=source.map(channel=>adjustment>=0?channel*(1-adjustment)+adjustment:channel*(1+adjustment));
      return hex(color);
    }
    return contrast('#ffffff')>=contrast('#111111')?'#ffffff':'#111111';
  }
  function create(team,values={},id='cutout-magnet') {
    const node=document.createElement('article');node.className='magnet';
    const rimId=id+'-rim',baseId=id==='cutout-magnet'?'logo-base-stroke':id+'-base';
    const rank=values.rank??team.seed??'',move=values.move??1,delta=values.delta??'-.00001';
    const rawRecord=String(values.record??'11-8-0');
    const record=rawRecord.replace(/^(\d+)\s*-\s*(\d+)\s*-\s*0\s*$/,'$1-$2');
    const recordLabel='W-L-T';
    const moveNumber=Number(move),deltaNumber=Number(String(delta).replace(/[^\d.\-+]/g,''));
    node.innerHTML=`<svg class="filter-defs" width="0" height="0" aria-hidden="true"><defs>
      <filter id="${rimId}" x="-80%" y="-100%" width="260%" height="300%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="14" result="outer"/>
        <feGaussianBlur in="outer" stdDeviation="1"/><feComponentTransfer result="outer-rounded"><feFuncA type="linear" slope="4" intercept="-1.5"/></feComponentTransfer>
        <feFlood flood-color="#454545"/><feComposite in2="outer-rounded" operator="in" result="edge"/>
        <feMorphology in="SourceAlpha" operator="dilate" radius="13" result="rim"/>
        <feGaussianBlur in="rim" stdDeviation="1"/><feComponentTransfer result="rim-rounded"><feFuncA type="linear" slope="4" intercept="-1.5"/></feComponentTransfer>
        <feFlood flood-color="#fff"/><feComposite in2="rim-rounded" operator="in" result="white"/>
        <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="inner"/><feFlood flood-color="#111"/><feComposite in2="inner" operator="in" result="black"/>
        <feMerge><feMergeNode in="edge"/><feMergeNode in="white"/><feMergeNode in="black"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="${baseId}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="base-outline"/><feFlood flood-color="#fff"/><feComposite in2="base-outline" operator="in" result="base-white"/>
        <feMerge><feMergeNode in="base-white"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs></svg>
    <div class="scoreboard"><div class="face"><div class="name"><div class="school">${escapeText(team.name)}</div><div class="mascot"><span>${escapeText(team.mascot)}</span></div></div>
      <div class="rankbox"><div class="rank-label">RANK</div><div class="rank-value">${escapeText(rank)}</div></div>
      <div class="rankbox move${moveNumber<0?' negative':''}"><div class="rank-label">&#9651;</div><div class="rank-value">${moveNumber?'<span class="move-arrow"></span>':''}<span>${escapeText(moveNumber?Math.abs(moveNumber):'—')}</span></div></div></div>
      <div class="stats"><div class="stat"><div class="stat-label">${recordLabel}</div><div class="stat-value record">${escapeText(record)}</div></div>
      <div class="stat"><div class="stat-label">RPI</div><div class="stat-value">${escapeText(values.rpi??'.50553')}</div></div>
      <div class="stat"><div class="stat-label">RPI CHANGE</div><div class="stat-value ${deltaNumber<0?'negative':deltaNumber>0?'positive':''}">${deltaNumber?'<span class="delta-arrow"></span>':''}<span>${escapeText(deltaNumber?String(delta).replace(/^[+-]/,''):'—')}</span></div></div></div></div>
    <img class="logo" alt="${escapeText(team.name.trim())} logo">`;
    node.style.setProperty('--team',team.color||'#326978');node.style.setProperty('--mascot-color',mascotColor(team.color,team.secondary));
    node.style.setProperty('--cutout-filter',`url('#${rimId}')`);
    const image=node.querySelector('.logo');image.style.setProperty('--base-filter',`url('#${baseId}')`);
    const fallback=new URL('assets/fallback-logo.png',document.baseURI).href;
    image.crossOrigin='anonymous';image.referrerPolicy='no-referrer';image.src=team.logo||fallback;
    image.onerror=()=>{if(!image.dataset.fallback){image.dataset.fallback='true';image.src=fallback;}};
    return node;
  }
  const trimmedLogos=new Map();
  function trimLogo(image,onReady) {
    if(!image.isConnected) return;
    if(image.dataset.trimmed==='true'){onReady();return;}
    const source=image.src,cached=trimmedLogos.get(source);
    if(cached){
      image.onload=null;image.src=cached.src;image.dataset.aspect=cached.aspect;
      image._visibleRowEdges=cached.edges;image.dataset.trimmed='true';onReady();return;
    }
    try {
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
      for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(pixels[(y*canvas.width+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      if(right<left) throw new Error('Empty logo');
      const cropped=document.createElement('canvas');cropped.width=right-left+1;cropped.height=bottom-top+1;
      cropped.getContext('2d').drawImage(canvas,left,top,cropped.width,cropped.height,0,0,cropped.width,cropped.height);
      image._visibleRowEdges=Array.from({length:cropped.height},(_,y)=>{
        for(let x=right;x>=left;x--)if(pixels[((y+top)*canvas.width+x)*4+3]>24)return (x-left+1)/cropped.width;
        return 0;
      });
      image.onload=null;image.src=cropped.toDataURL();image.dataset.aspect=cropped.width/cropped.height;
      if(trimmedLogos.size>=128)trimmedLogos.delete(trimmedLogos.keys().next().value);
      trimmedLogos.set(source,{src:image.src,aspect:image.dataset.aspect,edges:image._visibleRowEdges});
    } catch {
      image.dataset.aspect=image.naturalWidth/Math.max(1,image.naturalHeight);
    }
    image.dataset.trimmed='true';onReady();
  }
  function tune(node,settings) {
    for(const key in settings) node.style.setProperty('--'+key,settings[key]+'px');
    const morphology=node.querySelectorAll('filter:first-child feMorphology');
    morphology[0].setAttribute('radius',settings.rim+4);morphology[1].setAttribute('radius',settings.rim+3);
    node.querySelector('filter:last-child feMorphology').setAttribute('radius',settings.stroke);
  }
  function fitText(element,maxSize) {
    element.style.fontSize=maxSize+'px';
    if(element.scrollWidth>element.clientWidth) element.style.fontSize=Math.max(12,maxSize*element.clientWidth/element.scrollWidth)+'px';
  }
  window.CutoutCard={create,trimLogo,tune,fitText,mascotColor,panelColor};
})();
