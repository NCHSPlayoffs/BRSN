window.BRSNFullBracketView = window.BRSNFullBracketView || {};

window.BRSNFullBracketView.init = function initFullBracketView(root = document) {
  const viewport = root.querySelector("#bracketViewport");
  const zoomTarget = root.querySelector("#bracketZoom");
  const zoomValue = root.querySelector("#zoomValue");
  const tools = root.querySelector(".bracket-tools");

  if (!viewport || !zoomTarget || !tools) {
    return;
  }

  // Virtual zoom: user sees 50-150 (percent relative to bracket's natural default).
  // Actual CSS zoom = zoomPct / 100 * base, where base = 0.65 (small) or 0.55 (large).
  function getBracketBase() {
    const canvasWidth = Number(zoomTarget.dataset.canvasWidth || "3000");
    return canvasWidth <= 2300 ? 0.66 : 0.60;
  }
  function pctToActual(pct) { return (pct / 100) * getBracketBase(); }
  function actualToPct(actual) { return Math.round((actual / getBracketBase()) * 100); }

  let zoomPct = clamp(Number(localStorage.getItem("bracketZoomPct") || "100"), 50, 150);
  let zoom = pctToActual(zoomPct);

  tools.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-zoom]");
    if (!button) {
      return;
    }

    const action = button.dataset.zoom;
    if (action === "in")    zoomPct += 5;
    if (action === "out")   zoomPct -= 5;
    if (action === "reset") zoomPct = 100;
    if (action === "fullscreen") {
      const shell = root.querySelector(".bracket-shell");
      if (shell) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          shell.requestFullscreen();
        }
      }
      return;
    }
    zoomPct = clamp(zoomPct, 50, 150);
    zoom = pctToActual(zoomPct);
    applyZoom();
  });

  if (zoomValue) {
    zoomValue.addEventListener("change", () => {
      const parsed = parseFloat(zoomValue.value);
      if (!isNaN(parsed)) {
        zoomPct = clamp(Math.round(parsed), 50, 150);
        zoom = pctToActual(zoomPct);
        applyZoom();
      } else {
        zoomValue.value = zoomPct;
      }
    });
    zoomValue.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });
    // Prevent viewport pan-start from firing while typing in the input
    zoomValue.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  document.addEventListener("fullscreenchange", () => {
    const btn = root.querySelector("[data-zoom='fullscreen']");
    if (btn) {
      const inFullscreen = !!document.fullscreenElement;
      btn.title = inFullscreen ? "Exit full screen" : "Full screen";
      btn.setAttribute("aria-pressed", String(inFullscreen));
      btn.innerHTML = inFullscreen ? "&#x2715;" : "&#x26F6;";
    }
  });

  setupBracketSelectors();

  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let scrollStartLeft = 0;
  let scrollStartTop = 0;
  let pendingTeamTap_ = null;
  let panScrolled_ = false;
  const touchPointers = new Map();
  let isPinching = false;
  let pinchStartDistance = 0;
  let pinchStartZoomPct = zoomPct;
  let pinchLastDistance = 0;
  let pinchLastMidpoint = null;
  let isApplyingLayoutAlignment = false;
  let hasCenteredInitialView = false;

  viewport.addEventListener("pointerdown", (event) => {
    if ((event.pointerType !== "touch" && event.button !== 0) || event.target.closest("a, button, select, input")) {
      return;
    }

    if (event.pointerType === "touch") {
      rememberTouchPointer(event);
      if (usesTwoFingerMobilePan_()) {
        if (touchPointers.size >= 2) {
          event.preventDefault();
          try { viewport.setPointerCapture(event.pointerId); } catch (_) {}
          startPinchZoom();
        }
        return;
      }
      event.preventDefault();
      try { viewport.setPointerCapture(event.pointerId); } catch (_) {}
      if (touchPointers.size >= 2) {
        startPinchZoom();
        return;
      }
    }

    pendingTeamTap_ = event.target.closest?.('.team[data-schedule-team]') || null;
    panScrolled_ = false;
    isPanning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    scrollStartLeft = viewport.scrollLeft;
    scrollStartTop = viewport.scrollTop;
    viewport.classList.add("is-panning");
    try { viewport.setPointerCapture(event.pointerId); } catch (_) {}
  });

  viewport.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" && touchPointers.has(event.pointerId)) {
      rememberTouchPointer(event);
      if (usesTwoFingerMobilePan_()) {
        if (touchPointers.size >= 2) {
          if (!isPinching) {
            startPinchZoom();
          }
          event.preventDefault();
          updatePinchZoom();
        }
        return;
      }
      if (isPinching && touchPointers.size >= 2) {
        event.preventDefault();
        updatePinchZoom();
        return;
      }
    }

    if (isPanning) {
      if (Math.abs(event.clientX - panStartX) > 5 || Math.abs(event.clientY - panStartY) > 5) panScrolled_ = true;
      viewport.scrollLeft = scrollStartLeft - (event.clientX - panStartX);
      viewport.scrollTop = scrollStartTop - (event.clientY - panStartY);
    }
  });

  viewport.addEventListener("pointerup", (event) => {
    const teamEl = pendingTeamTap_;
    const didScroll = panScrolled_;
    pendingTeamTap_ = null;
    panScrolled_ = false;
    stopPanning(event);
    if (teamEl && !didScroll && !isPinching) {
      window.BRSNBoard?.openTeamScheduleCard?.(teamEl);
    }
  });
  viewport.addEventListener("pointercancel", (event) => {
    pendingTeamTap_ = null;
    panScrolled_ = false;
    stopPanning(event);
  });
  setupPathHoverCleanup();
  setupLayoutAlignmentObserver();

  applyZoom();
  scheduleLayoutAlignment();

  function getCenterGapExtra() {
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      const view = zoomTarget.querySelector('.view[data-view-type="horizontal-view"]');
      let raw;
      if (view && view.classList.contains("brsn-round-count-3")) {
        raw = rootStyle.getPropertyValue("--brsn-center-gap-small").trim()
           || rootStyle.getPropertyValue("--brsn-center-gap").trim();
      } else if (view && view.classList.contains("brsn-round-count-5")) {
        raw = rootStyle.getPropertyValue("--brsn-center-gap-large").trim()
           || rootStyle.getPropertyValue("--brsn-center-gap").trim();
      } else {
        raw = rootStyle.getPropertyValue("--brsn-center-gap").trim();
      }
      return parseFloat(raw) || 0;
    } catch (e) {
      return 0;
    }
  }

  function applyZoom(anchorPoint = null, panDelta = null) {
    const previousScrollWidth = viewport.scrollWidth || zoomTarget.getBoundingClientRect().width || 1;
    const previousScrollHeight = viewport.scrollHeight || zoomTarget.getBoundingClientRect().height || 1;
    const currentCenterRatio = (viewport.scrollLeft + viewport.clientWidth / 2) / previousScrollWidth;
    const previousCenterRatio = hasCenteredInitialView ? currentCenterRatio : 0.5;
    const viewportRect = anchorPoint ? viewport.getBoundingClientRect() : null;
    const anchorOffsetX = anchorPoint && viewportRect ? anchorPoint.x - viewportRect.left : 0;
    const anchorOffsetY = anchorPoint && viewportRect ? anchorPoint.y - viewportRect.top : 0;
    const anchorRatioX = anchorPoint ? (viewport.scrollLeft + anchorOffsetX) / previousScrollWidth : 0;
    const anchorRatioY = anchorPoint ? (viewport.scrollTop + anchorOffsetY) / previousScrollHeight : 0;
    const canvasWidth = Number(zoomTarget.dataset.canvasWidth || "3000");
    const gapExtra = getCenterGapExtra();
    const totalWidth = canvasWidth + gapExtra;
    zoomTarget.style.setProperty("--bracket-zoom", zoom.toFixed(2));
    zoomTarget.style.setProperty("--brsn-canvas-width", `${totalWidth}px`);
    zoomTarget.style.width = `${totalWidth}px`;
    zoomTarget.style.minHeight = "1250px";
    if (zoomValue && document.activeElement !== zoomValue) {
      zoomValue.value = Math.round(zoomPct);
    }
    localStorage.setItem("bracketZoomPct", String(Math.round(zoomPct)));
    scheduleLayoutAlignment();
    requestAnimationFrame(() => {
      const nextScrollWidth = viewport.scrollWidth || zoomTarget.getBoundingClientRect().width || previousScrollWidth;
      if (anchorPoint) {
        const nextScrollHeight = viewport.scrollHeight || zoomTarget.getBoundingClientRect().height || previousScrollHeight;
        viewport.scrollLeft = Math.max(0, nextScrollWidth * anchorRatioX - anchorOffsetX - (panDelta?.x || 0));
        viewport.scrollTop = Math.max(0, nextScrollHeight * anchorRatioY - anchorOffsetY - (panDelta?.y || 0));
      } else {
        viewport.scrollLeft = Math.max(0, nextScrollWidth * previousCenterRatio - viewport.clientWidth / 2);
      }
      hasCenteredInitialView = true;
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function stopPanning(event) {
    if (event?.pointerType === "touch") {
      touchPointers.delete(event.pointerId);
      if (touchPointers.size < 2) {
        isPinching = false;
        pinchLastMidpoint = null;
        pinchLastDistance = 0;
      }
    }
    isPanning = false;
    viewport.classList.remove("is-panning");
  }

  function rememberTouchPointer(event) {
    touchPointers.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function currentPinchPoints() {
    return Array.from(touchPointers.values()).slice(0, 2);
  }

  function pinchDistance(points) {
    if (points.length < 2) {
      return 0;
    }
    return Math.hypot(points[1].clientX - points[0].clientX, points[1].clientY - points[0].clientY);
  }

  function pinchMidpoint(points) {
    return {
      x: (points[0].clientX + points[1].clientX) / 2,
      y: (points[0].clientY + points[1].clientY) / 2,
    };
  }

  function startPinchZoom() {
    const points = currentPinchPoints();
    pinchStartDistance = pinchDistance(points);
    pinchStartZoomPct = zoomPct;
    pinchLastDistance = pinchStartDistance;
    pinchLastMidpoint = pinchMidpoint(points);
    isPinching = pinchStartDistance > 0;
    isPanning = false;
    viewport.classList.remove("is-panning");
  }

  function updatePinchZoom() {
    const points = currentPinchPoints();
    const distance = pinchDistance(points);
    if (!pinchStartDistance || !distance) {
      return;
    }
    const midpoint = pinchMidpoint(points);
    const panDelta = pinchLastMidpoint
      ? { x: midpoint.x - pinchLastMidpoint.x, y: midpoint.y - pinchLastMidpoint.y }
      : null;
    const nextZoomPct = clamp(zoomPct * (distance / (pinchLastDistance || distance)), 50, 150);
    if (Math.abs(nextZoomPct - zoomPct) < 0.25 && (!panDelta || (Math.abs(panDelta.x) < 0.5 && Math.abs(panDelta.y) < 0.5))) {
      return;
    }
    zoomPct = nextZoomPct;
    zoom = pctToActual(zoomPct);
    applyZoom(midpoint, panDelta);
    pinchLastDistance = distance;
    pinchLastMidpoint = midpoint;
  }

  function usesTwoFingerMobilePan_() {
    return window.matchMedia?.("(max-width: 760px)")?.matches
      && !document.fullscreenElement;
  }

  function scheduleLayoutAlignment() {
    [0, 80, 180, 420, 900, 1600].forEach((delay) => {
      window.setTimeout(() => {
        if (delay === 420 || delay === 900) {
          requestBracketLineRelayout();
        }
        window.setTimeout(runLayoutAlignment, 35);
      }, delay);
    });
  }

  function setupLayoutAlignmentObserver() {
    let queued = false;
    const stopAt = Date.now() + 3500;
    const observer = new MutationObserver(() => {
      if (isApplyingLayoutAlignment) {
        return;
      }
      if (Date.now() > stopAt) {
        observer.disconnect();
        return;
      }

      if (queued) {
        return;
      }

      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        runLayoutAlignment();
      });
    });

    observer.observe(zoomTarget, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      subtree: true,
    });
  }

  function runLayoutAlignment() {
    isApplyingLayoutAlignment = true;
    alignRoundHeadersToMatchups();
    alignCompactEastRoundSpacing();
    alignFinalFourColumns();
    requestAnimationFrame(() => {
      isApplyingLayoutAlignment = false;
    });
  }

  function requestBracketLineRelayout() {
    window.dispatchEvent(new Event("resize"));
  }

  function getRenderedZoom() {
    const width = zoomTarget.offsetWidth || Number(zoomTarget.dataset.canvasWidth || "3000");
    const renderedWidth = zoomTarget.getBoundingClientRect().width;
    const renderedZoom = renderedWidth && width ? renderedWidth / width : 1;
    return Number.isFinite(renderedZoom) && renderedZoom > 0 ? renderedZoom : 1;
  }

  function scheduleRoundHeaderAlignment() {
    requestAnimationFrame(() => {
      alignRoundHeadersToMatchups();
      window.setTimeout(alignRoundHeadersToMatchups, 150);
    });
  }

  function alignRoundHeadersToMatchups() {
    const renderedZoom = getRenderedZoom();
    zoomTarget.querySelectorAll('.view[data-view-type="horizontal-view"] > .rounds > .round').forEach((round) => {
      const header = round.querySelector(":scope > .round-header");
      const matchup = round.querySelector(":scope > .matchup-list .matchup-container");
      if (!header || !matchup) {
        return;
      }

      header.style.transform = "translateX(0)";
      const shift = (matchup.getBoundingClientRect().left - header.getBoundingClientRect().left) / renderedZoom;
      header.style.transform = `translateX(${Math.round(shift)}px)`;
    });
  }

  function alignCompactEastRoundSpacing() {
    const view = zoomTarget.querySelector('.view.brsn-round-count-3[data-view-type="horizontal-view"]');
    if (!view) {
      return;
    }

    const westRounds = Array.from(view.querySelectorAll(":scope > .rounds:first-child > .round"));
    const eastRounds = Array.from(view.querySelectorAll(":scope > .rounds:nth-child(2) > .round"));
    if (westRounds.length < 3 || eastRounds.length < 3) {
      return;
    }

    const firstEastRound = eastRounds[0];
    firstEastRound.style.transform = "";
    firstEastRound.style.marginLeft = "";

    const renderedZoom = getRenderedZoom();
    const westGap = getRoundGap(westRounds[0], westRounds[1]);
    const eastGap = getRoundGap(eastRounds[1], eastRounds[0]);
    if (!Number.isFinite(westGap) || !Number.isFinite(eastGap)) {
      return;
    }

    const gapDifference = eastGap - westGap;
    if (Math.abs(gapDifference) < 2) {
      return;
    }

    firstEastRound.style.marginLeft = `${Math.round(-gapDifference / renderedZoom)}px`;
    requestBracketLineRelayout();
  }

  function getRoundGap(leftRound, rightRound) {
    const leftMatchup = leftRound.querySelector(":scope > .matchup-list .matchup-container");
    const rightMatchup = rightRound.querySelector(":scope > .matchup-list .matchup-container");
    if (!leftMatchup || !rightMatchup) {
      return NaN;
    }

    return rightMatchup.getBoundingClientRect().left - leftMatchup.getBoundingClientRect().right;
  }

  function scheduleFinalFourAlignment() {
    requestAnimationFrame(() => {
      alignFinalFourColumns();
      window.setTimeout(alignFinalFourColumns, 150);
    });
  }

  function getFinalsInnerGap(regionalView) {
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      let raw;
      if (regionalView && regionalView.classList.contains("brsn-round-count-3")) {
        raw = rootStyle.getPropertyValue("--brsn-finals-inner-gap-small").trim()
           || rootStyle.getPropertyValue("--brsn-finals-inner-gap").trim();
      } else if (regionalView && regionalView.classList.contains("brsn-round-count-5")) {
        raw = rootStyle.getPropertyValue("--brsn-finals-inner-gap-large").trim()
           || rootStyle.getPropertyValue("--brsn-finals-inner-gap").trim();
      } else {
        raw = rootStyle.getPropertyValue("--brsn-finals-inner-gap").trim();
      }
      return parseFloat(raw) || 0;
    } catch (e) {
      return 0;
    }
  }

  function alignFinalFourColumns() {
    const regionalView = zoomTarget.querySelector('.view[data-view-type="horizontal-view"]');
    const finalsView = zoomTarget.querySelector('.view[data-view-type="horizontal-championship-view"]');
    if (!regionalView || !finalsView) {
      return;
    }

    finalsView.style.setProperty("--brsn-finals-regional-shift", "0px");
    finalsView.style.setProperty("--brsn-finals-state-shift", "0px");
    finalsView.style.setProperty("--brsn-finals-vertical-shift", "0px");

    const westTarget = regionalView.querySelector(":scope > .rounds:first-child > .round:last-child .matchup-container");
    const eastTarget = regionalView.querySelector(":scope > .rounds:nth-child(2) > .round:last-child .matchup-container");
    const finalsRegional = finalsView.querySelector(":scope > .rounds > .round:first-child .matchup-container");
    const finalsState = finalsView.querySelector(":scope > .rounds > .round:last-child .matchup-container");
    if (!westTarget || !eastTarget || !finalsRegional || !finalsState) {
      return;
    }

    const renderedZoom = getRenderedZoom();
    const regionalShift = (westTarget.getBoundingClientRect().left - finalsRegional.getBoundingClientRect().left) / renderedZoom;
    const stateShift = (eastTarget.getBoundingClientRect().left - finalsState.getBoundingClientRect().left) / renderedZoom;
    const finalsInnerGap = getFinalsInnerGap(regionalView);

    finalsView.style.setProperty("--brsn-finals-regional-shift", `${Math.round(regionalShift - finalsInnerGap / 2)}px`);
    finalsView.style.setProperty("--brsn-finals-state-shift", `${Math.round(stateShift + finalsInnerGap / 2)}px`);

    const verticalTarget = getFinalFourVerticalTarget(regionalView);
    const verticalAnchor = getFinalFourVerticalAnchor(finalsView);
    if (Number.isFinite(verticalTarget) && Number.isFinite(verticalAnchor)) {
      const verticalShift = (verticalTarget - verticalAnchor) / renderedZoom;
      finalsView.style.setProperty("--brsn-finals-vertical-shift", `${Math.round(verticalShift)}px`);
    }

    if (finalsInnerGap !== 0) {
      requestBracketLineRelayout();
    }
  }

  function getFinalFourVerticalAnchor(finalsView) {
    const regionalMatchups = Array.from(
      finalsView.querySelectorAll(":scope > .rounds > .round:first-child .matchup-container")
    );
    if (regionalMatchups.length >= 2) {
      const topBox = regionalMatchups[0].getBoundingClientRect();
      const bottomBox = regionalMatchups[1].getBoundingClientRect();
      return (topBox.bottom + bottomBox.top) / 2;
    }

    const finalsBox = finalsView.getBoundingClientRect();
    return finalsBox.height > 0 ? finalsBox.top + finalsBox.height / 2 : NaN;
  }

  function getFinalFourVerticalTarget(regionalView) {
    const westFirstRound = Array.from(
      regionalView.querySelectorAll(":scope > .rounds:first-child > .round:first-child .matchup-container")
    );
    const eastFirstRound = Array.from(
      regionalView.querySelectorAll(":scope > .rounds:nth-child(2) > .round:first-child .matchup-container")
    );
    const matchups = westFirstRound.length >= eastFirstRound.length ? westFirstRound : eastFirstRound;
    if (matchups.length < 2) {
      return NaN;
    }

    const splitIndex = Math.floor(matchups.length / 2);
    const topMatchup = matchups[splitIndex - 1];
    const bottomMatchup = matchups[splitIndex];
    if (!topMatchup || !bottomMatchup) {
      return NaN;
    }

    const topBox = topMatchup.getBoundingClientRect();
    const bottomBox = bottomMatchup.getBoundingClientRect();
    return (topBox.bottom + bottomBox.top) / 2;
  }

  function setupPathHoverCleanup() {
    let activeTeam = null;
    let cleanupTimer = 0;
    let cleanupFrame = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    const pathRoot = viewport.querySelector(".bracket-container") || viewport;

    viewport.addEventListener("pointerover", handleTeamEnter, true);
    viewport.addEventListener("mouseover", handleTeamEnter, true);
    viewport.addEventListener("pointerout", handleTeamLeave, true);
    viewport.addEventListener("mouseout", handleTeamLeave, true);
    document.addEventListener("pointermove", handleGlobalPointerMove, true);
    document.addEventListener("mousemove", handleGlobalPointerMove, true);

    function handleTeamEnter(event) {
      rememberPointer(event);
      const team = event.target.closest(".team");
      if (!team) {
        return;
      }

      activeTeam = team;
      clearTimeout(cleanupTimer);
      if (cleanupFrame) {
        cancelAnimationFrame(cleanupFrame);
        cleanupFrame = 0;
      }
    }

    function handleTeamLeave(event) {
      rememberPointer(event);
      const fromTeam = event.target.closest(".team");
      if (!fromTeam) {
        return;
      }

      const toTeam = event.relatedTarget?.closest?.(".team") || null;
      if (toTeam === fromTeam) {
        return;
      }

      activeTeam = null;
      queuePathCleanup(event.relatedTarget || viewport);
    }

    function handleGlobalPointerMove(event) {
      rememberPointer(event);

      const currentTeam = teamAtPointer();
      if (currentTeam) {
        activeTeam = currentTeam;
        return;
      }

      activeTeam = null;
      if (pathRoot.querySelector(".highlight")) {
        queuePathCleanup(event.target);
      }
    }

    viewport.addEventListener("pointermove", (event) => {
      if (isPanning) {
        return;
      }

      const team = event.target.closest(".team");
      if (team) {
        activeTeam = team;
        return;
      }

      if (!activeTeam) {
        return;
      }

      releaseTeamHover(activeTeam, event.target);
      activeTeam = null;
      queuePathCleanup(event.target);
    }, true);

    viewport.addEventListener("mouseleave", () => {
      if (activeTeam) {
        releaseTeamHover(activeTeam, viewport);
        activeTeam = null;
      }
      queuePathCleanup(viewport);
    });

    function queuePathCleanup(relatedTarget) {
      clearTimeout(cleanupTimer);
      cleanupTimer = window.setTimeout(() => {
        cleanupFrame = requestAnimationFrame(() => {
          cleanupFrame = 0;
          if (teamAtPointer() || viewport.querySelector(".team:hover")) {
            return;
          }
          activeTeam = null;
          scrubStuckPathHighlights(pathRoot);
        });
      }, 35);
    }

    function rememberPointer(event) {
      if (typeof event.clientX === "number" && typeof event.clientY === "number") {
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
      }
    }

    function teamAtPointer() {
      const element = document.elementFromPoint(lastPointerX, lastPointerY);
      if (!element || !viewport.contains(element)) {
        return null;
      }
      return element.closest(".team");
    }
  }

  function releaseTeamHover(team, relatedTarget) {
    if (!team) {
      return;
    }

    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      relatedTarget: relatedTarget instanceof Element ? relatedTarget : viewport,
    };

    team.dispatchEvent(new MouseEvent("mouseout", options));
    team.dispatchEvent(new MouseEvent("mouseleave", { ...options, bubbles: false }));
  }

  function scrubStuckPathHighlights(root) {
    root.querySelectorAll(".highlight").forEach((element) => {
      element.classList.remove("highlight");
    });

    const colorProperties = [
      "border-color",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "background-color",
      "color",
      "box-shadow",
      "outline",
      "outline-color",
    ];

    root.querySelectorAll("[style]").forEach((element) => {
      const style = element.getAttribute("style") || "";
      if (!looksLikeHoverPathStyle(style)) {
        return;
      }

      colorProperties.forEach((property) => element.style.removeProperty(property));
      if (!element.getAttribute("style")?.trim()) {
        element.removeAttribute("style");
      }
    });
  }

  function looksLikeHoverPathStyle(style) {
    return /border(?:-[a-z]+)?-color\s*:|background-color\s*:|box-shadow\s*:|outline(?:-color)?\s*:|color\s*:/i.test(style)
      && /rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)|rgb\(\s*255\s*,\s*51\s*,\s*68\s*\)|rgb\(\s*47\s*,\s*131\s*,\s*255\s*\)|#f00|#ff0000|#ff3344|#2f83ff|red|blue/i.test(style);
  }

  // == Bracket toolbar: Sport / Class / Year / Team Search =================

  function setupBracketSelectors() {
    const mainSport = document.getElementById("sport");
    const mainClass = document.getElementById("classification");
    const mainYear  = document.getElementById("seasonYear");
    const bracketSport       = root.querySelector("#bracketSport");
    const bracketClass       = root.querySelector("#bracketClass");
    const bracketYear        = root.querySelector("#bracketYear");
    const bracketSearchInput = root.querySelector("#bracketTeamSearch");
    const bracketTeamMenu    = root.querySelector("#bracketTeamMenu");

    // Mirror options + current value from the main page selects.
    function syncSelects() {
      if (bracketSport && mainSport) { bracketSport.innerHTML = mainSport.innerHTML; bracketSport.value = mainSport.value; }
      if (bracketClass && mainClass) { bracketClass.innerHTML = mainClass.innerHTML; bracketClass.value = mainClass.value; }
      if (bracketYear  && mainYear)  { bracketYear.innerHTML  = mainYear.innerHTML;  bracketYear.value  = mainYear.value; }
    }
    syncSelects();

    // When a bracket select changes, push the value to the main select and trigger reload.
    if (bracketSport) {
      bracketSport.addEventListener("change", () => {
        if (mainSport && mainSport.value !== bracketSport.value) {
          mainSport.value = bracketSport.value;
          mainSport.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
    if (bracketClass) {
      bracketClass.addEventListener("change", () => {
        if (mainClass && mainClass.value !== bracketClass.value) {
          mainClass.value = bracketClass.value;
          mainClass.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
    if (bracketYear) {
      bracketYear.addEventListener("change", () => {
        if (mainYear && mainYear.value !== bracketYear.value) {
          mainYear.value = bracketYear.value;
          mainYear.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    // Team search wiring.
    if (!bracketSearchInput || !bracketTeamMenu) return;

    let searchTimer = 0;

    bracketSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(renderBracketMenu, 120);
    });
    bracketSearchInput.addEventListener("focus", renderBracketMenu);
    bracketSearchInput.addEventListener("pointerdown", (e) => e.stopPropagation());
    bracketSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeBracketMenu(); bracketSearchInput.blur(); }
    });

    bracketTeamMenu.addEventListener("pointerdown", (e) => e.stopPropagation());
    bracketTeamMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-bracket-team-key]");
      if (!btn) return;
      const name = btn.dataset.bracketTeamName  || "";
      const cls  = btn.dataset.bracketTeamClass || "";
      const key  = btn.dataset.bracketTeamKey   || "";
      bracketSearchInput.value = name;
      closeBracketMenu();
      bracketJumpToTeam_(name, cls, key, mainClass);
    });

    document.addEventListener("pointerdown", (e) => {
      if (!bracketSearchInput.contains(e.target) && !bracketTeamMenu.contains(e.target)) {
        closeBracketMenu();
      }
    });

    function renderBracketMenu() {
      const query = (bracketSearchInput.value || "").trim();
      const rows  = window.BRSNBoard && window.BRSNBoard.searchTeams ? window.BRSNBoard.searchTeams(query) : [];
      bracketTeamMenu.hidden = rows.length === 0;
      if (!rows.length) { bracketTeamMenu.innerHTML = ""; return; }
      bracketTeamMenu.innerHTML = rows.map(function(r) {
        return '<button type="button" class="team-jump-option"' +
          ' data-bracket-team-key="' + bEsc_(r.key) + '"' +
          ' data-bracket-team-name="' + bEsc_(r.name) + '"' +
          ' data-bracket-team-class="' + bEsc_(r.teamClass) + '">' +
          (r.logoUrl
            ? '<img class="bracket-team-option-logo" src="' + bEsc_(r.logoUrl) + '" alt="" loading="lazy">'
            : '<span class="team-jump-option-logo"></span>') +
          '<span class="team-jump-option-copy">' +
          '<span class="team-jump-option-name">' + bEscHtml_(r.name) + '</span>' +
          '<small>' + (r.mascot ? '<b>' + bEscHtml_(r.mascot) + '</b> ' : '') +
          '<span>' + bEscHtml_(r.classShort || r.teamClass) + '</span></small>' +
          '</span></button>';
      }).join("");
    }

    function closeBracketMenu() {
      bracketTeamMenu.hidden = true;
    }

    // If the previous bracket reload was triggered by a team-search class-switch,
    // a pending jump is stored on window -- pick it up and execute now.
    var pending = window.BRSN_PENDING_BRACKET_JUMP;
    if (pending) {
      window.BRSN_PENDING_BRACKET_JUMP = null;
      window.setTimeout(function() { scrollAndHighlightBracketTeam_(pending.name); }, 1200);
    }
  }

  // Change class if needed then scroll+highlight; otherwise scroll+highlight directly.
  function bracketJumpToTeam_(teamName, teamClass, teamKey, mainClassEl) {
    if (!teamName) return;
    var curClass = mainClassEl ? mainClassEl.value : "";
    if (teamClass && curClass && teamClass !== curClass) {
      window.BRSN_PENDING_BRACKET_JUMP = { name: teamName, key: teamKey };
      if (mainClassEl) {
        mainClassEl.value = teamClass;
        mainClassEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return;
    }
    scrollAndHighlightBracketTeam_(teamName);
  }

  // Find the team's latest-round element in the bracket, scroll to it, and highlight path.
  function scrollAndHighlightBracketTeam_(teamName) {
    if (!teamName || !viewport) return;
    function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim(); }
    var needle = norm(teamName).slice(0, 24);
    if (!needle) return;

    var allTeamEls = Array.from(viewport.querySelectorAll(".team"));
    var matched = allTeamEls.filter(function(el) {
      var nameEl = el.querySelector(".team-name, .school-name");
      var text = norm(nameEl ? nameEl.textContent : el.textContent).slice(0, 24);
      return text && text.indexOf(needle) !== -1;
    });
    if (!matched.length) return;

    // Find the element furthest into the bracket (latest round).
    var rounds = Array.from(viewport.querySelectorAll(".round"));
    var latestEl = matched[0];
    for (var i = rounds.length - 1; i >= 0; i--) {
      var found = matched.find(function(t) { return rounds[i].contains(t); });
      if (found) { latestEl = found; break; }
    }

    // Scroll the viewport so the team element is centered.
    var teamRect = latestEl.getBoundingClientRect();
    var viewRect = viewport.getBoundingClientRect();
    viewport.scrollTo({
      left: viewport.scrollLeft + (teamRect.left + teamRect.width  / 2) - (viewRect.left + viewRect.width  / 2),
      top:  viewport.scrollTop  + (teamRect.top  + teamRect.height / 2) - (viewRect.top  + viewRect.height / 2),
      behavior: "smooth",
    });

    highlightBracketTeamPath_(latestEl);
  }

  // Dispatch synthetic hover events to trigger MaxPreps path highlight for 5 seconds.
  function highlightBracketTeamPath_(teamEl) {
    if (!teamEl || !viewport) return;
    var pathRoot = viewport.querySelector(".bracket-container") || viewport;
    var evOpts = { bubbles: true, cancelable: true, view: window };

    teamEl.dispatchEvent(new MouseEvent("mouseover",  evOpts));
    teamEl.dispatchEvent(new MouseEvent("mouseenter", Object.assign({}, evOpts, { bubbles: false })));

    // Fallback: if MaxPreps widget did not add .highlight, add it ourselves.
    window.setTimeout(function() {
      if (!pathRoot.querySelector(".highlight")) {
        function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim(); }
        var nameEl = teamEl.querySelector(".team-name, .school-name");
        var needle = norm(nameEl ? nameEl.textContent : teamEl.textContent).slice(0, 24);
        viewport.querySelectorAll(".team").forEach(function(t) {
          var tName = t.querySelector(".team-name, .school-name");
          var text = norm(tName ? tName.textContent : t.textContent).slice(0, 24);
          if (needle && text && text.indexOf(needle) !== -1) t.classList.add("highlight");
        });
      }
    }, 150);

    // Remove highlight after 5 seconds.
    window.setTimeout(function() {
      teamEl.dispatchEvent(new MouseEvent("mouseout",   Object.assign({}, evOpts, { relatedTarget: viewport })));
      teamEl.dispatchEvent(new MouseEvent("mouseleave", Object.assign({}, evOpts, { bubbles: false, relatedTarget: viewport })));
      scrubStuckPathHighlights(pathRoot);
    }, 5000);
  }

  // HTML escapers for bracket menu markup.
  function bEsc_(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function bEscHtml_(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
};
