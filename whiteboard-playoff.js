(() => {
  let stickyObserver;
  const D = {width:290,height:117,matchupGap:40,firstX:-30,secondX:-47,verticalGap:15,rowsY:-31,cardRotation:.8};
  const mappings = {
    'card-playoff-rank':'wb-rank-stack', 'card-playoff-rank-number':'wb-rank',
    'card-playoff-move':'wb-move', 'card-playoff-hero':'wb-top',
    'card-playoff-logo-wrap':'wb-logo-wrap', 'card-playoff-logo':'wb-logo',
    'card-playoff-logo-placeholder':'wb-logo-placeholder', 'card-playoff-copy':'wb-copy',
    'card-playoff-school':'wb-school', 'card-playoff-mascot':'wb-mascot',
    'card-playoff-stats':'wb-stats', 'card-playoff-stat':'wb-stat',
    'card-playoff-stat-value':'wb-value', 'card-playoff-record':'wb-record',
    'card-playoff-change-arrow':'wb-arrow', 'card-playoff-result-arrow':'wb-result',
    'card-playoff-delta':'wb-delta', 'card-playoff-placeholder-text':'wb-placeholder-text',
    'card-placeholder-eyebrow':'wb-eyebrow', 'card-placeholder-detail':'wb-detail'
  };
  function element(tag,cls,text) {
    const node = document.createElement(tag); node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function coin(cls,description) {
    const image = element('img',cls);
    image.src = 'whiteboard-assets/magnet-nchsaa-coin-v4.png';
    image.alt = description;
    image.draggable = false;
    return image;
  }
  function card(source,index,height) {
    const node = source.cloneNode(true);
    const placeholder = node.classList.contains('card-playoff-placeholder');
    const highlighted = node.matches('.odd-extra-east,.odd-extra-west');
    node.querySelector('.card-playoff-rank-edge')?.remove();
    node.className = `wb-magnet${placeholder ? ' wb-placeholder' : ''}${highlighted ? ' wb-highlighted' : ''}`;
    const teamNames = [source.dataset.teamContextOriginalTeam, source.dataset.scheduleOriginalTeam, source.dataset.teamContextTeam, source.dataset.scheduleTeam];
    if (teamNames.some(name=>String(name || '').trim().toLowerCase()==='durham charter')) node.classList.add('wb-durham-charter');
    for (const [old,next] of Object.entries(mappings)) {
      node.querySelectorAll('.'+old).forEach(child => {child.classList.remove(old); child.classList.add(next);});
    }
    if (source.classList.contains('is-bye')) {
      const detail = node.querySelector('.wb-detail');
      if (detail?.textContent.trim().toLowerCase() === '[no opponent]') detail.textContent = '[NO OPPONENT]';
    }
    const rankStack = node.querySelector('.wb-rank-stack');
    if (rankStack) node.querySelector('.wb-top')?.prepend(rankStack);
    const school = node.querySelector('.wb-school');
    if (school) {
      const lines = school.innerHTML.split(/<br\s*\/?\s*>/i);
      school.replaceChildren(...lines.slice(0,2).map(line => {
        const span = element('span',''); span.innerHTML = line; return span;
      }));
    }
    const tilt = Math.sin((index+1)*127.1+311.7)*43758.5453;
    node.style.setProperty('--wb-angle',`${((tilt-Math.floor(tilt))*2-1)*D.cardRotation}deg`);
    node.style.height = height+'px';
    node.style.setProperty('--wb-density',Math.min(1,height/125));
    return node;
  }
  function apply(board,sportLabel) {
    if (!board || board.classList.contains('whiteboard-playoff')) return;
    stickyObserver?.disconnect();
    const rows = [...board.querySelectorAll('.card-playoff-row')];
    const heading = board.querySelector('.card-banner-heading')?.textContent || '';
    const noteText = board.querySelector('.odd-extra-note')?.textContent.trim() || '';
    const excludedText = board.querySelector('.excluded-teams-note')?.textContent.trim() || '';
    const excludedEntries = [...board.querySelectorAll('.excluded-teams-note .excluded-team-entry')].map(n=>n.textContent.trim());
    const footerSource = board.querySelector('.graphic-footer');
    const rowCards = rows.map(row => ({cards:[...row.children].filter(n => n.classList.contains('card-playoff-team')), winnerVs:!!row.querySelector('.card-playoff-winner-vs')}));
    board.classList.add('whiteboard-playoff');
    const surface = element('div','wb-surface');
    surface.style.setProperty('--wb-row-count',Math.max(1,rows.length));
    const logoFilter = document.createElementNS('http://www.w3.org/2000/svg','svg');
    const logoFilterId = `wb-logo-white-stroke-${board.dataset.region || 'board'}`;
    logoFilter.setAttribute('width','0');
    logoFilter.setAttribute('height','0');
    logoFilter.setAttribute('aria-hidden','true');
    logoFilter.style.position = 'absolute';
    const logoStroke = Math.max(0,parseFloat(getComputedStyle(board).getPropertyValue('--wb-logo-stroke')) || 0);
    logoFilter.innerHTML = `<defs><filter id="${logoFilterId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="${logoStroke}" result="expanded"/><feComposite in="expanded" in2="SourceAlpha" operator="out" result="outline"/><feFlood flood-color="white" result="white"/><feComposite in="white" in2="outline" operator="in" result="stroke"/><feMerge><feMergeNode in="stroke"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    surface.style.setProperty('--wb-logo-stroke-filter',`url("#${logoFilterId}")`);
    surface.append(logoFilter);
    const logoStrokeControl = element('span','wb-logo-stroke-control');
    logoStrokeControl.setAttribute('aria-hidden','true');
    surface.append(logoStrokeControl);
    surface.append(element('div','wb-cork'));
    const frame = element('img','wb-frame-overlay');
    frame.src = 'whiteboard-assets/frame-west-slim-markers-overlay.png';
    frame.alt = '';
    frame.setAttribute('aria-hidden','true');
    frame.draggable = false;
    surface.append(frame);
    if(board.dataset.region === 'east') {
      const marker = frame.cloneNode();
      marker.classList.add('wb-frame-marker');
      marker.src = 'whiteboard-assets/frame-east-slim-markers-overlay.png';
      surface.append(marker);
    }
    for(const side of ['left','right']) {
      const stroke = element('div',`wb-footer-stroke wb-footer-stroke-${side}`);
      stroke.innerHTML = '<svg viewBox="0 0 62 8" preserveAspectRatio="none" aria-hidden="true"><path d="M3 4 Q31 3 59 4" /></svg>';
      surface.append(stroke);
    }
    const region = element('div','wb-region-label');
    region.append(element('span','wb-region-name',board.dataset.region === 'east' ? 'EAST' : 'WEST'),element('span','wb-region-caption','REGION'));
    const brand = element('div','wb-brand');
    const brandName = element('div','wb-brand-name');
    brandName.append(element('span','','BIG'),element('span','wb-brand-red','RED'));
    brand.append(brandName,element('div','wb-brand-caption','SPORTS NETWORK'));
    surface.append(region,brand);
    surface.append(element('h1','wb-title',heading),element('div','wb-subtitle','PLAYOFF PICTURE'));
    const sport = String(sportLabel || heading).toLowerCase().match(/\b(football|soccer|volleyball|basketball|baseball|softball)\b/)?.[1];
    if (sport) {
      const magnet = element('img','wb-sport-magnet');
      const girlsBall = /\bgirls?\b/i.test(String(sportLabel || heading)) && /^(soccer|basketball)$/.test(sport);
      magnet.src = `whiteboard-assets/magnet-${sport}${girlsBall ? '-pink' : ''}.png`;
      magnet.alt = '';
      magnet.setAttribute('aria-hidden','true');
      magnet.draggable = false;
      surface.append(magnet);
    }
    const leftX = 390-D.width+D.secondX;
    const middleX = 796-D.matchupGap/2-D.width+D.firstX;
    const rightX = 796+D.matchupGap/2+D.firstX;
    const startY = 206+D.rowsY;
    const bottom = 1220;
    // Reserve the lower board for larger notes; tighten gaps before shrinking cards.
    const availableGap = rows.length > 1 ? (bottom-startY-rows.length*D.height)/(rows.length-1) : D.verticalGap;
    const rowGap = Math.min(rows.length > 8 ? 8 : D.verticalGap, Math.max(6,availableGap));
    const height = Math.min(D.height,(bottom-startY-Math.max(0,rows.length-1)*rowGap)/Math.max(1,rows.length));
    const heads = element('div','wb-heads');
    // Text aligns to the hand-drawn outlines baked into both backgrounds.
    for (const [text,x,width] of [['SECOND ROUND',61,330],['FIRST ROUND',443,620]]) {
      const head = element('div','wb-head',text); Object.assign(head.style,{left:x+'px',width:width+'px'}); heads.append(head);
    }
    surface.append(heads);
    rowCards.forEach((row,index) => {
      const y = startY+index*(height+rowGap);
      row.cards.forEach((source,col) => {
        const node = card(source,index*3+col,height);
        node.style.setProperty('--wb-row-index',index);
        if(col===0) node.classList.add('wb-second-column');
        if(col===1) node.classList.add('wb-first-home');
        if(col===2) node.classList.add('wb-first-away');
        Object.assign(node.style,{left:[leftX,middleX,rightX][col]+'px',top:y+'px'});
        surface.append(node);
        if(node.classList.contains('wb-highlighted')) {
          const anchor = element('div','wb-coin-anchor');
          anchor.style.setProperty('--wb-row-index',index);
          if(col===0) anchor.classList.add('wb-second-column');
          if(col===1) anchor.classList.add('wb-first-home');
          if(col===2) anchor.classList.add('wb-first-away');
          Object.assign(anchor.style,{left:node.style.left,top:node.style.top});
          anchor.append(coin('wb-odd-coin','Region determined by a coin flip'));
          surface.append(anchor);
        }
      });
      if (row.cards.length > 1) {
        const connector = element('div','wb-connector');
        connector.style.setProperty('--wb-row-index',index);
        connector.style.setProperty('--wb-connector-center',y+height/2+'px');
        connector.innerHTML = '<svg class="wb-connector-line" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 Q50 28 100 30" /></svg><svg class="wb-connector-cap" viewBox="0 0 13 60" preserveAspectRatio="none" aria-hidden="true"><path d="M13 0 H0 V60 H13" /></svg>';
        surface.append(connector);
      }
      // Keep BYE indicators and paired winner placeholders from the existing bracket logic.
      if (row.cards.length === 3) {
        const vs = element('div','wb-vs','VS'); vs.style.setProperty('--wb-row-index',index); Object.assign(vs.style,{left:796+D.firstX-1+'px',top:y+height/2+'px'}); surface.append(vs);
      }
      if (row.winnerVs) {
        const vs = element('div','wb-vs wb-winner-vs','VS'); vs.style.setProperty('--wb-row-index',index); Object.assign(vs.style,{left:'37px',top:y+height+rowGap/2+'px'}); surface.append(vs);
      }
    });
    if (!rows.length) surface.append(element('p','wb-empty','No eligible teams.'));
    if (noteText) {
      const note = element('div','wb-note wb-sticky wb-sticky-pink');
      const copy = element('div','wb-sticky-copy');
      copy.append(coin('wb-note-coin','Coin'),element('span','','= Coin flip decides if the team will be in the East/West at the end of the season'));
      note.append(copy); surface.append(note);
    }
    if (excludedText) {
      const note = element('div','wb-excluded wb-sticky wb-sticky-yellow');
      const copy = element('div','wb-sticky-copy');
      copy.append(element('div','wb-excluded-heading','Excluded Teams:'));
      for(const team of excludedEntries.length ? excludedEntries : [excludedText.replace(/^Excluded Teams:\s*/i,'')]) {
        const name = team.replace(/\s*\(\d+\s*-\s*\d+(?:\s*-\s*\d+)?\)\s*$/,'');
        const entry = element('div','wb-excluded-team',name);
        const bullet = document.createElementNS('http://www.w3.org/2000/svg','svg');
        bullet.setAttribute('class','wb-excluded-bullet');
        bullet.setAttribute('viewBox','0 0 10 10');
        bullet.setAttribute('aria-hidden','true');
        bullet.innerHTML = '<path d="M3 2 Q8 1 8 5 Q7 9 3 7 Q0 5 3 2 M3 4 Q6 2 6 5 Q5 7 3 5" />';
        entry.prepend(bullet);
        copy.append(entry);
      }
      note.append(copy); surface.append(note);
    }
    const footer = footerSource ? footerSource.cloneNode(true) : element('footer','wb-footer','BRSN');
    footer.className = 'wb-footer';
    surface.append(footer);
    const timestamp = element('div','wb-timestamp');
    const updated = footer.querySelector('.graphic-updated');
    timestamp.append(updated ? updated.cloneNode(true) : element('span','graphic-updated','Update time unavailable'));
    surface.append(timestamp);
    board.replaceChildren(surface);
    for(const note of surface.querySelectorAll('.wb-sticky,.wb-timestamp')) {
      const pin = element('img','wb-push-pin');
      pin.src = `whiteboard-assets/push-pin-${board.dataset.region === 'east' ? 'blue' : 'red'}-overhead.png`;
      pin.alt = '';
      pin.setAttribute('aria-hidden','true');
      pin.draggable = false;
      note.append(pin);
    }
    const fitTitle = () => {
      const title = surface.querySelector('.wb-title');
      const context = document.createElement('canvas').getContext('2d');
      context.font = "48px 'WB Marker'";
      const width = context.measureText(heading).width;
      title.style.fontSize = Math.min(48,48*(1122-310-312)/Math.max(1,width))+'px';
    };
    fitTitle();
    const fitSticky = () => {
      for(const copy of surface.querySelectorAll('.wb-sticky-copy')) {
        copy.style.setProperty('--wb-sticky-fit',1);
        for(let i=0;i<8 && copy.scrollHeight>copy.clientHeight+1;i++) {
          const scale = Number(copy.style.getPropertyValue('--wb-sticky-fit'));
          copy.style.setProperty('--wb-sticky-fit',scale*.9);
        }
      }
    };
    const fitStatLabels = cards => {
      const labels = cards.flatMap(card=>Array.from(card.querySelectorAll('.wb-stat>span:first-child')));
      // Reset together, measure together, then apply fits without per-label reflows.
      labels.forEach(label=>label.style.setProperty('--wb-label-fit',1));
      const fits = labels.map(label=>{
        const width = label.clientWidth;
        const contentWidth = label.scrollWidth;
        return width && contentWidth>width ? Math.min(1,(width-2)/contentWidth) : 1;
      });
      labels.forEach((label,index)=>label.style.setProperty('--wb-label-fit',fits[index]));
    };
    stickyObserver = new ResizeObserver(entries=>{
      const strokeEntry = entries.find(entry=>entry.target===logoStrokeControl);
      if(strokeEntry) logoFilter.querySelector('feMorphology').setAttribute('radius',Math.max(0,parseFloat(getComputedStyle(board).getPropertyValue('--wb-logo-stroke')) || 0));
      const cards = entries.filter(entry=>entry.target.classList.contains('wb-magnet')).map(entry=>entry.target);
      const densities = cards.map(card=>Math.min(1,parseFloat(getComputedStyle(card).height)/125));
      cards.forEach((card,index)=>card.style.setProperty('--wb-density',densities[index]));
      fitStatLabels(cards);
      fitSticky();
    });
    surface.querySelectorAll('.wb-magnet').forEach(card=>stickyObserver.observe(card));
    stickyObserver.observe(logoStrokeControl);
    surface.querySelectorAll('.wb-sticky-copy').forEach(copy=>stickyObserver.observe(copy));
    document.fonts.ready.then(()=>{if(!surface.isConnected)return;fitTitle();fitSticky();fitStatLabels(Array.from(surface.querySelectorAll('.wb-magnet')));});
  }
  window.WhiteboardPlayoff = {apply};
})();
