// Runtime wiring and startup for the playoff board.

// Picker menus and lightweight control wiring.
sportPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setSportPickerOpen_(sportPickerMenu.hidden);
});

classPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setClassPickerOpen_(classPickerMenu.hidden);
});

yearPickerBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  setYearPickerOpen_(yearPickerMenu.hidden);
});

eastWestMapClassPickerBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  setEastWestMapClassPickerOpen_(eastWestMapClassPickerMenu.hidden);
});

eastWestMapSportPickerBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  setEastWestMapSportPickerOpen_(eastWestMapSportPickerMenu.hidden);
});

sportPickerMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.sport-picker-option');
  if (!btn) return;
  const nextValue = btn.dataset.value;
  if (sportEl.value !== nextValue) {
    sportEl.value = nextValue;
    syncSportPickerUi_();
    sportEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    syncSportPickerUi_();
  }
  setSportPickerOpen_(false);
});

classPickerMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('.class-picker-option');
  if (!btn) return;
  const nextValue = btn.dataset.value;
  if (classEl.value !== nextValue) {
    classEl.value = nextValue;
    syncClassPickerUi_();
    classEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    syncClassPickerUi_();
  }
  setClassPickerOpen_(false);
});

yearPickerMenu?.addEventListener('click', (e) => {
  const btn = e.target.closest('.class-picker-option');
  if (!btn) return;
  const nextValue = btn.dataset.value;
  if (yearEl.value !== nextValue) {
    yearEl.value = nextValue;
    syncYearPickerUi_();
    yearEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    syncYearPickerUi_();
  }
  setYearPickerOpen_(false);
});

eastWestMapClassPickerMenu?.addEventListener('click', (e) => {
  const btn = e.target.closest('.class-picker-option');
  if (!btn) return;
  const nextValue = btn.dataset.value;
  if (eastWestMapClass.value !== nextValue) {
    eastWestMapClass.value = nextValue;
    syncEastWestMapClassPickerUi_();
    eastWestMapClass.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    syncEastWestMapClassPickerUi_();
  }
  setEastWestMapClassPickerOpen_(false);
});

eastWestMapSportPickerMenu?.addEventListener('click', (e) => {
  const btn = e.target.closest('.sport-picker-option');
  if (!btn) return;
  const nextValue = btn.dataset.value;
  if (eastWestMapSport.value !== nextValue) {
    eastWestMapSport.value = nextValue;
    syncEastWestMapSportPickerUi_();
    eastWestMapSport.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    syncEastWestMapSportPickerUi_();
  }
  setEastWestMapSportPickerOpen_(false);
});

document.addEventListener('click', (e) => {
  if (sportPicker && !sportPicker.contains(e.target)) {
    setSportPickerOpen_(false);
  }
  if (classPicker && !classPicker.contains(e.target)) {
    setClassPickerOpen_(false);
  }
  if (yearPicker && !yearPicker.contains(e.target)) {
    setYearPickerOpen_(false);
  }
  if (eastWestMapClassPicker && !eastWestMapClassPicker.contains(e.target)) {
    setEastWestMapClassPickerOpen_(false);
  }
  if (eastWestMapSportPicker && !eastWestMapSportPicker.contains(e.target)) {
    setEastWestMapSportPickerOpen_(false);
  }
});

renderSportPickerOptions_();
renderClassPickerOptions_();
renderYearPickerOptions_();
syncSportPickerUi_();
syncClassPickerUi_();
syncYearPickerUi_();

