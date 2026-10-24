(() => {
  const ns='http://www.w3.org/2000/svg';
  const asset=new URL('whiteboard-assets/map-whiteboard.png',document.currentScript.src).href;
  let sequence=0;
  function node(tag,attributes={}) {
    const element=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attributes))element.setAttribute(key,value);
    return element;
  }
  function roughPath(x,y,endX,endY,seed=1) {
    const length=Math.hypot(endX-x,endY-y)||1;
    const bend=Math.min(1.8,length*.035)*Math.sin(seed*2.17);
    return 'M'+x+' '+y+' Q'+((x+endX)/2-(endY-y)/length*bend)+' '+((y+endY)/2+(endX-x)/length*bend)+' '+endX+' '+endY;
  }
  function handDrawnOutline(path) {
    const length=path.getTotalLength();
    const count=Math.max(24,Math.ceil(length/6));
    const points=[];
    for(let i=0;i<count;i++) {
      const distance=i/count*length,point=path.getPointAtLength(distance);
      const next=path.getPointAtLength(Math.min(length,distance+1));
      const dx=next.x-point.x,dy=next.y-point.y,norm=Math.hypot(dx,dy)||1;
      const wobble=.75*Math.sin(distance/14)+.35*Math.sin(distance/4.7);
      points.push((i?'L':'M')+(point.x-dy/norm*wobble).toFixed(2)+' '+(point.y+dx/norm*wobble).toFixed(2));
    }
    path.setAttribute('d',points.join(' ')+' Z');
  }
  function markerGradient(defs,id,color,light) {
    const gradient=node('linearGradient',{id,x1:'0%',y1:'0%',x2:'25%',y2:'100%'});
    for(const [offset,shade] of [[0,color],[.16,color],[.22,light],[.29,color],[.46,color],[.53,light],[.61,color],[.79,color],[.85,light],[1,color]])
      gradient.append(node('stop',{offset,'stop-color':shade}));
    defs.append(gradient);
  }
  function decorate(svg,onResize) {
    if(!svg || svg.classList.contains('whiteboard-map-svg'))return;
    svg.classList.add('whiteboard-map-svg');
    const canvas=svg.closest('.east-west-map-canvas');
    const panel=canvas?.closest('.east-west-map-panel');
    panel?.classList.add('whiteboard-map-panel');
    if(panel && !panel.querySelector('.wb-map-board')) {
      const board=document.createElement('img');
      board.className='wb-map-board';board.src=asset;board.alt='';board.setAttribute('aria-hidden','true');
      panel.prepend(board);
    }
    panel?.querySelectorAll('img.east-west-map-brand').forEach(image=>{
      const mark=document.createElement('div');mark.className='wb-map-wordmark';
      mark.setAttribute('aria-label','Big Red Sports Network');
      mark.innerHTML='<span class="wb-map-brand-name">BIG <span>RED</span></span><span class="wb-map-brand-caption">SPORTS NETWORK</span>';
      image.replaceWith(mark);
    });
    const kicker=panel?.querySelector('.east-west-map-kicker');
    if(kicker)kicker.textContent=kicker.textContent.replace(/[^\w /&()-]/g,'').trim();
    const defs=svg.querySelector('defs');
    const viewport=svg.querySelector('#eastWestMapViewport');
    const cut=svg.querySelector('.nc-map-cut-line');
    const counties=svg.querySelector('.nc-map-counties');
    const shape=svg.querySelector('.nc-map-shape');
    if(!defs || !viewport || !cut || !counties || !shape)return;
    const id='wb-map-'+(++sequence);
    const width=svg.viewBox.baseVal.width;
    const height=svg.viewBox.baseVal.height;
    const cutX=Math.max(0,Math.min(width,Number(cut.getAttribute('x1'))));
    markerGradient(defs,id+'-ink-black','#222','#777');
    markerGradient(defs,id+'-ink-west','#e51b23','#ee666c');
    markerGradient(defs,id+'-ink-east','#087fe8','#68afea');
    for(const [side,x,w] of [['west',0,cutX],['east',cutX,width-cutX]]) {
      const clip=node('clipPath',{id:id+'-'+side});
      clip.append(node('rect',{x,y:-100,width:w,height:height+200}));
      defs.append(clip);
      const group=node('g',{class:'wb-map-region '+side,'clip-path':'url(#'+id+'-'+side+')'});
      group.append(counties.cloneNode(true),shape.cloneNode(true));
      viewport.insertBefore(group,counties);
      const outline=group.querySelector('.nc-map-shape');
      handDrawnOutline(outline);
      outline.style.setProperty('--map-outline-ink','url(#'+id+'-ink-'+side+')');
    }
    counties.remove();shape.remove();
    svg.querySelectorAll('.nc-map-shade-east,.nc-map-shade-west').forEach(n=>n.remove());
    const ink=node('filter',{id:id+'-ink',x:'-2%',y:'-2%',width:'104%',height:'104%','color-interpolation-filters':'sRGB'});
    ink.innerHTML='<feTurbulence type="fractalNoise" baseFrequency=".065" numOctaves="1" seed="8" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale="1.2" xChannelSelector="R" yChannelSelector="G"/>';
    defs.append(ink);
    svg.querySelectorAll('.wb-map-region').forEach(n=>n.setAttribute('filter','url(#'+id+'-ink)'));
    const magnet=node('filter',{id:id+'-magnet',x:'-30%',y:'-30%',width:'160%',height:'160%','color-interpolation-filters':'sRGB'});
    magnet.innerHTML='<feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="rim"/><feMorphology in="rim" operator="dilate" radius=".5" result="edge"/><feOffset in="edge" dx="0" dy="1.6" result="depth"/><feFlood flood-color="#222"/><feComposite in2="depth" operator="in" result="black"/><feFlood flood-color="white"/><feComposite in2="rim" operator="in" result="white"/><feMerge><feMergeNode in="black"/><feMergeNode in="white"/><feMergeNode in="SourceGraphic"/></feMerge>';
    defs.append(magnet);
    svg.querySelectorAll('.nc-map-marker image').forEach(n=>n.style.filter='url(#'+id+'-magnet)');
    const writing=node('g',{class:'wb-map-writing',filter:'url(#'+id+'-ink)'});
    svg.querySelectorAll('.nc-map-legend,.nc-map-note').forEach(text=>{
      const side=text.classList.contains('nc-map-note')?'black':text.textContent.trim().toLowerCase();
      text.style.setProperty('--map-text-ink','url(#'+id+'-ink-'+side+')');
      writing.append(text);
    });
    svg.append(writing);
    panel?.querySelectorAll('.east-west-map-head').forEach(n=>n.style.filter='url(#'+id+'-ink)');
    const split=node('path',{class:'nc-map-cut-line',d:roughPath(cutX,66,cutX,height-74,6),filter:'url(#'+id+'-ink)'});
    cut.replaceWith(split);
    const clip=node('clipPath',{id:id+'-surface',clipPathUnits:'userSpaceOnUse'});
    const clipRect=node('rect',{x:0,y:0,width,height});
    clip.append(clipRect);
    defs.append(clip);
    const surface=node('g',{class:'wb-map-surface-clip','clip-path':'url(#'+id+'-surface)'});
    svg.insertBefore(surface,viewport);surface.append(viewport);
    const leaders=node('g',{class:'wb-map-location-lines','aria-hidden':'true',filter:'url(#'+id+'-ink)'});
    viewport.insertBefore(leaders,svg.querySelector('#eastWestMapMarkerLayer'));
    const fitSurface=()=>{
      if(!svg.isConnected || !svg.clientWidth || !svg.clientHeight)return;
      const surfaceHeight=width*svg.clientHeight/svg.clientWidth;
      const top=(height-surfaceHeight)/2;
      svg.setAttribute('viewBox','0 '+top+' '+width+' '+surfaceHeight);
      clipRect.setAttribute('y',top);clipRect.setAttribute('height',surfaceHeight);
      const units=width/svg.clientWidth;
      writing.querySelectorAll('.nc-map-legend').forEach(text=>text.setAttribute('y',top+180*units));
      writing.querySelector('.nc-map-note')?.setAttribute('y',top+surfaceHeight-28*units);
      onResize?.();
    };
    canvas._whiteboardMapResize?.disconnect();
    const observer=new ResizeObserver(fitSurface);
    canvas._whiteboardMapResize=observer;observer.observe(svg);
    fitSurface();
    updateLeaders(svg);
  }
  function updateLeaders(svg) {
    const layer=svg?.querySelector('.wb-map-location-lines');
    if(!layer)return;
    const fragment=document.createDocumentFragment();
    svg.querySelectorAll('.nc-map-marker.is-offset').forEach((marker,index)=>{
      const x=Number(marker.dataset.mapX),y=Number(marker.dataset.mapY);
      const drawX=Number(marker.dataset.drawX),drawY=Number(marker.dataset.drawY);
      if(![x,y,drawX,drawY].every(Number.isFinite) || Math.hypot(drawX-x,drawY-y)<1)return;
      fragment.append(node('path',{d:roughPath(x,y,drawX,drawY,index+3),'data-end-x':drawX,'data-end-y':drawY}),node('circle',{cx:x,cy:y,r:2.2}));
    });
    layer.replaceChildren(fragment);
  }
  function projector(boundary,width,height) {
    const mercator=([lon,lat])=>[lon*Math.PI/180,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
    const points=boundary.map(mercator);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=Math.min((width-160)/(maxX-minX),(height-180)/(maxY-minY));
    const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
    return point=>{const [x,y]=mercator(point);return [width/2+(x-centerX)*scale,height/2-(y-centerY)*scale];};
  }
  function constrainTransform(transform,svg) {
    const shape=svg?.querySelector('.nc-map-shape');
    if(!shape)return;
    const bounds=shape.getBBox(),view=svg.viewBox.baseVal;
    const clampAxis=(position,start,length,low,high)=>{
      const a=low-start*transform.scale,b=high-(start+length)*transform.scale;
      return Math.max(Math.min(a,b),Math.min(Math.max(a,b),position));
    };
    transform.x=clampAxis(transform.x,bounds.x,bounds.width,view.x,view.x+view.width);
    transform.y=clampAxis(transform.y,bounds.y,bounds.height,view.y,view.y+view.height);
  }
  window.WhiteboardMap={decorate,updateLeaders,projector,constrainTransform,boundaryUrl:new URL('data/nc-state.geojson',document.currentScript.src).href,countiesUrl:new URL('data/nc-counties.geojson',document.currentScript.src).href};
})();
