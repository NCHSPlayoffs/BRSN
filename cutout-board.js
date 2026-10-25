(() => {
  const original=window.WhiteboardPlayoff.apply;
  let sequence=0;
  const saved={};
  try{Object.assign(saved,JSON.parse(localStorage.getItem('brsn-whiteboard2-magnet-v2')));}catch{}
  const defaults={width:880,height:315,logo:375,logoMaxWidth:0,logoUniformity:90,logoWidthRatio:95,school:114,mascot:46,rank:140,moveFont:68.25,rankLabel:34,stat:110,label:30,stroke:2.5,rim:15,depth:3,cutoutRounding:1,cutoutSoftness:0,corners:12,'logo-x':0,'logo-y':0};
  defaults.rankLabel=100;
  const settings={...defaults};
  defaults.schoolStroke=2.5;settings.schoolStroke=2.5;
  for(const key in defaults) if(Number.isFinite(saved[key])) settings[key]=saved[key];
  if(saved.textFitRevision!==1){settings.label=Math.max(settings.label,40);settings.stat=Math.max(settings.stat,75);}
  if(!Number.isFinite(saved.moveFont))settings.moveFont=(saved.rank||105)*.65;
  if(saved.numericFitRevision!==1){settings.rank=Math.max(settings.rank,140);settings.stat=Math.max(settings.stat,110);}
  if(saved.mascotFitRevision!==1)settings.mascot=Math.max(settings.mascot,46);
  if(saved.rankLabelFitRevision!==1)settings.rankLabel=100;
  const layoutDefaults={slotWidth:314,slotHeight:120,rowGap:20,cardsY:184,secondX:45,homeX:438,awayX:798,edgeInset:32,lighten:12,rotation:.8,vsX:0,vsY:0,vsSize:25,vsAngle:-5};
  layoutDefaults.winnerVsX=286;
  const layoutSettings={...layoutDefaults};
  layoutDefaults.darken=0;layoutSettings.darken=0;
  const statsDefaults={faceHeight:59,labelHeight:38,gridLine:3,statGap:2,statPad:3,recordWidth:1,rpiWidth:1,deltaWidth:1.1,rankWidth:12,moveWidth:9,rankHeight:100,moveHeight:100,upGap:10,downGap:2,numberTallness:118,inkStyle:'marker',inkStrength:35,inkGrain:6,statsX:0,labelX:0,valueX:0,labelY:0,valueY:0,schoolSpacing:0,mascotSpacing:0,rankSpacing:0,labelSpacing:0,valueSpacing:0,rankLabelSpacing:0,valuesFont:'upright',rankFont:'upright',changeFont:'pen',labelsFont:'marker',labelAlign:'center',valueAlign:'center'};
  statsDefaults.mascotFont='scoreboard';
  statsDefaults.schoolFont='scoreboard';
  statsDefaults.schoolTallness=100;
  statsDefaults.mascotContrast=3;
  statsDefaults.secondaryLightening=0;
  statsDefaults.schoolStrokeColor='black';
  statsDefaults.shortenTeamNames=0;
  statsDefaults.centerTeamNames=0;
  statsDefaults.mascotY=0;
  statsDefaults.nameY=0;
  statsDefaults.rankLabelWidth=100;
  statsDefaults.rankLabelHeight=50;
  statsDefaults.rankCorners=8;
  statsDefaults.moveCorners=8;
  statsDefaults.moveLabelSize=0;
  Object.assign(statsDefaults,{recordDividerLength:100,rpiDividerLength:100,deltaDividerLength:100});
  statsDefaults.headerInkStrength=18;
  statsDefaults.headerInkGrain=4;
  Object.assign(statsDefaults,{reflectionStrength:12,reflectionAngle:115,reflectionWidth:28,reflectionPosition:50});
  Object.assign(layoutDefaults,{secondY:0,homeY:0,awayY:0});
  Object.assign(layoutSettings,{secondY:0,homeY:0,awayY:0});
  Object.assign(statsDefaults,{labelBoost:125,labelExtraHeight:16});
  Object.assign(statsDefaults,{nameX:0,logoTextGap:2,recordMaxWidth:0,rpiMaxWidth:0,deltaMaxWidth:0});
  Object.assign(statsDefaults,{rpiSpacing:0,deltaSpacing:0});
  Object.assign(statsDefaults,{recordLabelX:0,recordValueX:0,rpiLabelX:0,rpiValueX:0,deltaLabelX:0,deltaValueX:0});
  for(const key of ['record','rpi','delta'])Object.assign(statsDefaults,{[key+'ValuePaddingLeft']:-1,[key+'ValuePaddingRight']:-1});
  Object.assign(statsDefaults,{connectorX:0,connectorLineLength:17,connectorArmLength:13,connectorHeight:60});
  Object.assign(statsDefaults,{minimumScoreboardWidth:900,minimumMagnetWidth:0});
  const logoExceptions=[['southStanly','South Stanly'],['weldon','Weldon'],['statesville','Statesville'],['triton','Triton'],['eastGaston','East Gaston']];
  for(const [key]of logoExceptions)Object.assign(statsDefaults,{[key+'LogoSize']:100,[key+'LogoWidth']:100,[key+'LogoHeightScale']:100,[key+'LogoX']:0,[key+'LogoY']:0,[key+'LogoAngle']:0,[key+'LogoUniformity']:0});
  const statsSettings={...statsDefaults};
  try{
    const stored=JSON.parse(localStorage.getItem('brsn-whiteboard2-board-stats-v1'));
    for(const key in statsDefaults)if(typeof stored?.[key]===typeof statsDefaults[key])statsSettings[key]=stored[key];
    if(stored?.uprightFontRevision!==1&&statsSettings.valuesFont==='pen')statsSettings.valuesFont='upright';
  }catch{}
  try{
    const stored=JSON.parse(localStorage.getItem('brsn-whiteboard2-board-layout-v1'));
    for(const key in layoutDefaults)if(Number.isFinite(stored?.[key]))layoutSettings[key]=stored[key];
  }catch{}
  Object.assign(defaults,{width:900,height:360,logoMaxWidth:380,logoUniformity:95,logoWidthRatio:90,school:92,mascot:58,rank:150,moveFont:72,label:44,stat:120});
  Object.assign(layoutDefaults,{slotWidth:300,slotHeight:114,rowGap:18,cardsY:180,secondX:45,homeX:438,awayX:798});
  Object.assign(statsDefaults,{faceHeight:64,labelHeight:38,gridLine:2,statPad:2,deltaWidth:1.25,rankWidth:13,moveWidth:8,rankHeight:94,moveHeight:94,numberTallness:112,labelsFont:'scoreboard',mascotContrast:4,inkStrength:30});
  const designKeys=['brsn-whiteboard2-magnet-v2','brsn-whiteboard2-board-layout-v1','brsn-whiteboard2-board-stats-v1'];
  try{
    if(localStorage.getItem('brsn-whiteboard2-layout-tuning')!=='1'){
      localStorage.setItem('brsn-whiteboard2-before-layout-tuning',JSON.stringify(Object.fromEntries(designKeys.map(key=>[key,localStorage.getItem(key)]))));
      Object.assign(settings,defaults);Object.assign(layoutSettings,layoutDefaults);Object.assign(statsSettings,statsDefaults);
      designKeys.forEach((key,index)=>localStorage.setItem(key,JSON.stringify([settings,layoutSettings,statsSettings][index])));
      localStorage.setItem('brsn-whiteboard2-layout-tuning','1');
    }
  }catch{}
  Object.assign(settings,defaults);Object.assign(layoutSettings,layoutDefaults);Object.assign(statsSettings,statsDefaults);
  const cardProperties={rim:'--lab-rim',stroke:'--lab-base-stroke',depth:'--lab-depth',logo:'--lab-logo-height',logoMaxWidth:'--lab-logo-max-width',logoUniformity:'--lab-logo-uniformity',logoWidthRatio:'--lab-logo-width-ratio',school:'--lab-school-size',mascot:'--lab-mascot-size',rank:'--lab-rank-size',stat:'--lab-stat-size',label:'--lab-label-size',cutoutRounding:'--lab-cutout-rounding',cutoutSoftness:'--lab-cutout-softness',corners:'--lab-corners'};
  const layoutProperties={slotWidth:'--lab-slot-width',slotHeight:'--lab-slot-height',rowGap:'--lab-row-gap',cardsY:'--lab-cards-y',secondX:'--lab-second-x',homeX:'--lab-home-x',awayX:'--lab-away-x',edgeInset:'--lab-edge-inset',lighten:'--lab-panel-lighten',vsX:'--wb-vs-x',vsY:'--wb-vs-y',vsSize:'--lab-vs-size',vsAngle:'--lab-vs-angle'};
  function applySettings(board){
    board.dataset.centerTeamNames=statsSettings.centerTeamNames?'true':'false';
    board.style.setProperty('--wb-winner-vs-x',layoutSettings.winnerVsX+'px');
    board.style.setProperty('--lab-school-stroke',settings.schoolStroke+'px');
    board.style.setProperty('--lab-reflection-opacity',statsSettings.reflectionStrength/100);
    board.style.setProperty('--lab-reflection-angle',statsSettings.reflectionAngle+'deg');
    board.style.setProperty('--lab-reflection-width',statsSettings.reflectionWidth+'%');
    board.style.setProperty('--lab-reflection-position',statsSettings.reflectionPosition+'%');
    board.style.setProperty('--lab-header-ink-dark',statsSettings.headerInkStrength*.45+'%');
    board.style.setProperty('--lab-header-ink-light',statsSettings.headerInkStrength*.18+'%');
    board.style.setProperty('--lab-header-ink-grain',statsSettings.headerInkGrain/100);
    for(const key of ['second','home','away'])board.style.setProperty('--lab-'+key+'-y',layoutSettings[key+'Y']+'px');
    board.style.setProperty('--lab-panel-darken',layoutSettings.darken+'%');
    for(const [key,property]of Object.entries(cardProperties))board.style.setProperty(property,settings[key]+(['logoUniformity','logoWidthRatio'].includes(key)?'%':'px'));
    for(const [key,property]of Object.entries(layoutProperties))board.style.setProperty(property,layoutSettings[key]+(key==='lighten'?'%':key==='vsAngle'?'deg':'px'));
    const unitless=['recordWidth','rpiWidth','deltaWidth'];
    const fonts={upright:"'Cutout Neat',Arial,sans-serif",pen:"'Cutout Pen',cursive",marker:"'Cutout Marker',cursive",scoreboard:"'Cutout Scoreboard',Arial,sans-serif",arial:'Arial,Helvetica,sans-serif',goldman:"'Cutout Goldman',Arial,sans-serif",russo:"'Cutout Russo',Arial,sans-serif",graduate:"'Cutout Graduate',Arial,sans-serif",blackops:"'Cutout Black Ops',Arial,sans-serif",sairastencil:"'Cutout Saira Stencil',Arial,sans-serif",squada:"'Cutout Squada',Arial,sans-serif"};
    for(const [key,value]of Object.entries(statsSettings)){
      if(key==='headerInkStrength'||key==='headerInkGrain'||key.startsWith('reflection'))continue;
      const cssKey=key.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase());
      if(/ValuePadding(Left|Right)$/.test(key)&&value<0){board.style.removeProperty('--lab-'+cssKey);continue;}
      let cssValue=value;
      if(key==='inkStyle'){board.dataset.inkStyle=['solid','pen','marker'].includes(value)?value:'solid';continue;}
      if(key==='inkStrength'){
        board.style.setProperty('--lab-ink-dark',value*.45+'%');
        board.style.setProperty('--lab-ink-light',value*.18+'%');
      }
      if(key.endsWith('Font'))cssValue=fonts[value]||fonts.pen;
      else if(key==='inkGrain')cssValue=value/100;
      else if(key==='numberTallness')cssValue=value/100;
      else if(key==='schoolTallness')cssValue=value/100;
      else if(key.endsWith('LogoAngle'))cssValue=value+'deg';
      else if(key==='connectorHeight'||key==='rankLabelHeight')cssValue=value+'px';
      else if(key==='rankLabelWidth')cssValue=value+'%';
      else if(key.endsWith('DividerLength'))cssValue=value+'%';
      else if(key.endsWith('Align'))cssValue=({left:'flex-start',center:'center',right:'flex-end'})[value]||'center';
      else cssValue=value+(unitless.includes(key)?'fr':key.endsWith('Height')||['rankWidth','moveWidth'].includes(key)?'%':'px');
      board.style.setProperty('--lab-'+cssKey,cssValue);
    }
    board.style.setProperty('--lab-record-align',statsSettings.valueAlign==='right'?'flex-end':'flex-start');
    board.querySelectorAll('.wb-magnet').forEach(slot=>slot.style.setProperty('--wb-angle',(Number(slot.dataset.cutoutTilt)||0)*layoutSettings.rotation+'deg'));
    board._cutoutRefresh?.();
    const schoolFont=fonts[statsSettings.schoolFont]||fonts.scoreboard;
    if(!document.fonts.check('100px '+schoolFont)){
      document.fonts.load('100px '+schoolFont).then(()=>{if(board.isConnected)board._cutoutRefresh?.();}).catch(()=>{});
    }
  }
  const text=(node,selector)=>node.querySelector(selector)?.textContent.trim()||'';
  function forcedTeamNameLines(fullName){
    if(!statsSettings.shortenTeamNames)return null;
    const words=fullName.trim().split(/\s+/);
    const firstWordLetters=words[0].replace(/[^a-z]/gi,'').length;
    return words.length>1&&firstWordLetters>=4?[words[0],words.slice(1).join(' ')]:[fullName];
  }
  function transformBoard(board) {
    if(!board?.classList.contains('whiteboard-playoff')||board.classList.contains('cutout-board'))return;
    board.classList.add('cutout-board');
    board.style.setProperty('--lab-rim',settings.rim+'px');
    board.style.setProperty('--lab-base-stroke',settings.stroke+'px');
    board.style.setProperty('--lab-logo-height',settings.logo+'px');
    for(const key of ['school','mascot','rank','stat','label'])board.style.setProperty('--lab-'+key+'-size',settings[key]+'px');
    const surface=board.querySelector('.wb-surface');
    const fitTitle=()=>{
      if(!board.isConnected)return;
      const title=surface.querySelector('.wb-title'),context=document.createElement('canvas').getContext('2d');
      const style=getComputedStyle(title),heading=style.textTransform==='uppercase'?title.textContent.toUpperCase():title.textContent;
      context.font="48px 'WB Marker'";
      title.style.fontSize=Math.min(48,48*(title.clientWidth-8)/Math.max(1,context.measureText(heading).width))+'px';
    };
    document.fonts.ready.then(fitTitle);
    const control=document.createElement('span');control.className='lab-filter-controls';control.setAttribute('aria-hidden','true');surface.append(control);
    const layouts=[];
    let layoutPending=false;
    const refreshLayouts=()=>{
      if(layoutPending)return;layoutPending=true;
      requestAnimationFrame(()=>{layoutPending=false;if(board.isConnected)layouts.forEach(layout=>layout());});
    };
    let textPending=false;
    const fitAllText=()=>{
      if(textPending)return;textPending=true;
      requestAnimationFrame(()=>{
        textPending=false;if(!board.isConnected)return;
        const nameStyle=surface.querySelector('.cm-school');
        if(nameStyle){
          const css=getComputedStyle(nameStyle),font=css.fontWeight+' 100px '+css.fontFamily;
          if(!document.fonts.check(font)){
            document.fonts.load(font).then(()=>{if(board.isConnected)fitAllText();}).catch(()=>{});
            return;
          }
        }
        const context=document.createElement('canvas').getContext('2d');
        const measurements=new Map();
        const textMetrics=value=>{
          const key=JSON.stringify([context.font,value]);
          if(!measurements.has(key))measurements.set(key,context.measureText(value));
          return measurements.get(key);
        };
        const measure=(element,maxSize,school=false)=>{
          const css=getComputedStyle(element),spacing=parseFloat(css.letterSpacing)||0;
          const raw=element.dataset.fullName||element.textContent.trim();
          const content=css.textTransform==='uppercase'?raw.toUpperCase():raw;
          const arrow=element.querySelector('.cm-delta-arrow,.cm-move-arrow');
          const vertical=element.closest('.cm-move');
          const numeric=element.classList.contains('cm-stat-value')||(element.classList.contains('cm-rank-value')&&!vertical);
          const width=element.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-(arrow&&!vertical?arrow.offsetWidth+(parseFloat(css.columnGap)||0):0)-(element.classList.contains('cm-mascot')?8:0)-(element.classList.contains('cm-stat-label')?2:6);
          const height=element.clientHeight-(arrow&&vertical?arrow.offsetHeight+(parseFloat(css.rowGap)||0):0)-(element.classList.contains('cm-stat-label')?2:6);
          const usableWidth=element.classList.contains('cm-record')?width/.85:width;
          const stroke=school?(parseFloat(css.webkitTextStrokeWidth)||0):0;
          const forcedLines=school?forcedTeamNameLines(content):null;
          const options=forcedLines?[forcedLines]:[ [content] ];
          if(school&&!forcedLines){
            const words=content.split(/\s+/);
            for(let i=1;i<words.length;i++)options.push([words.slice(0,i).join(' '),words.slice(i).join(' ')]);
          }
          let best={size:0,lines:options[0]};
          for(const lines of options){
            let low=1,high=maxSize;
            for(let i=0;i<12;i++){
              const size=(low+high)/2;context.font=`${css.fontWeight} ${size}px ${css.fontFamily}`;
              const lineMetrics=lines.map(textMetrics);
              const widths=lineMetrics.map((metrics,index)=>Math.max(metrics.width,(metrics.actualBoundingBoxLeft||0)+(metrics.actualBoundingBoxRight||0))+Math.max(0,lines[index].length-1)*spacing+stroke);
              const metrics=textMetrics(numeric?content:'Mg');
              const inkHeight=(metrics.actualBoundingBoxAscent||size*.8)+(metrics.actualBoundingBoxDescent||size*.2);
              const heightScale=numeric?statsSettings.numberTallness/100:1;
              const paintedHeight=school?Math.max(size*1.08,Math.max(...lineMetrics.map(m=>(m.actualBoundingBoxAscent||size*.8)+(m.actualBoundingBoxDescent||0))))*lines.length+stroke:Math.max(size*(numeric?.8:1.08),inkHeight)*heightScale*lines.length;
              if(Math.max(...widths)<=usableWidth&&paintedHeight<=height)low=size;else high=size;
            }
            if(low>best.size)best={size:low,lines};
          }
          return {...best,element};
        };
        const groups=[['.cm-school',settings.school,true],['.cm-mascot',settings.mascot],['.cm-stat-label',settings.label*statsSettings.labelBoost/100],['.cm-stat-value:not(.cm-record)',settings.stat],['.cm-record',settings.stat],['.cm-rankbox:not(.cm-move) .cm-rank-label',settings.rankLabel],['.cm-move .cm-rank-label',statsSettings.moveLabelSize||settings.rankLabel],['.cm-rankbox:not(.cm-move) .cm-rank-value',settings.rank],['.cm-move .cm-rank-value',settings.moveFont]];
        let statCommon=settings.stat;
        for(const [selector,maximum,school]of groups){
          const recordGroup=selector==='.cm-record';
          const fitted=[...surface.querySelectorAll(selector)].map(element=>measure(element,recordGroup?statCommon:maximum,school));
          if(!fitted.length)continue;
          const common=Math.floor(Math.min(maximum,Math.min(...fitted.map(item=>item.size))/(school?.85:1))*2)/2;
          if(selector==='.cm-stat-value:not(.cm-record)')statCommon=common;
          for(const item of fitted){
            item.element.style.fontSize=(recordGroup?Math.min(statCommon,Math.floor(item.size*2)/2):school?Math.min(common,Math.floor(item.size*2)/2):common)+'px';
            const ink=item.element.querySelector('.cm-number-ink,.cm-ink-text');
            if(ink){
              const css=getComputedStyle(item.element),size=parseFloat(css.fontSize),scale=ink.classList.contains('cm-number-ink')?statsSettings.numberTallness/100:1;
              context.font=`${css.fontWeight} ${size}px ${css.fontFamily}`;
              const metrics=textMetrics(ink.textContent),ascent=metrics.fontBoundingBoxAscent||size,descent=metrics.fontBoundingBoxDescent||size*.25;
              const inkAscent=metrics.actualBoundingBoxAscent||size*.8,inkDescent=metrics.actualBoundingBoxDescent||0;
              const spacing=parseFloat(css.letterSpacing)||0;
              const frame=ink.parentElement;
              const inkWidth=metrics.width+Math.max(0,ink.textContent.length-1)*spacing;
              const availableWidth=item.element.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-6;
              const widthScale=recordGroup?Math.max(.85,Math.min(1,availableWidth/Math.max(1,inkWidth))):1;
              ink.style.setProperty('--ink-width-scale',widthScale);
              frame.style.width=inkWidth*widthScale+4+'px';
              frame.style.transform='';
              const tiedRecord=recordGroup&&/^(\d+)-(\d+)-(\d+)$/.exec(ink.textContent.trim());
              if(tiedRecord&&Number(tiedRecord[3])>0){
                const manualX=css.transform==='none'?0:new DOMMatrixReadOnly(css.transform).m41;
                const overflow=frame.offsetLeft+frame.offsetWidth+manualX-item.element.clientWidth+2;
                if(overflow>0)frame.style.transform='translateX('+(-overflow)+'px)';
              }
              frame.style.height=(inkAscent+inkDescent)*scale+4+'px';
              ink.style.setProperty('--ink-line-height',Math.ceil(ascent+descent+6)+'px');
              ink.style.setProperty('--ink-center-shift',(inkAscent-inkDescent-ascent+descent)/2*scale+'px');
              ink.style.setProperty('--ink-height-scale',scale);
              if(item.element.matches('.cm-rankbox:not(.cm-move) .cm-rank-value')){
                ink.style.setProperty('--rank-ink-wash-height',(inkAscent+inkDescent+4)+'px');
                ink.style.setProperty('--rank-ink-wash-offset',(ascent-descent-inkAscent+inkDescent)/2+'px');
              }
            }
            if(school){
              const css=getComputedStyle(item.element),size=parseFloat(css.fontSize),raw=item.element.dataset.fullName;
              const full=css.textTransform==='uppercase'?raw.toUpperCase():raw;
              context.font=`${css.fontWeight} ${size}px ${css.fontFamily}`;
              const available=item.element.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-6;
              const fullMetrics=textMetrics(full);
              const fullWidth=Math.max(fullMetrics.width,(fullMetrics.actualBoundingBoxLeft||0)+(fullMetrics.actualBoundingBoxRight||0))+(full.length-1)*(parseFloat(css.letterSpacing)||0)+(parseFloat(css.webkitTextStrokeWidth)||0);
              if(!statsSettings.shortenTeamNames&&fullWidth<=available)item.lines=[full];
              item.element.replaceChildren();
              item.lines.forEach((line,index)=>{if(index)item.element.append(document.createElement('br'));item.element.append(document.createTextNode(line));});
            }
          }
        }
      });
    };
    const cards=[...surface.querySelectorAll('.wb-magnet')];
    const alignEdges=(slot,node,rectangles)=>{
      const inset=parseFloat(getComputedStyle(board).getPropertyValue('--lab-edge-inset'))||32;
      const angle=(parseFloat(slot.style.getPropertyValue('--wb-angle'))||0)*Math.PI/180;
      const cos=Math.cos(angle),sin=Math.sin(angle),originX=slot.clientWidth/2,originY=slot.clientHeight/2;
      const points=rectangles.flatMap(({left,top,right,bottom})=>[[left,top],[right,top],[left,bottom],[right,bottom]]);
      const xs=points.map(([x,y])=>slot.offsetLeft+originX+(x-originX)*cos-(y-originY)*sin);
      const left=Math.min(...xs),right=Math.max(...xs),safeRight=surface.clientWidth-inset;
      let shift=0;
      if(slot.classList.contains('wb-second-column'))shift=Math.max(inset,slot.offsetLeft)-left;
      else if(slot.classList.contains('wb-first-away'))shift=Math.min(safeRight,slot.offsetLeft+slot.clientWidth)-right;
      shift=Math.max(inset-left,Math.min(safeRight-right,shift));
      node.style.left=(parseFloat(node.style.left)||0)+shift/cos+'px';
      slot.dataset.cutoutLeft=(left+shift).toFixed(3);
      slot.dataset.cutoutRight=(right+shift).toFixed(3);
    };
    for(const slot of cards) {
      slot.dataset.cutoutTilt=(parseFloat(slot.style.getPropertyValue('--wb-angle'))||0)/.8;
      if(slot.classList.contains('wb-placeholder')) {
        const title=text(slot,'.wb-placeholder-text'),detail=text(slot,'.wb-detail'),eyebrow=text(slot,'.wb-eyebrow');
        const placeholder=document.createElement('div');placeholder.className='cutout-placeholder';
        const seeds=[...slot.querySelectorAll('.wb-placeholder-text>span')].map(line=>line.textContent.trim());
        const isBye=/^BYE$/i.test(title);
        placeholder.dataset.kind=isBye?'bye':'matchup';
        const lines=[seeds.length===2?'SECOND ROUND':eyebrow,seeds.length===2?seeds.join(' VS '):title,isBye?'[NO OPPONENT]':detail];
        lines.forEach((value,index)=>{if(!value)return;const line=document.createElement(index===1?'strong':'small');line.className='placeholder-'+['eyebrow','title','detail'][index];line.textContent=value.toUpperCase();placeholder.append(line);});
        slot.replaceChildren(placeholder);
        const layout=()=>{
          placeholder.style.left='0px';placeholder.style.right='auto';placeholder.style.width=slot.clientWidth+'px';
          const referenceWidth=defaults.width+Math.max(0,defaults.logo*defaults.logoWidthRatio/100-defaults.width*.18)+defaults.rim*2+16;
          const magnetScale=Math.min(layoutSettings.slotWidth/referenceWidth,layoutSettings.slotHeight/(defaults.logo+defaults.rim*2+10));
          const rim=settings.rim*magnetScale,depth=settings.depth*magnetScale,edge=magnetScale,shadow=(settings.depth+5)*magnetScale;
          placeholder.style.setProperty('--placeholder-rim',rim+'px');
          placeholder.style.setProperty('--placeholder-depth',depth+'px');
          placeholder.style.setProperty('--placeholder-edge',edge+'px');
          placeholder.style.setProperty('--placeholder-shadow-offset',(settings.depth+3)*magnetScale+'px');
          placeholder.style.setProperty('--placeholder-shadow-blur',2*magnetScale+'px');
          const context=document.createElement('canvas').getContext('2d');
          const entries=[...placeholder.children],sizes=entries.map(line=>line.classList.contains('placeholder-title')?(isBye?36:22):line.classList.contains('placeholder-eyebrow')?14:18);
          const width=Math.max(1,slot.clientWidth-34),height=Math.max(1,slot.clientHeight-30-5*(entries.length-1));
          const scale=Math.min(1,height/sizes.reduce((sum,size)=>sum+size*1.15,0),...entries.map((line,index)=>{context.font=sizes[index]+"px 'Cutout Marker'";return width/Math.max(1,context.measureText(line.textContent).width);}));
          entries.forEach((line,index)=>line.style.fontSize=sizes[index]*scale+'px');
          alignEdges(slot,placeholder,[{left:-rim-edge,top:-rim-edge,right:slot.clientWidth+rim+edge,bottom:slot.clientHeight+rim+edge+shadow}]);
        };
        const observer=new ResizeObserver(layout);observer.observe(slot);slot._cutoutObserver=observer;layouts.push(layout);layout();continue;
      }
      const schoolLines=[...slot.querySelectorAll('.wb-school>span')].map(line=>line.textContent.trim());
      const team={name:schoolLines.length?schoolLines.join(' '):text(slot,'.wb-school'),mascot:text(slot,'.wb-mascot'),color:slot.style.getPropertyValue('--team-primary')||slot.style.getPropertyValue('--team-accent')||'#326978',secondary:slot.style.getPropertyValue('--team-secondary').trim(),logo:slot.querySelector('.wb-logo')?.src};
      if(/pine\s*lake|pinelake/i.test(team.name))team.logo=new URL('assets/pine-lake-prep-nMdhYRp.png',document.baseURI).href;
      else if(window.BRSNHosted?.enabled)team.logo=window.BRSNHosted.imageUrl(team.logo);
      else if(/^https?:/.test(team.logo)&&new URL(team.logo).origin!==location.origin)team.logo='/lab-logo?url='+encodeURIComponent(team.logo);
      const move=Number(text(slot,'.wb-move').replace(/[^\d]/g,''))*(slot.dataset.move==='neg'?-1:slot.dataset.move==='pos'?1:0);
      const stats=[...slot.querySelectorAll('.wb-stat')];
      const deltaText=text(stats[2]||slot,'.wb-value').replace(/[\s▲▼△▽]/g,'');
      const values={rank:text(slot,'.wb-rank'),move,record:text(stats[0]||slot,'.wb-value'),rpi:text(stats[1]||slot,'.wb-value'),delta:(stats[2]?.classList.contains('negative')?'-':'')+deltaText};
      const node=window.CutoutCard.create(team,values,'board-cutout-'+(++sequence));
      // Keep legacy table styles from changing the cutout card's internal elements.
      node.querySelectorAll('[class]').forEach(child=>{
        for(const name of [...child.classList]) {child.classList.remove(name);child.classList.add('cm-'+name);}
      });
      slot.replaceChildren(node);
      node.querySelector('.cm-move .cm-rank-label').textContent='\u25b3\u25bd';
      node.querySelectorAll('.cm-stat-value,.cm-rankbox:not(.cm-move) .cm-rank-value').forEach(value=>{
        const existing=value.querySelector('span:not(.cm-delta-arrow)');
        if(existing){existing.classList.add('cm-number-ink');return;}
        const ink=document.createElement('span');ink.className='cm-number-ink';
        while(value.firstChild)ink.append(value.firstChild);value.append(ink);
      });
      node.querySelectorAll('.cm-move .cm-rank-value>span:not(.cm-move-arrow)').forEach(ink=>ink.classList.add('cm-ink-text'));
      node.querySelectorAll('.cm-number-ink,.cm-ink-text').forEach(ink=>{
        const frame=document.createElement('span');frame.className='cm-ink-frame';ink.replaceWith(frame);frame.append(ink);
      });
      const image=node.querySelector('.cm-logo');
      const school=node.querySelector('.cm-school');school.dataset.fullName=school.textContent;
      const shell=document.createElement('div');shell.className='cm-shell';shell.setAttribute('aria-hidden','true');
      const shellFace=document.createElement('div');shellFace.className='cm-shell-face';
      const shellLogo=image.cloneNode();shellLogo.className='cm-shell-logo';shellLogo.removeAttribute('id');shellLogo.alt='';
      shell.append(shellFace,shellLogo);node.prepend(shell);
      const reflection=document.createElement('div');reflection.className='cm-logo-reflection';reflection.setAttribute('aria-hidden','true');node.append(reflection);
      const teamKey=logoExceptions.find(([,name])=>team.name.toLowerCase().replace(/[^a-z0-9]/g,'').includes(name.toLowerCase().replace(/[^a-z0-9]/g,'')))?.[0];
      if(teamKey)node.dataset.logoException=teamKey;
      const layout=()=>{
        if(!node.isConnected)return;
        const style=getComputedStyle(board),number=(name,fallback)=>{
          const value=parseFloat(style.getPropertyValue(name));return Number.isFinite(value)?value:fallback;
        };
        const local={...settings,rim:number('--lab-rim',0),stroke:number('--lab-base-stroke',0),depth:number('--lab-depth',0)};
        const primary=team.color.trim();
        const panelColor=window.CutoutCard.panelColor(primary,number('--lab-panel-lighten',12),number('--lab-panel-darken',0));
        node.style.setProperty('--panel-color',panelColor);
        node.style.setProperty('--school-color','#ffffff');
        node.style.setProperty('--school-stroke-width',(statsSettings.schoolStrokeColor==='secondary'?2:1)*settings.schoolStroke+'px');
        const exceptionProperty=key=>'--lab-'+teamKey.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase())+'-logo-'+key;
        const logoX=settings['logo-x']+(teamKey?number(exceptionProperty('x'),0):0);
        const logoY=settings['logo-y']+(teamKey?number(exceptionProperty('y'),0):0);
        const logoAngle=teamKey?number(exceptionProperty('angle'),0):0;
        local['logo-x']=logoX;local['logo-y']=logoY;
        node.style.setProperty('--logo-angle',logoAngle+'deg');
        node.style.setProperty('--mascot-color',window.CutoutCard.mascotColor(team.color.trim(),team.secondary,number('--lab-panel-lighten',12),number('--lab-mascot-contrast',3),number('--lab-secondary-lightening',0),number('--lab-panel-darken',0)));
        node.style.setProperty('--school-stroke-color',statsSettings.schoolStrokeColor==='secondary'?node.style.getPropertyValue('--mascot-color'):'#000');
        local.cutoutRounding=number('--lab-cutout-rounding',1);local.cutoutSoftness=number('--lab-cutout-softness',0);
        for(const key of ['school','mascot','rank','stat','label'])local[key]=number('--lab-'+key+'-size',settings[key]);
        const rimFilter=node.querySelector('filter:first-child');
        const softness=Math.max(0,local.cutoutSoftness),rounding=Math.max(0,local.cutoutRounding);
        rimFilter.querySelectorAll('feGaussianBlur').forEach(blur=>blur.setAttribute('stdDeviation',Math.hypot(rounding,softness)));
        const slope=4/(1+softness);
        rimFilter.querySelectorAll('feFuncA').forEach(alpha=>{alpha.setAttribute('slope',slope);alpha.setAttribute('intercept',(1-slope)/2);});
        const aspect=Number(image.dataset.aspect||.85),maxWidth=number('--lab-logo-max-width',0)*(teamKey?number(exceptionProperty('size'),100)/100:1);
        const desiredHeight=Math.max(number('--lab-logo-height',settings.logo),settings.height*1.02)*(teamKey?number(exceptionProperty('size'),100)/100:1);
        const uniformity=Math.max(0,Math.min(1,(teamKey?number(exceptionProperty('uniformity'),0):number('--lab-logo-uniformity',90))/100));
        const targetRatio=number('--lab-logo-width-ratio',95)/100;
        const baseLogoHeight=!uniformity&&maxWidth>0?Math.min(desiredHeight,maxWidth/aspect):desiredHeight;
        const balancedWidth=baseLogoHeight*(aspect*(1-uniformity)+targetRatio*uniformity);
        const widthScale=teamKey?number(exceptionProperty('width'),100)/100:1;
        const heightScale=teamKey?number(exceptionProperty('height-scale'),100)/100:1;
        const logoHeight=baseLogoHeight*heightScale;
        const logoWidth=(maxWidth>0?Math.min(maxWidth,balancedWidth):balancedWidth)*widthScale;
        image.style.objectFit=uniformity||widthScale!==heightScale?'fill':'contain';
        const overlap=settings.width*.18;
        const radians=logoAngle*Math.PI/180,cosLogo=Math.cos(radians),sinLogo=Math.sin(radians);
        const rotatedWidth=Math.abs(logoWidth*cosLogo)+Math.abs(logoHeight*sinLogo);
        const rotatedHeight=Math.abs(logoHeight*cosLogo)+Math.abs(logoWidth*sinLogo);
        const rotatedLeft=overlap-logoWidth/2+logoX-rotatedWidth/2;
        const rotatedTop=settings.height/2+logoY-rotatedHeight/2;
        const cutoutAllowance=2*(local.rim+local.stroke);
        // One shared scoreboard width, including when a total-magnet floor is enabled.
        local.width=Math.max(number('--lab-minimum-scoreboard-width',900),settings.width,number('--lab-minimum-magnet-width',0)-cutoutAllowance);
        window.CutoutCard.tune(node,local);
        const originalFaceHeight=settings.height*number('--lab-face-height',59)/100;
        const originalStatsHeight=settings.height-originalFaceHeight;
        const extraLabelHeight=Math.min(statsSettings.labelExtraHeight,Math.max(0,originalFaceHeight-settings.height*.35));
        const faceHeight=originalFaceHeight-extraLabelHeight;
        node.style.setProperty('--lab-face-height',faceHeight/settings.height*100+'%');
        node.style.setProperty('--lab-label-height',(originalStatsHeight*statsSettings.labelHeight/100+extraLabelHeight)/(originalStatsHeight+extraLabelHeight)*100+'%');
        const logoTopLocal=settings.height/2+logoY-logoHeight/2;
        const bandEdge=(top,bottom)=>{
          if(logoAngle)return bottom>=rotatedTop&&top<=rotatedTop+rotatedHeight?Math.max(0,rotatedLeft+rotatedWidth):0;
          const edges=image._visibleRowEdges;
          if(!edges)return overlap+logoX;
          const start=Math.max(0,Math.floor((top-logoTopLocal)/logoHeight*edges.length));
          const end=Math.min(edges.length,Math.ceil((bottom-logoTopLocal)/logoHeight*edges.length));
          let edge=0;
          for(let y=start;y<end;y++)edge=Math.max(edge,edges[y]);
          return Math.max(0,overlap-logoWidth+logoX+edge*logoWidth);
        };
        const gap=number('--lab-logo-text-gap',2)+local.stroke;
        const copyStart=Math.max(0,bandEdge(4,faceHeight)+gap+number('--lab-name-x',0));
        const statsStart=Math.max(0,bandEdge(originalFaceHeight,settings.height-4)+gap+number('--lab-stats-x',0));
        node.style.setProperty('--copy-start',copyStart+'px');
        node.style.setProperty('--stats-start',statsStart+'px');
        const available=Math.max(0,local.width-4-statsStart);
        const ratios=['record','rpi','delta'].map(key=>number('--lab-'+key+'-width',key==='delta'?1.1:1));
        const caps=['record','rpi','delta'].map(key=>number('--lab-'+key+'-max-width',0)||Infinity);
        const widths=[0,0,0];let remaining=available,active=[0,1,2];
        // Redistribute spare width only to columns that have not reached their cap.
        while(active.length){
          const total=active.reduce((sum,i)=>sum+ratios[i],0);
          const capped=active.filter(i=>remaining*ratios[i]/total>caps[i]);
          if(!capped.length){active.forEach(i=>widths[i]=remaining*ratios[i]/total);break;}
          capped.forEach(i=>{widths[i]=caps[i];remaining-=caps[i];});active=active.filter(i=>!capped.includes(i));
        }
        node.style.setProperty('--stats-columns',widths.map(width=>width+'px').join(' '));
        // Scale from a fixed design reference, not the adjusted card dimensions.
        // Otherwise increasing card height or rim can silently shrink the entire magnet.
        const referenceLogoHeight=defaults.logo;
        const referenceLeftSpace=Math.max(0,referenceLogoHeight*defaults.logoWidthRatio/100-defaults.width*.18);
        const referenceWidth=defaults.width+referenceLeftSpace+defaults.rim*2+16;
        const effectiveHeight=number('--lab-slot-height',120);
        const scale=Math.min(number('--lab-slot-width',314)/referenceWidth,effectiveHeight/(defaults.logo+defaults.rim*2+10));
        node.style.setProperty('--visible-logo-height',logoHeight+'px');node.style.setProperty('--visible-logo-width',logoWidth+'px');node.style.setProperty('--logo-overlap',overlap+'px');
        node.style.left=((slot.clientWidth-referenceWidth*scale)/2+(referenceLeftSpace+defaults.rim+8)*scale)+'px';
        node.style.top=((slot.clientHeight-settings.height*scale)/2)+'px';node.style.transform=`scale(${scale})`;
        // Align the whole silhouette, allowing for the rim, depth, shadow and card rotation.
        const left=parseFloat(node.style.left),top=parseFloat(node.style.top);
        const margin=(local.rim+local.stroke+8+softness*3)*scale,shadow=(local.depth+5)*scale;
        const logoLeft=left+rotatedLeft*scale;
        const logoTop=top+rotatedTop*scale;
        // Limit the filter buffer to the actual combined silhouette plus its halo.
        const halo=local.rim+local.stroke+8+Math.hypot(rounding,softness)*6;
        const filterLeft=Math.min(0,rotatedLeft)-halo,filterTop=Math.min(0,rotatedTop)-halo;
        rimFilter.setAttribute('filterUnits','userSpaceOnUse');
        rimFilter.setAttribute('x',filterLeft);
        rimFilter.setAttribute('y',filterTop);
        rimFilter.setAttribute('width',Math.max(local.width,rotatedLeft+rotatedWidth)+halo-filterLeft);
        rimFilter.setAttribute('height',Math.max(settings.height,rotatedTop+rotatedHeight)+halo-filterTop);
        alignEdges(slot,node,[
          {left:left-margin,top:top-margin,right:left+local.width*scale+margin,bottom:top+settings.height*scale+margin+shadow},
          {left:logoLeft-margin,top:logoTop-margin,right:logoLeft+rotatedWidth*scale+margin,bottom:logoTop+rotatedHeight*scale+margin+shadow}
        ]);
        shellLogo.style.objectFit=image.style.objectFit;
        if(shellLogo.src!==image.src)shellLogo.src=image.src;
        reflection.style.maskImage='url('+JSON.stringify(image.src)+')';
        reflection.style.maskSize=image.style.objectFit==='contain'?'contain':'100% 100%';
        reflection.style.backgroundPosition=-(overlap-logoWidth+logoX)+'px '+(-logoTopLocal)+'px';
        const moveBody=node.querySelector('.cm-move .cm-rank-value');
        const moveSpace=Math.max(0,moveBody.clientHeight-10),arrowHeight=Math.min(27,moveSpace*.24);
        node.style.setProperty('--move-arrow-height',arrowHeight+'px');
        node.style.setProperty('--move-arrow-width',arrowHeight*40/27+'px');
        const requestedGap=node.querySelector('.cm-move').classList.contains('cm-negative')?number('--lab-down-gap',2):number('--lab-up-gap',10);
        node.style.setProperty('--move-gap',Math.min(requestedGap,moveSpace*.12)+'px');
        fitAllText();
      };
      const logoReady=refreshLayouts;
      image.onload=()=>window.CutoutCard.trimLogo(image,logoReady);
      const observer=new ResizeObserver(layout);observer.observe(slot);
      slot._cutoutObserver=observer;
      layouts.push(layout);
      if(image.complete&&image.naturalWidth)window.CutoutCard.trimLogo(image,logoReady);
      layout();
    }
    document.fonts.ready.then(refreshLayouts);
    const controlsObserver=new ResizeObserver(refreshLayouts);controlsObserver.observe(control);
    board._cutoutRefresh=refreshLayouts;
    applySettings(board);
    const cleanup=new MutationObserver(()=>{if(!board.isConnected){cards.forEach(slot=>slot._cutoutObserver?.disconnect());controlsObserver.disconnect();cleanup.disconnect();}});
    cleanup.observe(document.body,{childList:true,subtree:true});
  }
  window.WhiteboardPlayoff.apply=(board,sport)=>{original(board,sport);transformBoard(board);};
  let revision='';
  async function loadSharedDesign(){
    try{
      const response=await fetch(window.BRSNHosted?.enabled?'./data/whiteboard-design.json':'./design-settings',{cache:'no-store'});
      if(!response.ok)return;
      const design=await response.json();
      if(!design||design.savedAt===revision)return;
      for(const [group,values,template]of [['card',settings,defaults],['layout',layoutSettings,layoutDefaults],['stats',statsSettings,statsDefaults]]){
        for(const key in template){
          const value=design[group]?.[key];
          if(typeof value===typeof template[key]&&(typeof value!=='number'||Number.isFinite(value)))values[key]=value;
        }
      }
      revision=design.savedAt;
      document.querySelectorAll('.cutout-board').forEach(applySettings);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }catch(error){console.warn('Shared design unavailable; keeping current design.',error);}
  }
  window.CutoutBoard={transform:transformBoard,refreshDesign:loadSharedDesign,ready:loadSharedDesign()};
  window.addEventListener('focus',()=>{window.CutoutBoard.ready=loadSharedDesign();});
})();