// Startup preferences, overlays, and board event wiring.
try {
      const savedTheme = localStorage.getItem('nchsaa-theme');
      if (savedTheme && themeEl.querySelector(`option[value="${savedTheme}"]`)) themeEl.value = savedTheme;
    } catch (e) {}

    try {
      const savedShowLastChange = localStorage.getItem('nchsaa-show-last-change');
      showLastChangeToggle.checked = savedShowLastChange === null ? true : savedShowLastChange === '1';
    } catch (e) {}

    try {
      applyPerformanceMode_(localStorage.getItem('nchsaa-performance-mode') === '1');
    } catch (e) {
      applyPerformanceMode_(false);
    }

    try {
      const savedPlayoffTeamLimit = localStorage.getItem('nchsaa-playoff-team-limit') || '';
      playoffTeamLimit.value = /^\d+$/.test(savedPlayoffTeamLimit) ? savedPlayoffTeamLimit : '';
    } catch (e) {}

    applyTheme_(themeEl.value);
    syncOddTeamSplitToggleUi_();
    setViewMode_('rankings');


    function applyExportPreviewFilter_() {
      const filter = exportPreviewTypeFilter.value;
      const cards = [...exportPreviewGrid.querySelectorAll('.export-preview-card')];
      cards.forEach(card => {
        const key = card.getAttribute('data-export-key') || '';
        const kind = key.endsWith('::region') ? 'region' : 'playoff';
        card.style.display = (filter === 'all' || filter === kind) ? '' : 'none';
      });
      const visibleCount = visibleExportItems_().length;
      if (!cards.length) {
        setExportPreviewStatus_('Choose classes and view type, then click Build Exports.');
      } else {
        setExportPreviewStatus_(visibleCount ? `Ready. Showing ${visibleCount} export${visibleCount === 1 ? '' : 's'}.` : 'No exports match the current filter.');
      }
      scheduleExportPreviewGridFit_();
    }

    closeExportPreviewBtn.addEventListener('click', closeExportPreview_);
    exportPreviewOverlay.addEventListener('click', (e) => {
      if (e.target === exportPreviewOverlay) closeExportPreview_();
    });

    teamScheduleCloseBtn?.addEventListener('click', closeTeamScheduleCard_);
    teamScheduleOverlay?.addEventListener('click', (e) => {
      if (e.target === teamScheduleOverlay) closeTeamScheduleCard_();
    });
    teamLogCloseBtn?.addEventListener('click', closeTeamLogCard_);
    teamLogOverlay?.addEventListener('click', (e) => {
      if (e.target === teamLogOverlay) closeTeamLogCard_();
    });
    teamLogCalendarBtn?.addEventListener('click', () => openDatePicker_(teamLogDateInput));
    teamLogViewBtn?.addEventListener('click', toggleTeamLogView_);
    teamLogDateInput?.addEventListener('change', () => applyTeamLogDateSelection_(teamLogDateInput.value));
    teamLogContent?.addEventListener('click', (e) => {
      if (e.target.closest('.team-log-inline-calendar-btn')) {
        openDatePicker_(teamLogDateInput);
        return;
      }
      if (e.target.closest('.team-log-inline-view-btn')) {
        toggleTeamLogView_();
        return;
      }
      const dateStepBtn = e.target.closest('[data-team-log-date-step]');
      if (dateStepBtn) {
        stepTeamLogDate_(dateStepBtn.dataset.teamLogDateStep);
        return;
      }
      const mobileRow = e.target.closest('[data-team-log-entry]');
      if (mobileRow) {
        toggleTeamLogEntry_(mobileRow.dataset.teamLogEntry);
        return;
      }
      const rangeBtn = e.target.closest('[data-team-log-range]');
      if (!rangeBtn) return;
      applyTeamLogRangeSelection_(rangeBtn.dataset.teamLogRange);
    });

    eastWestMapCloseBtn.addEventListener('click', closeEastWestMap_);
    eastWestMapOverlay.addEventListener('click', (e) => {
      if (e.target === eastWestMapOverlay) closeEastWestMap_();
    });

    eastWestMapOverlay.querySelector('.east-west-map-panel').addEventListener('click', (e) => {
      if (e.target.closest('.east-west-map-info-card, .east-west-map-context-menu, .nc-map-ui, .nc-map-marker, .east-west-map-close')) return;
      hideEastWestMapInfoCard_();
      clearEastWestMeasureLine_();
      eastWestMapMeasureStartKey_ = '';
      eastWestMapCanvas.classList.remove('is-measuring');
      applyEastWestMarkerZOrder_();
    });

    eastWestMapInfoCards.addEventListener('click', (e) => {
      const card = e.target.closest('.east-west-map-info-card');
      if (!card) return;
      e.stopPropagation();
      bringEastWestMapInfoCardToFront_(card);
      if (!e.target.closest('[data-map-card-close]')) return;
      removeEastWestMapInfoCard_(card);
      if (!eastWestMapInfoCards.querySelector('.east-west-map-info-card')) {
        clearEastWestMeasureLine_();
        eastWestMapMeasureStartKey_ = '';
        eastWestMapCanvas.classList.remove('is-measuring');
        applyEastWestMarkerZOrder_();
      }
    });

    eastWestMapInfoCards.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.east-west-map-info-card');
      if (!card || e.target.closest('button, input, select, textarea, a')) return;
      const handle = e.target.closest('.east-west-map-card-head');
      if (!handle) {
        bringEastWestMapInfoCardToFront_(card);
        return;
      }
      const panel = eastWestMapOverlay.querySelector('.east-west-map-panel');
      const panelRect = panel.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      eastWestMapCardDrag_ = {
        card,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        left: cardRect.left - panelRect.left,
        top: cardRect.top - panelRect.top,
        panelRect
      };
      bringEastWestMapInfoCardToFront_(card);
      card.classList.add('is-dragging');
      card.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });

    eastWestMapInfoCards.addEventListener('pointermove', (e) => {
      if (!eastWestMapCardDrag_ || e.pointerId !== eastWestMapCardDrag_.pointerId) return;
      const { card, panelRect, startX, startY, left, top } = eastWestMapCardDrag_;
      const margin = 10;
      const nextLeft = left + (e.clientX - startX);
      const nextTop = top + (e.clientY - startY);
      const maxLeft = Math.max(margin, panelRect.width - card.offsetWidth - margin);
      const maxTop = Math.max(margin, panelRect.height - card.offsetHeight - margin);
      card.style.left = `${Math.max(margin, Math.min(nextLeft, maxLeft))}px`;
      card.style.top = `${Math.max(margin, Math.min(nextTop, maxTop))}px`;
      card.style.bottom = 'auto';
      e.preventDefault();
    });

    const finishEastWestInfoCardDrag_ = (e) => {
      if (!eastWestMapCardDrag_ || e.pointerId !== eastWestMapCardDrag_.pointerId) return;
      eastWestMapCardDrag_.card.classList.remove('is-dragging');
      eastWestMapCardDrag_ = null;
    };
    eastWestMapInfoCards.addEventListener('pointerup', finishEastWestInfoCardDrag_);
    eastWestMapInfoCards.addEventListener('pointercancel', finishEastWestInfoCardDrag_);

    eastWestMapContextMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = e.target.closest('[data-map-menu-action]')?.dataset.mapMenuAction || '';
      if (!action) return;
      const row = eastWestMapRowsByKey_.get(eastWestMapContextTeamKey_);
      hideEastWestMapContextMenu_();
      if (!row) return;
      if (action === 'measure') {
        startEastWestMeasure_(row);
      } else if (action === 'focus') {
        focusEastWestMapTeam_(row);
      } else if (action === 'unfocus') {
        unfocusEastWestMapTeam_(row);
      }
    });

    let mobileStatsLongPressTimer_ = 0;
    let mobileStatsLongPressRow_ = null;
    let mobileStatsLongPressPointerId_ = 0;
    let mobileStatsLongPressStart_ = null;
    let mobileStatsSuppressClickUntil_ = 0;

    function mobileStatsExpandableRow_(target) {
      const row = closestFromTarget_(target, 'tr');
      if (!row || row.classList.contains('mobile-rpi-board-header') || row.classList.contains('east-west-line-section-row')) return null;
      if (!row.querySelector?.('td[data-label]')) return null;
      return row;
    }

    function clearMobileStatsLongPress_() {
      if (mobileStatsLongPressTimer_) clearTimeout(mobileStatsLongPressTimer_);
      mobileStatsLongPressTimer_ = 0;
      mobileStatsLongPressRow_ = null;
      mobileStatsLongPressPointerId_ = 0;
      mobileStatsLongPressStart_ = null;
    }

    tbody.addEventListener('pointerdown', (e) => {
      if (!isMobileBoardLayout_()) return;
      if (e.target.closest('[data-east-west-map-btn], #eastWestMapBtn, button, a, input, select, textarea')) return;
      const row = mobileStatsExpandableRow_(e.target);
      if (!row) return;
      clearMobileStatsLongPress_();
      mobileStatsLongPressRow_ = row;
      mobileStatsLongPressPointerId_ = e.pointerId;
      mobileStatsLongPressStart_ = { x: e.clientX, y: e.clientY };
      mobileStatsLongPressTimer_ = setTimeout(() => {
        if (!mobileStatsLongPressRow_) return;
        toggleMobileStatsRow_(mobileStatsLongPressRow_);
        mobileStatsSuppressClickUntil_ = Date.now() + 650;
        if (navigator.vibrate) navigator.vibrate(18);
        clearMobileStatsLongPress_();
      }, 560);
    });

    tbody.addEventListener('pointermove', (e) => {
      if (!mobileStatsLongPressStart_ || e.pointerId !== mobileStatsLongPressPointerId_) return;
      const dx = e.clientX - mobileStatsLongPressStart_.x;
      const dy = e.clientY - mobileStatsLongPressStart_.y;
      if (Math.hypot(dx, dy) > 10) clearMobileStatsLongPress_();
    });

    tbody.addEventListener('pointerup', clearMobileStatsLongPress_);
    tbody.addEventListener('pointercancel', clearMobileStatsLongPress_);
    tbody.addEventListener('pointerleave', clearMobileStatsLongPress_);

    tbody.addEventListener('click', (e) => {
      if (e.target.closest('[data-east-west-map-btn], #eastWestMapBtn')) openEastWestMap_();
      if (e.target.closest('button, a, input, select, textarea')) return;
      const teamLogTarget = closestFromTarget_(e.target, '[data-team-log-row="1"]');
      const scheduleTarget = closestFromTarget_(e.target, '[data-schedule-row="1"]');
      const isMobile = isMobileBoardLayout_();
      if (isMobile) {
        if (Date.now() < mobileStatsSuppressClickUntil_) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (teamLogTarget) {
          openTeamLogCard_(teamLogRowFromDataset_(teamLogTarget.dataset));
          return;
        }
        if (scheduleTarget) openTeamScheduleCard_(scheduleRowFromDataset_(scheduleTarget.dataset));
        return;
      }
      if (teamLogTarget) {
        openTeamLogCard_(teamLogRowFromDataset_(teamLogTarget.dataset));
        return;
      }
      if (scheduleTarget) openTeamScheduleCard_(scheduleRowFromDataset_(scheduleTarget.dataset));
    });

    [eastWestMapClass, eastWestMapSport].filter(Boolean).forEach(select => {
      select.addEventListener('pointerdown', e => e.stopPropagation());
      select.addEventListener('click', e => e.stopPropagation());
      select.addEventListener('change', applyEastWestMapSelectorChange_);
    });

    eastWestMapCanvas.addEventListener('input', (e) => {
      if (e.target.closest('#eastWestMapLogoScale')) {
        setEastWestMapLogoScale_(e.target.value);
      }
    });

    eastWestMapCanvas.addEventListener('change', async (e) => {
      const extraEast = e.target.closest('#eastWestMapExtraEast');
      const cleanView = e.target.closest('#eastWestMapCleanView');
      const regionRankView = e.target.closest('#eastWestMapRegionRankView');
      const performanceMode = e.target.closest('#eastWestMapPerformanceMode');
      if (extraEast) {
        e.stopPropagation();
        eastWestExtraEast.checked = extraEast.checked;
        syncOddTeamSplitToggleUi_();
        await refreshEastWestSplitFromCurrentState_();
        return;
      }
      if (cleanView) {
        e.stopPropagation();
        eastWestMapCleanView_ = cleanView.checked;
        eastWestMapPlacementCacheKey_ = '';
        eastWestMapPlacementCache_ = null;
        updateEastWestMapLogoScaleUi_();
        applyEastWestMapZoom_({ forcePlacement: true });
        return;
      }
      if (regionRankView) {
        e.stopPropagation();
        eastWestMapRegionRankView_ = regionRankView.checked;
        updateEastWestMapLogoScaleUi_();
      }
      if (performanceMode) {
        e.stopPropagation();
        eastWestMapPerformanceMode_ = performanceMode.checked;
        updateEastWestMapLogoScaleUi_();
      }
    });

    eastWestMapCanvas.addEventListener('click', (e) => {
      const action = e.target.closest('[data-map-action]')?.dataset.mapAction || '';
      if (action === 'zoom-in') {
        zoomEastWestMapAt_(EAST_WEST_MAP_ZOOM_STEP_, eastWestMapCenterPoint_());
        return;
      }
      if (action === 'zoom-out') {
        zoomEastWestMapAt_(1 / EAST_WEST_MAP_ZOOM_STEP_, eastWestMapCenterPoint_());
        return;
      }
      if (action === 'settings') {
        toggleEastWestMapLogoControls_();
        return;
      }
      if (action === 'save-map') {
        exportEastWestMapPng_();
        return;
      }
      if (eastWestMapUiTarget_(e.target)) return;
      if (Date.now() < eastWestMapSuppressClickUntil_) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      hideEastWestMapContextMenu_();
      const marker = markerFromMapTarget_(e.target);
      const row = rowFromMapMarker_(marker);
      if (!row) return;
      e.stopPropagation();
      if (eastWestMapMeasureStartKey_) {
        completeEastWestMeasure_(row, e);
      } else {
        showEastWestTeamDetails_(row, e);
      }
    });

    eastWestMapCanvas.addEventListener('contextmenu', (e) => {
      const marker = markerFromMapTarget_(e.target);
      const row = rowFromMapMarker_(marker);
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      showEastWestMapContextMenu_(row, e);
    });

    eastWestMapCanvas.addEventListener('keydown', (e) => {
      const action = e.target.closest('[data-map-action]')?.dataset.mapAction || '';
      if (!action || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (action === 'settings') {
        toggleEastWestMapLogoControls_();
      } else if (action === 'save-map') {
        exportEastWestMapPng_();
      } else {
        zoomEastWestMapAt_(action === 'zoom-in' ? EAST_WEST_MAP_ZOOM_STEP_ : 1 / EAST_WEST_MAP_ZOOM_STEP_, eastWestMapCenterPoint_());
      }
    });

    eastWestMapCanvas.addEventListener('wheel', (e) => {
      if (!eastWestMapCanvas.querySelector('svg')) return;
      if (eastWestMapUiTarget_(e.target)) return;
      e.preventDefault();
      const point = eastWestMapSvgPoint_(e);
      if (!point) return;
      setEastWestMapTransforming_(true, 180);
      zoomEastWestMapAt_(e.deltaY < 0 ? EAST_WEST_MAP_ZOOM_STEP_ : 1 / EAST_WEST_MAP_ZOOM_STEP_, point);
    }, { passive: false });

    let eastWestMapPanStart_ = null;
    let eastWestMapPinchStart_ = null;
    let eastWestMapGestureMoved_ = false;
    let eastWestMapSuppressClickUntil_ = 0;
    const eastWestMapActivePointers_ = new Map();

    function eastWestMapPointerPair_() {
      return [...eastWestMapActivePointers_.values()].slice(0, 2);
    }

    function eastWestMapPointerDistance_(a, b) {
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function eastWestMapPointerMidpoint_(a, b) {
      return {
        clientX: (a.clientX + b.clientX) / 2,
        clientY: (a.clientY + b.clientY) / 2
      };
    }

    function beginEastWestMapPinch_() {
      const [a, b] = eastWestMapPointerPair_();
      if (!a || !b) return;
      const point = eastWestMapSvgPoint_(eastWestMapPointerMidpoint_(a, b));
      const distance = eastWestMapPointerDistance_(a, b);
      if (!point || distance <= 0) return;
      eastWestMapPinchStart_ = {
        distance,
        scale: eastWestMapTransform_.scale,
        mapX: (point.x - eastWestMapTransform_.x) / eastWestMapTransform_.scale,
        mapY: (point.y - eastWestMapTransform_.y) / eastWestMapTransform_.scale
      };
      eastWestMapPanStart_ = null;
      eastWestMapGestureMoved_ = true;
      eastWestMapCanvas.classList.add('is-panning');
    }

    function updateEastWestMapPinch_() {
      const [a, b] = eastWestMapPointerPair_();
      if (!eastWestMapPinchStart_ || !a || !b) return false;
      const point = eastWestMapSvgPoint_(eastWestMapPointerMidpoint_(a, b));
      const distance = eastWestMapPointerDistance_(a, b);
      if (!point || distance <= 0) return true;
      const newScale = Math.min(EAST_WEST_MAP_MAX_SCALE_, Math.max(EAST_WEST_MAP_MIN_SCALE_, eastWestMapPinchStart_.scale * (distance / eastWestMapPinchStart_.distance)));
      eastWestMapTransform_.scale = newScale;
      eastWestMapTransform_.x = point.x - eastWestMapPinchStart_.mapX * newScale;
      eastWestMapTransform_.y = point.y - eastWestMapPinchStart_.mapY * newScale;
      eastWestMapGestureMoved_ = true;
      hideEastWestMapContextMenu_();
      requestEastWestMapViewportApply_();
      return true;
    }

    eastWestMapCanvas.addEventListener('pointerdown', (e) => {
      if (!eastWestMapCanvas.querySelector('svg')) return;
      const markerTarget = markerFromMapTarget_(e.target);
      if (eastWestMapUiTarget_(e.target) || (markerTarget && e.pointerType !== 'touch')) return;
      const point = eastWestMapSvgPoint_(e);
      if (!point) return;
      if (eastWestMapActivePointers_.size === 0) {
        eastWestMapGestureMoved_ = false;
        eastWestMapSuppressClickUntil_ = 0;
      }
      eastWestMapActivePointers_.set(e.pointerId, { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
      if (!markerTarget) {
        try { eastWestMapCanvas.setPointerCapture(e.pointerId); } catch {}
      }
      hideEastWestMapContextMenu_();
      setEastWestMapTransforming_(true);
      if (eastWestMapActivePointers_.size >= 2) {
        beginEastWestMapPinch_();
        return;
      }
      eastWestMapPanStart_ = {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        startX: eastWestMapTransform_.x,
        startY: eastWestMapTransform_.y,
        rect: point.rect
      };
      eastWestMapCanvas.classList.add('is-panning');
    });

    eastWestMapCanvas.addEventListener('pointermove', (e) => {
      if (eastWestMapActivePointers_.has(e.pointerId)) {
        eastWestMapActivePointers_.set(e.pointerId, { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
      }
      if (eastWestMapPinchStart_ && eastWestMapActivePointers_.size >= 2) {
        e.preventDefault();
        updateEastWestMapPinch_();
        return;
      }
      if (!eastWestMapPanStart_ || e.pointerId !== eastWestMapPanStart_.pointerId) return;
      const pointerDistance = Math.hypot(e.clientX - eastWestMapPanStart_.clientX, e.clientY - eastWestMapPanStart_.clientY);
      if (pointerDistance > 4) eastWestMapGestureMoved_ = true;
      const dx = ((e.clientX - eastWestMapPanStart_.clientX) / eastWestMapPanStart_.rect.width) * 1200;
      const dy = ((e.clientY - eastWestMapPanStart_.clientY) / eastWestMapPanStart_.rect.height) * 650;
      eastWestMapTransform_.x = eastWestMapPanStart_.startX + dx;
      eastWestMapTransform_.y = eastWestMapPanStart_.startY + dy;
      if (e.pointerType === 'touch') e.preventDefault();
      requestEastWestMapViewportApply_();
    });

    const finishEastWestMapPan_ = (e) => {
      if (eastWestMapActivePointers_.has(e.pointerId)) {
        eastWestMapActivePointers_.delete(e.pointerId);
        try { eastWestMapCanvas.releasePointerCapture(e.pointerId); } catch {}
      }
      if (eastWestMapPanStart_ && e.pointerId === eastWestMapPanStart_.pointerId) {
        eastWestMapPanStart_ = null;
      }
      if (eastWestMapPinchStart_ && eastWestMapActivePointers_.size < 2) {
        eastWestMapPinchStart_ = null;
        requestEastWestMapZoomApply_({ deferPlacement: true });
        const remaining = eastWestMapPointerPair_()[0];
        const point = remaining ? eastWestMapSvgPoint_(remaining) : null;
        eastWestMapPanStart_ = remaining && point ? {
          pointerId: remaining.pointerId,
          clientX: remaining.clientX,
          clientY: remaining.clientY,
          startX: eastWestMapTransform_.x,
          startY: eastWestMapTransform_.y,
          rect: point.rect
        } : null;
      }
      if (!eastWestMapPanStart_ && eastWestMapActivePointers_.size === 0) {
        eastWestMapCanvas.classList.remove('is-panning');
        setEastWestMapTransforming_(false);
        if (eastWestMapGestureMoved_) eastWestMapSuppressClickUntil_ = Date.now() + 360;
        eastWestMapGestureMoved_ = false;
        requestEastWestMapZoomApply_({ deferPlacement: true });
      }
    };
    eastWestMapCanvas.addEventListener('pointerup', finishEastWestMapPan_);
    eastWestMapCanvas.addEventListener('pointercancel', finishEastWestMapPan_);

    exportPreviewClassMenuBtn.addEventListener('click', () => {
      setExportPreviewClassMenuOpen_(exportPreviewClassMenu.hidden);
    });

    exportPreviewSelectAllClasses.addEventListener('change', () => {
      setAllExportPreviewClasses_(exportPreviewSelectAllClasses.checked);
    });

    document.addEventListener('click', (e) => {
      if (!exportPreviewClassPicker.contains(e.target)) {
        setExportPreviewClassMenuOpen_(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setSportPickerOpen_(false);
        setClassPickerOpen_(false);
        setEastWestMapClassPickerOpen_(false);
        setEastWestMapSportPickerOpen_(false);
        setExportPreviewClassMenuOpen_(false);
        setAppSettingsOpen_(false);
        closeTeamScheduleCard_();
        closeEastWestMap_();
      }
    });

    buildExportPreviewBtn.addEventListener('click', async () => {
      const didBuild = await buildExportPreview_();
      if (didBuild) applyExportPreviewFilter_();
    });

    clearExportPreviewBtn.addEventListener('click', () => {
      exportPreviewState_.currentToken += 1;
      clearPendingServerPngExports_();
      clearExportPreview_();
      setExportPreviewStatus_('Choose classes and view type, then click Build Exports.');
      setStatus('Exports cleared.');
    });

    exportPreviewTypeFilter.addEventListener('change', applyExportPreviewFilter_);
    window.addEventListener('resize', scheduleExportPreviewGridFit_);
    exportPreviewSport.addEventListener('change', () => {
      exportPreviewSportTouched_ = true;
    });

    downloadAllExportsBtn.addEventListener('click', () => {
      const items = visibleExportItems_().filter(item => item.blob);
      items.forEach((item, idx) => {
        setTimeout(() => downloadExportItem_(item), idx * 200);
      });
    });

    function setAppSettingsOpen_(isOpen) {
      appSettingsPanel.hidden = !isOpen;
      appSettingsBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    appSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setAppSettingsOpen_(appSettingsPanel.hidden);
    });

    appSettingsCloseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      setAppSettingsOpen_(false);
    });

    appSettingsPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!appSettingsPanel.hidden && !appSettingsPanel.contains(e.target) && !appSettingsBtn.contains(e.target)) {
        setAppSettingsOpen_(false);
      }
    });

    compareSnapshotCalendarBtn?.addEventListener('click', () => openDatePicker_(compareSnapshotDate));
    historySnapshotCalendarBtn?.addEventListener('click', () => openDatePicker_(historySnapshotDate));

    compareSnapshotDate?.addEventListener('change', () => {
      loadSnapshotListForDate_('compare', compareSnapshotDate.value);
    });

    historySnapshotDate?.addEventListener('change', () => {
      loadSnapshotListForDate_('history', historySnapshotDate.value);
    });

    compareSnapshotResetBtn?.addEventListener('click', () => {
      resetCompareSnapshot_();
    });

    historySnapshotResetBtn?.addEventListener('click', () => {
      resetHistorySnapshot_();
    });

    showLastChangeToggle?.addEventListener('change', () => {
      try {
        localStorage.setItem('nchsaa-show-last-change', showLastChangeToggle.checked ? '1' : '0');
      } catch (e) {}
      reloadCurrentBoardForSelection_();
    });

    performanceModeToggle?.addEventListener('change', () => {
      applyPerformanceMode_(performanceModeToggle.checked, true);
    });

    function applyPlayoffTeamLimitSetting_() {
      const value = Math.floor(Number(playoffTeamLimit.value || 0));
      playoffTeamLimit.value = Number.isFinite(value) && value > 0 ? String(value) : '';
      try {
        localStorage.setItem('nchsaa-playoff-team-limit', playoffTeamLimit.value || '');
      } catch (e) {}
      reloadCurrentBoardForSelection_();
    }

    playoffTeamLimit?.addEventListener('change', applyPlayoffTeamLimitSetting_);
    playoffTeamLimit?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      playoffTeamLimit.blur();
    });

    compareSnapshotList?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-snapshot-id]');
      if (!btn) return;
      selectSnapshot_('compare', btn.dataset.snapshotId).catch(err => {
        console.warn(err);
        setStatus(`Unable to use compare snapshot. ${err.message}`, true);
      });
    });

    historySnapshotList?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-snapshot-id]');
      if (!btn) return;
      selectSnapshot_('history', btn.dataset.snapshotId).catch(err => {
        console.warn(err);
        setStatus(`Unable to load history snapshot. ${err.message}`, true);
      });
    });

    themeEl.addEventListener('change', () => applyTheme_(themeEl.value));
    sportEl.addEventListener('change', async () => {
      resetSnapshotSelectionsForNewTable_();
      syncSportPickerUi_();
      syncExportPreviewSportToCurrent_();
      await refreshSeasonYearOptions_({ preserveValue: selectedRpiYear_() });
      reloadCurrentBoardForSelection_();
    });
    classEl.addEventListener('change', () => {
      resetSnapshotSelectionsForNewTable_();
      syncClassPickerUi_();
      syncExportPreviewClassesToCurrent_();
      reloadCurrentBoardForSelection_();
    });
    yearEl.addEventListener('change', () => {
      syncYearPickerUi_();
      reloadCurrentBoardForSelection_();
    });
    loadBtn.addEventListener('click', loadRankings);
    exportBtn.addEventListener('click', exportPlayoffBoardPng_);

    function currentViewMode_() {
      if (document.body.classList.contains('playoff-mode')) return 'playoff';
      if (document.body.classList.contains('regions-mode')) return 'regions';
      if (document.body.classList.contains('east-west-mode')) return 'east-west';
      if (document.body.classList.contains('rankings-mode')) return 'rankings';
      return '';
    }

    let selectionReloadToken_ = 0;
    async function reloadCurrentBoardForSelection_() {
      const mode = currentViewMode_();
      if (!mode) return;

      const token = ++selectionReloadToken_;
      const mapWasOpen = eastWestMapOverlay.classList.contains('open');
      if (mode === 'playoff') {
        await buildPlayoffView_();
      } else if (mode === 'regions') {
        await buildRegionView_();
      } else if (mode === 'east-west') {
        await buildEastWestLineView_({ openMapAfter: mapWasOpen });
      } else {
        await loadRankings();
      }

      if (token !== selectionReloadToken_) return;
      if (mapWasOpen && mode !== 'east-west' && eastWestLineMapState_ && eastWestMapOverlay.classList.contains('open')) {
        await renderEastWestMap_();
      }
    }

    // View builders keep each board mode reload path in one place.
    async function buildEastWestLineView_(options = {}) {
      const openMapAfter = Boolean(options.openMapAfter);
      setBoardActionsDisabled_(true);
      updatedText.textContent = '';
      setStatus(`Building ${classEl.value} East/West line...`);
      setViewMode_('east-west');
      setBoardLoading_(true, 'Loading East/West line...', `${sportEl.value} ${classEl.value}`);
      await nextPaint_();

      try {
        const { sport, classification, rows, rpiResult } = await getMergedRowsForCurrentSelection_();
        setBoardLoading_(true, 'Rendering East/West line...', 'Sorting eligible teams by longitude');
        await nextPaint_();
        const lineData = buildEastWestLineRows_(rows, classification);
        setMainHeaderBlank();
        renderEastWestLine_(lineData, classification, sport);
        armImageFallbacks_(tbody);
        setUpdatedFromRpi_(rpiResult);
        await idleFrame_();
        const oddText = lineData.isOdd ? ` Extra team to ${lineData.extraSide === 'east' ? 'East' : 'West'}.` : '';
        setStatus(`${lineData.total} playoff teams: East ${lineData.east.length}, West ${lineData.west.length}.${oddText}`);
        if (openMapAfter) await openEastWestMap_();
      } catch (err) {
        console.error(err);
        restoreMainHeader();
        tbody.innerHTML = `<tr><td colspan="${MAIN_TABLE_COLSPAN_}" class="muted">Unable to build East/West line.</td></tr>`;
        setStatus(`${err.message}. If this is a browser CORS block, you'll need a tiny proxy/API layer.`, true);
      } finally {
        setBoardLoading_(false);
        setBoardActionsDisabled_(false);
      }
    }

    eastWestLineBtn.addEventListener('click', buildEastWestLineView_);
    viewMapBtn.addEventListener('click', async () => {
      const mapMatchesCurrent = eastWestLineMapState_
        && eastWestLineMapState_.classification === classEl.value
        && eastWestLineMapState_.sportLabel === sportEl.value
        && eastWestLineMapState_.year === selectedRpiYear_();
      if (mapMatchesCurrent) {
        await openEastWestMap_();
      } else {
        await buildEastWestLineView_({ openMapAfter: true });
      }
    });
    eastWestExtraEast.addEventListener('change', async () => {
      syncOddTeamSplitToggleUi_();
      if (eastWestMapOverlay.classList.contains('open') && eastWestLineMapState_) {
        await refreshEastWestSplitFromCurrentState_();
      } else if (document.body.classList.contains('east-west-mode')) {
        buildEastWestLineView_();
      } else if (document.body.classList.contains('regions-mode')) {
        regionBtn.click();
      } else if (document.body.classList.contains('playoff-mode')) {
        playoffBtn.click();
      }
    });

    async function buildRegionView_() {
      setBoardActionsDisabled_(true);
      updatedText.textContent = '';
      setStatus(`Building ${classEl.value} region standings...`);
      setViewMode_('regions');
      setBoardLoading_(true, 'Loading region standings...', `${sportEl.value} ${classEl.value}`);
      await nextPaint_();

      try {
        const { sport, classification, rows, rpiResult } = await getMergedRowsForCurrentSelection_();
        setBoardLoading_(true, 'Rendering region standings...', 'Splitting East and West regions');
        await nextPaint_();
        const regionData = buildRegionRows_(rows, classification);
        setMainHeaderBlank();
        renderRegionRows(regionData, classification, sport);
        armImageFallbacks_(tbody);
        setUpdatedFromRpi_(rpiResult);
        await idleFrame_();
        setStatus(`Region standings for ${regionData.total} playoff teams.`);
      } catch (err) {
        console.error(err);
        restoreMainHeader();
        tbody.innerHTML = `<tr><td colspan="${MAIN_TABLE_COLSPAN_}" class="muted">Unable to load region standings.</td></tr>`;
        setStatus(`${err.message}. If this is a browser CORS block, you'll need a tiny proxy/API layer.`, true);
      } finally {
        setBoardLoading_(false);
        setBoardActionsDisabled_(false);
      }
    }

    async function buildPlayoffView_() {
      setBoardActionsDisabled_(true);
      updatedText.textContent = '';
      setStatus(`Building ${classEl.value} playoff picture...`);
      setViewMode_('playoff');
      setBoardLoading_(true, 'Loading playoff picture...', `${sportEl.value} ${classEl.value}`);
      await nextPaint_();

      try {
        const { sport, classification, rows, rpiResult } = await getMergedRowsForCurrentSelection_();
        setBoardLoading_(true, 'Rendering playoff picture...', 'Building projected first two rounds');
        await nextPaint_();
        const regionData = buildRegionRows_(rows, classification);
        setMainHeaderBlank();
        renderPlayoffPicture(regionData, classification, sport);
        armImageFallbacks_(tbody);
        setUpdatedFromRpi_(rpiResult);
        await idleFrame_();
        setStatus(`${regionData.total} playoff teams.`);
      } catch (err) {
        console.error(err);
        restoreMainHeader();
        tbody.innerHTML = `<tr><td colspan="${MAIN_TABLE_COLSPAN_}" class="muted">Unable to build playoff picture.</td></tr>`;
        setStatus(`${err.message}. If this is a browser CORS block, you'll need a tiny proxy/API layer.`, true);
      } finally {
        setBoardLoading_(false);
        setBoardActionsDisabled_(false);
      }
    }

    regionBtn.addEventListener('click', buildRegionView_);
    playoffBtn.addEventListener('click', buildPlayoffView_);
    refreshSeasonYearOptions_().catch(err => console.warn('Unable to load fallback RPI years:', err));
