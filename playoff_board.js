// Core app logic for the playoff board.
//
// Refactor note:
// This file still owns most application behavior, but the logic is grouped into
// labeled sections so future prompted changes can land in the right area faster
// without rewriting stable behavior.

// ============================================================================
// 1. Config, constants, DOM references, and shared UI state
// ============================================================================

const SHEET_ID = '1JmclT_tkhJC1g71NWB3z6SBV8dvTdKV3Cu9Q3f6FxIE';
    const TEAMDETAILS_GID = '510129710';
    const OFFICIAL_RPI_FALLBACK_GID = '1999286146';
    const API_BASE_URL_ = String(window.RPI_APP_CONFIG?.apiBaseUrl || '').replace(/\/+$/g, '');

    function compileTeamNameNormalizeConfig_(raw = {}) {
      return {
        phraseReplacements: (Array.isArray(raw.phraseReplacements) ? raw.phraseReplacements : [])
          .map(rule => ({
            from: new RegExp(String(rule.pattern || ''), String(rule.flags || 'g')),
            to: String(rule.to || '')
          }))
          .filter(rule => rule.from.source),
        removePhrases: Array.isArray(raw.removePhrases) ? raw.removePhrases : [],
        removeTokens: Array.isArray(raw.removeTokens) ? raw.removeTokens : [],
        removeTrailingSchool: raw.removeTrailingSchool !== false,
        removeLeadingThe: raw.removeLeadingThe !== false,
        acronymOverrides: raw.acronymOverrides || {}
      };
    }

    function loadTeamNameNormalizeConfig_() {
      try {
        const req = new XMLHttpRequest();
        req.open('GET', './supabase/functions/_shared/team-name-normalize.config.json', false);
        req.send(null);
        if (req.status >= 200 && req.status < 300) {
          return compileTeamNameNormalizeConfig_(JSON.parse(req.responseText));
        }
      } catch (err) {
        console.warn('Team name normalize config unavailable; using built-in fallback.', err);
      }
      return compileTeamNameNormalizeConfig_({
        phraseReplacements: [
          { pattern: '\\bsaint\\b', flags: 'ig', to: 'St' },
          { pattern: '\\bmount\\b', flags: 'ig', to: 'Mt' },
          { pattern: '\\bfort\\b', flags: 'ig', to: 'Ft' },
          { pattern: '\\bnorthwest\\b', flags: 'ig', to: 'NW' },
          { pattern: '\\bnortheast\\b', flags: 'ig', to: 'NE' },
          { pattern: '\\bsouthwest\\b', flags: 'ig', to: 'SW' },
          { pattern: '\\bsoutheast\\b', flags: 'ig', to: 'SE' },
          { pattern: '\\bpreparatory\\b', flags: 'ig', to: 'Prep' },
          { pattern: '&', flags: 'g', to: ' and ' },
          { pattern: '-', flags: 'g', to: ' ' }
        ],
        removePhrases: [
          'high school', 'highschool', 'junior senior', 'middle and high school', 'middle and highschool',
          'middle and', 'andhigh school', 'and Sustainability', 'Collegiate and Technical Academy', 'of Technology and Arts', 'Classical Academy'
        ],
        removeTokens: ['junior', 'senior', 'stem', 'magnet', 'andhighschool'],
        removeTrailingSchool: true,
        removeLeadingThe: true,
        acronymOverrides: {
          'north carolina school of science and mathematics durham': 'NCSSM Durham',
          'north carolina school of science and mathematics morganton': 'NCSSM Morganton',
          'american leadership academy johnston': 'American Leadership - Johnston'
        }
      });
    }

    const APP = {
        //TEAM OPT OUT CONFIG
      OptOut: {
        all: [],
        football: [],
        baseball: ["Phoenix Academy", "KIPP Pride","Rocky Mt Prep", "Raleigh Charter"],
        softball: ["Bishop McGuinness","Millennium Charter Academy","Wilson Prep Academy","Rocky Mt Prep","KIPP Pride","WSPA","Weldon","NCLA" ],
        volleyball: [],
        boys: [], girls: [],
        girls_soccer: ["CPLA","Howard"],
        boys_soccer: []
      },
      FetchRpi: {
        sportUrls: {
          basketball: 'https://www.nchsaa.org/sports/basketball/',
          football: 'https://www.nchsaa.org/sports/football/',
          baseball: 'https://www.nchsaa.org/sports/baseball/',
          softball: 'https://www.nchsaa.org/sports/softball/',
          volleyball: 'https://www.nchsaa.org/sports/volleyball/',
          girlsSoccer: 'https://www.nchsaa.org/sports/womens-soccer/',
          boysSoccer: 'https://www.nchsaa.org/sports/mens-soccer/'
        },
        basketballAnchorGirls: '<h3>Girls Basketball RPI standings</h3>',
        basketballAnchorBoys: '<h3>Boys Basketball RPI standings</h3>'
      },
      TeamNameNormalize: loadTeamNameNormalizeConfig_()
    };

    const NC_MAP_DEFAULT_LATITUDE_ = 35.34651886289863;
    const NC_BOUNDARY_GEOJSON_URL_ = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query?where=STATE%3D%2737%27&outFields=STATE,NAME&outSR=4326&f=geojson";
    const NC_COUNTIES_GEOJSON_URL_ = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/13/query?where=STATE%3D%2737%27&outFields=STATE,NAME&outSR=4326&f=geojson&geometryPrecision=3&maxAllowableOffset=0.01";
    const NC_BOUNDARY_ = [
      [-84.32, 35.21], [-83.96, 35.32], [-83.64, 35.46], [-83.22, 35.58],
      [-82.86, 35.73], [-82.49, 35.92], [-82.14, 36.12], [-81.74, 36.34],
      [-81.66, 36.59], [-80.72, 36.56], [-79.78, 36.55], [-78.86, 36.54],
      [-77.92, 36.54], [-76.96, 36.55], [-75.92, 36.55], [-75.74, 36.22],
      [-75.57, 35.79], [-75.47, 35.31], [-75.64, 35.05], [-76.05, 34.92],
      [-76.52, 34.78], [-77.03, 34.58], [-77.42, 34.39], [-77.88, 33.92],
      [-78.54, 33.86], [-79.08, 34.19], [-79.45, 34.45], [-79.82, 34.81],
      [-80.78, 34.82], [-81.05, 35.04], [-81.36, 35.16], [-82.05, 35.18],
      [-82.78, 35.10], [-83.48, 35.00], [-84.32, 35.21]
    ];

    // Core page controls, overlays, and view containers.
    const sportEl = document.getElementById('sport');
    const classEl = document.getElementById('classification');
    const classPicker = document.getElementById('classPicker');
    const classPickerBtn = document.getElementById('classPickerBtn');
    const classPickerBtnText = document.getElementById('classPickerBtnText');
    const classPickerMenu = document.getElementById('classPickerMenu');
    const yearEl = document.getElementById('seasonYear');
    const yearPicker = document.getElementById('yearPicker');
    const yearPickerBtn = document.getElementById('yearPickerBtn');
    const yearPickerBtnText = document.getElementById('yearPickerBtnText');
    const yearPickerMenu = document.getElementById('yearPickerMenu');
    const themeEl = document.getElementById('theme');
    const appSettingsBtn = document.getElementById('appSettingsBtn');
    const appSettingsPanel = document.getElementById('appSettingsPanel');
    const appSettingsCloseBtn = document.getElementById('appSettingsCloseBtn');
    const performanceModeToggle = document.getElementById('performanceModeToggle');
    const compareSnapshotCalendarBtn = document.getElementById('compareSnapshotCalendarBtn');
    const compareSnapshotDate = document.getElementById('compareSnapshotDate');
    const compareSnapshotResetBtn = document.getElementById('compareSnapshotResetBtn');
    const compareSnapshotList = document.getElementById('compareSnapshotList');
    const showLastChangeToggle = document.getElementById('showLastChangeToggle');
    const historySnapshotCalendarBtn = document.getElementById('historySnapshotCalendarBtn');
    const historySnapshotDate = document.getElementById('historySnapshotDate');
    const historySnapshotResetBtn = document.getElementById('historySnapshotResetBtn');
    const historySnapshotList = document.getElementById('historySnapshotList');
    const loadBtn = document.getElementById('loadBtn');
    const regionBtn = document.getElementById('regionBtn');
    const playoffBtn = document.getElementById('playoffBtn');
    const eastWestLineBtn = document.getElementById('eastWestLineBtn');
    const viewMapBtn = document.getElementById('viewMapBtn');
    const eastWestExtraEast = document.getElementById('eastWestExtraEast');
    const playoffTeamLimit = document.getElementById('playoffTeamLimit');
    const exportBtn = document.getElementById('exportBtn');
    const BOARD_ACTION_BUTTONS_ = [loadBtn, regionBtn, playoffBtn, eastWestLineBtn, viewMapBtn, exportBtn];
    const statusText = document.getElementById('statusText');
    const updatedText = document.getElementById('updatedText');
    const tbody = document.getElementById('tbody');
    const eastWestMapOverlay = document.getElementById('eastWestMapOverlay');
    const eastWestMapCloseBtn = document.getElementById('eastWestMapCloseBtn');
    const eastWestMapKicker = document.getElementById('eastWestMapKicker');
    const eastWestMapTitle = document.getElementById('eastWestMapTitle');
    const eastWestMapSubtitle = document.getElementById('eastWestMapSubtitle');
    const eastWestMapClass = document.getElementById('eastWestMapClass');
    const eastWestMapClassPicker = document.getElementById('eastWestMapClassPicker');
    const eastWestMapClassPickerBtn = document.getElementById('eastWestMapClassPickerBtn');
    const eastWestMapClassPickerText = document.getElementById('eastWestMapClassPickerText');
    const eastWestMapClassPickerMenu = document.getElementById('eastWestMapClassPickerMenu');
    const eastWestMapSport = document.getElementById('eastWestMapSport');
    const eastWestMapSportPicker = document.getElementById('eastWestMapSportPicker');
    const eastWestMapSportPickerBtn = document.getElementById('eastWestMapSportPickerBtn');
    const eastWestMapSportPickerIcon = document.getElementById('eastWestMapSportPickerIcon');
    const eastWestMapSportPickerText = document.getElementById('eastWestMapSportPickerText');
    const eastWestMapSportPickerMenu = document.getElementById('eastWestMapSportPickerMenu');
    const eastWestMapCanvas = document.getElementById('eastWestMapCanvas');
    const eastWestMapInfoCards = document.getElementById('eastWestMapInfoCards');
    const eastWestMapContextMenu = document.getElementById('eastWestMapContextMenu');
    const exportPreviewOverlay = document.getElementById('exportPreviewOverlay');
    const closeExportPreviewBtn = document.getElementById('closeExportPreviewBtn');
    const downloadAllExportsBtn = document.getElementById('downloadAllExportsBtn');
    const buildExportPreviewBtn = document.getElementById('buildExportPreviewBtn');
    const clearExportPreviewBtn = document.getElementById('clearExportPreviewBtn');
    const exportPreviewClassPicker = document.getElementById('exportPreviewClassPicker');
    const exportPreviewClassMenuBtn = document.getElementById('exportPreviewClassMenuBtn');
    const exportPreviewClassSummary = document.getElementById('exportPreviewClassSummary');
    const exportPreviewClassMenu = document.getElementById('exportPreviewClassMenu');
    const exportPreviewSelectAllClasses = document.getElementById('exportPreviewSelectAllClasses');
    const exportPreviewClassList = document.getElementById('exportPreviewClassList');
    const exportPreviewSport = document.getElementById('exportPreviewSport');
    const exportPreviewTypeFilter = document.getElementById('exportPreviewTypeFilter');
    const exportPreviewStatus = document.getElementById('exportPreviewStatus');
    const exportPreviewGrid = document.getElementById('exportPreviewGrid');
    const teamScheduleOverlay = document.getElementById('teamScheduleOverlay');
    const teamScheduleCloseBtn = document.getElementById('teamScheduleCloseBtn');
    const teamScheduleContent = document.getElementById('teamScheduleContent');
    const teamLogOverlay = document.getElementById('teamLogOverlay');
    const teamLogCloseBtn = document.getElementById('teamLogCloseBtn');
    const teamLogCalendarBtn = document.getElementById('teamLogCalendarBtn');
    const teamLogViewBtn = document.getElementById('teamLogViewBtn');
    const teamLogDateInput = document.getElementById('teamLogDateInput');
    const teamLogContent = document.getElementById('teamLogContent');
    const tableCard = document.querySelector('.table-card');
    const boardLoadingOverlay = document.getElementById('boardLoadingOverlay');
    const boardLoadingTitle = document.getElementById('boardLoadingTitle');
    const boardLoadingSubtitle = document.getElementById('boardLoadingSubtitle');
    const MAIN_TABLE_COLSPAN_ = 9;
    const defaultHeaderLabels = ['Rank', 'School', 'Record', 'WP', 'OWP', 'OOWP', 'RPI'];
    
    
    
    const sportPicker = document.getElementById('sportPicker');
const sportPickerBtn = document.getElementById('sportPickerBtn');
const sportPickerBtnIcon = document.getElementById('sportPickerBtnIcon');
const sportPickerBtnText = document.getElementById('sportPickerBtnText');
    const sportPickerMenu = document.getElementById('sportPickerMenu');
    // Picker option caches and view-level state.
    let classPickerOptions = [];
    let yearPickerOptions = [];
    let eastWestMapClassPickerOptions = [];
    let sportPickerOptions = [];
    let eastWestMapSportPickerOptions = [];
    const teamScheduleCache_ = new Map();
    let teamScheduleRequestToken_ = 0;
    let teamLogRequestToken_ = 0;
    let teamLogCurrentRow_ = null;
    let teamLogCurrentResult_ = null;
    let teamLogSelectedDate_ = '';
let teamLogExpandedEntryKey_ = '';
let teamLogViewMode_ = 'graph';
let teamLogRange_ = 'ALL';
let teamLogGraphZoom_ = 1;
let teamLogGraphPanX_ = 0;
let teamLogGraphPanY_ = 0;
let teamLogSelectorClass_ = '';
let teamLogSelectorRegion_ = 'both';
let teamLogTeamSearch_ = '';
let teamLogSelectorRows_ = [];
let teamLogSelectorLoading_ = false;
let teamLogTeamMenuOpen_ = false;
let teamLogSelectorRequestToken_ = 0;
let teamLogShowAllTeams_ = false;
let teamLogSelectedTeamKey_ = '';
let teamLogGraphAllSeries_ = [];
let teamLogGraphAllLoading_ = false;
let teamLogGraphAllRequestToken_ = 0;
let compareSnapshotId_ = '';
let compareSnapshotLabel_ = '';
let historySnapshotId_ = '';
let historySnapshotLabel_ = '';
const TEAM_LOG_ALL_TEAMS_VALUE_ = '__all_teams__';
const teamLogSelectorCache_ = new Map();
const teamLogSeriesCache_ = new Map();
const teamLogSnapshotBundleCache_ = new Map();

// Team Log graph range metadata and sport-display helpers.
const TEAM_LOG_GRAPH_RANGES_ = [
  { key: '1D', label: '1D', days: 1 },
  { key: '7D', label: '7D', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '2M', label: '2M', days: 60 },
  { key: '3M', label: '3M', days: 90 },
  { key: 'ALL', label: 'All', days: null }
];

const SPORT_UI_ = {
  'Football': { emoji: '\u{1F3C8}' },
  'Baseball': { emoji: '\u26BE' },
  'Softball': { emoji: '\u{1F94E}' },
  'Volleyball': { emoji: '\u{1F3D0}' },
  'Boys Basketball': { emoji: '\u{1F3C0}' },
  'Girls Basketball': {
    emoji: '\u{1F3C0}',
    image: 'https://iili.io/BgQ9nqb.md.png'
  },
  'Girls Soccer': {
    emoji: '\u26BD',
    image: 'https://iili.io/BC46ul2.png'
  },
  'Boys Soccer': {
    emoji: '\u26BD'
  }
};

const SPORT_KEY_LABEL_ = {
  football: 'Football',
  baseball: 'Baseball',
  softball: 'Softball',
  volleyball: 'Volleyball',
  boys: 'Boys Basketball',
  girls: 'Girls Basketball',
  girls_soccer: 'Girls Soccer',
  boys_soccer: 'Boys Soccer'
};

// ============================================================================
// 2. Config-backed display metadata and lightweight picker helpers
// ============================================================================

function sportUiKey_(label) {
  const raw = String(label || '').toLowerCase();
  return Object.keys(SPORT_UI_).find(key => raw.includes(key.toLowerCase())) || '';
}

function stripHtml_(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function sportImageHtml_(className, src, extraAttrs = '') {
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(src)}" alt=""${extraAttrs}>`;
}

function sportPickerIconHtml_(value) {
  const meta = SPORT_UI_[sportUiKey_(value)];
  if (!meta) return '';
  return meta.image ? sportImageHtml_('sport-picker-option-img', meta.image) : escapeHtml(meta.emoji || '');
}

function sportPickerOptionsHtml_(sourceSelect) {
  return [...sourceSelect.options].map(option => {
    const value = option.value;
    return `
      <button class="sport-picker-option" type="button" data-value="${escapeHtml(value)}" role="option">
        <span class="sport-picker-option-icon">${sportPickerIconHtml_(value)}</span>
        <span class="sport-picker-option-text">${escapeHtml(value)}</span>
      </button>`;
  }).join('');
}

function syncSportPickerOptionStates_(options, value) {
  options.forEach(btn => {
    const isSelected = btn.dataset.value === value;
    btn.classList.toggle('is-selected', isSelected);
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
}

function classPickerOptionsHtml_(sourceSelect) {
  return [...sourceSelect.options].map(option => {
    const value = option.value || option.textContent;
    const label = option.textContent || value;
    return `<button class="class-picker-option" type="button" data-value="${escapeHtml(value)}" role="option">${escapeHtml(label)}</button>`;
  }).join('');
}

function syncClassPickerOptionStates_(options, value) {
  options.forEach(btn => {
    const isSelected = btn.dataset.value === value;
    btn.classList.toggle('is-selected', isSelected);
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });
}

function renderSportPickerOptions_() {
  sportPickerMenu.innerHTML = sportPickerOptionsHtml_(sportEl);
  sportPickerOptions = Array.from(sportPickerMenu.querySelectorAll('.sport-picker-option'));
}

function renderClassPickerOptions_() {
  classPickerMenu.innerHTML = classPickerOptionsHtml_(classEl);
  classPickerOptions = Array.from(classPickerMenu.querySelectorAll('.class-picker-option'));
}

function renderYearPickerOptions_() {
  if (!yearPickerMenu) return;
  yearPickerMenu.innerHTML = classPickerOptionsHtml_(yearEl);
  yearPickerOptions = Array.from(yearPickerMenu.querySelectorAll('.class-picker-option'));
}

function renderEastWestMapClassPickerOptions_() {
  if (!eastWestMapClassPickerMenu) return;
  eastWestMapClassPickerMenu.innerHTML = classPickerOptionsHtml_(eastWestMapClass);
  eastWestMapClassPickerOptions = Array.from(eastWestMapClassPickerMenu.querySelectorAll('.class-picker-option'));
}

function renderEastWestMapSportPickerOptions_() {
  if (!eastWestMapSportPickerMenu) return;
  eastWestMapSportPickerMenu.innerHTML = sportPickerOptionsHtml_(eastWestMapSport);
  eastWestMapSportPickerOptions = Array.from(eastWestMapSportPickerMenu.querySelectorAll('.sport-picker-option'));
}

function syncSportPickerUi_() {
  const value = sportEl.value;
  sportPickerBtnIcon.innerHTML = sportPickerIconHtml_(value);
  sportPickerBtnText.textContent = value;
  syncSportPickerOptionStates_(sportPickerOptions, value);
}

function syncClassPickerUi_() {
  const value = classEl.value;
  classPickerBtnText.textContent = value;
  syncClassPickerOptionStates_(classPickerOptions, value);
}

function syncYearPickerUi_() {
  if (!yearPickerBtn) return;
  const option = [...yearEl.options].find(opt => opt.value === yearEl.value);
  yearPickerBtnText.textContent = option?.textContent || yearEl.value || 'Live';
  syncClassPickerOptionStates_(yearPickerOptions, yearEl.value);
}

function syncEastWestMapClassPickerUi_() {
  if (!eastWestMapClassPickerBtn) return;
  const value = eastWestMapClass?.value || classEl.value;
  eastWestMapClassPickerText.textContent = value;
  syncClassPickerOptionStates_(eastWestMapClassPickerOptions, value);
}

function syncEastWestMapSportPickerUi_() {
  if (!eastWestMapSportPickerBtn) return;
  const value = eastWestMapSport?.value || sportEl.value;
  eastWestMapSportPickerIcon.innerHTML = sportPickerIconHtml_(value);
  eastWestMapSportPickerText.textContent = value;
  syncSportPickerOptionStates_(eastWestMapSportPickerOptions, value);
}

function setSportPickerOpen_(isOpen) {
  sportPicker.classList.toggle('open', isOpen);
  sportPickerMenu.hidden = !isOpen;
  sportPickerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function setClassPickerOpen_(isOpen) {
  classPicker.classList.toggle('open', isOpen);
  classPickerMenu.hidden = !isOpen;
  classPickerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function setYearPickerOpen_(isOpen) {
  if (!yearPicker) return;
  yearPicker.classList.toggle('open', isOpen);
  yearPickerMenu.hidden = !isOpen;
  yearPickerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function setEastWestMapClassPickerOpen_(isOpen) {
  if (!eastWestMapClassPicker) return;
  eastWestMapClassPicker.classList.toggle('open', isOpen);
  eastWestMapClassPickerMenu.hidden = !isOpen;
  eastWestMapClassPickerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function setEastWestMapSportPickerOpen_(isOpen) {
  if (!eastWestMapSportPicker) return;
  eastWestMapSportPicker.classList.toggle('open', isOpen);
  eastWestMapSportPickerMenu.hidden = !isOpen;
  eastWestMapSportPickerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// ============================================================================
// 3. Shared board UI state, status text, and layout helpers
// ============================================================================
    function setViewMode_(mode) {
      document.body.classList.remove('rankings-mode', 'regions-mode', 'playoff-mode', 'east-west-mode');
      document.body.classList.remove('has-rpi-changes');
      document.body.classList.add(`${mode}-mode`);
    }

    function mainHeaderCells_() {
      return [...document.querySelectorAll('.table-card > .table-scroll > table > thead th')];
    }

    function setMainHeaderLabels_(labels) {
      mainHeaderCells_().forEach((th, i) => {
        const hasLabel = i < labels.length;
        th.hidden = !hasLabel;
        th.textContent = hasLabel ? labels[i] : '';
      });
    }

    function setMainHeaderBlank() {
      mainHeaderCells_().forEach(th => {
        th.hidden = false;
        th.textContent = '';
      });
    }

    function applyTheme_(themeName) {
      const safe = String(themeName || 'bigred').toLowerCase();
      const targetClass = `theme-${safe}`;
      if (document.body.classList.contains(targetClass)) return;
      document.body.classList.remove('theme-carbon', 'theme-midnight', 'theme-slate', 'theme-gold', 'theme-bigred', 'theme-royal', 'theme-emerald', 'theme-plum');
      document.body.classList.add(targetClass);
      try { localStorage.setItem('nchsaa-theme', safe); } catch (e) {}
    }

    function applyPerformanceMode_(enabled, persist = false) {
      const active = Boolean(enabled);
      document.body.classList.toggle('performance-mode', active);
      if (performanceModeToggle) performanceModeToggle.checked = active;
      if (!persist) return;
      try {
        localStorage.setItem('nchsaa-performance-mode', active ? '1' : '0');
      } catch (e) {}
    }

    function restoreMainHeader() { setMainHeaderLabels_(defaultHeaderLabels); }

    function setStatus(msg, isError = false) {
      statusText.textContent = msg;
      statusText.className = isError ? 'status error' : 'status';
    }

    function setUpdatedFromRpi_(rpiResult, fallback = '') {
      if (rpiResult?.source === 'fallback' && rpiResult.year) ensureSeasonYearOption_(rpiResult.year);
      const prefix = rpiResult?.source === 'snapshot_history'
        ? 'History: '
        : (rpiResult?.source === 'fallback' ? 'Fallback: ' : 'Last updated: ');
      const base = rpiResult?.lastUpdated ? `${prefix}${rpiResult.lastUpdated}` : fallback;
      const previous = rpiResult?.changeCompare?.previousFetchedAt;
      const compared = compareSnapshotLabel_ || (previous ? new Date(previous).toLocaleString() : '');
      const usingSnapshotTools = Boolean(compareSnapshotId_ || historySnapshotId_);
      const showCompared = Boolean(previous && compared) && (!showLastChangeToggle?.checked || usingSnapshotTools);
      updatedText.textContent = showCompared ? `${base} | Compared: ${compared}` : base;
    }

    function snapshotButtonLabel_(snapshot) {
      if (!snapshot?.fetchedAt) return 'Unknown Time';
      return new Date(snapshot.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    function snapshotFullLabel_(snapshot) {
      if (!snapshot?.fetchedAt) return 'Selected snapshot';
      return new Date(snapshot.fetchedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    }

    function renderSnapshotList_(kind, snapshots = []) {
      const isCompare = kind === 'compare';
      const list = isCompare ? compareSnapshotList : historySnapshotList;
      const activeId = isCompare ? compareSnapshotId_ : historySnapshotId_;
      if (!list) return;

      if (!snapshots.length) {
        list.innerHTML = `<span class="snapshot-empty">${isCompare ? 'No compare snapshots found for that date.' : 'No history snapshots found for that date.'}</span>`;
        return;
      }

      list.innerHTML = snapshots.map(snapshot => {
        const active = snapshot.id === activeId ? ' is-active' : '';
        const tag = snapshot.testMode ? 'TEST' : `${snapshot.rowCount || 0} rows`;
        return `
          <button class="snapshot-time-btn${active}" type="button" data-snapshot-kind="${escapeHtml(kind)}" data-snapshot-id="${escapeHtml(snapshot.id)}">
            <span>${escapeHtml(snapshotButtonLabel_(snapshot))}</span>
            <span>${escapeHtml(tag)}</span>
          </button>`;
      }).join('');
    }

    function snapshotDateParams_(dateValue) {
      return {
        sport: sportEl.value,
        classification: classEl.value,
        date: dateValue,
        tzOffset: String(new Date().getTimezoneOffset())
      };
    }

    async function loadSnapshotListForDate_(kind, dateValue) {
      const isCompare = kind === 'compare';
      const list = isCompare ? compareSnapshotList : historySnapshotList;
      if (!dateValue || !list) return;
      list.innerHTML = '<span class="snapshot-empty">Loading snapshots...</span>';
      try {
        const result = await requestSnapshotApiJson_('/rpi-snapshots/list', snapshotDateParams_(dateValue));
        renderSnapshotList_(kind, result?.snapshots || []);
      } catch (err) {
        console.warn('Snapshot list unavailable:', err);
        list.innerHTML = `<span class="snapshot-empty">Snapshot server unavailable.</span>`;
      }
    }

    async function selectSnapshot_(kind, snapshotId) {
      const result = await requestSnapshotApiJson_('/rpi-snapshots/snapshot', { id: snapshotId });
      const snapshot = result?.snapshot;
      if (!snapshot) throw new Error('Snapshot not found');

      if (kind === 'compare') {
        compareSnapshotId_ = snapshot.id;
        compareSnapshotLabel_ = snapshotFullLabel_(snapshot);
        if (compareSnapshotDate?.value) await loadSnapshotListForDate_('compare', compareSnapshotDate.value);
      } else {
        historySnapshotId_ = snapshot.id;
        historySnapshotLabel_ = snapshotFullLabel_(snapshot);
        if (historySnapshotDate?.value) await loadSnapshotListForDate_('history', historySnapshotDate.value);
      }

      await reloadCurrentBoardForSelection_();
    }

    async function resetCompareSnapshot_() {
      compareSnapshotId_ = '';
      compareSnapshotLabel_ = '';
      if (compareSnapshotDate) compareSnapshotDate.value = '';
      if (compareSnapshotList) compareSnapshotList.innerHTML = '<span class="snapshot-empty">Comparing to previous snapshot.</span>';
      await reloadCurrentBoardForSelection_();
    }

    async function resetHistorySnapshot_() {
      historySnapshotId_ = '';
      historySnapshotLabel_ = '';
      if (historySnapshotDate) historySnapshotDate.value = '';
      if (historySnapshotList) historySnapshotList.innerHTML = '<span class="snapshot-empty">Loading live RPI tables.</span>';
      await reloadCurrentBoardForSelection_();
    }

    function resetSnapshotSelectionsForNewTable_() {
      compareSnapshotId_ = '';
      compareSnapshotLabel_ = '';
      historySnapshotId_ = '';
      historySnapshotLabel_ = '';
      if (compareSnapshotDate) compareSnapshotDate.value = '';
      if (historySnapshotDate) historySnapshotDate.value = '';
      if (compareSnapshotList) compareSnapshotList.innerHTML = '<span class="snapshot-empty">Comparing to previous snapshot.</span>';
      if (historySnapshotList) historySnapshotList.innerHTML = '<span class="snapshot-empty">Loading live RPI tables.</span>';
    }

    function openDatePicker_(input) {
      if (!input) return;
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    }

    function setBoardActionsDisabled_(disabled, extraButtons = []) {
      BOARD_ACTION_BUTTONS_.concat(extraButtons).forEach(btn => {
        if (btn) btn.disabled = disabled;
      });
    }

    function setBoardLoading_(isLoading, title = 'Loading board...', subtitle = 'Building the latest view') {
      if (!tableCard || !boardLoadingOverlay) return;
      tableCard.classList.toggle('is-loading', Boolean(isLoading));
      boardLoadingOverlay.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
      if (boardLoadingTitle) boardLoadingTitle.textContent = title;
      if (boardLoadingSubtitle) boardLoadingSubtitle.textContent = subtitle;
    }

    function nextPaint_() {
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function idleFrame_(timeout = 80) {
      return new Promise(resolve => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(resolve, { timeout });
        } else {
          setTimeout(resolve, 16);
        }
      });
    }

    function escapeHtml(v) {
      return String(v ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function normalizeMaxPrepsUrl_(href) {
      const raw = String(href || '').trim();
      if (!raw) return '';
      try {
        const url = new URL(raw, 'https://www.maxpreps.com');
        if (!/maxpreps\.com$/i.test(url.hostname)) return '';
        url.protocol = 'https:';
        url.hash = '';
        if (!/\/local\/team\/home\.aspx$/i.test(url.pathname)) url.search = '';
        return url.toString();
      } catch (_) {
        return '';
      }
    }

    const MAXPREPS_SPORT_SEGMENT_ = {
      football: 'football',
      baseball: 'baseball',
      softball: 'softball',
      volleyball: 'volleyball',
      boys: 'basketball',
      girls: 'girls-basketball',
      girls_soccer: 'girls-soccer',
      boys_soccer: 'soccer'
    };

    function maxPrepsSportSegmentForKey_(sportKey) {
      return MAXPREPS_SPORT_SEGMENT_[sportKey] || '';
    }

    function maxPrepsScheduleUrl_(href, options = {}) {
      const normalized = normalizeMaxPrepsUrl_(href);
      if (!normalized) return '';
      try {
        const url = new URL(normalized);
        if (/\/local\/team\/home\.aspx$/i.test(url.pathname)) return url.toString();
        const sportKey = sportKeyFromLabel_(options.sport || sportEl?.value || '');
        let pathname = String(url.pathname || '').replace(/\/+$/g, '');
        if (!maxPrepsSportKeyFromUrl_(normalized)) {
          const sportSegment = maxPrepsSportSegmentForKey_(sportKey);
          if (sportSegment) pathname += `/${sportSegment}`;
        }
        pathname = maxPrepsPathWithSeason_(pathname, maxPrepsScheduleSeasonToken_(options));
        if (!/\/schedule$/i.test(pathname)) pathname += '/schedule';
        url.pathname = `${pathname}/`;
        return url.toString();
      } catch (_) {
        return normalized;
      }
    }

    function seasonYearInfo_(value) {
      const raw = String(value || '').trim();
      if (!raw || raw === 'live' || raw === 'history') return null;
      let m = raw.match(/\b(20\d{2})\s*[-/]\s*(\d{2,4})\b/);
      if (m) {
        const start = Number(m[1]);
        const endRaw = String(m[2]);
        const end = endRaw.length === 4 ? Number(endRaw) : Number(String(start).slice(0, 2) + endRaw.padStart(2, '0'));
        if (Number.isFinite(start) && Number.isFinite(end)) {
          return {
            start,
            end,
            label: `${start}-${String(end).slice(-2).padStart(2, '0')}`,
            token: `${String(start).slice(-2).padStart(2, '0')}-${String(end).slice(-2).padStart(2, '0')}`
          };
        }
      }
      m = raw.match(/\b(20\d{2})\b/);
      if (m) {
        const end = Number(m[1]);
        const start = end - 1;
        return {
          start,
          end,
          label: `${start}-${String(end).slice(-2).padStart(2, '0')}`,
          token: `${String(start).slice(-2).padStart(2, '0')}-${String(end).slice(-2).padStart(2, '0')}`
        };
      }
      return null;
    }

    function seasonYearLabel_(value) {
      return seasonYearInfo_(value)?.label || '';
    }

    function seasonYearToken_(value) {
      return seasonYearInfo_(value)?.token || '';
    }

    function seasonYearSortValue_(value) {
      const info = seasonYearInfo_(value);
      return info ? info.end : -Infinity;
    }

    function shiftSeasonYearLabel_(value, offset = 0) {
      const info = seasonYearInfo_(value);
      if (!info) return '';
      const start = info.start + offset;
      const end = info.end + offset;
      return `${start}-${String(end).slice(-2).padStart(2, '0')}`;
    }

    function maxPrepsScheduleSeasonToken_(options = {}) {
      return seasonYearToken_(options.year);
    }

    function maxPrepsPathWithSeason_(pathname, seasonToken = '') {
      let path = String(pathname || '').replace(/\/+$/g, '');
      path = path.replace(/\/schedule$/i, '');
      if (seasonToken) {
        path = path.replace(/\/\d{2}-\d{2}$/i, '');
        path += `/${seasonToken}`;
      }
      return path;
    }

    const MAXPREPS_URL_CACHE_KEY_ = 'nchsaa-maxpreps-url-cache-v1';
    let maxPrepsUrlCache_ = null;

    function maxPrepsCacheKey_(teamName, sportLabel) {
      const team = canonicalTeamName_(teamName);
      const sportKey = sportKeyFromLabel_(sportLabel);
      return team && sportKey ? `${sportKey}:${team}` : '';
    }

    function loadMaxPrepsUrlCache_() {
      if (maxPrepsUrlCache_) return maxPrepsUrlCache_;
      try {
        maxPrepsUrlCache_ = JSON.parse(localStorage.getItem(MAXPREPS_URL_CACHE_KEY_) || '{}') || {};
      } catch (_) {
        maxPrepsUrlCache_ = {};
      }
      return maxPrepsUrlCache_;
    }

    function saveMaxPrepsUrlCache_() {
      try {
        localStorage.setItem(MAXPREPS_URL_CACHE_KEY_, JSON.stringify(maxPrepsUrlCache_ || {}));
      } catch (_) {}
    }

    function maxPrepsSportKeyFromUrl_(url) {
      const s = String(url || '').toLowerCase();
      if (s.includes('/football/')) return 'football';
      if (s.includes('/baseball/')) return 'baseball';
      if (s.includes('/softball/')) return 'softball';
      if (s.includes('/volleyball/')) return 'volleyball';
      if (s.includes('/girls-basketball/')) return 'girls';
      if (s.includes('/basketball/')) return 'boys';
      if (s.includes('/girls-soccer/')) return 'girls_soccer';
      if (s.includes('/soccer/')) return 'boys_soccer';
      return '';
    }

    function maxPrepsUrlFromText_(value) {
      const s = String(value || '').replace(/&amp;/gi, '&').trim();
      if (!s) return '';
      const m = s.match(/https?:\/\/(?:www\.)?maxpreps\.com\/[^\s"'<>)]*/i);
      return m?.[0] ? normalizeMaxPrepsUrl_(m[0].replace(/[.,;]+$/g, '')) : '';
    }

    function sportKeyFromMaybeSportText_(value) {
      const v = String(value || '').toLowerCase();
      if (!/(football|baseball|softball|volleyball|basket|soccer|boys|girls|women|men)/.test(v)) return '';
      return sportKeyFromLabel_(v);
    }

    // ============================================================================
    // 4. Generic utility helpers plus Team Schedule card rendering
    // ============================================================================
    function cacheMaxPrepsUrl_(teamName, sportLabel, url) {
      const normalized = normalizeMaxPrepsUrl_(url);
      const key = maxPrepsCacheKey_(teamName, sportLabel);
      if (!key || !normalized) return '';
      const cache = loadMaxPrepsUrlCache_();
      if (cache[key] !== normalized) {
        cache[key] = normalized;
        saveMaxPrepsUrlCache_();
      }
      return normalized;
    }

    function cachedMaxPrepsUrl_(teamName, sportLabel) {
      const key = maxPrepsCacheKey_(teamName, sportLabel);
      return key ? normalizeMaxPrepsUrl_(loadMaxPrepsUrlCache_()[key] || '') : '';
    }

    function scheduleYearForRpiResult_(rpiResult) {
      const resultYear = String(rpiResult?.year || '').trim();
      if (seasonYearLabel_(resultYear)) return seasonYearLabel_(resultYear);
      const selectedYear = selectedRpiYear_();
      return seasonYearLabel_(selectedYear);
    }

    function teamDetailsMaxPrepsUrl_(teamObj, sportLabel) {
      if (!teamObj) return '';
      const sportKey = sportKeyFromLabel_(sportLabel);
      const sportUrl = normalizeMaxPrepsUrl_(teamObj.maxPrepsBySport?.[sportKey] || '');
      if (sportUrl) return sportUrl;

      const genericUrl = normalizeMaxPrepsUrl_(teamObj.maxPrepsUrl || '');
      const genericSportKey = maxPrepsSportKeyFromUrl_(genericUrl);
      return genericUrl && (!genericSportKey || genericSportKey === sportKey) ? genericUrl : '';
    }

    function scheduleOptionsForRow_(row = {}) {
      const rowYear = String(row?.scheduleYear || '').trim();
      const selectedYear = selectedRpiYear_();
      return {
        year: seasonYearLabel_(rowYear) || seasonYearLabel_(selectedYear),
        sport: row?.scheduleSport || sportEl?.value || ''
      };
    }

    function teamScheduleEndpointCandidates_() {
      const configured = configuredApiEndpoint_('/team-schedule');
      if (window.location.protocol === 'file:') {
        return uniqueEndpoints_([configured, 'http://localhost:8000/team-schedule']);
      }
      if (configured) return [configured];
      return uniqueEndpoints_(['/team-schedule', 'http://localhost:8000/team-schedule']);
    }

    async function fetchTeamSchedule_(maxPrepsUrl, options = {}) {
      const scheduleUrl = maxPrepsScheduleUrl_(maxPrepsUrl, options);
      if (!scheduleUrl) throw new Error('No MaxPreps schedule URL found for this team');
      if (teamScheduleCache_.has(scheduleUrl)) return teamScheduleCache_.get(scheduleUrl);

      const endpointErrors = [];
      for (const endpoint of teamScheduleEndpointCandidates_()) {
        try {
          const sep = endpoint.includes('?') ? '&' : '?';
          const res = await fetch(`${endpoint}${sep}url=${encodeURIComponent(scheduleUrl)}`);
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(text || `Schedule server failed (${res.status})`);
          }
          const data = await res.json();
          teamScheduleCache_.set(scheduleUrl, data);
          return data;
        } catch (err) {
          const message = err?.message || String(err || 'Unknown error');
          endpointErrors.push(`${endpoint}: ${message}`);
        }
      }

      throw new Error(endpointErrors[0] || 'Schedule server unavailable');
    }

    function scheduleRowHasUrl_(row) {
      return Boolean(maxPrepsScheduleUrl_(row?.maxPrepsUrl, scheduleOptionsForRow_(row)));
    }

    function scheduleRowClass_(row, base = '') {
      return [base, scheduleRowHasUrl_(row) ? 'schedule-enabled' : ''].filter(Boolean).join(' ');
    }

    function scheduleRowDataAttrs_(row) {
      const scheduleOptions = scheduleOptionsForRow_(row);
      const url = maxPrepsScheduleUrl_(row?.maxPrepsUrl, scheduleOptions);
      if (!url) return '';
      return [
        'data-schedule-row="1"',
        `data-maxpreps-url="${escapeHtml(url)}"`,
        `data-schedule-year="${escapeHtml(scheduleOptions.year || '')}"`,
        `data-schedule-sport="${escapeHtml(scheduleOptions.sport || '')}"`,
        `data-schedule-team="${escapeHtml(row?.school || row?.team || '')}"`,
        `data-schedule-record="${escapeHtml(row?.record || '')}"`,
        `data-schedule-rpi="${escapeHtml(row?.rpi || '')}"`,
        `data-schedule-rank="${escapeHtml(row?.rank || row?.regionRank || row?.lineRank || '')}"`,
        `data-schedule-region-rank="${escapeHtml(row?.regionRank || '')}"`,
        `data-schedule-region="${escapeHtml(row?.lineRegion || '')}"`,
        `data-schedule-logo="${escapeHtml(row?.logoUrl || row?.mapLogoUrl || '')}"`
      ].join(' ');
    }

    function teamLogRowDataAttrs_(row) {
      return [
        'data-team-log-row="1"',
        `data-log-team="${escapeHtml(row?.school || row?.team || '')}"`,
        `data-log-record="${escapeHtml(row?.record || '')}"`,
        `data-log-rpi="${escapeHtml(row?.rpi || '')}"`,
        `data-log-rank="${escapeHtml(row?.rank || row?.regionRank || row?.lineRank || '')}"`,
        `data-log-region-rank="${escapeHtml(row?.regionRank || '')}"`,
        `data-log-region="${escapeHtml(row?.lineRegion || '')}"`,
        `data-log-logo="${escapeHtml(row?.logoUrl || row?.mapLogoUrl || '')}"`
      ].join(' ');
    }

    function teamLogRowFromDataset_(dataset) {
      return {
        school: dataset.logTeam || '',
        record: dataset.logRecord || '',
        rpi: dataset.logRpi || '',
        rank: dataset.logRank || '',
        regionRank: dataset.logRegionRank || '',
        lineRegion: dataset.logRegion || '',
        logoUrl: dataset.logLogo || ''
      };
    }

    function teamLogTriggerHtml_(row, value, className = 'rpi', options = {}) {
      const classes = [className, 'rpi-log-trigger'].filter(Boolean).join(' ');
      const content = options.raw ? String(value ?? '-') : escapeHtml(value || '-');
      return `<span class="${classes}" ${teamLogRowDataAttrs_(row)}>${content}</span>`;
    }

    function closeTeamScheduleCard_() {
      teamScheduleRequestToken_ += 1;
      teamScheduleOverlay?.classList.remove('open');
      teamScheduleOverlay?.setAttribute('aria-hidden', 'true');
    }

    function teamScheduleLogoHtml_(row = {}, team = {}) {
      const logoUrl = row.logoUrl || team.logoUrl || '';
      const name = row.school || team.name || 'Team';
      return imageHtmlWithFallback_('team-schedule-logo', logoUrl, `${name} logo`, 'team-schedule-logo');
    }

    function teamScheduleStatsHtml_(row = {}, overrides = {}) {
      const record = overrides.record ?? row.record ?? '-';
      const rpi = overrides.rpi ?? row.rpi ?? '-';
      const region = row.lineRegion || '-';
      const regionRank = row.regionRank ? `#${row.regionRank}` : '-';
      const regionClass = /^east$/i.test(region) ? 'region-east' : (/^west$/i.test(region) ? 'region-west' : '');
      return `
        <div class="team-schedule-stats">
          <div class="team-schedule-stat ${escapeHtml(regionClass)}"><div class="team-schedule-stat-label">Region</div><div class="team-schedule-stat-value">${escapeHtml(region)}</div></div>
          <div class="team-schedule-stat"><div class="team-schedule-stat-label">Region Rank</div><div class="team-schedule-stat-value">${escapeHtml(regionRank)}</div></div>
          <div class="team-schedule-stat team-schedule-record-stat"><div class="team-schedule-stat-label">Record</div><div class="team-schedule-stat-value">${escapeHtml(record || '-')}</div></div>
          <div class="team-schedule-stat team-schedule-rpi-stat"><div class="team-schedule-stat-label">RPI</div><div class="team-schedule-stat-value">${escapeHtml(rpi || '-')}</div></div>
        </div>`;
    }

    function teamPanelHeadingHtml_({ titleId, title, subtitleHtml, actionsHtml = '', wrapClass = '', copyClass = '' } = {}) {
      const copyClasses = copyClass ? ` class="${escapeHtml(copyClass)}"` : '';
      const headingCopyHtml = `
        <div${copyClasses}>
          <h2 id="${escapeHtml(titleId || 'teamPanelTitle')}" class="team-schedule-title">${escapeHtml(title || 'Team')}</h2>
          <div class="team-schedule-subtitle">${subtitleHtml || ''}</div>
        </div>`;
      if (!actionsHtml) return headingCopyHtml;
      const wrapClasses = wrapClass ? ` class="${escapeHtml(wrapClass)}"` : '';
      return `
        <div${wrapClasses}>
          <div class="team-log-title-row">
            ${headingCopyHtml}
            ${actionsHtml}
          </div>
        </div>`;
    }

    function teamPanelHeadHtml_({
      row = {},
      team = {},
      titleId,
      title,
      subtitleHtml = '',
      statsOverrides = {},
      actionsHtml = '',
      wrapClass = '',
      copyClass = ''
    } = {}) {
      return `
        <div class="team-schedule-head">
          <div class="team-schedule-team">
            ${teamScheduleLogoHtml_(row, team)}
            ${teamPanelHeadingHtml_({ titleId, title, subtitleHtml, actionsHtml, wrapClass, copyClass })}
          </div>
          ${teamScheduleStatsHtml_(row, statsOverrides)}
        </div>`;
    }

    function teamScheduleSubtitleHtml_(team = {}) {
      const displayYear = teamScheduleDisplayYear_(team);
      const lineOne = [displayYear, team.sport || ''].filter(Boolean).join(' ');
      const lineTwo = team.division || '';
      if (!lineOne && !lineTwo) return escapeHtml('MaxPreps Schedule');
      return `${lineOne ? `<span>${escapeHtml(lineOne)}</span>` : ''}${lineTwo ? `<span>${escapeHtml(lineTwo)}</span>` : ''}`;
    }

    function teamScheduleDisplayYear_(team = {}) {
      const year = String(team.year || '').trim();
      const sport = String(team.sport || '').trim();
      const season = String(team.season || '').trim();
      const match = year.match(/^(\d{2})-(\d{2})$/);
      if (!match) return year;
      if (/baseball/i.test(sport) || /^spring$/i.test(season)) return `20${match[2]}`;
      if (/^fall$/i.test(season)) return `20${match[1]}`;
      return `20${match[1]}-${match[2]}`;
    }

    function renderTeamScheduleLoading_(row) {
      teamScheduleContent.innerHTML = `
        ${teamPanelHeadHtml_({
          row,
          titleId: 'teamScheduleTitle',
          title: row.school || 'Team Schedule',
          subtitleHtml: escapeHtml('Loading MaxPreps schedule')
        })}
        <div class="team-schedule-loading">
          <div>
            <div class="team-schedule-spinner" aria-hidden="true"></div>
            Pulling schedule data...
          </div>
        </div>`;
      armImageFallbacks_(teamScheduleContent);
    }

    function scheduleDateParts_(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return { date: 'TBD', time: '' };
      return {
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      };
    }

    function scheduleGameResultText_(game) {
      if (game?.score) return game.score;
      if (game?.statusClass === 'scheduled') return 'Scheduled';
      return game?.status || '-';
    }

    function renderTeamScheduleError_(row, err) {
      teamScheduleContent.innerHTML = `
        ${teamPanelHeadHtml_({
          row,
          titleId: 'teamScheduleTitle',
          title: row.school || 'Team Schedule',
          subtitleHtml: escapeHtml('Schedule unavailable')
        })}
        <div class="team-schedule-empty">
          Could not load this MaxPreps schedule.<br>${escapeHtml(err?.message || String(err || ''))}
        </div>`;
      armImageFallbacks_(teamScheduleContent);
    }

    function renderTeamSchedule_(row, schedule) {
      const team = schedule?.team || {};
      const record = row.record || team.record || '-';
      const rpi = row.rpi || '-';
      const games = Array.isArray(schedule?.games) ? schedule.games : [];
      const gamesHtml = games.map(game => {
        const when = scheduleDateParts_(game.date);
        const opponent = game.opponent || {};
        const loc = game.location === 'Away' ? '@' : (game.location === 'Neutral' ? 'N' : 'vs');
        const opponentName = `${loc} ${opponent.name || 'Opponent TBD'}${opponent.record ? ` (${opponent.record})` : ''}`;
        const opponentMeta = [game.location || '', opponent.city && opponent.state ? `${opponent.city}, ${opponent.state}` : '', opponent.mascot || '']
          .filter(Boolean)
          .join(' | ');
        const opponentLogo = imageHtmlWithFallback_(
          'team-schedule-opponent-logo',
          opponent.logoUrl,
          `${opponent.name || 'Opponent'} logo`,
          'team-schedule-opponent-logo team-schedule-opponent-logo-placeholder'
        );
        return `
          <div class="team-schedule-game">
            <div class="team-schedule-date"><span>${escapeHtml(when.date)}</span><span>${escapeHtml(when.time)}</span></div>
            <div class="team-schedule-opponent">
              ${opponentLogo}
              <div class="team-schedule-opponent-copy">
                <div class="team-schedule-opponent-name">${escapeHtml(opponentName)}</div>
                <div class="team-schedule-opponent-meta">${escapeHtml(opponentMeta || game.status || '')}</div>
              </div>
            </div>
            <div class="team-schedule-result ${escapeHtml(game.statusClass || '')}">${escapeHtml(scheduleGameResultText_(game))}</div>
          </div>`;
      }).join('');

      teamScheduleContent.innerHTML = `
        ${teamPanelHeadHtml_({
          row,
          team,
          titleId: 'teamScheduleTitle',
          title: row.school || team.name || 'Team Schedule',
          subtitleHtml: teamScheduleSubtitleHtml_(team),
          statsOverrides: { record, rpi }
        })}
        <div class="team-schedule-body">
          <div class="team-schedule-toolbar">
            <span>${escapeHtml(games.length)} games loaded${schedule?.cached ? ' from cache' : ''}</span>
            <a class="team-schedule-link" href="${escapeHtml(schedule?.url || row.maxPrepsUrl || '#')}" target="_blank" rel="noopener">Open MaxPreps</a>
          </div>
          ${gamesHtml ? `<div class="team-schedule-games">${gamesHtml}</div>` : '<div class="team-schedule-empty">No schedule games found.</div>'}
        </div>`;
      armImageFallbacks_(teamScheduleContent);
    }

    async function openTeamScheduleCard_(row) {
      const scheduleOptions = scheduleOptionsForRow_(row);
      const url = maxPrepsScheduleUrl_(row?.maxPrepsUrl, scheduleOptions);
      if (!url || !teamScheduleOverlay || !teamScheduleContent) return;
      closeTeamLogCard_();
      const token = ++teamScheduleRequestToken_;
      const context = { ...row, maxPrepsUrl: url };
      teamScheduleOverlay.classList.add('open');
      teamScheduleOverlay.setAttribute('aria-hidden', 'false');
      renderTeamScheduleLoading_(context);

      try {
        const schedule = await fetchTeamSchedule_(url, scheduleOptions);
        if (token !== teamScheduleRequestToken_) return;
        renderTeamSchedule_(context, schedule);
      } catch (err) {
        if (token !== teamScheduleRequestToken_) return;
        console.warn('Team schedule unavailable:', err);
        renderTeamScheduleError_(context, err);
      }
    }

    function scheduleRowFromDataset_(dataset) {
      return {
        school: dataset.scheduleTeam || '',
        record: dataset.scheduleRecord || '',
        rpi: dataset.scheduleRpi || '',
        rank: dataset.scheduleRank || '',
        regionRank: dataset.scheduleRegionRank || '',
        lineRegion: dataset.scheduleRegion || '',
        logoUrl: dataset.scheduleLogo || '',
        maxPrepsUrl: dataset.maxprepsUrl || '',
        scheduleYear: dataset.scheduleYear || '',
        scheduleSport: dataset.scheduleSport || ''
      };
    }

    function closeTeamLogCard_() {
      teamLogRequestToken_ += 1;
      teamLogOverlay?.classList.remove('open');
      teamLogOverlay?.setAttribute('aria-hidden', 'true');
    }

// ============================================================================
// 5. Team Log card state, filtering, and view rendering
// ============================================================================

async function fetchTeamRpiLog_(row, options = {}) {
  return requestSnapshotApiJson_('/rpi-snapshots/team-log', {
    sport: options.sport || row?.sport || sportEl?.value || '',
    classification: options.classification || row?.classification || classEl?.value || '',
    seasonYear: options.seasonYear || selectedRpiYear_() || 'live',
    source: 'official',
    school: row?.school || '',
    limit: 200
  });
}

    function teamLogLocalDateKey_(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function teamLogDisplayDate_(value) {
      if (!value) return 'Latest snapshot day';
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function normalizeTeamLogEntries_(logs) {
      return (Array.isArray(logs) ? logs : []).map(log => ({
        ...log,
        localDate: teamLogLocalDateKey_(log?.fetchedAt)
      }));
    }

    function teamLogAvailableDates_() {
      const logs = normalizeTeamLogEntries_(teamLogCurrentResult_?.logs || []);
      return [...new Set(logs.map(log => log.localDate).filter(Boolean))];
    }

    function isMobileViewport_() {
      return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(max-width: 900px)').matches;
    }

    function teamLogDateNavState_() {
      const dates = teamLogAvailableDates_();
      const idx = dates.indexOf(teamLogSelectedDate_);
      return {
        dates,
        idx,
        hasNewer: idx > 0,
        hasOlder: idx >= 0 && idx < dates.length - 1
      };
    }

    function stepTeamLogDate_(direction) {
      const { dates, idx, hasNewer, hasOlder } = teamLogDateNavState_();
      if (!dates.length) return;
      if (direction === 'older' && hasOlder) {
        teamLogSelectedDate_ = dates[idx + 1];
        teamLogExpandedEntryKey_ = '';
        renderTeamLog_();
      } else if (direction === 'newer' && hasNewer) {
        teamLogSelectedDate_ = dates[idx - 1];
        teamLogExpandedEntryKey_ = '';
        renderTeamLog_();
      }
    }

function teamLogToolbarDateHtml_(label) {
  const nav = teamLogDateNavState_();
  return `
        <span class="team-log-toolbar-date-nav">
          <button type="button" class="team-log-date-step-btn" data-team-log-date-step="older" aria-label="Show older log date"${nav.hasOlder ? '' : ' disabled'}>&lsaquo;</button>
          <span class="team-log-toolbar-date-label">${escapeHtml(label)}</span>
          <button type="button" class="team-log-date-step-btn" data-team-log-date-step="newer" aria-label="Show newer log date"${nav.hasNewer ? '' : ' disabled'}>&rsaquo;</button>
        </span>`;
}

function teamLogCalendarButtonHtml_() {
  return `
    <button type="button" class="team-log-inline-btn team-panel-icon-btn team-log-inline-calendar-btn" aria-label="Choose team log date" title="Choose team log date">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 2v3M17 2v3M3.5 9.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18V7A1.5 1.5 0 0 1 5 5.5Z" />
        <path d="M8 13h3M8 16h3M13 13h3M13 16h3" />
      </svg>
    </button>`;
}

function teamLogViewButtonHtml_() {
  return `
    <button type="button" class="team-log-inline-btn team-panel-icon-btn team-log-inline-view-btn${teamLogViewMode_ === 'graph' ? ' is-graph-view' : ''}" aria-label="${escapeHtml(teamLogViewMode_ === 'graph' ? 'Show team RPI log table' : 'Show team RPI graph')}" title="${escapeHtml(teamLogViewMode_ === 'graph' ? 'Show team RPI log table' : 'Show team RPI graph')}">
      ${teamLogViewIconSvg_(teamLogViewMode_)}
    </button>`;
}

function teamLogInlineActionButtonsHtml_() {
  return `
    <div class="team-log-inline-actions">
      ${teamLogCalendarButtonHtml_()}
      ${teamLogViewButtonHtml_()}
    </div>`;
}

function teamLogToolbarActionsHtml_() {
  return `
    <span class="team-log-toolbar-actions">
      ${teamLogCalendarButtonHtml_()}
      ${teamLogViewButtonHtml_()}
      <span class="team-log-toolbar-zoom" aria-label="Graph zoom controls">
        <button type="button" class="team-log-inline-btn team-panel-icon-btn team-log-zoom-btn" data-team-log-zoom="out" aria-label="Zoom out graph" title="Zoom out graph"${teamLogViewMode_ === 'graph' ? '' : ' disabled'}>−</button>
        <span class="team-log-zoom-label">${escapeHtml(teamLogGraphZoomLabel_())}</span>
        <button type="button" class="team-log-inline-btn team-panel-icon-btn team-log-zoom-btn" data-team-log-zoom="in" aria-label="Zoom in graph" title="Zoom in graph"${teamLogViewMode_ === 'graph' ? '' : ' disabled'}>+</button>
      </span>
    </span>`;
}

function teamLogClassOptions_() {
  const values = [...(classEl?.options || [])]
    .map(option => String(option.value || '').trim())
    .filter(value => /\b\d+A\b/i.test(value));
  return [...new Set(values)].map(value => ({ value, label: value }));
}

function teamLogSelectorCacheKey_(classification) {
  return `${selectedRpiYear_() || 'live'}|${sportEl?.value || ''}|${classification || classEl?.value || ''}`;
}

function sortedUniqueTeamLogRows_(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .filter(row => row?.school)
    .filter(row => {
      const key = canonicalTeamName_(row.school);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.school || '').localeCompare(String(b.school || '')));
}

function teamLogSelectedTeamLabel_() {
  return teamLogShowAllTeams_
    ? 'All Teams'
    : String(teamLogCurrentRow_?.school || 'Search team');
}

function teamLogSeriesCacheKey_(row, options = {}) {
  const classification = options.classification || row?.classification || classEl?.value || '';
  const sport = options.sport || row?.sport || sportEl?.value || '';
  const seasonYear = options.seasonYear || selectedRpiYear_() || 'live';
  const school = canonicalTeamName_(row?.school || '');
  return `${seasonYear}|${sport}|${classification}|${school}`;
}

function teamLogSnapshotBundleCacheKey_(options = {}) {
  const classification = options.classification || teamLogSelectorClass_ || classEl?.value || '';
  const sport = options.sport || teamLogCurrentResult_?.sport || sportEl?.value || '';
  const seasonYear = options.seasonYear || teamLogCurrentResult_?.seasonYear || selectedRpiYear_() || 'live';
  const source = options.source || teamLogCurrentResult_?.source || 'official';
  return `${seasonYear}|${source}|${sport}|${classification}`;
}

async function fetchTeamLogSnapshotBundle_(options = {}) {
  const cacheKey = teamLogSnapshotBundleCacheKey_(options);
  if (teamLogSnapshotBundleCache_.has(cacheKey)) return teamLogSnapshotBundleCache_.get(cacheKey);
  const sport = options.sport || teamLogCurrentResult_?.sport || sportEl?.value || '';
  const classification = options.classification || teamLogSelectorClass_ || classEl?.value || '';
  const seasonYear = options.seasonYear || teamLogCurrentResult_?.seasonYear || selectedRpiYear_() || 'live';
  const source = options.source || teamLogCurrentResult_?.source || 'official';
  const listResult = await requestSnapshotApiJson_('/rpi-snapshots/list', { sport, classification });
  const snapshots = (Array.isArray(listResult?.snapshots) ? listResult.snapshots : [])
    .filter(snapshot => (!seasonYear || snapshot.seasonYear === seasonYear) && (!source || snapshot.source === source))
    .sort((a, b) => String(b.fetchedAt || '').localeCompare(String(a.fetchedAt || '')));
  const details = [];
  const concurrency = 4;
  for (let i = 0; i < snapshots.length; i += concurrency) {
    const batch = snapshots.slice(i, i + concurrency);
    const batchDetails = await Promise.all(batch.map(async snapshot => {
      const result = await requestSnapshotApiJson_('/rpi-snapshots/snapshot', { id: snapshot.id });
      return result?.snapshot || null;
    }));
    details.push(...batchDetails.filter(Boolean));
  }
  teamLogSnapshotBundleCache_.set(cacheKey, details);
  return details;
}

function buildAllTeamLogSeriesFromSnapshots_(snapshots, rows, options = {}) {
  const rowMap = new Map();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const key = canonicalTeamName_(row?.school || '').toLowerCase();
    if (key && !rowMap.has(key)) rowMap.set(key, row);
  });
  if (!rowMap.size) return [];
  const seriesMap = new Map([...rowMap.entries()].map(([key, row]) => [key, { row, logs: [] }]));
  const orderedSnapshots = (Array.isArray(snapshots) ? snapshots : [])
    .filter(snapshot => snapshot?.fetchedAt)
    .slice()
    .sort((a, b) => Date.parse(a?.fetchedAt || 0) - Date.parse(b?.fetchedAt || 0));

  orderedSnapshots.forEach(snapshot => {
    const snapshotRows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
    snapshotRows.forEach(item => {
      const key = canonicalTeamName_(item?.school || item?.team || '').toLowerCase();
      if (!key || !seriesMap.has(key)) return;
      const rank = Number(item?.rank);
      const rpi = Number(item?.rpi);
      const log = {
        snapshotId: snapshot?.id || '',
        fetchedAt: snapshot?.fetchedAt || '',
        school: String(item?.school || item?.team || '').trim(),
        rank: Number.isFinite(rank) ? rank : (item?.rank ?? ''),
        record: String(item?.record || ''),
        wp: String(item?.wp || ''),
        owp: String(item?.owp || ''),
        oowp: String(item?.oowp || ''),
        rpi: Number.isFinite(rpi) ? rpi : item?.rpi,
        rankChange: null,
        rpiChange: null
      };
      seriesMap.get(key)?.logs.push(log);
    });
  });

  return [...seriesMap.values()].map(item => {
    const sortedLogs = item.logs
      .slice()
      .sort((a, b) => Date.parse(a?.fetchedAt || 0) - Date.parse(b?.fetchedAt || 0))
      .map((log, index, arr) => {
        const older = arr[index - 1] || null;
        const olderRank = Number(older?.rank);
        const newerRank = Number(log?.rank);
        const olderRpi = Number(older?.rpi);
        const newerRpi = Number(log?.rpi);
        return {
          ...log,
          localDate: teamLogLocalDateKey_(log?.fetchedAt),
          rankChange: older && Number.isFinite(olderRank) && Number.isFinite(newerRank)
            ? olderRank - newerRank
            : null,
          rpiChange: older && Number.isFinite(olderRpi) && Number.isFinite(newerRpi)
            ? Number((newerRpi - olderRpi).toFixed(6))
            : null
        };
      });
    return {
      row: item.row,
      logs: filterTeamLogEntriesForGraph_(sortedLogs, options)
    };
  }).filter(item => item.logs.length);
}

async function loadTeamLogSeriesForRow_(row, options = {}) {
  const cacheKey = teamLogSeriesCacheKey_(row, options);
  if (teamLogSeriesCache_.has(cacheKey)) return teamLogSeriesCache_.get(cacheKey);
  const result = await fetchTeamRpiLog_(row, options);
  const normalized = {
    ...result,
    sport: options.sport || row?.sport || sportEl?.value || '',
    classification: options.classification || row?.classification || classEl?.value || '',
    logs: normalizeTeamLogEntries_(result?.logs || [])
  };
  teamLogSeriesCache_.set(cacheKey, normalized);
  return normalized;
}

async function loadTeamLogSelectorRowsForClass_(classification) {
  const targetClass = classification || classEl?.value || '';
  const cacheKey = teamLogSelectorCacheKey_(targetClass);
  if (teamLogSelectorCache_.has(cacheKey)) {
    teamLogSelectorRows_ = teamLogSelectorCache_.get(cacheKey) || [];
    return teamLogSelectorRows_;
  }
  const sport = sportEl?.value || '';
  const mergedRows = (await getMergedRowsForSelection_(targetClass, sport)).rows
    .map(row => ({ ...row, classification: targetClass, sport }));
  const lineData = buildEastWestLineRows_(mergedRows, targetClass);
  const regionLookup = new Map();
  lineData.east.concat(lineData.west).forEach(row => {
    const key = canonicalTeamName_(row.school).toLowerCase();
    if (!key) return;
    regionLookup.set(key, {
      lineRegion: row.lineRegion || '',
      regionRank: row.regionRank || ''
    });
  });
  const rows = mergedRows.map(row => {
    const key = canonicalTeamName_(row.school).toLowerCase();
    const info = regionLookup.get(key) || {};
    return {
      ...row,
      lineRegion: row.lineRegion || info.lineRegion || '',
      regionRank: row.regionRank || info.regionRank || ''
    };
  });
  const normalizedRows = sortedUniqueTeamLogRows_(rows);
  teamLogSelectorCache_.set(cacheKey, normalizedRows);
  teamLogSelectorRows_ = normalizedRows;
  return normalizedRows;
}

async function ensureTeamLogSelectorRows_(classification = teamLogSelectorClass_) {
  const targetClass = classification || classEl?.value || '';
  const requestToken = ++teamLogSelectorRequestToken_;
  teamLogSelectorLoading_ = true;
  renderTeamLog_();
  try {
    await loadTeamLogSelectorRowsForClass_(targetClass);
  } catch (err) {
    console.warn('Team log selector rows unavailable:', err);
    if (requestToken !== teamLogSelectorRequestToken_) return;
    teamLogSelectorRows_ = [];
  } finally {
    if (requestToken !== teamLogSelectorRequestToken_) return;
    teamLogSelectorLoading_ = false;
    renderTeamLog_();
  }
}

function filteredTeamLogSelectorRows_() {
  const needle = canonicalTeamName_(teamLogTeamSearch_ || '').toLowerCase();
  const rows = (Array.isArray(teamLogSelectorRows_) ? teamLogSelectorRows_ : [])
    .filter(row => {
      if (teamLogSelectorRegion_ === 'both') return true;
      return String(row?.lineRegion || '').toLowerCase() === teamLogSelectorRegion_;
    });
  if (!needle) return rows;
  return rows
    .filter(row => canonicalTeamName_(row.school).toLowerCase().includes(needle))
    .slice(0, 24);
}

async function applyTeamLogSelectorClass_(value) {
  teamLogSelectorClass_ = value || classEl?.value || '';
  teamLogTeamSearch_ = '';
  teamLogTeamMenuOpen_ = false;
  teamLogSelectorRows_ = [];
  await ensureTeamLogSelectorRows_(teamLogSelectorClass_);
  const currentKey = canonicalTeamName_(teamLogCurrentRow_?.school || '').toLowerCase();
  const hasCurrent = teamLogSelectorRows_.some(row => canonicalTeamName_(row.school).toLowerCase() === currentKey);
  if (teamLogShowAllTeams_) {
    if (!hasCurrent && teamLogSelectorRows_.length) {
      teamLogSelectedTeamKey_ = canonicalTeamName_(teamLogSelectorRows_[0].school).toLowerCase();
    } else if (hasCurrent) {
      teamLogSelectedTeamKey_ = currentKey;
    }
    teamLogGraphPanX_ = 0;
    teamLogGraphPanY_ = 0;
    await ensureTeamLogAllSeries_();
  } else {
    renderTeamLog_();
  }
}

async function applyTeamLogSelectorRegion_(value) {
  const next = ['both', 'east', 'west'].includes(String(value || '').toLowerCase())
    ? String(value || '').toLowerCase()
    : 'both';
  teamLogSelectorRegion_ = next;
  teamLogTeamSearch_ = '';
  teamLogTeamMenuOpen_ = false;
  if (teamLogShowAllTeams_) {
    const visibleRows = filteredTeamLogSelectorRows_();
    if (visibleRows.length && !visibleRows.some(row => canonicalTeamName_(row.school).toLowerCase() === teamLogSelectedTeamKey_)) {
      teamLogSelectedTeamKey_ = canonicalTeamName_(visibleRows[0].school).toLowerCase();
    }
    teamLogGraphPanX_ = 0;
    teamLogGraphPanY_ = 0;
    await ensureTeamLogAllSeries_();
    return;
  }
  renderTeamLog_();
}

function updateTeamLogTeamSearch_(value) {
  teamLogTeamSearch_ = String(value || '');
  teamLogTeamMenuOpen_ = true;
  renderTeamLog_();
}

async function selectTeamLogTeamByName_(value) {
  if (value === TEAM_LOG_ALL_TEAMS_VALUE_ || canonicalTeamName_(value).toLowerCase() === canonicalTeamName_('All Teams').toLowerCase()) {
    teamLogShowAllTeams_ = true;
    teamLogTeamSearch_ = '';
    teamLogTeamMenuOpen_ = false;
    if (!teamLogSelectedTeamKey_) {
      teamLogSelectedTeamKey_ = canonicalTeamName_(teamLogCurrentRow_?.school || '').toLowerCase();
    }
    await ensureTeamLogAllSeries_();
    return;
  }
  const target = canonicalTeamName_(value || '').toLowerCase();
  if (!target) return;
  const match = teamLogSelectorRows_.find(row => canonicalTeamName_(row.school).toLowerCase() === target)
    || filteredTeamLogSelectorRows_()[0];
  if (!match) return;
  teamLogShowAllTeams_ = false;
  teamLogTeamSearch_ = '';
  teamLogTeamMenuOpen_ = false;
  teamLogSelectedTeamKey_ = canonicalTeamName_(match.school).toLowerCase();
  await openTeamLogCard_(match, {
    classification: match.classification || teamLogSelectorClass_ || classEl?.value || '',
    sport: match.sport || sportEl?.value || '',
    preserveSelectorState: true
  });
}

    function teamLogEntryKey_(log) {
      return String(log?.fetchedAt || '');
    }

    function toggleTeamLogEntry_(key) {
      teamLogExpandedEntryKey_ = teamLogExpandedEntryKey_ === key ? '' : key;
      renderTeamLog_();
    }

    function renderTeamLogMobileList_(logs) {
      return `<div class="team-log-mobile-list">
        ${logs.map(log => {
          const key = teamLogEntryKey_(log);
          const expanded = teamLogExpandedEntryKey_ === key;
          const parts = formatTeamLogTimestamp_(log.fetchedAt);
          const rowDate = (() => {
            const d = new Date(log.fetchedAt);
            return Number.isNaN(d.getTime())
              ? parts.date
              : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
          })();
          const rankChange = Number(log.rankChange);
          const rowClass = Number.isFinite(rankChange)
            ? (rankChange > 0 ? ' is-rank-up' : (rankChange < 0 ? ' is-rank-down' : ''))
            : '';
          const rankChangeHtml = formatTeamLogRankChange_(log.rankChange);
          const rpiChangeHtml = formatTeamLogRpiChange_(log.rpiChange);
          return `
            <div class="team-log-mobile-card${rowClass}${expanded ? ' is-expanded' : ''}">
              <button type="button" class="team-log-mobile-row" data-team-log-entry="${escapeHtml(key)}" aria-expanded="${expanded ? 'true' : 'false'}">
                <span class="team-log-mobile-timeband">
                  <strong class="team-log-mobile-top-time">${escapeHtml(parts.time)}</strong>
                  <strong class="team-log-mobile-top-date">${escapeHtml(rowDate)}</strong>
                </span>
                <span class="team-log-mobile-bodyband">
                  <span class="team-log-mobile-summary-grid">
                    <span class="team-log-mobile-summary-block">
                      <span class="team-log-mobile-summary-label">&#9650;/&#9660;</span>
                      <span class="team-log-mobile-summary-pill team-log-rpi-pill">${rankChangeHtml}</span>
                    </span>
                    <span class="team-log-mobile-summary-block">
                      <span class="team-log-mobile-summary-label">Rank</span>
                      <span class="team-log-mobile-summary-pill team-log-rank-pill">#${escapeHtml(log.rank ?? '-')}</span>
                    </span>
                    <span class="team-log-mobile-summary-block">
                      <span class="team-log-mobile-summary-label">Record</span>
                      <span class="team-log-mobile-summary-pill team-log-rpi-pill">${escapeHtml(log.record || '-')}</span>
                    </span>
                    <span class="team-log-mobile-summary-block">
                      <span class="team-log-mobile-summary-label">+/-</span>
                      <span class="team-log-mobile-summary-pill team-log-rpi-pill">${rpiChangeHtml}</span>
                    </span>
                  </span>
                </span>
              </button>
              <div class="team-log-mobile-details${expanded ? ' is-expanded' : ''}">
                <div class="team-log-mobile-pills">
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">&#9650;/&#9660;</span><span class="team-log-rpi-pill">${rankChangeHtml}</span></span>
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">Rank</span><span class="team-log-rank-pill">#${escapeHtml(log.rank ?? '-')}</span></span>
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">Record</span><span class="team-log-rpi-pill">${escapeHtml(log.record || '-')}</span></span>
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">WP</span><span class="team-log-rpi-pill">${escapeHtml(log.wp || '-')}</span></span>
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">OWP</span><span class="team-log-rpi-pill">${escapeHtml(log.owp || '-')}</span></span>
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">OOWP</span><span class="team-log-rpi-pill">${escapeHtml(log.oowp || '-')}</span></span>
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">RPI</span><span class="team-log-rpi-pill">${escapeHtml(typeof log.rpi === 'number' ? log.rpi.toFixed(6) : (log.rpi || '-'))}</span></span>
                  <span class="team-log-mobile-pill-card"><span class="team-log-mobile-pill-label">+/-</span><span class="team-log-rpi-pill">${rpiChangeHtml}</span></span>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
    }

    function syncTeamLogDateControls_() {
      const dates = teamLogAvailableDates_();
      const hasDates = dates.length > 0;
      if (teamLogDateInput) {
        teamLogDateInput.disabled = !hasDates;
        teamLogDateInput.min = hasDates ? dates[dates.length - 1] : '';
        teamLogDateInput.max = hasDates ? dates[0] : '';
        teamLogDateInput.value = hasDates && teamLogSelectedDate_ ? teamLogSelectedDate_ : '';
      }
      if (teamLogCalendarBtn) {
        teamLogCalendarBtn.disabled = !hasDates;
        teamLogCalendarBtn.title = hasDates
          ? `Choose log date (${teamLogDisplayDate_(teamLogSelectedDate_)})`
          : 'No log dates available';
      }
      syncTeamLogViewControls_();
    }

    function teamLogViewIconSvg_(viewMode) {
      if (viewMode === 'graph') {
        return `
          <svg viewBox="-0.5 -0.5 16 16" aria-hidden="true" focusable="false">
            <path d="M6.875 10.9375h6.25M6.875 7.5h6.25M6.875 4.0625h6.25M2.1875 9.659375v-0.10875c0 -0.485625 0.42 -0.87875 0.9375 -0.87875h0.025c0.504375 0 0.9125 0.383125 0.9125 0.855 0 0.20625 -0.07125 0.40625 -0.2025 0.57L2.1875 12.1875h1.875m-1.875 -8.789375 1.25 -0.585625v3.515625" />
          </svg>`;
      }
      return `
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4.5 18.5h15" />
            <path d="M6 15.5l4.1-4.2 3.1 2.6 4.8-6.1" />
            <path d="M15.9 7.8h2.9v2.9" />
          </svg>`;
    }

    function syncTeamLogViewControls_() {
      if (!teamLogViewBtn) return;
      const hasLogs = normalizeTeamLogEntries_(teamLogCurrentResult_?.logs || []).length > 0;
      const nextLabel = teamLogViewMode_ === 'graph' ? 'Show team RPI log table' : 'Show team RPI graph';
      teamLogViewBtn.disabled = !hasLogs;
      teamLogViewBtn.setAttribute('aria-label', nextLabel);
      teamLogViewBtn.title = hasLogs ? nextLabel : 'No RPI log data available';
      teamLogViewBtn.innerHTML = teamLogViewIconSvg_(teamLogViewMode_);
      teamLogViewBtn.classList.toggle('is-graph-view', teamLogViewMode_ === 'graph');
    }

    function filteredTeamLogEntries_() {
      const logs = normalizeTeamLogEntries_(teamLogCurrentResult_?.logs || []);
      const dates = [...new Set(logs.map(log => log.localDate).filter(Boolean))];
      if (dates.length && !dates.includes(teamLogSelectedDate_)) {
        teamLogSelectedDate_ = dates[0];
      }
      return logs.filter(log => !teamLogSelectedDate_ || log.localDate === teamLogSelectedDate_);
    }

    function formatTeamLogTimestamp_(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return { date: 'Unknown date', time: 'Unknown time' };
      }
      return {
        date: date.toLocaleDateString([], { dateStyle: 'short' }),
        time: date.toLocaleTimeString([], { timeStyle: 'short' })
      };
    }

    function teamLogTimestampHtml_(value) {
      const parts = formatTeamLogTimestamp_(value);
      return `
        <span class="team-log-timestamp">
          <span class="team-log-timestamp-date">${escapeHtml(parts.date)}</span>
          <span class="team-log-timestamp-time">${escapeHtml(parts.time)}</span>
        </span>`;
    }

    function formatTeamLogRankChange_(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n === 0) return '-';
      const arrow = n > 0 ? '&#9650;' : '&#9660;';
      return `<span class="team-log-change ${n > 0 ? 'up' : 'down'}"><span class="change-arrow ${n > 0 ? 'up' : 'down'}">${arrow}</span>${escapeHtml(Math.abs(n))}</span>`;
    }

    function formatTeamLogRpiChange_(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n === 0) return '-';
      const fixed = `${n > 0 ? '+' : '-'}${Math.abs(n).toFixed(6)}`.replace(/^([+-])0\./, '$1.');
      return `<span class="team-log-change ${n > 0 ? 'up' : 'down'}">${escapeHtml(fixed)}</span>`;
    }

    function normalizeTeamLogSeriesColor_(value) {
      const hex = String(value || '').trim();
      return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)
        ? hex
        : 'rgba(255,255,255,0.22)';
    }

    function teamDetailsRowForName_(teamName) {
      const key = canonicalTeamName_(teamName || '');
      if (!key || !(teamDetailsMapResolved_ instanceof Map)) return null;
      return teamDetailsMapResolved_.get(key) || null;
    }

    function getTeamGraphColor_(teamName, row = {}) {
      const detailRow = teamDetailsRowForName_(teamName);
      const candidate = detailRow?.dominantHex || row?.dominantHex || '';
      return normalizeTeamLogSeriesColor_(candidate);
    }

    function teamLogAllEntriesSorted_() {
      return normalizeTeamLogEntries_(teamLogCurrentResult_?.logs || [])
        .filter(log => Number.isFinite(Number(log?.rpi)) && log?.fetchedAt)
        .slice()
        .sort((a, b) => Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt));
    }

    function teamLogAnchorEntry_(logs) {
      if (!logs.length) return null;
      const selectedDayLogs = teamLogSelectedDate_
        ? logs.filter(log => log.localDate === teamLogSelectedDate_)
        : [];
      return selectedDayLogs[selectedDayLogs.length - 1] || logs[logs.length - 1] || null;
    }

function filteredTeamLogGraphEntries_() {
  const logs = teamLogAllEntriesSorted_();
  if (!logs.length) return [];
  return filterTeamLogEntriesForGraph_(logs, {
    rangeKey: teamLogRange_,
    selectedDate: teamLogSelectedDate_
  });
}

function filterTeamLogEntriesForGraph_(logs, options = {}) {
  const normalizedLogs = normalizeTeamLogEntries_(logs || [])
    .filter(log => Number.isFinite(Number(log?.rpi)) && log?.fetchedAt)
    .slice()
    .sort((a, b) => Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt));
  if (!normalizedLogs.length) return [];
  const range = TEAM_LOG_GRAPH_RANGES_.find(item => item.key === (options.rangeKey || teamLogRange_)) || TEAM_LOG_GRAPH_RANGES_[0];
  const selectedDate = options.selectedDate ?? teamLogSelectedDate_;
  const anchor = (() => {
    if (!selectedDate) return normalizedLogs[normalizedLogs.length - 1] || null;
    const selectedDayLogs = normalizedLogs.filter(log => log.localDate === selectedDate);
    return selectedDayLogs[selectedDayLogs.length - 1] || normalizedLogs[normalizedLogs.length - 1] || null;
  })();
  if (!anchor) return normalizedLogs;
  const anchorTime = Date.parse(anchor.fetchedAt);
  if (!Number.isFinite(anchorTime)) return normalizedLogs;
  if (range.key === 'ALL') {
    return normalizedLogs.filter(log => Date.parse(log.fetchedAt) <= anchorTime);
  }
  if (range.key === '1D') {
    return normalizedLogs.filter(log => log.localDate === anchor.localDate && Date.parse(log.fetchedAt) <= anchorTime);
  }
  const cutoff = anchorTime - (range.days * 24 * 60 * 60 * 1000);
  const filtered = normalizedLogs.filter(log => {
    const time = Date.parse(log.fetchedAt);
    return Number.isFinite(time) && time >= cutoff && time <= anchorTime;
  });
  return filtered.length ? filtered : normalizedLogs.filter(log => Date.parse(log.fetchedAt) <= anchorTime);
}

async function ensureTeamLogAllSeries_() {
  const rows = filteredTeamLogSelectorRows_();
  if (!rows.length) return [];
  const requestToken = ++teamLogGraphAllRequestToken_;
  teamLogGraphAllLoading_ = true;
  renderTeamLog_();
  try {
    const snapshots = await fetchTeamLogSnapshotBundle_({
      sport: teamLogCurrentResult_?.sport || sportEl?.value || '',
      classification: teamLogSelectorClass_ || classEl?.value || '',
      seasonYear: teamLogCurrentResult_?.seasonYear || selectedRpiYear_() || 'live',
      source: teamLogCurrentResult_?.source || 'official'
    });
    if (requestToken !== teamLogGraphAllRequestToken_) return teamLogGraphAllSeries_;
    const series = buildAllTeamLogSeriesFromSnapshots_(snapshots, rows, {
      rangeKey: teamLogRange_,
      selectedDate: teamLogSelectedDate_
    });
    if (requestToken !== teamLogGraphAllRequestToken_) return teamLogGraphAllSeries_;
    teamLogGraphAllSeries_ = series;
    return teamLogGraphAllSeries_;
  } finally {
    if (requestToken !== teamLogGraphAllRequestToken_) return;
    teamLogGraphAllLoading_ = false;
    renderTeamLog_();
  }
}

    function formatTeamLogGraphAxisLabel_(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      if (teamLogRange_ === '1D') {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
    }

function formatTeamLogGraphRangeLabel_(logs) {
      if (!logs.length) return teamLogDisplayDate_(teamLogSelectedDate_);
      const first = new Date(logs[0].fetchedAt);
      const last = new Date(logs[logs.length - 1].fetchedAt);
      if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return teamLogDisplayDate_(teamLogSelectedDate_);
      return `${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }

function teamLogGraphZoomLabel_() {
      return `${Math.round(teamLogGraphZoom_ * 100)}%`;
    }

    function clampTeamLogGraphPan_(value) {
      return Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));
    }

    function teamLogGraphAnchorKey_() {
      return teamLogSelectedTeamKey_
        || canonicalTeamName_(teamLogCurrentRow_?.school || '').toLowerCase()
        || '';
    }

    function teamLogGraphAnchorPointForSingle_(logs, timeViewport) {
      const points = (Array.isArray(logs) ? logs : [])
        .map(log => ({
          time: Date.parse(log?.fetchedAt),
          rpi: Number(log?.rpi)
        }))
        .filter(point => Number.isFinite(point.time) && Number.isFinite(point.rpi));
      if (!points.length) return null;
      const visiblePoints = points.filter(point => point.time >= timeViewport.startTime && point.time <= timeViewport.endTime);
      return visiblePoints[visiblePoints.length - 1] || points[points.length - 1] || null;
    }

    function teamLogGraphAnchorPointForAll_() {
      const anchorKey = teamLogGraphAnchorKey_();
      const series = (Array.isArray(teamLogGraphAllSeries_) ? teamLogGraphAllSeries_ : []);
      const matchedSeries = series.find(item => canonicalTeamName_(item?.row?.school || '').toLowerCase() === anchorKey)
        || series.find(item => canonicalTeamName_(item?.row?.school || '').toLowerCase() === canonicalTeamName_(teamLogCurrentRow_?.school || '').toLowerCase())
        || series[0]
        || null;
      if (!matchedSeries) return null;
      const logs = Array.isArray(matchedSeries.logs) ? matchedSeries.logs : [];
      const lastLog = logs[logs.length - 1] || null;
      if (!lastLog) return null;
      const time = Date.parse(lastLog.fetchedAt);
      const rpi = Number(lastLog.rpi);
      if (!Number.isFinite(time) || !Number.isFinite(rpi)) return null;
      return {
        key: canonicalTeamName_(matchedSeries?.row?.school || '').toLowerCase(),
        time,
        rpi
      };
    }

    function teamLogGraphViewport_(minTime, maxTime) {
      const totalSpan = Math.max(maxTime - minTime, 1);
      const zoom = Math.max(teamLogGraphZoom_, 1);
      const visibleSpan = zoom <= 1 ? totalSpan : Math.max(totalSpan / zoom, 1);
      const maxOffset = Math.max(totalSpan - visibleSpan, 0);
      const panRatio = clampTeamLogGraphPan_(teamLogGraphPanX_);
      // Keep graph zoom anchored to the newest data on the right by default.
      const startTime = minTime + (maxOffset * (1 - panRatio));
      return {
        zoom,
        totalSpan,
        visibleSpan,
        maxOffset,
        startTime,
        endTime: startTime + visibleSpan,
        panRatio
      };
    }

    function teamLogGraphValueViewport_(points, timeViewport, options = {}) {
      const normalizedPoints = (Array.isArray(points) ? points : [])
        .filter(point => Number.isFinite(Number(point?.time)) && Number.isFinite(Number(point?.rpi)));
      const visiblePoints = normalizedPoints.filter(point => point.time >= timeViewport.startTime && point.time <= timeViewport.endTime);
      const scalePoints = visiblePoints.length ? visiblePoints : normalizedPoints;
      const rawMin = 0;
      const rawMax = scalePoints.length ? Math.max(...scalePoints.map(point => Number(point.rpi))) : 0;
      const paddedMax = rawMin === rawMax
        ? Math.max(rawMax + 0.0005, 0.01)
        : rawMax + ((rawMax - rawMin) * 0.12);
      const totalRange = Math.max(paddedMax - rawMin, 0.0001);
      const zoom = Math.max(timeViewport.zoom || teamLogGraphZoom_ || 1, 1);
      // When zooming, tighten the visible value range toward the top of the chart
      // so nearby RPI lines spread apart instead of staying compressed near the top.
      const visibleRange = zoom <= 1 ? totalRange : Math.max(totalRange / zoom, 0.0001);
      const anchorRpi = Number(options.anchorRpi);
      const anchorOffsetRatio = 0.16;
      const maxYOffset = Math.max(totalRange - visibleRange, 0);
      const panRatio = clampTeamLogGraphPan_(teamLogGraphPanY_);
      const anchoredDisplayMax = (zoom > 1 && Number.isFinite(anchorRpi))
        ? Math.min(paddedMax, Math.max(anchorRpi + (visibleRange * anchorOffsetRatio), visibleRange))
        : paddedMax;
      const requestedDisplayMax = maxYOffset > 0
        ? paddedMax - (maxYOffset * panRatio)
        : paddedMax;
      const displayMax = zoom > 1 ? requestedDisplayMax : anchoredDisplayMax;
      const displayMin = Math.max(rawMin, displayMax - visibleRange);
      return {
        rawMin,
        rawMax,
        paddedMax,
        totalRange,
        maxYOffset,
        panRatio,
        anchoredDisplayMax,
        displayMin,
        displayMax,
        valueRange: Math.max(displayMax - displayMin, 0.0001)
      };
    }

    function currentTeamLogGraphTimeExtent_() {
      if (teamLogShowAllTeams_) {
        const points = (Array.isArray(teamLogGraphAllSeries_) ? teamLogGraphAllSeries_ : [])
          .flatMap(item => (Array.isArray(item?.logs) ? item.logs : []).map(log => Date.parse(log.fetchedAt)))
          .filter(Number.isFinite);
        if (!points.length) return null;
        return {
          minTime: Math.min(...points),
          maxTime: Math.max(...points)
        };
      }
      const logs = filteredTeamLogGraphEntries_();
      if (!logs.length) return null;
      return {
        minTime: Date.parse(logs[0].fetchedAt),
        maxTime: Date.parse(logs[logs.length - 1].fetchedAt)
      };
    }

    function currentTeamLogGraphPoints_() {
      if (teamLogShowAllTeams_) {
        return (Array.isArray(teamLogGraphAllSeries_) ? teamLogGraphAllSeries_ : [])
          .flatMap(item => (Array.isArray(item?.logs) ? item.logs : []).map(log => ({
            time: Date.parse(log?.fetchedAt),
            rpi: Number(log?.rpi)
          })))
          .filter(point => Number.isFinite(point.time) && Number.isFinite(point.rpi));
      }
      return filteredTeamLogGraphEntries_()
        .map(log => ({
          time: Date.parse(log?.fetchedAt),
          rpi: Number(log?.rpi)
        }))
        .filter(point => Number.isFinite(point.time) && Number.isFinite(point.rpi));
    }

    function applyTeamLogGraphGestureZoom_(zoomFactor, anchorXRatio = 0.88, anchorYRatio = 0.16) {
      const currentExtent = currentTeamLogGraphTimeExtent_();
      if (!currentExtent) return;
      const currentViewport = teamLogGraphViewport_(currentExtent.minTime, currentExtent.maxTime);
      const currentPoints = currentTeamLogGraphPoints_();
      if (!currentPoints.length) return;
      const currentAnchor = teamLogShowAllTeams_
        ? teamLogGraphAnchorPointForAll_()
        : teamLogGraphAnchorPointForSingle_(filteredTeamLogGraphEntries_(), currentViewport);
      const currentValueViewport = teamLogGraphValueViewport_(currentPoints, currentViewport, {
        anchorRpi: currentAnchor?.rpi
      });
      const currentVisibleTimeSpan = Math.max(currentViewport.visibleSpan, 1);
      const anchorTime = currentViewport.startTime + (currentVisibleTimeSpan * Math.max(0, Math.min(1, anchorXRatio)));
      const anchorRpi = currentValueViewport.displayMax - (currentValueViewport.valueRange * Math.max(0, Math.min(1, anchorYRatio)));

      const nextZoom = Math.min(16, Math.max(1, Number((teamLogGraphZoom_ * zoomFactor).toFixed(4))));
      teamLogGraphZoom_ = nextZoom;

      const totalSpan = Math.max(currentExtent.maxTime - currentExtent.minTime, 1);
      const nextVisibleSpan = nextZoom <= 1 ? totalSpan : Math.max(totalSpan / nextZoom, 1);
      const maxOffset = Math.max(totalSpan - nextVisibleSpan, 0);
      const desiredStartTime = anchorTime - (nextVisibleSpan * Math.max(0, Math.min(1, anchorXRatio)));
      const nextStartTime = Math.max(
        currentExtent.minTime,
        Math.min(desiredStartTime, currentExtent.maxTime - nextVisibleSpan)
      );
      const nextPanX = maxOffset > 0
        ? 1 - ((nextStartTime - currentExtent.minTime) / maxOffset)
        : 0;
      teamLogGraphPanX_ = clampTeamLogGraphPan_(nextPanX);

      const nextViewport = teamLogGraphViewport_(currentExtent.minTime, currentExtent.maxTime);
      const nextValueViewportBase = teamLogGraphValueViewport_(currentPoints, nextViewport, {
        anchorRpi: currentAnchor?.rpi
      });
      const nextVisibleRange = nextValueViewportBase.valueRange;
      const desiredDisplayMax = anchorRpi + (nextVisibleRange * Math.max(0, Math.min(1, anchorYRatio)));
      const nextPanY = nextValueViewportBase.maxYOffset > 0
        ? (nextValueViewportBase.paddedMax - desiredDisplayMax) / nextValueViewportBase.maxYOffset
        : 0;
      teamLogGraphPanY_ = clampTeamLogGraphPan_(nextPanY);

      if (teamLogViewMode_ === 'graph') renderTeamLog_();
    }

    function applyTeamLogGraphZoom_(direction) {
      const currentExtent = currentTeamLogGraphTimeExtent_();
      const currentViewport = currentExtent
        ? teamLogGraphViewport_(currentExtent.minTime, currentExtent.maxTime)
        : null;
      const currentAnchorPoint = teamLogShowAllTeams_
        ? teamLogGraphAnchorPointForAll_()
        : teamLogGraphAnchorPointForSingle_(filteredTeamLogGraphEntries_(), currentViewport || { startTime: 0, endTime: Infinity });
      const delta = direction === 'in' ? 0.35 : -0.35;
      teamLogGraphZoom_ = Math.min(16, Math.max(1, Math.round((teamLogGraphZoom_ + delta) * 100) / 100));
      if (currentExtent && currentViewport) {
        const totalSpan = Math.max(currentExtent.maxTime - currentExtent.minTime, 1);
        const visibleSpan = teamLogGraphZoom_ <= 1 ? totalSpan : Math.max(totalSpan / teamLogGraphZoom_, 1);
        const maxOffset = Math.max(totalSpan - visibleSpan, 0);
        const anchorTime = Number.isFinite(Number(currentAnchorPoint?.time))
          ? Number(currentAnchorPoint.time)
          : currentViewport.endTime;
        const anchorRatio = 0.88;
        const desiredStartTime = anchorTime - (visibleSpan * anchorRatio);
        const nextStartTime = Math.max(
          currentExtent.minTime,
          Math.min(desiredStartTime, currentExtent.maxTime - visibleSpan)
        );
        const nextPan = maxOffset > 0
          ? 1 - ((nextStartTime - currentExtent.minTime) / maxOffset)
          : 0;
        teamLogGraphPanX_ = clampTeamLogGraphPan_(nextPan);
        const anchorRpi = Number(currentAnchorPoint?.rpi);
        const points = currentTeamLogGraphPoints_();
        const nextViewport = teamLogGraphViewport_(currentExtent.minTime, currentExtent.maxTime);
        const nextValueViewport = teamLogGraphValueViewport_(points, nextViewport, { anchorRpi });
        const desiredDisplayMax = nextValueViewport.anchoredDisplayMax;
        const nextPanY = nextValueViewport.maxYOffset > 0
          ? (nextValueViewport.paddedMax - desiredDisplayMax) / nextValueViewport.maxYOffset
          : 0;
        teamLogGraphPanY_ = clampTeamLogGraphPan_(nextPanY);
      } else {
        teamLogGraphPanX_ = clampTeamLogGraphPan_(teamLogGraphPanX_);
        teamLogGraphPanY_ = clampTeamLogGraphPan_(teamLogGraphPanY_);
      }
      if (teamLogViewMode_ === 'graph') renderTeamLog_();
    }

    function applyTeamLogGraphPanDelta_(pixelDeltaX, pixelDeltaY, frameWidth, frameHeight) {
      const width = Math.max(Number(frameWidth) || 0, 1);
      const height = Math.max(Number(frameHeight) || 0, 1);
      if (teamLogGraphZoom_ <= 1) return;
      teamLogGraphPanX_ = clampTeamLogGraphPan_(teamLogGraphPanX_ + (pixelDeltaX / width));
      teamLogGraphPanY_ = clampTeamLogGraphPan_(teamLogGraphPanY_ - (pixelDeltaY / height));
      if (teamLogViewMode_ === 'graph') renderTeamLog_();
    }

function renderTeamLogGraph_(logs) {
  const width = 980;
  const height = 420;
      const padTop = 28;
      const padRight = 44;
      const padBottom = 48;
      const padLeft = 42;
      const plotWidth = width - padLeft - padRight;
      const plotHeight = height - padTop - padBottom;
  const hasLogs = logs.length > 0;
  const firstTime = hasLogs ? Date.parse(logs[0].fetchedAt) : 0;
  const lastTime = hasLogs ? Date.parse(logs[logs.length - 1].fetchedAt) : 0;
  const viewport = teamLogGraphViewport_(firstTime, lastTime);
      const pointData = logs.map((log, index) => {
        const time = Date.parse(log.fetchedAt);
        return { ...log, index, time, rpi: Number(log.rpi) };
      });
      const anchorPoint = teamLogGraphAnchorPointForSingle_(logs, viewport);
      const valueViewport = teamLogGraphValueViewport_(pointData, viewport, {
        anchorRpi: anchorPoint?.rpi
      });
      const { displayMin, displayMax, valueRange } = valueViewport;
      const plottedPoints = pointData.map(point => {
        const x = padLeft + (((point.time - viewport.startTime) / Math.max(viewport.visibleSpan, 1)) * plotWidth);
        const y = padTop + ((displayMax - point.rpi) / valueRange) * plotHeight;
        return { ...point, x, y };
      });
      const path = plottedPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
      const areaPath = `${path} L${(padLeft + plotWidth).toFixed(2)} ${(padTop + plotHeight).toFixed(2)} L${padLeft.toFixed(2)} ${(padTop + plotHeight).toFixed(2)} Z`;
      const firstPoint = plottedPoints[0] || null;
      const lastPoint = plottedPoints[plottedPoints.length - 1] || null;
      const overallDelta = hasLogs ? (Number(lastPoint?.rpi) - Number(firstPoint?.rpi)) : 0;
      const trendClass = overallDelta > 0 ? 'up' : (overallDelta < 0 ? 'down' : 'flat');
      const gridLines = Array.from({ length: 4 }, (_, index) => {
        const ratio = index / 3;
        const y = padTop + (ratio * plotHeight);
        const value = displayMax - (ratio * valueRange);
        return `
          <g class="team-log-graph-grid-row">
            <line x1="${padLeft}" y1="${y.toFixed(2)}" x2="${(padLeft + plotWidth).toFixed(2)}" y2="${y.toFixed(2)}" />
            <text x="10" y="${(y + 4).toFixed(2)}">${escapeHtml(value.toFixed(6))}</text>
          </g>`;
      }).join('');
  const rangeButtons = TEAM_LOG_GRAPH_RANGES_.map(range => `
        <button type="button" class="team-log-range-btn${range.key === teamLogRange_ ? ' is-active' : ''}" data-team-log-range="${range.key}">
          ${escapeHtml(range.label)}
        </button>
      `).join('');
  const classOptions = teamLogClassOptions_().map(item => `
        <option value="${escapeHtml(item.value)}"${item.value === teamLogSelectorClass_ ? ' selected' : ''}>${escapeHtml(item.label)}</option>
      `).join('');
  const regionOptions = [
    { value: 'both', label: 'Both' },
    { value: 'east', label: 'East' },
    { value: 'west', label: 'West' }
  ].map(item => `
        <option value="${escapeHtml(item.value)}"${item.value === teamLogSelectorRegion_ ? ' selected' : ''}>${escapeHtml(item.label)}</option>
      `).join('');
  const teamOptions = [
    `<button type="button" class="team-log-team-option${teamLogShowAllTeams_ ? ' is-selected' : ''}" data-team-log-team="${TEAM_LOG_ALL_TEAMS_VALUE_}">
      <span class="team-log-team-option-name">All Teams</span>
      <span class="team-log-team-option-meta">${escapeHtml(teamLogSelectorClass_ || classEl?.value || '')}</span>
    </button>`,
    ...filteredTeamLogSelectorRows_().map(option => `
        <button type="button" class="team-log-team-option${canonicalTeamName_(option.school).toLowerCase() === teamLogSelectedTeamKey_ && !teamLogShowAllTeams_ ? ' is-selected' : ''}" data-team-log-team="${escapeHtml(option.school || '')}">
          <span class="team-log-team-option-name">${escapeHtml(option.school || '')}</span>
          <span class="team-log-team-option-meta">${escapeHtml(option.classification || '')}</span>
        </button>
      `)
  ].join('');
  const showTeamMenu = teamLogTeamMenuOpen_;
  const points = plottedPoints.map((point, index) => `
        <circle class="team-log-graph-point${index === pointData.length - 1 ? ' is-last' : ''}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${index === pointData.length - 1 ? 5.5 : 3.5}" />
      `).join('');
  const startLabel = hasLogs ? formatTeamLogGraphAxisLabel_(firstPoint.fetchedAt) : '';
  const endLabel = hasLogs ? formatTeamLogGraphAxisLabel_(lastPoint.fetchedAt) : '';
  const changeText = hasLogs ? `${overallDelta >= 0 ? '+' : '-'}${Math.abs(overallDelta).toFixed(6)}`.replace(/^([+-])0\./, '$1.') : '+.000000';
  const graphCardHtml = hasLogs ? `
          <div class="team-log-graph-card ${trendClass}">
            <div class="team-log-graph-meta">
              <div>
                <div class="team-log-graph-kicker">RPI TREND</div>
                <div class="team-log-graph-subtitle">${escapeHtml(formatTeamLogGraphRangeLabel_(logs))}</div>
              </div>
              <div class="team-log-graph-change ${trendClass}">
                <span>${escapeHtml(changeText)}</span>
                <small>${escapeHtml(String(logs.length))} point${logs.length === 1 ? '' : 's'}</small>
              </div>
            </div>
            <div class="team-log-graph-frame${teamLogGraphZoom_ > 1 ? ' is-pannable' : ''}" data-team-log-pan-area="1">
              <svg class="team-log-graph-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="RPI trend graph">
                ${gridLines}
                <path class="team-log-graph-area" d="${areaPath}" />
                <path class="team-log-graph-line" d="${path}" />
                ${points}
              </svg>
              <div class="team-log-graph-axis team-log-graph-axis-start">${escapeHtml(formatTeamLogGraphAxisLabel_(new Date(viewport.startTime).toISOString()))}</div>
              <div class="team-log-graph-axis team-log-graph-axis-end">${escapeHtml(formatTeamLogGraphAxisLabel_(new Date(viewport.endTime).toISOString()))}</div>
            </div>
          </div>`
    : `<div class="team-log-empty">No RPI snapshots found for this graph range.</div>`;

  return `
        <div class="team-log-graph-shell">
          <div class="team-log-graph-controls">
            <div class="team-log-range-bar">${rangeButtons}</div>
            <div class="team-log-team-selectors">
              <label class="team-log-graph-select">
                <span class="team-log-graph-select-label">Class</span>
                <select class="team-log-class-select" data-team-log-class>
                  ${classOptions}
                </select>
              </label>
              <label class="team-log-graph-select">
                <span class="team-log-graph-select-label">Region</span>
                <select class="team-log-class-select" data-team-log-region>
                  ${regionOptions}
                </select>
              </label>
              <label class="team-log-graph-select team-log-graph-select-team">
                <span class="team-log-graph-select-label">Team</span>
                <span class="team-log-team-search-wrap">
                  <input
                    type="text"
                    class="team-log-team-search"
                    data-team-log-team-search
                  value="${escapeHtml(teamLogTeamMenuOpen_ ? teamLogTeamSearch_ : teamLogSelectedTeamLabel_())}"
                    placeholder="${escapeHtml(teamLogSelectorLoading_ ? 'Loading teams...' : 'Search team')}"
                    autocomplete="off"
                    ${teamLogSelectorLoading_ ? 'disabled' : ''}
                  />
                  <button type="button" class="team-log-team-toggle" data-team-log-team-toggle aria-label="Toggle team list"${teamLogSelectorLoading_ ? ' disabled' : ''}>
                    <span aria-hidden="true">&#9662;</span>
                  </button>
                </span>
                <div class="team-log-team-menu${showTeamMenu ? ' is-open' : ''}">
                  ${teamOptions || `<div class="team-log-team-empty">${escapeHtml(teamLogSelectorLoading_ ? 'Loading teams...' : 'No matching teams')}</div>`}
                </div>
              </label>
            </div>
          </div>
          ${teamLogShowAllTeams_ ? renderTeamLogAllTeamsGraph_() : graphCardHtml}
        </div>`;
}

function renderTeamLogAllTeamsGraph_() {
  if (teamLogGraphAllLoading_) {
    return `<div class="team-log-empty">Loading team trend lines...</div>`;
  }
  const series = Array.isArray(teamLogGraphAllSeries_) ? teamLogGraphAllSeries_ : [];
  if (!series.length) {
    return `<div class="team-log-empty">No RPI snapshots found for the selected teams and range.</div>`;
  }
  const width = 980;
  const height = 420;
  const padTop = 28;
  const padRight = 110;
  const padBottom = 48;
  const padLeft = 42;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const points = series.flatMap(item => item.logs.map(log => ({ time: Date.parse(log.fetchedAt), rpi: Number(log.rpi) }))).filter(point => Number.isFinite(point.time) && Number.isFinite(point.rpi));
  if (!points.length) {
    return `<div class="team-log-empty">No plottable RPI points found for the selected teams.</div>`;
  }
  const minTime = Math.min(...points.map(point => point.time));
  const maxTime = Math.max(...points.map(point => point.time));
  const viewport = teamLogGraphViewport_(minTime, maxTime);
  const anchorPoint = teamLogGraphAnchorPointForAll_();
  const valueViewport = teamLogGraphValueViewport_(points, viewport, {
    anchorRpi: anchorPoint?.rpi
  });
  const { displayMin, displayMax, valueRange } = valueViewport;
  const selectedKey = teamLogSelectedTeamKey_ || canonicalTeamName_(teamLogCurrentRow_?.school || '').toLowerCase();
  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const y = padTop + (ratio * plotHeight);
    const value = displayMax - (ratio * valueRange);
    return `
      <g class="team-log-graph-grid-row">
        <line x1="${padLeft}" y1="${y.toFixed(2)}" x2="${(padLeft + plotWidth).toFixed(2)}" y2="${y.toFixed(2)}" />
        <text x="10" y="${(y + 4).toFixed(2)}">${escapeHtml(value.toFixed(6))}</text>
      </g>`;
  }).join('');
  const linePaths = series.map(item => {
    const pts = item.logs.map((log, index) => {
      const time = Date.parse(log.fetchedAt);
      const x = padLeft + (((time - viewport.startTime) / Math.max(viewport.visibleSpan, 1)) * plotWidth);
      const y = padTop + ((displayMax - Number(log.rpi)) / valueRange) * plotHeight;
      return { ...log, index, x, y };
    });
    const path = pts.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const key = canonicalTeamName_(item.row?.school || '').toLowerCase();
    const selected = key === selectedKey;
    const lastPoint = pts[pts.length - 1];
    const logoUrl = normalizeDriveImageUrl_(item.row?.mapLogoUrl || item.row?.logoUrl || '');
    const teamColor = getTeamGraphColor_(item.row?.school, item.row);
    const clipId = `team-log-clip-${escapeHtml(key.replace(/[^a-z0-9]+/gi, '-'))}`;
    const logoSize = selected ? 26 : 22;
    const half = logoSize / 2;
    const markerHtml = logoUrl && lastPoint ? `
      <defs>
        <clipPath id="${clipId}">
          <rect x="${(lastPoint.x - half).toFixed(2)}" y="${(lastPoint.y - half).toFixed(2)}" width="${logoSize}" height="${logoSize}" rx="7" ry="7"></rect>
        </clipPath>
      </defs>
      <rect class="team-log-graph-logo-bg${selected ? ' is-selected' : ''}" x="${(lastPoint.x - half - 2).toFixed(2)}" y="${(lastPoint.y - half - 2).toFixed(2)}" width="${logoSize + 4}" height="${logoSize + 4}" rx="8" ry="8"></rect>
      <image href="${escapeHtml(logoUrl)}" xlink:href="${escapeHtml(logoUrl)}" x="${(lastPoint.x - half).toFixed(2)}" y="${(lastPoint.y - half).toFixed(2)}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"></image>`
      : '';
    return `
      <g class="team-log-graph-series${selected ? ' is-selected' : ''}" style="--team-log-series-color:${escapeHtml(teamColor)};">
        <path class="team-log-graph-multi-line" d="${path}" stroke="${escapeHtml(teamColor)}"></path>
        ${markerHtml}
      </g>`;
  }).join('');
  const firstTimeLabel = formatTeamLogGraphAxisLabel_(new Date(viewport.startTime).toISOString());
  const lastTimeLabel = formatTeamLogGraphAxisLabel_(new Date(viewport.endTime).toISOString());
  return `
    <div class="team-log-graph-card team-log-graph-card-all">
      <div class="team-log-graph-meta">
        <div>
          <div class="team-log-graph-kicker">RPI TREND</div>
          <div class="team-log-graph-subtitle">All teams in ${escapeHtml(teamLogSelectorClass_ || classEl?.value || '')}</div>
        </div>
        <div class="team-log-graph-change flat">
          <span>${escapeHtml(String(series.length))}</span>
          <small>teams plotted</small>
        </div>
      </div>
      <div class="team-log-graph-frame${teamLogGraphZoom_ > 1 ? ' is-pannable' : ''}" data-team-log-pan-area="1">
        <svg class="team-log-graph-svg team-log-graph-svg-all" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="All teams RPI trend graph">
          ${gridLines}
          ${linePaths}
        </svg>
        <div class="team-log-graph-axis team-log-graph-axis-start">${escapeHtml(firstTimeLabel)}</div>
        <div class="team-log-graph-axis team-log-graph-axis-end">${escapeHtml(lastTimeLabel)}</div>
      </div>
    </div>`;
}

function teamLogGraphBodyHtml_(logs) {
  return teamLogShowAllTeams_ ? renderTeamLogAllTeamsGraph_() : renderTeamLogGraph_(logs);
}

    function renderTeamLogLoading_(row) {
      if (!teamLogContent) return;
      syncTeamLogDateControls_();
      teamLogContent.innerHTML = `
        ${teamPanelHeadHtml_({
          row,
          titleId: 'teamLogTitle',
          title: row.school || 'Team RPI Log',
          subtitleHtml: escapeHtml('Loading RPI snapshot log')
        })}
        <div class="team-schedule-loading">
          <div>
            <div class="team-schedule-spinner" aria-hidden="true"></div>
            Pulling RPI log...
          </div>
        </div>`;
      armImageFallbacks_(teamLogContent);
    }

    function renderTeamLogError_(row, err) {
      if (!teamLogContent) return;
      syncTeamLogDateControls_();
      teamLogContent.innerHTML = `
        ${teamPanelHeadHtml_({
          row,
          titleId: 'teamLogTitle',
          title: row.school || 'Team RPI Log',
          subtitleHtml: escapeHtml('RPI log unavailable')
        })}
        <div class="team-log-empty">
          Could not load this team RPI log.<br>${escapeHtml(err?.message || String(err || ''))}
        </div>`;
      armImageFallbacks_(teamLogContent);
    }

        function renderTeamLog_() {
      const row = teamLogCurrentRow_ || {};
      const result = teamLogCurrentResult_ || {};
      if (!teamLogContent) return;
      const allLogs = normalizeTeamLogEntries_(teamLogCurrentResult_?.logs || []);
      const logs = filteredTeamLogEntries_();
      const graphLogs = filteredTeamLogGraphEntries_();
      const rangeMeta = TEAM_LOG_GRAPH_RANGES_.find(item => item.key === teamLogRange_) || TEAM_LOG_GRAPH_RANGES_[TEAM_LOG_GRAPH_RANGES_.length - 1];
      const seasonYear = String(result?.seasonYear || selectedRpiYear_() || 'live').trim();
      const toolbarLabel = seasonYear === 'live' ? 'Live RPI snapshot history' : `${seasonYear} RPI snapshot history`;
      const toolbarDate = teamLogViewMode_ === 'graph'
        ? `${teamLogDisplayDate_(teamLogSelectedDate_)} | ${rangeMeta.label}`
        : teamLogDisplayDate_(teamLogSelectedDate_);
      syncTeamLogDateControls_();
      const toolbarDateDisplay = String(toolbarDate).replace(/[^ -~]/g, '|').replace(/\|\|+/g, '|');
      const toolbarDateHtml = teamLogToolbarDateHtml_(toolbarDateDisplay);
      const toolbarActionsHtml = teamLogToolbarActionsHtml_();
      const useMobileLogList = teamLogViewMode_ === 'table' && isMobileViewport_();
      const rowsHtml = logs.map(log => {
        const rankChange = Number(log.rankChange);
        const rowClass = Number.isFinite(rankChange)
          ? (rankChange > 0 ? ' is-rank-up' : (rankChange < 0 ? ' is-rank-down' : ''))
          : '';
        return `
          <tr class="team-log-row${rowClass}">
            <td class="team-log-timestamp-cell" data-col="timestamp">${teamLogTimestampHtml_(log.fetchedAt)}</td>
            <td class="is-centered" data-col="change">${formatTeamLogRankChange_(log.rankChange)}</td>
            <td class="is-centered" data-col="rank"><span class="team-log-rank-pill">#${escapeHtml(log.rank ?? '-')}</span></td>
            <td class="is-centered" data-col="record"><span class="team-log-rpi-pill">${escapeHtml(log.record || '-')}</span></td>
            <td class="is-centered" data-col="wp"><span class="team-log-rpi-pill">${escapeHtml(log.wp || '-')}</span></td>
            <td class="is-centered" data-col="owp"><span class="team-log-rpi-pill">${escapeHtml(log.owp || '-')}</span></td>
            <td class="is-centered" data-col="oowp"><span class="team-log-rpi-pill">${escapeHtml(log.oowp || '-')}</span></td>
            <td class="is-centered" data-col="rpi"><span class="team-log-rpi-pill">${escapeHtml(typeof log.rpi === 'number' ? log.rpi.toFixed(6) : (log.rpi || '-'))}</span></td>
            <td class="is-centered" data-col="rpi-delta">${formatTeamLogRpiChange_(log.rpiChange)}</td>
          </tr>
        `;
      }).join('');

      teamLogContent.innerHTML = `
        ${teamPanelHeadHtml_({
          row,
          titleId: 'teamLogTitle',
          title: row.school || 'Team RPI Log',
          subtitleHtml: `<span>${escapeHtml(toolbarLabel)}</span><span>${escapeHtml(result?.sport || sportEl?.value || '')} ${escapeHtml(result?.classification || classEl?.value || '')}</span>`,
          actionsHtml: teamLogInlineActionButtonsHtml_(),
          wrapClass: 'team-log-title-wrap',
          copyClass: 'team-log-heading-copy'
        })}
        <div class="team-log-body">
          <div class="team-log-toolbar">
            ${toolbarDateHtml}
            ${toolbarActionsHtml}
          </div>
          ${teamLogViewMode_ === 'graph'
            ? renderTeamLogGraph_(graphLogs)
            : (useMobileLogList
              ? renderTeamLogMobileList_(logs)
              : (rowsHtml ? `
            <div class="team-log-table-wrap">
              <table class="team-log-table">
                <colgroup>
                  <col class="team-log-col team-log-col-timestamp">
                  <col class="team-log-col team-log-col-change">
                  <col class="team-log-col team-log-col-rank">
                  <col class="team-log-col team-log-col-record">
                  <col class="team-log-col team-log-col-stat">
                  <col class="team-log-col team-log-col-stat">
                  <col class="team-log-col team-log-col-stat">
                  <col class="team-log-col team-log-col-rpi">
                  <col class="team-log-col team-log-col-rpi-delta">
                </colgroup>
                <thead>
                  <tr>
                    <th data-col="timestamp">Timestamp</th>
                    <th class="is-centered" data-col="change">▲/▼</th>
                    <th class="is-centered" data-col="rank">Rank</th>
                    <th class="is-centered" data-col="record">Record</th>
                    <th class="is-centered" data-col="wp">WP</th>
                    <th class="is-centered" data-col="owp">OWP</th>
                    <th class="is-centered" data-col="oowp">OOWP</th>
                    <th class="is-centered" data-col="rpi">RPI</th>
                    <th class="is-centered" data-col="rpi-delta">+/-</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          ` : `<div class="team-log-empty">${escapeHtml(allLogs.length ? 'No RPI snapshots found for the selected day.' : 'No RPI snapshots found for this team yet.')}</div>`))}
        </div>`;
      armImageFallbacks_(teamLogContent);
    }

async function openTeamLogCard_(row, options = {}) {
  if (!row?.school || !teamLogOverlay || !teamLogContent) return;
  closeTeamScheduleCard_();
  const nextClassification = options.classification || row?.classification || classEl?.value || '';
  const nextSport = options.sport || row?.sport || sportEl?.value || '';
  teamLogCurrentRow_ = { ...row, classification: nextClassification, sport: nextSport };
  teamLogCurrentResult_ = null;
  teamLogSelectedDate_ = '';
  teamLogExpandedEntryKey_ = '';
  teamLogViewMode_ = 'graph';
  teamLogRange_ = 'ALL';
  teamLogGraphZoom_ = 1;
  teamLogGraphPanX_ = 0;
  teamLogGraphPanY_ = 0;
  if (!options.preserveSelectorState) {
    teamLogSelectorClass_ = nextClassification || classEl?.value || '';
    teamLogTeamSearch_ = '';
    teamLogSelectorRows_ = [];
    teamLogSelectorLoading_ = false;
    teamLogTeamMenuOpen_ = false;
    teamLogShowAllTeams_ = false;
  } else {
    teamLogSelectorClass_ = teamLogSelectorClass_ || nextClassification || classEl?.value || '';
    teamLogTeamSearch_ = '';
    teamLogTeamMenuOpen_ = false;
    if (!options.keepAllTeams) teamLogShowAllTeams_ = false;
  }
  teamLogSelectedTeamKey_ = canonicalTeamName_(row?.school || '').toLowerCase();
  syncTeamLogDateControls_();
  const token = ++teamLogRequestToken_;
  teamLogOverlay.classList.add('open');
  teamLogOverlay.setAttribute('aria-hidden', 'false');
  renderTeamLogLoading_(teamLogCurrentRow_);

  try {
    const result = await fetchTeamRpiLog_(teamLogCurrentRow_, {
      classification: nextClassification,
      sport: nextSport
    });
    if (token !== teamLogRequestToken_) return;
    teamLogCurrentResult_ = {
      ...result,
      classification: nextClassification,
      sport: nextSport,
      logs: normalizeTeamLogEntries_(result?.logs || [])
    };
    teamLogSelectedDate_ = teamLogAvailableDates_()[0] || '';
    renderTeamLog_();
    if (!options.preserveSelectorState || !teamLogSelectorRows_.length) {
      ensureTeamLogSelectorRows_(teamLogSelectorClass_);
    }
    if (teamLogShowAllTeams_) {
      ensureTeamLogAllSeries_();
    }
  } catch (err) {
    if (token !== teamLogRequestToken_) return;
    console.warn('Team RPI log unavailable:', err);
    renderTeamLogError_(teamLogCurrentRow_, err);
  }
}

function applyTeamLogDateSelection_(value) {
  if (!teamLogCurrentResult_) return;
  const dates = teamLogAvailableDates_();
  teamLogSelectedDate_ = dates.includes(value) ? value : (dates[0] || '');
  teamLogExpandedEntryKey_ = '';
  teamLogGraphZoom_ = 1;
  teamLogGraphPanX_ = 0;
  teamLogGraphPanY_ = 0;
  if (teamLogViewMode_ === 'graph' && teamLogShowAllTeams_) {
    ensureTeamLogAllSeries_();
    return;
  }
  renderTeamLog_();
}

function toggleTeamLogView_() {
  if (!normalizeTeamLogEntries_(teamLogCurrentResult_?.logs || []).length) return;
  teamLogViewMode_ = teamLogViewMode_ === 'graph' ? 'table' : 'graph';
  if (teamLogViewMode_ === 'graph') teamLogExpandedEntryKey_ = '';
  if (teamLogViewMode_ === 'graph' && teamLogShowAllTeams_) {
    ensureTeamLogAllSeries_();
    return;
  }
  renderTeamLog_();
}

function applyTeamLogRangeSelection_(value) {
  const next = TEAM_LOG_GRAPH_RANGES_.find(item => item.key === value);
  if (!next) return;
  teamLogRange_ = next.key;
  teamLogGraphZoom_ = 1;
  teamLogGraphPanX_ = 0;
  teamLogGraphPanY_ = 0;
  if (teamLogViewMode_ === 'graph' && teamLogShowAllTeams_) {
    ensureTeamLogAllSeries_();
    return;
  }
  if (teamLogViewMode_ === 'graph') renderTeamLog_();
}

// ============================================================================
// 6. Team identity, logo, color, and canonical-name lookup helpers
// ============================================================================

    function escapeRegex_(str) { return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function acronymKey_(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function applyAcronymOverrides_(name, cfg) {
      const map = cfg?.acronymOverrides || null;
      if (!map) return name;
      const k = acronymKey_(name);
      return map[k] || name;
    }

    function canonicalTeamName_(name, cfg = APP.TeamNameNormalize) {
      let s = String(name || '');
      s = applyAcronymOverrides_(s, cfg);
      s = s
        .replace(/\u00A0/g, ' ')
        .replace(/[’‘]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/\u00E2\u20AC\u2122|\u00E2\u20AC\u02DC/g, "'")
        .replace(/\u00E2\u20AC\u201C|\u00E2\u20AC\u201D/g, '-');
      for (const r of (cfg.phraseReplacements || [])) s = s.replace(r.from, r.to);
      if (cfg.removeLeadingThe) s = s.replace(/^\s*the\b\s+/i, '');
      s = s.replace(/[^A-Za-z0-9 ]+/g, ' ');
      for (const p of (cfg.removePhrases || [])) {
        const re = new RegExp('\\b' + escapeRegex_(p).replace(/\s+/g, '\\s+') + '\\b', 'ig');
        s = s.replace(re, ' ');
      }
      for (const t of (cfg.removeTokens || [])) {
        const re = new RegExp('\\b' + escapeRegex_(t) + '\\b', 'ig');
        s = s.replace(re, ' ');
      }
      if (cfg.removeTrailingSchool) s = s.replace(/\bschool\b\s*$/i, '');
      return s.replace(/\s+/g, ' ').trim();
    }

    function splitAliasList_(value) { return String(value || '').split(/[,;\n|]/).map(s => s.trim()).filter(Boolean); }

    function sportKeyFromLabel_(s) {
      const v = String(s || '').toLowerCase();
      const isBasket = v.includes('basket');
      const isSoccer = v.includes('soccer') || v.includes('⚽');
      const isBoys = v.includes('boys') || v.includes('men') || v.includes('mens');
      const isGirls = v.includes('girls') || v.includes('women') || v.includes('womens');
      if (isBasket) return isBoys ? 'boys' : 'girls';
      if (isSoccer && isBoys) return 'boys_soccer';
      if (isSoccer && isGirls) return 'girls_soccer';
      if (v.includes('football')) return 'football';
      if (v.includes('baseball')) return 'baseball';
      if (v.includes('softball')) return 'softball';
      if (v.includes('volleyball')) return 'volleyball';
      if (isBoys && !isGirls) return 'boys';
      if (isGirls && !isBoys) return 'girls';
      return 'girls';
    }

    function sportEmojiFromLabel_(label) {
      const key = sportKeyFromLabel_(label);
      const sportLabel = SPORT_KEY_LABEL_[key];
      return SPORT_UI_[sportLabel]?.emoji || '\u{1F3C6}';
    }

    function sportHeaderIconHtml_(label) {
      const meta = SPORT_UI_[sportUiKey_(label)];
      if (meta?.image) return sportImageHtml_('sport-header-icon', meta.image, ' crossorigin="anonymous" referrerpolicy="no-referrer"');
      return escapeHtml(sportEmojiFromLabel_(label));
    }

    function getSportConfig_(sportKey) {
      if (sportKey === 'boys' || sportKey === 'girls') return { kind: 'basketball', url: APP.FetchRpi.sportUrls.basketball };
      const map = {
        football: APP.FetchRpi.sportUrls.football,
        baseball: APP.FetchRpi.sportUrls.baseball,
        softball: APP.FetchRpi.sportUrls.softball,
        volleyball: APP.FetchRpi.sportUrls.volleyball,
        girls_soccer: APP.FetchRpi.sportUrls.girlsSoccer,
        boys_soccer: APP.FetchRpi.sportUrls.boysSoccer
      };
      return { kind: 'single_table', url: map[sportKey] };
    }

    function getOptOutEntriesForSport_(sportKey) {
      const cfg = APP.OptOut || {};
      const allTeams = Array.isArray(cfg.all) ? cfg.all : [];
      const sportTeams = Array.isArray(cfg[sportKey]) ? cfg[sportKey] : [];
      const seen = new Set();
      return allTeams.concat(sportTeams)
        .map(label => String(label || '').trim())
        .filter(label => {
          if (!label) return false;
          const key = label.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    function teamDetailOptOutKeys_(teamObj) {
      const keys = new Set();
      if (!teamObj) return keys;
      if (teamObj.name) keys.add(canonicalTeamName_(teamObj.name));
      splitAliasList_(teamObj.aliases).forEach(v => keys.add(canonicalTeamName_(v)));
      return new Set([...keys].filter(Boolean));
    }

    function findTeamDetailForOptOutKey_(rowKey, tdMap = null) {
      if (!rowKey || !tdMap) return null;
      const seen = new Set();
      for (const teamObj of tdMap.values()) {
        if (!teamObj || seen.has(teamObj)) continue;
        seen.add(teamObj);
        if (teamDetailOptOutKeys_(teamObj).has(rowKey)) return teamObj;
      }
      return null;
    }

    function filterOptedOutTeams_(rows, sportKey, tdMap = null) {
      const optOutLabels = getOptOutEntriesForSport_(sportKey);
      if (!optOutLabels.length) return { rows, excludedTeams: [] };

      const optOutEntries = optOutLabels.map(label => ({
        label,
        key: canonicalTeamName_(label)
      })).filter(entry => entry.key);

      if (!optOutEntries.length) return { rows, excludedTeams: [] };

      const excludedTeams = [];
      const filteredRows = (Array.isArray(rows) ? rows : []).filter(row => {
        const school = String(row?.school || row?.team || '').trim();
        const rowKey = canonicalTeamName_(school);
        if (!rowKey) return true;
        const teamObj = findTeamDetailForOptOutKey_(rowKey, tdMap);
        const rowKeys = teamDetailOptOutKeys_(teamObj);
        rowKeys.add(rowKey);

        const matchedEntry = optOutEntries.find(entry => rowKeys.has(entry.key)) || null;
        if (!matchedEntry) return true;

        excludedTeams.push({
          label: matchedEntry.label,
          school,
          record: String(row?.record || '').trim()
        });
        return false;
      });

      return { rows: filteredRows, excludedTeams };
    }

    // ============================================================================
    // 7. Data loading, parsing, and live/fallback RPI source helpers
    // ============================================================================

    // TeamDetails loading plus live/fallback RPI data sources.
    async function fetchTeamDetailsMap_() {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${TEAMDETAILS_GID}&tqx=out:json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`TeamDetails fetch failed (${res.status})`);
      const text = await res.text();
      const jsonText = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?$/s)?.[1];
      if (!jsonText) throw new Error('Could not parse TeamDetails response');
      const data = JSON.parse(jsonText);
      const rows = data.table.rows || [];
      const cols = data.table.cols || [];
      const map = new Map();

      const findColIndex_ = (...candidates) => {
        const normalizedCandidates = candidates.map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
        return cols.findIndex(col => {
          const id = String(col?.id || '').trim().toLowerCase();
          const label = String(col?.label || '').trim().toLowerCase();
          return normalizedCandidates.includes(id) || normalizedCandidates.includes(label);
        });
      };

      const classCol = findColIndex_('a', 'class');
      const nameCol = findColIndex_('c', 'name');
      const aliasesCol = findColIndex_('d', 'aliases');
      const mascotCol = findColIndex_('e', 'mascots', 'mascot');
      const longitudeCol = findColIndex_('f', 'longitude');
      const mapLogoCol = findColIndex_('g', 'logourl');
      const keyAcrCol = findColIndex_('h', 'keyacr');
      const keyNameCol = findColIndex_('i', 'keyname');
      const keyAliasesCol = findColIndex_('j', 'keyailases', 'keyaliases');
      const dominantHexCol = findColIndex_('k', 'dominant_hex');
      const secondaryHexCol = findColIndex_('l', 'secondary_hex');
      const logoCol = findColIndex_('m', 'logos');
      const maxPrepsCol = findColIndex_('n', 'maxpreps');
      const latitudeCol = findColIndex_('t', 'latitude');

      function getCellString_(cell) {
        if (!cell) return '';
        return String(cell.f ?? cell.v ?? '').trim();
      }

      function extractLogoUrl_(value) {
        const s = String(value || '').trim();
        if (!s) return '';
        let m = s.match(/^=IMAGE\("([^"]+)"\)$/i);
        if (m && m[1]) return m[1].trim();
        m = s.match(/https:\/\/drive\.google\.com\/uc\?export=view&id=[A-Za-z0-9_-]+/i);
        if (m && m[0]) return m[0].trim();
        if (/^https?:\/\//i.test(s)) return s;
        return '';
      }

      for (const row of rows) {
        const rawCells = row.c || [];
        const cells = rawCells.map(getCellString_);
        const mapLogoFromG = extractLogoUrl_(getCellString_(rawCells[mapLogoCol >= 0 ? mapLogoCol : 6]));
        const logoFromM = extractLogoUrl_(getCellString_(rawCells[logoCol >= 0 ? logoCol : 12]));
        const maxPrepsBySport = {};
        let maxPrepsUrl = getCellString_(rawCells[maxPrepsCol >= 0 ? maxPrepsCol : 13]) || '';

        rawCells.forEach((cell, index) => {
          const cellUrl = maxPrepsUrlFromText_(getCellString_(cell));
          if (!cellUrl) return;
          const colLabel = String(cols[index]?.label || cols[index]?.id || '').trim();
          const sportKey = sportKeyFromMaybeSportText_(colLabel) || maxPrepsSportKeyFromUrl_(cellUrl);
          if (sportKey && !maxPrepsBySport[sportKey]) maxPrepsBySport[sportKey] = cellUrl;
          if (!maxPrepsUrl) maxPrepsUrl = cellUrl;
        });

        const teamObj = {
          teamClass: String(cells[classCol >= 0 ? classCol : 0] || '').trim(),
          name: String(cells[nameCol >= 0 ? nameCol : 2] || '').trim(),
          aliases: String(cells[aliasesCol >= 0 ? aliasesCol : 3] || '').trim(),
          mascot: String(cells[mascotCol >= 0 ? mascotCol : 4] || '').trim(),
          longitude: String(cells[longitudeCol >= 0 ? longitudeCol : 5] || '').trim(),
          logoUrl: logoFromM,
          mapLogoUrl: mapLogoFromG,
          keyAcr: String(cells[keyAcrCol >= 0 ? keyAcrCol : 7] || '').trim(),
          keyName: String(cells[keyNameCol >= 0 ? keyNameCol : 8] || '').trim(),
          keyAliases: String(cells[keyAliasesCol >= 0 ? keyAliasesCol : 9] || '').trim(),
          dominantHex: String(cells[dominantHexCol >= 0 ? dominantHexCol : 10] || '').trim(),
          secondaryHex: String(cells[secondaryHexCol >= 0 ? secondaryHexCol : 11] || '').trim(),
          latitude: String(cells[latitudeCol >= 0 ? latitudeCol : 18] || '').trim(),
          maxPrepsUrl,
          maxPrepsBySport
        };

        const keys = new Set();
        if (teamObj.keyName) keys.add(canonicalTeamName_(teamObj.keyName));
        if (teamObj.keyAcr) keys.add(canonicalTeamName_(teamObj.keyAcr));
        if (teamObj.name) keys.add(canonicalTeamName_(teamObj.name));
        splitAliasList_(teamObj.keyAliases).forEach(v => keys.add(canonicalTeamName_(v)));
        splitAliasList_(teamObj.aliases).forEach(v => keys.add(canonicalTeamName_(v)));

        for (const k of keys) if (k) map.set(k, teamObj);
      }
      return map;
    }

    async function fetchDirectHtml_(url, options = {}) {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
      return await res.text();
    }

    function uniqueEndpoints_(endpoints) {
      return [...new Set(endpoints.filter(Boolean))];
    }

    function configuredApiEndpoint_(pathWithQuery) {
      if (!API_BASE_URL_) return '';
      const path = String(pathWithQuery || '');
      return `${API_BASE_URL_}${path.startsWith('/') ? path : `/${path}`}`;
    }

    function localFetchPageEndpointCandidates_() {
      const local = window.location.protocol === 'file:'
        ? ['http://localhost:8000/fetch-page', '/fetch-page']
        : ['/fetch-page', 'http://localhost:8000/fetch-page'];
      return uniqueEndpoints_([configuredApiEndpoint_('/fetch-page'), ...local]);
    }

    function proxyFetchOptions_(options = {}) {
      const clean = { ...options };
      if (clean.body instanceof URLSearchParams) {
        clean.body = clean.body.toString();
      } else if (clean.body instanceof FormData) {
        clean.body = new URLSearchParams(clean.body).toString();
      } else if (clean.body != null && typeof clean.body !== 'string') {
        clean.body = String(clean.body);
      }
      return clean;
    }

    async function fetchViaLocalProxy_(url, options = {}) {
      let lastErr = null;
      const proxyOptions = proxyFetchOptions_(options);
      for (const endpoint of localFetchPageEndpointCandidates_()) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, options: proxyOptions })
          });
          if (!res.ok) {
            let message = `Local proxy failed (${res.status})`;
            try {
              const err = await res.json();
              if (err && err.error) message = err.error;
            } catch (e) {}
            throw new Error(message);
          }
          return await res.text();
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('Local proxy failed');
    }

    async function fetchViaCorsProxyIo_(url, options = {}) {
      const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
      const res = await fetch(proxyUrl, options);
      if (!res.ok) throw new Error(`corsproxy.io failed (${res.status})`);
      return await res.text();
    }

    async function fetchViaCodeTabs_(url, options = {}) {
      const proxyUrl = 'https://api.codetabs.com/cors-proxy/?' + url;
      const res = await fetch(proxyUrl, options);
      if (!res.ok) throw new Error(`CodeTabs proxy failed (${res.status})`);
      return await res.text();
    }

    async function fetchPageHtml_(url, options = {}) {
      const attempts = [
        () => fetchViaLocalProxy_(url, options),
        () => fetchViaCorsProxyIo_(url, options),
        () => fetchViaCodeTabs_(url, options),
        () => fetchDirectHtml_(url, options)
      ];

      let lastErr = null;
      for (const attempt of attempts) {
        try {
          const html = await attempt();
          if (html && String(html).trim()) return html;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('Unable to fetch page HTML');
    }

    const FALLBACK_RPI_TITLES_ = {
      football: 'Football Final RPI',
      boys: 'Boys Basketball Final RPI',
      girls: 'Girls Basketball Final RPI',
      baseball: 'Baseball Final RPI',
      softball: 'Softball Final RPI',
      volleyball: 'Volleyball Final RPI',
      girls_soccer: 'Girls Soccer Final RPI',
      boys_soccer: 'Boys Soccer Final RPI'
    };
    let fallbackRpiIndexPromise_ = null;

    function parseCsvRows_(text) {
      const rows = [];
      let row = [];
      let field = '';
      let inQuotes = false;
      const s = String(text || '');

      for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        const next = s[i + 1];
        if (inQuotes) {
          if (ch === '"' && next === '"') {
            field += '"';
            i += 1;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            field += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(field);
          field = '';
        } else if (ch === '\n') {
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
        } else if (ch !== '\r') {
          field += ch;
        }
      }

      row.push(field);
      if (row.some(cell => String(cell || '').trim())) rows.push(row);
      return rows;
    }

    function cleanFallbackCell_(value) {
      return String(value ?? '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function fallbackClassValue_(value) {
      const m = cleanFallbackCell_(value).match(/\bClass\s*([1-8]A)\b/i);
      return m ? `Class ${m[1].toUpperCase()}` : '';
    }

    function fallbackYearValue_(value) {
      return seasonYearLabel_(cleanFallbackCell_(value));
    }

    function fallbackCsvUrl_() {
      return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${OFFICIAL_RPI_FALLBACK_GID}`;
    }

    function fallbackGvizUrl_() {
      return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${OFFICIAL_RPI_FALLBACK_GID}&tqx=out:json&headers=4`;
    }

    function isFallbackHeaderRow_(row, startCol) {
      const school = cleanFallbackCell_(row[startCol + 1]);
      const classCell = cleanFallbackCell_(row[startCol + 2]);
      return /^school$/i.test(school) && /^class$/i.test(classCell);
    }

    function isFallbackClassBannerRow_(row, startCol) {
      const rankCell = cleanFallbackCell_(row[startCol]);
      const classCell = fallbackClassValue_(rankCell);
      if (!classCell || /^\d+$/.test(rankCell)) return '';
      const rest = Array.from({ length: 8 }, (_, i) => cleanFallbackCell_(row[startCol + i + 1]));
      return rest.every(cell => !cell) ? classCell : '';
    }

    function addFallbackRowToTable_(table, row, startCol, currentClass = '') {
      const rank = cleanFallbackCell_(row[startCol]);
      const school = cleanFallbackCell_(row[startCol + 1]);
      const classValue = fallbackClassValue_(row[startCol + 2]) || currentClass;
      const rpi = cleanFallbackCell_(row[startCol + 3]);
      const wp = cleanFallbackCell_(row[startCol + 4]);
      const mwp = cleanFallbackCell_(row[startCol + 5]);
      const owp = cleanFallbackCell_(row[startCol + 6]);
      const oowp = cleanFallbackCell_(row[startCol + 7]);
      const record = cleanFallbackCell_(row[startCol + 8]);

      if (!/^\d+$/.test(rank) || !school || !classValue || !rpi) return false;
      if (!table.rowsByClass[classValue]) table.rowsByClass[classValue] = [];
      table.rowsByClass[classValue].push({
        team: canonicalTeamName_(school),
        record,
        wp,
        mwp,
        owp,
        oowp,
        rpi,
        source: 'fallback'
      });
      return true;
    }

    function parseFallbackRpiIndex_(csvText) {
      const csvRows = parseCsvRows_(csvText);
      const index = {};

      Object.entries(FALLBACK_RPI_TITLES_).forEach(([sportKey, title]) => {
        const starts = [];
        csvRows.forEach((row, rowIndex) => {
          row.forEach((cell, colIndex) => {
            if (cleanFallbackCell_(cell).toLowerCase() === title.toLowerCase()) {
              starts.push({ rowIndex, colIndex });
            }
          });
        });

        const tables = starts.map((start, startIndex) => {
          const nextStart = starts[startIndex + 1];
          const endRow = nextStart ? nextStart.rowIndex : csvRows.length;
          const rowsByClass = {};
          const table = { sportKey, title, year: '', rowsByClass, rowIndex: start.rowIndex };
          let currentClass = '';

          for (let rowIndex = start.rowIndex + 1; rowIndex < endRow; rowIndex += 1) {
            const row = csvRows[rowIndex] || [];
            const startValue = cleanFallbackCell_(row[start.colIndex]);
            if (!startValue && !row.slice(start.colIndex, start.colIndex + 9).some(cell => cleanFallbackCell_(cell))) continue;
            if (isFallbackHeaderRow_(row, start.colIndex)) continue;
            const yearValue = fallbackYearValue_(startValue);
            if (yearValue) {
              table.year = yearValue;
              continue;
            }
            const classBanner = isFallbackClassBannerRow_(row, start.colIndex);
            if (classBanner) {
              currentClass = classBanner;
              continue;
            }
            addFallbackRowToTable_(table, row, start.colIndex, currentClass);
          }

          return table;
        }).filter(table => table.year && Object.keys(table.rowsByClass).length);

        tables.sort((a, b) => seasonYearSortValue_(b.year) - seasonYearSortValue_(a.year) || b.rowIndex - a.rowIndex);
        index[sportKey] = {
          tables,
          years: [...new Set(tables.map(table => table.year))],
          latestYear: tables[0]?.year || ''
        };
      });

      return index;
    }

    function parseFallbackRpiIndexFromGviz_(gvizText) {
      const jsonText = String(gvizText || '').match(/google\.visualization\.Query\.setResponse\((.*)\);?$/s)?.[1];
      if (!jsonText) throw new Error('Could not parse fallback RPI sheet response');
      const data = JSON.parse(jsonText);
      const cols = data.table?.cols || [];
      const rows = (data.table?.rows || []).map(row => {
        const cells = row.c || [];
        return cols.map((_, i) => cleanFallbackCell_(cells[i]?.f ?? cells[i]?.v ?? ''));
      });
      const index = {};

      Object.entries(FALLBACK_RPI_TITLES_).forEach(([sportKey, title]) => {
        const startCol = cols.findIndex(col => cleanFallbackCell_(col.label).toLowerCase().startsWith(title.toLowerCase()));
        const firstYear = fallbackYearValue_(cols[startCol]?.label);
        if (startCol < 0 || !firstYear) {
          index[sportKey] = { tables: [], years: [], latestYear: '' };
          return;
        }

        const tables = [];
        let tableNumber = 0;
        let table = { sportKey, title, year: shiftSeasonYearLabel_(firstYear, tableNumber), rowsByClass: {}, rowIndex: 0 };

        rows.forEach((row, rowIndex) => {
          const isHeaderRow = /^school$/i.test(cleanFallbackCell_(row[startCol + 1]))
            && /^class$/i.test(cleanFallbackCell_(row[startCol + 2]));
          if (isHeaderRow) {
            if (Object.keys(table.rowsByClass).length) tables.push(table);
            tableNumber += 1;
              table = { sportKey, title, year: shiftSeasonYearLabel_(firstYear, tableNumber), rowsByClass: {}, rowIndex };
              return;
            }
            addFallbackRowToTable_(table, row, startCol);
        });

        if (Object.keys(table.rowsByClass).length) tables.push(table);
        tables.sort((a, b) => seasonYearSortValue_(b.year) - seasonYearSortValue_(a.year) || b.rowIndex - a.rowIndex);
        index[sportKey] = {
          tables,
          years: [...new Set(tables.map(item => item.year))],
          latestYear: tables[0]?.year || ''
        };
      });

      return index;
    }

    async function getFallbackRpiIndex_() {
      if (!fallbackRpiIndexPromise_) {
        fallbackRpiIndexPromise_ = fetchPageHtml_(fallbackCsvUrl_())
          .then(parseFallbackRpiIndex_)
          .catch(() => fetchDirectHtml_(fallbackGvizUrl_()).then(parseFallbackRpiIndexFromGviz_))
          .catch(() => fetchPageHtml_(fallbackGvizUrl_()).then(parseFallbackRpiIndexFromGviz_))
          .catch(err => {
            fallbackRpiIndexPromise_ = null;
            throw err;
          });
      }
      return fallbackRpiIndexPromise_;
    }

    function selectedRpiYear_() {
      return yearEl?.value || 'live';
    }

    function rpiResultHasDetailedStats_(rows) {
      return (rows || []).some(row => row.wp || row.mwp || row.owp || row.oowp);
    }

    function shouldUseLiveRpiSnapshots_(rpiResult) {
      return selectedRpiYear_() === 'live' && rpiResult?.source === 'official';
    }

    function snapshotEndpointCandidates_() {
      const local = window.location.protocol === 'file:'
        ? ['http://localhost:8000/rpi-snapshots/compare', '/rpi-snapshots/compare']
        : ['/rpi-snapshots/compare', 'http://localhost:8000/rpi-snapshots/compare'];
      return uniqueEndpoints_([configuredApiEndpoint_('/rpi-snapshots/compare'), ...local]);
    }

    function snapshotApiEndpointCandidates_(pathWithQuery) {
      const local = window.location.protocol === 'file:'
        ? [`http://localhost:8000${pathWithQuery}`, pathWithQuery]
        : [pathWithQuery, `http://localhost:8000${pathWithQuery}`];
      return uniqueEndpoints_([configuredApiEndpoint_(pathWithQuery), ...local]);
    }

    async function requestSnapshotApiJson_(path, params = {}) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') query.set(key, value);
      });
      const pathWithQuery = `${path}${query.toString() ? `?${query}` : ''}`;
      let lastError = null;
      for (const endpoint of snapshotApiEndpointCandidates_(pathWithQuery)) {
        try {
          const response = await fetch(endpoint, { method: 'GET' });
          if (!response.ok) throw new Error(`Snapshot API failed (${response.status})`);
          return await response.json();
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError || new Error('Snapshot API failed');
    }

    function snapshotStatusEndpointCandidates_() {
      return snapshotEndpointCandidates_().map(endpoint => endpoint.replace('/compare', '/status'));
    }

    async function isSnapshotServerAvailable_() {
      for (const endpoint of snapshotStatusEndpointCandidates_()) {
        try {
          const response = await fetch(endpoint, { method: 'GET' });
          if (response.ok) return true;
        } catch (err) {}
      }
      return false;
    }

    async function requestRpiSnapshotCompare_(payload) {
      let lastError = null;
      for (const endpoint of snapshotEndpointCandidates_()) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error(`Snapshot compare failed (${response.status})`);
          return await response.json();
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError || new Error('Snapshot compare failed');
    }

    function showLastChangeEnabled_() {
      return Boolean(showLastChangeToggle?.checked) && !compareSnapshotId_;
    }

    function changeOrLastChange_(changeValue, lastChangeValue, useLastChange) {
      const n = Number(changeValue);
      if (Number.isFinite(n) && n !== 0) return changeValue;
      if (!useLastChange) return changeValue ?? null;
      const last = Number(lastChangeValue);
      return Number.isFinite(last) && last !== 0 ? lastChangeValue : (changeValue ?? null);
    }

    function applyRpiChangeData_(rows, compareResult) {
      const changes = Array.isArray(compareResult?.rows) ? compareResult.rows : [];
      const useLastChange = Boolean(compareResult?.includeLastChange);
      return rows.map((row, index) => {
        const change = changes[index] || {};
        return {
          ...row,
          previousRank: change.previousRank ?? null,
          rankChange: changeOrLastChange_(change.rankChange, change.lastRankChange, useLastChange),
          lastRankChange: change.lastRankChange ?? null,
          previousRpi: change.previousRpi ?? null,
          rpiChange: changeOrLastChange_(change.rpiChange, change.lastRpiChange, useLastChange),
          lastRpiChange: change.lastRpiChange ?? null,
          isNewSnapshotTeam: Boolean(change.isNew)
        };
      });
    }

    async function addLiveRpiChangeData_(rows, sport, classification, rpiResult) {
      if (!shouldUseLiveRpiSnapshots_(rpiResult)) return rows;
      try {
        const compareResult = await requestRpiSnapshotCompare_({
          sport,
          classification,
          source: 'official',
          seasonYear: 'live',
          save: false,
          compareSnapshotId: compareSnapshotId_,
          includeLastChange: showLastChangeEnabled_(),
          rows: rows.map(row => ({
            school: row.school,
            rank: row.rank,
            rpi: row.rpi,
            record: row.record,
            wp: row.wp,
            mwp: row.mwp,
            owp: row.owp,
            oowp: row.oowp
          }))
        });
        rpiResult.changeCompare = compareResult;
        return compareResult?.canCompare ? applyRpiChangeData_(rows, compareResult) : rows;
      } catch (err) {
        console.warn('Live RPI snapshot compare unavailable:', err);
        rpiResult.changeCompareError = err?.message || String(err || '');
        return rows;
      }
    }

    async function fetchFallbackRpiRows_(classification, sportLabel, year = '') {
      const sportKey = sportKeyFromLabel_(sportLabel);
      const sportIndex = (await getFallbackRpiIndex_())[sportKey];
      if (!sportIndex?.tables?.length) throw new Error(`No fallback RPI table found for ${sportLabel}`);

      const targetYear = year && year !== 'live' ? (seasonYearLabel_(year) || String(year)) : sportIndex.latestYear;
      const table = sportIndex.tables.find(item => item.year === targetYear);
      if (!table) throw new Error(`No fallback ${sportLabel} RPI table found for ${targetYear}`);

      const rows = table.rowsByClass[classification] || [];
      if (!rows.length) throw new Error(`No fallback ${sportLabel} ${classification} rows found for ${targetYear}`);

      return {
        rows,
        lastUpdated: `${sportLabel} Final RPI ${targetYear}`,
        source: 'fallback',
        year: targetYear,
        hasDetailedStats: rpiResultHasDetailedStats_(rows)
      };
    }

    function setSeasonYearOptions_(years, preferredValue = selectedRpiYear_()) {
      if (!yearEl) return;
      const safeYears = [...new Set((years || []).map(seasonYearLabel_).filter(Boolean))]
        .sort((a, b) => seasonYearSortValue_(b) - seasonYearSortValue_(a));
      const preferred = seasonYearLabel_(preferredValue);
      const desired = preferredValue !== 'live' && safeYears.includes(preferred)
        ? preferred
        : 'live';
      yearEl.innerHTML = [
        '<option value="live">Live</option>',
        ...safeYears.map(year => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`)
      ].join('');
      yearEl.value = desired;
      renderYearPickerOptions_();
      syncYearPickerUi_();
    }

    function ensureSeasonYearOption_(year) {
      if (!yearEl || !year) return;
      const normalizedYear = seasonYearLabel_(year) || String(year);
      if (![...yearEl.options].some(option => option.value === normalizedYear)) {
        yearEl.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(normalizedYear)}">${escapeHtml(normalizedYear)}</option>`);
        renderYearPickerOptions_();
      }
      yearEl.value = normalizedYear;
      syncYearPickerUi_();
    }

    async function refreshSeasonYearOptions_({ preserveValue = selectedRpiYear_() } = {}) {
      try {
        const sportKey = sportKeyFromLabel_(sportEl.value);
        const sportIndex = (await getFallbackRpiIndex_())[sportKey];
        setSeasonYearOptions_(sportIndex?.years || [], preserveValue);
      } catch (err) {
        console.warn('Fallback RPI year options unavailable:', err);
        setSeasonYearOptions_([], preserveValue === 'live' ? 'live' : preserveValue);
      }
    }

    function extractLastUpdatedAnywhere_(html) {
      const s = String(html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();

      let m = s.match(/Last\s*updated\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}(?:\s*\(\d{1,2}:\d{2}\s*[ap]m\))?)/i);
      if (m?.[1]) return m[1].trim();
      m = s.match(/Last\s*updated\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d{2}\s*[ap]m)?)/i);
      if (m?.[1]) return m[1].trim();
      m = s.match(/Last\s*updated\s*:?\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i);
      if (m?.[1]) return m[1].trim();
      return '';
    }

    function parseRowsFromTableHtml_(tableHtml) {
      const doc = new DOMParser().parseFromString(tableHtml, 'text/html');
      const trs = [...doc.querySelectorAll('tr')];
      const raw = trs.map(tr => {
        const cells = [...tr.querySelectorAll('td,th')];
        return {
          cells,
          text: cells.map(td => td.textContent.replace(/\s+/g, ' ').trim())
        };
      });

      return raw
        .filter(r => r.text.length >= 6)
        .filter(({ text }) => {
          const joined = text.join(' ').toLowerCase();
          if (joined.includes('team') && joined.includes('record') && joined.includes('wp') && joined.includes('owp') && joined.includes('oowp') && joined.includes('rpi')) return false;
          if (joined.includes('select a classification')) return false;
          return true;
        })
        .map(({ cells, text }) => {
          const hasRankCol = text.length >= 7 && /^\d+$/.test(String(text[0] || '').trim());
          const teamIndex = hasRankCol ? 1 : 0;
          const teamCell = cells[teamIndex] || null;
          const maxPrepsHref = teamCell?.querySelector('a[href*="maxpreps.com"]')?.getAttribute('href') || '';
          return {
            team: canonicalTeamName_(hasRankCol ? text[1] : text[0]),
            record: hasRankCol ? (text[2] || '') : (text[1] || ''),
            wp: hasRankCol ? (text[3] || '') : (text[2] || ''),
            owp: hasRankCol ? (text[4] || '') : (text[3] || ''),
            oowp: hasRankCol ? (text[5] || '') : (text[4] || ''),
            rpi: hasRankCol ? (text[6] || '') : (text[5] || ''),
            maxPrepsUrl: normalizeMaxPrepsUrl_(maxPrepsHref)
          };
        })
        .filter(r => r.team);
    }

    async function fetchSingleTableWeb_(url, classification, sportKey) {
      const division = classification.replace(/^Class/i, 'Division').trim();
      const postBody = new URLSearchParams({ classification: division });
      let html = '';

      try {
        html = await fetchPageHtml_(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postBody
        });
      } catch (err) {
        html = await fetchPageHtml_(url);
      }

      const start = html.indexOf('<table');
      const end = html.indexOf('</table>', start);
      if (start === -1 || end === -1) throw new Error('No standings table found');

      const lastUpdated = extractLastUpdatedAnywhere_(html);
      const rows = parseRowsFromTableHtml_(html.slice(start, end + 8));
      return { rows, lastUpdated };
    }

    async function fetchBasketballWeb_(url, classification, sportKey) {
      const division = classification.replace(/^Class/i, 'Division').trim();
      const payload = sportKey === 'girls'
        ? new URLSearchParams({ classification: '', classification_2: division })
        : new URLSearchParams({ classification: division });

      const html = await fetchPageHtml_(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload
      });

      const anchor = sportKey === 'girls'
        ? APP.FetchRpi.basketballAnchorGirls
        : APP.FetchRpi.basketballAnchorBoys;

      const a = html.indexOf(anchor);
      if (a === -1) throw new Error('Basketball standings anchor not found');

      const start = html.indexOf('<table', a);
      const end = html.indexOf('</table>', start);
      if (start === -1 || end === -1) throw new Error('No basketball standings table found');

      const lastUpdated = extractLastUpdatedAnywhere_(html);
      const rows = parseRowsFromTableHtml_(html.slice(start, end + 8));
      return { rows, lastUpdated };
    }

    async function fetchOfficialRpiRows_(classification, sportLabel) {
      const sportKey = sportKeyFromLabel_(sportLabel);
      const cfg = getSportConfig_(sportKey);
      if (!cfg.url) throw new Error(`No URL configured for ${sportLabel}`);

      const result = cfg.kind === 'basketball'
        ? await fetchBasketballWeb_(cfg.url, classification, sportKey)
        : await fetchSingleTableWeb_(cfg.url, classification, sportKey);
      if (!result.rows?.length) throw new Error(`No live ${sportLabel} RPI rows found`);
      return {
        ...result,
        source: 'official',
        year: 'live',
        hasDetailedStats: rpiResultHasDetailedStats_(result.rows)
      };
    }

    function formatSnapshotRpi_(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(6) : String(value ?? '');
    }

    function snapshotHistoryLabel_(snapshot) {
      const sport = snapshot?.sport || sportEl.value;
      const classification = snapshot?.classification || classEl.value;
      const time = snapshot?.fetchedAt
        ? new Date(snapshot.fetchedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        : 'selected snapshot';
      return `${classification} ${sport} snapshot ${time}`;
    }

    async function fetchSnapshotRpiRows_(snapshotId) {
      const result = await requestSnapshotApiJson_('/rpi-snapshots/snapshot', { id: snapshotId });
      const snapshot = result?.snapshot;
      if (!snapshot?.rows?.length) throw new Error('Snapshot has no rows');

      const rows = snapshot.rows.map(row => ({
        team: canonicalTeamName_(row.school),
        record: String(row.record || ''),
        wp: String(row.wp || ''),
        mwp: String(row.mwp || ''),
        owp: String(row.owp || ''),
        oowp: String(row.oowp || ''),
        rpi: formatSnapshotRpi_(row.rpi),
        source: 'snapshot_history'
      }));

      return {
        rows,
        lastUpdated: snapshotHistoryLabel_(snapshot),
        source: 'snapshot_history',
        year: 'history',
        snapshot,
        hasDetailedStats: rpiResultHasDetailedStats_(rows)
      };
    }

    async function fetchRpiRows_(classification, sportLabel) {
      if (historySnapshotId_) {
        return await fetchSnapshotRpiRows_(historySnapshotId_);
      }

      const requestedYear = selectedRpiYear_();
      if (requestedYear !== 'live') {
        return await fetchFallbackRpiRows_(classification, sportLabel, requestedYear);
      }

      try {
        return await fetchOfficialRpiRows_(classification, sportLabel);
      } catch (err) {
        const fallback = await fetchFallbackRpiRows_(classification, sportLabel);
        return {
          ...fallback,
          officialError: err?.message || String(err || '')
        };
      }
    }

    function mergeRows_(rpiRows, tdMap, sportLabel = sportEl?.value || '', rpiResult = {}) {
      const scheduleYear = scheduleYearForRpiResult_(rpiResult);
      let rank = 1;
      return rpiRows.map(row => {
        const match = tdMap.get(canonicalTeamName_(row.team)) || null;
        const officialUrl = normalizeMaxPrepsUrl_(row.maxPrepsUrl || '');
        const teamDetailsUrl = teamDetailsMaxPrepsUrl_(match, sportLabel);
        const cachedUrl = cachedMaxPrepsUrl_(row.team, sportLabel);
        const maxPrepsUrl = officialUrl || teamDetailsUrl || cachedUrl || '';
        if (officialUrl || teamDetailsUrl) cacheMaxPrepsUrl_(row.team, sportLabel, maxPrepsUrl);
        return {
          rank: rank++,
          school: row.team,
          record: row.record,
          wp: row.wp,
          mwp: row.mwp || '',
          owp: row.owp,
          oowp: row.oowp,
          rpi: row.rpi,
          source: row.source || '',
          maxPrepsUrl,
          scheduleYear,
          scheduleSport: sportLabel,
          logoUrl: match?.logoUrl || '',
          mapLogoUrl: match?.mapLogoUrl || '',
          mascot: match?.mascot || '',
          longitude: Number(match?.longitude ?? NaN),
          latitude: Number(match?.latitude ?? NaN)
        };
      });
    }

    function numericRpi_(value) {
      const n = parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : -Infinity;
    }

    function is8AClassification_(classification) { return /\b8A\b/i.test(String(classification || '').trim()); }
    function playoffTeamLimitOverride_() {
      const value = Math.floor(Number(playoffTeamLimit?.value || 0));
      return Number.isFinite(value) && value > 0 ? value : 0;
    }
    // ============================================================================
    // 8. Standings, East/West split, bracket math, and board header helpers
    // ============================================================================

    // Standings, East/West split, and playoff bracket calculations.
    function playoffEligibleCap_(classification) { return playoffTeamLimitOverride_() || (is8AClassification_(classification) ? 24 : 48); }
    function nextBracketSize_(teamCount) {
      const safeCount = Math.max(1, Number(teamCount) || 1);
      let size = 1;
      while (size < safeCount) size *= 2;
      return size;
    }
    function regionSlotCount_(classification, teamCount = 0) {
      const count = Math.max(Number(teamCount) || 0, 0);
      if (count) return count <= 24 ? 16 : 32;
      const cap = playoffEligibleCap_(classification);
      return cap <= 24 ? 16 : 32;
    }
    function eastWestExtraSide_() { return eastWestExtraEast.checked ? 'west' : 'east'; }

    function oddTeamSplitLabel_() {
      return eastWestExtraEast.checked ? 'Default to West' : 'Default to East';
    }

    function syncOddTeamSplitToggleUi_() {
      document.querySelectorAll('[data-odd-team-split-label]').forEach(el => {
        el.textContent = oddTeamSplitLabel_();
      });
    }
    function longitudeSortValue_(row) {
      const n = Number(row?.longitude);
      return Number.isFinite(n) ? Math.abs(n) : Infinity;
    }

    function formatLongitude_(value) {
      const n = Number(value);
      return Number.isFinite(n) ? Math.abs(n).toFixed(4) : 'Missing';
    }

    function oddExtraClass_(row) {
      if (!row?.isOddExtra) return '';
      return row.lineRegion === 'East' ? 'odd-extra-east' : 'odd-extra-west';
    }

    function oddExtraNoteHtml_(rows, colspan = 1) {
      const oddRow = (Array.isArray(rows) ? rows : []).find(row => row?.isOddExtra);
      const oddClass = oddExtraClass_(oddRow);
      if (!oddClass) return '';
      const note = 'Region will be determined by a coin flip at the end of the season for highlighted team';
      return `
        <tfoot>
          <tr>
            <td colspan="${colspan}">
              <div class="odd-extra-note ${escapeHtml(oddClass)}">${escapeHtml(note)}</div>
            </td>
          </tr>
        </tfoot>`;
    }

    function bracketHasOddExtra_(bracketData) {
      const entries = [];
      (bracketData?.slots || []).forEach(slot => {
        entries.push(
          slot.firstRound?.top,
          slot.firstRound?.bottom,
          slot.secondRound?.top,
          slot.secondRound?.bottom
        );
      });
      return entries.some(entry => entry?.type === 'team' && entry.team?.isOddExtra);
    }

    function bracketOddExtraNoteHtml_(side, bracketData) {
      if (!bracketHasOddExtra_(bracketData)) return '';
      const oddClass = side === 'east' ? 'odd-extra-east' : 'odd-extra-west';
      const note = 'Region will be determined by a coin flip at the end of the season for highlighted team';
      return `<div class="odd-extra-note ${escapeHtml(oddClass)}">${escapeHtml(note)}</div>`;
    }

    function excludedTeamsNoteHtml_(excludedTeams = []) {
      const items = (Array.isArray(excludedTeams) ? excludedTeams : [])
        .map(item => {
          const label = String(item?.label || '').trim();
          if (!label) return '';
          const record = String(item?.record || '').trim();
          return `${escapeHtml(label)}${record ? ` (${escapeHtml(record)})` : ''}`;
        })
        .filter(Boolean);
      if (!items.length) return '';
      return `<div class="excluded-teams-note">Excluded Teams: ${items.join(', ')}</div>`;
    }

    function playoffHeaderHtml_(classification, sportLabel, viewTitle, subtitle = '') {
      const sportText = String(sportLabel || '').trim();
      const classText = String(classification || '').replace(/^Class\s+/i, '').trim();
      const sportIconHtml = sportHeaderIconHtml_(sportLabel);
      return `
        <div class="playoff-header">
          <div class="playoff-brand-row">
            <img class="playoff-brand" src="https://iili.io/Bga3mQe.png" alt="Brand logo" crossorigin="anonymous" referrerpolicy="no-referrer">
            <div class="playoff-title-wrap">
              <div class="playoff-kicker">${sportIconHtml} ${escapeHtml(classText)} ${escapeHtml(sportText)} ${sportIconHtml}</div>
              <div class="playoff-title">${escapeHtml(viewTitle)}</div>
              <div class="playoff-subtitle">${escapeHtml(subtitle)}</div>
            </div>
            <img class="playoff-brand" src="https://iili.io/Bga3mQe.png" alt="Brand logo" crossorigin="anonymous" referrerpolicy="no-referrer">
          </div>
        </div>`;
    }

    // ============================================================================
    // 9. East/West map geometry, marker placement, and interaction helpers
    // ============================================================================

    // East/West map geometry, marker placement, and map interactions.
    function mapLongitude_(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return n > 0 ? -Math.abs(n) : n;
    }

    function mapLatitude_(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : NC_MAP_DEFAULT_LATITUDE_;
    }

    function mercatorY_(lat) {
      const rad = lat * Math.PI / 180;
      return Math.log(Math.tan(Math.PI / 4 + rad / 2));
    }

    function ncMapProjector_(width, height) {
      const boundary = eastWestLineMapState_?.boundary || NC_BOUNDARY_;
      const padX = 64;
      const padY = 58;
      const bounds = boundary.reduce((acc, point) => {
        const [lon, lat] = point;
        acc.minLon = Math.min(acc.minLon, lon);
        acc.maxLon = Math.max(acc.maxLon, lon);
        acc.minLat = Math.min(acc.minLat, lat);
        acc.maxLat = Math.max(acc.maxLat, lat);
        return acc;
      }, { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity });
      bounds.minLon -= 0.15;
      bounds.maxLon += 0.15;
      bounds.minLat -= 0.18;
      bounds.maxLat += 0.18;
      const minY = mercatorY_(bounds.minLat);
      const maxY = mercatorY_(bounds.maxLat);
      const usableWidth = width - padX * 2;
      const usableHeight = height - padY * 2;
      return ([lon, lat]) => {
        const x = padX + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * usableWidth;
        const y = padY + ((maxY - mercatorY_(lat)) / (maxY - minY)) * usableHeight;
        return [x, y];
      };
    }

    function polygonArea_(ring) {
      let sum = 0;
      for (let i = 0; i < ring.length; i += 1) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[(i + 1) % ring.length];
        sum += x1 * y2 - x2 * y1;
      }
      return Math.abs(sum / 2);
    }

    function extractLargestGeoJsonRing_(geojson) {
      const rings = [];
      const addGeometry = (geometry) => {
        if (!geometry) return;
        if (geometry.type === 'Polygon') {
          if (Array.isArray(geometry.coordinates?.[0])) rings.push(geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
          geometry.coordinates?.forEach(poly => {
            if (Array.isArray(poly?.[0])) rings.push(poly[0]);
          });
        }
      };
      if (geojson?.type === 'FeatureCollection') {
        geojson.features?.forEach(feature => addGeometry(feature.geometry));
      } else if (geojson?.type === 'Feature') {
        addGeometry(geojson.geometry);
      } else {
        addGeometry(geojson);
      }
      return rings
        .filter(ring => Array.isArray(ring) && ring.length > 8)
        .sort((a, b) => polygonArea_(b) - polygonArea_(a))[0] || null;
    }

    function extractGeoJsonRings_(geojson) {
      const rings = [];
      const addGeometry = (geometry) => {
        if (!geometry) return;
        if (geometry.type === 'Polygon') {
          geometry.coordinates?.forEach(ring => {
            if (Array.isArray(ring) && ring.length > 4) rings.push(ring);
          });
        } else if (geometry.type === 'MultiPolygon') {
          geometry.coordinates?.forEach(poly => {
            poly?.forEach(ring => {
              if (Array.isArray(ring) && ring.length > 4) rings.push(ring);
            });
          });
        }
      };
      if (geojson?.type === 'FeatureCollection') {
        geojson.features?.forEach(feature => addGeometry(feature.geometry));
      } else if (geojson?.type === 'Feature') {
        addGeometry(geojson.geometry);
      } else {
        addGeometry(geojson);
      }
      return rings;
    }

    async function getNcBoundary_() {
      if (!ncBoundaryPromise_) {
        ncBoundaryPromise_ = fetch(NC_BOUNDARY_GEOJSON_URL_)
          .then(res => {
            if (!res.ok) throw new Error(`NC boundary fetch failed (${res.status})`);
            return res.json();
          })
          .then(json => extractLargestGeoJsonRing_(json) || NC_BOUNDARY_)
          .catch(err => {
            console.warn(err);
            return NC_BOUNDARY_;
          });
      }
      return ncBoundaryPromise_;
    }

    async function getNcCountyBoundaries_() {
      if (!ncCountyBoundariesPromise_) {
        ncCountyBoundariesPromise_ = fetch(NC_COUNTIES_GEOJSON_URL_)
          .then(res => {
            if (!res.ok) throw new Error(`NC county boundary fetch failed (${res.status})`);
            return res.json();
          })
          .then(json => extractGeoJsonRings_(json))
          .catch(err => {
            console.warn(err);
            return [];
          });
      }
      return ncCountyBoundariesPromise_;
    }

    function svgPathFromPoints_(points, project) {
      return points.map((point, idx) => {
        const [x, y] = project(point);
        return `${idx ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ') + ' Z';
    }

    function mapTeamInitials_(name) {
      const words = String(name || '').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
      if (!words.length) return '?';
      return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    }

    function mapTeamKey_(row) {
      const rankPart = Number.isFinite(Number(row?.rank)) ? String(row.rank) : String(row?.lineRank || '');
      return `${row?.lineRegion || ''}::${rankPart}::${canonicalTeamName_(row?.school || '')}`;
    }

    function mapTeamCoords_(row) {
      const lon = mapLongitude_(row?.longitude);
      const rawLat = Number(row?.latitude);
      const hasLat = Number.isFinite(rawLat);
      return {
        lon,
        lat: hasLat ? rawLat : NC_MAP_DEFAULT_LATITUDE_,
        hasLon: lon !== null,
        hasLat
      };
    }

    function formatCoordinate_(value, fallbackText = 'Missing') {
      const n = Number(value);
      return Number.isFinite(n) ? n.toFixed(5) : fallbackText;
    }

    function buildEastWestMapRows_(lineData, project) {
      const eastRows = lineData?.east || [];
      const westRows = lineData?.west || [];
      const regionRankByKey = new Map();
      const addRegionRanks = (rows) => {
        rows
          .slice()
          .sort((a, b) => {
            const rpiDiff = numericRpi_(b.rpi) - numericRpi_(a.rpi);
            if (rpiDiff) return rpiDiff;
            return Number(a.rank || 0) - Number(b.rank || 0);
          })
          .forEach((row, idx) => regionRankByKey.set(mapTeamKey_(row), idx + 1));
      };
      addRegionRanks(eastRows);
      addRegionRanks(westRows);

      return eastRows.concat(westRows).map(row => {
        const coords = mapTeamCoords_(row);
        if (!coords.hasLon) return null;
        const [x, y] = project([coords.lon, coords.lat]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const teamKey = mapTeamKey_(row);
        return {
          ...row,
          teamKey,
          regionRank: row.regionRank || regionRankByKey.get(teamKey) || '',
          mapX: x,
          mapY: y,
          mapLongitude: coords.lon,
          mapLatitude: coords.lat,
          mapLatitudeIsDefault: !coords.hasLat
        };
      }).filter(Boolean);
    }

    function eastWestMapControlsSvg_() {
      const settingsActiveClass = eastWestMapLogoControlsOpen_ ? ' is-active' : '';
      const mobile = isMobileBoardLayout_();
      const buttonSize = mobile ? 220 : 34;
      const buttonGap = mobile ? 238 : 42;
      const buttonX = mobile ? 958 : 1146;
      const buttonY = mobile ? 70 : 266;
      const buttonRadius = mobile ? 22 : 6;
      const buttonText = mobile ? 118 : 24;
      const buttonCenter = buttonSize / 2;
      const zoomHiddenClass = ' is-hidden';
      const zoomOutTransform = `translate(0 ${buttonGap})`;
      const actionHiddenClass = ' is-mobile-hidden';
      const settingsTransform = `translate(0 ${buttonGap * 2})`;
      const saveTransform = `translate(0 ${buttonGap * 3})`;
      return `
        <g class="nc-map-zoom-controls nc-map-ui" transform="translate(${buttonX} ${buttonY})" style="--map-button-text:${buttonText}px;">
          <g id="eastWestMapZoomInBtn" class="nc-map-svg-button${zoomHiddenClass}" data-map-action="zoom-in" role="button" tabindex="0" aria-label="Zoom in">
            <title>Zoom in</title>
            <rect x="0" y="0" width="${buttonSize}" height="${buttonSize}" rx="${buttonRadius}"></rect>
            <text x="${buttonCenter}" y="${buttonCenter}" dy="0.06em">+</text>
          </g>
          <g id="eastWestMapZoomOutBtn" class="nc-map-svg-button${zoomHiddenClass}" data-map-action="zoom-out" role="button" tabindex="0" aria-label="Zoom out" transform="${zoomOutTransform}">
            <title>Zoom out</title>
            <rect x="0" y="0" width="${buttonSize}" height="${buttonSize}" rx="${buttonRadius}"></rect>
            <text x="${buttonCenter}" y="${buttonCenter}" dy="0.06em">-</text>
          </g>
          <g id="eastWestMapSettingsBtn" class="nc-map-svg-button${settingsActiveClass}${actionHiddenClass}" data-map-action="settings" role="button" tabindex="0" aria-label="Toggle logo size settings" aria-pressed="${eastWestMapLogoControlsOpen_ ? 'true' : 'false'}" transform="${settingsTransform}">
            <title>Logo settings</title>
            <rect x="0" y="0" width="${buttonSize}" height="${buttonSize}" rx="${buttonRadius}"></rect>
            <text x="${buttonCenter}" y="${buttonCenter}" dy="0.06em">&#9881;</text>
          </g>
          <g id="eastWestMapSaveBtn" class="nc-map-svg-button${actionHiddenClass}" data-map-action="save-map" role="button" tabindex="0" aria-label="Save map PNG" transform="${saveTransform}">
            <title>Save map PNG</title>
            <rect x="0" y="0" width="${buttonSize}" height="${buttonSize}" rx="${buttonRadius}"></rect>
            <text x="${buttonCenter}" y="${buttonCenter}" dy="0.06em">&#128190;</text>
          </g>
        </g>`;
    }

    function eastWestMapSettingsPanelHtml_() {
      const logoPercent = Math.round(eastWestMapLogoScale_ * 100);
      const scaleHiddenClass = eastWestMapLogoControlsOpen_ ? '' : ' is-hidden';
      const extraWestChecked = eastWestExtraEast.checked ? ' checked' : '';
      const cleanViewChecked = eastWestMapCleanView_ ? ' checked' : '';
      const regionRankViewChecked = eastWestMapRegionRankView_ ? ' checked' : '';
      const performanceModeChecked = eastWestMapPerformanceMode_ ? ' checked' : '';
      return `
        <div id="eastWestMapLogoScaleWrap" class="nc-map-logo-scale-wrap nc-map-ui${scaleHiddenClass}">
          <div class="nc-map-logo-scale-panel" role="dialog" aria-label="Map settings">
            <div class="nc-map-settings-head">
              <div class="nc-map-settings-heading">
                <div class="nc-map-settings-kicker">East/West Map</div>
                <div class="nc-map-settings-title">Map Settings</div>
                <div class="nc-map-settings-subtitle">Tune the map controls without leaving the board.</div>
              </div>
              <button class="nc-map-settings-close" type="button" data-map-action="settings" aria-label="Close map settings">&times;</button>
            </div>
            <div class="nc-map-logo-scale-control nc-map-setting-card">
              <div class="nc-map-logo-scale-row">
                <div class="nc-map-setting-copy">
                  <span class="nc-map-setting-name">Logo Size</span>
                  <span class="nc-map-setting-note">Adjust how large each team logo appears on the map.</span>
                </div>
                <span id="eastWestMapLogoScaleValue" class="nc-map-setting-value">${logoPercent}%</span>
              </div>
              <input id="eastWestMapLogoScale" type="range" min="${EAST_WEST_MAP_LOGO_MIN_}" max="${EAST_WEST_MAP_LOGO_MAX_}" step="0.05" value="${eastWestMapLogoScale_.toFixed(2)}" aria-label="Logo size">
            </div>
            <label class="nc-map-setting-check split-toggle-control nc-map-setting-card" for="eastWestMapExtraEast">
              <span class="nc-map-setting-copy">
                <span class="nc-map-setting-name" data-odd-team-split-label>${escapeHtml(oddTeamSplitLabel_())}</span>
                <span class="nc-map-setting-note">Choose the default side when the field has one extra team.</span>
              </span>
              <input id="eastWestMapExtraEast" type="checkbox"${extraWestChecked}>
              <span class="split-toggle-track" aria-hidden="true"><span class="split-toggle-thumb"></span></span>
            </label>
            <label class="nc-map-setting-check split-toggle-control nc-map-setting-card" for="eastWestMapCleanView">
              <span class="nc-map-setting-copy">
                <span class="nc-map-setting-name">Clean View</span>
                <span class="nc-map-setting-note">Spread overlapping logos apart only when the map needs it.</span>
              </span>
              <input id="eastWestMapCleanView" type="checkbox"${cleanViewChecked}>
              <span class="split-toggle-track" aria-hidden="true"><span class="split-toggle-thumb"></span></span>
            </label>
            <label class="nc-map-setting-check split-toggle-control nc-map-setting-card" for="eastWestMapRegionRankView">
              <span class="nc-map-setting-copy">
                <span class="nc-map-setting-name">Region Standings View</span>
                <span class="nc-map-setting-note">Show each team&apos;s region rank directly on the logo.</span>
              </span>
              <input id="eastWestMapRegionRankView" type="checkbox"${regionRankViewChecked}>
              <span class="split-toggle-track" aria-hidden="true"><span class="split-toggle-thumb"></span></span>
            </label>
            <label class="nc-map-setting-check split-toggle-control nc-map-setting-card" for="eastWestMapPerformanceMode">
              <span class="nc-map-setting-copy">
                <span class="nc-map-setting-name">Performance Mode</span>
                <span class="nc-map-setting-note">Hide county lines while moving the map for smoother performance.</span>
              </span>
              <input id="eastWestMapPerformanceMode" type="checkbox"${performanceModeChecked}>
              <span class="split-toggle-track" aria-hidden="true"><span class="split-toggle-thumb"></span></span>
            </label>
          </div>
        </div>`;
    }

    function mapMarkerSvg_(row) {
      const x = Number(row.mapX);
      const y = Number(row.mapY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
      const side = row.lineRegion === 'East' ? 'east' : 'west';
      const oddClass = oddExtraClass_(row);
      const size = EAST_WEST_MAP_MARKER_SIZE_;
      const half = size / 2;
      const logoInset = 1;
      const logoUrl = normalizeDriveImageUrl_(row.mapLogoUrl || '');
      const content = logoUrl
        ? `<image href="${escapeHtml(logoUrl)}" xlink:href="${escapeHtml(logoUrl)}" x="${(-half + logoInset).toFixed(1)}" y="${(-half + logoInset).toFixed(1)}" width="${size - logoInset * 2}" height="${size - logoInset * 2}" preserveAspectRatio="xMidYMid meet"></image>`
        : `<text class="nc-map-marker-initials" x="0" y="0">${escapeHtml(mapTeamInitials_(row.school))}</text>`;
      const rankText = row.regionRank ? `<text class="nc-map-marker-rank" x="0" y="${(half - 2).toFixed(1)}">${escapeHtml(row.regionRank)}</text>` : '';

      return `
        <g class="nc-map-marker ${side} ${escapeHtml(oddClass)}" data-team-key="${escapeHtml(row.teamKey)}" data-map-x="${x.toFixed(2)}" data-map-y="${y.toFixed(2)}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
            <title>${escapeHtml(row.school)} • ${escapeHtml(row.lineRegion)} • ${escapeHtml(formatCoordinate_(row.mapLongitude))}, ${escapeHtml(formatCoordinate_(row.mapLatitude, 'default lat'))}</title>
          <rect x="${(-half).toFixed(1)}" y="${(-half).toFixed(1)}" width="${size}" height="${size}" rx="4"></rect>
          ${content}
          ${rankText}
        </g>`;
    }

    async function renderEastWestMap_() {
      if (!eastWestLineMapState_) return;
      const { lineData, classification, sportLabel } = eastWestLineMapState_;
      const selectorOverlay = eastWestMapCanvas.querySelector('.east-west-map-selectors');
      const zoomControls = eastWestMapCanvas.querySelector('.east-west-map-zoom-controls');
      const cornerControls = eastWestMapCanvas.querySelector('.east-west-map-corner-controls');
      eastWestMapCanvas.innerHTML = '';
      if (selectorOverlay) eastWestMapCanvas.appendChild(selectorOverlay);
      if (zoomControls) eastWestMapCanvas.appendChild(zoomControls);
      if (cornerControls) eastWestMapCanvas.appendChild(cornerControls);
      eastWestMapCanvas.insertAdjacentHTML('beforeend', '<div class="muted" style="height:100%;display:flex;align-items:center;justify-content:center;">Loading North Carolina map...</div>');
      const [ncBoundary, countyRings] = await Promise.all([
        getNcBoundary_(),
        getNcCountyBoundaries_()
      ]);
      eastWestLineMapState_.boundary = ncBoundary;
      const width = 1200;
      const height = 650;
      const project = ncMapProjector_(width, height);
      const mapBoundary = eastWestLineMapState_.boundary || NC_BOUNDARY_;
      eastWestLineMapState_.mapBoundarySvg = simplifyEastWestMapBoundary_(
        mapBoundary
        .map(point => project(point))
        .filter(point => Number.isFinite(point?.[0]) && Number.isFinite(point?.[1]))
      );
      eastWestMapPlacementCacheKey_ = '';
      eastWestMapPlacementCache_ = null;
      clearEastWestMapPlacementSolve_();
      const ncPath = svgPathFromPoints_(mapBoundary, project);
      const countyPaths = countyRings
        .map(ring => `<path class="nc-map-county-line" d="${svgPathFromPoints_(ring, project)}"></path>`)
        .join('');
      const allRows = lineData.east.concat(lineData.west);
      const rows = buildEastWestMapRows_(lineData, project);
      eastWestMapRowsByKey_.clear();
      rows.forEach(row => eastWestMapRowsByKey_.set(row.teamKey, row));
      const lastEast = lineData.east[lineData.east.length - 1] || null;
      const firstWest = lineData.west[0] || null;
      const eastLon = lastEast ? mapLongitude_(lastEast.longitude) : null;
      const westLon = firstWest ? mapLongitude_(firstWest.longitude) : null;
      const cutLon = eastLon !== null && westLon !== null ? (eastLon + westLon) / 2 : null;
      const cutX = cutLon !== null ? project([cutLon, NC_MAP_DEFAULT_LATITUDE_])[0] : width / 2;
      eastWestLineMapState_.mapCutX = cutX;
      const missingLatCount = allRows.filter(row => !Number.isFinite(Number(row.latitude))).length;
      const missingLonCount = allRows.length - rows.length;
      const classText = String(classification || '').replace(/^Class\s+/i, '');
      const sportEmoji = sportEmojiFromLabel_(sportLabel);
      const sportIconHtml = sportHeaderIconHtml_(sportLabel);
      if (eastWestMapKicker) eastWestMapKicker.innerHTML = `${sportIconHtml} ${escapeHtml(classText)} ${escapeHtml(sportLabel || '')} ${sportIconHtml}`;
      eastWestMapTitle.textContent = 'East/West Line Map';
      eastWestMapSubtitle.textContent = `${rows.length} playoff teams plotted${missingLonCount ? ` • ${missingLonCount} missing longitude` : ''}${missingLatCount ? ` • ${missingLatCount} using default latitude` : ''}`;
      syncEastWestMapSelectors_();
      eastWestMapCanvas.querySelector('.muted')?.remove();
      eastWestMapCanvas.insertAdjacentHTML('beforeend', `
        <svg class="east-west-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(`${sportEmoji} ${classText} ${sportLabel || ''} East/West Line Map ${sportEmoji}`)}">
          <defs>
            <clipPath id="ncMapClip">
              <path d="${ncPath}"></path>
            </clipPath>
          </defs>
          <g id="eastWestMapViewport">
            <rect class="nc-map-shade-west" x="0" y="0" width="${Math.max(0, cutX).toFixed(1)}" height="${height}" clip-path="url(#ncMapClip)"></rect>
            <rect class="nc-map-shade-east" x="${Math.max(0, cutX).toFixed(1)}" y="0" width="${Math.max(0, width - cutX).toFixed(1)}" height="${height}" clip-path="url(#ncMapClip)"></rect>
            <g class="nc-map-counties" clip-path="url(#ncMapClip)">
              ${countyPaths}
            </g>
            <path class="nc-map-shape" d="${ncPath}"></path>
            <line class="nc-map-cut-line" x1="${cutX.toFixed(1)}" y1="62" x2="${cutX.toFixed(1)}" y2="${height - 62}"></line>
            <text class="nc-map-legend" x="72" y="42">West</text>
            <text class="nc-map-legend" x="${width - 72}" y="42" text-anchor="end">East</text>
            <text class="nc-map-note" x="${cutX.toFixed(1)}" y="${height - 26}" text-anchor="middle">East/West line</text>
            <g id="eastWestMapMeasureLayer"></g>
            <g id="eastWestMapMarkerLayer">
              ${rows.map(row => mapMarkerSvg_(row)).join('')}
            </g>
          </g>
          ${eastWestMapControlsSvg_()}
        </svg>`);
      eastWestMapCanvas.insertAdjacentHTML('beforeend', eastWestMapSettingsPanelHtml_());
      hideEastWestMapContextMenu_();
      hideEastWestMapInfoCard_();
      eastWestMapMeasureStartKey_ = '';
      eastWestMapCanvas.classList.remove('is-measuring');
      resetEastWestMapZoom_();
      applyEastWestMarkerZOrder_();
      setEastWestMapLogoControlsOpen_(eastWestMapLogoControlsOpen_);
      updateEastWestMapLogoScaleUi_();
    }

    async function refreshEastWestSplitFromCurrentState_() {
      if (!eastWestLineMapState_) return;
      const { lineData, classification, sportLabel } = eastWestLineMapState_;
      const sourceRows = lineData.east.concat(lineData.west);
      const nextLineData = buildEastWestLineRows_(sourceRows, classification);
      const excludedTeams = eastWestLineMapState_.excludedTeams || [];
      eastWestLineMapState_ = { lineData: nextLineData, classification, sportLabel, year: selectedRpiYear_(), excludedTeams };

      if (document.body.classList.contains('east-west-mode')) {
        renderEastWestLine_(nextLineData, classification, sportLabel);
        armImageFallbacks_(tbody);
      } else if (document.body.classList.contains('regions-mode')) {
        const regionData = buildRegionRows_(sourceRows, classification, eastWestExtraSide_(), eastWestLineMapState_.excludedTeams || []);
        renderRegionRows(regionData, classification, sportLabel);
        armImageFallbacks_(tbody);
      } else if (document.body.classList.contains('playoff-mode')) {
        const regionData = buildRegionRows_(sourceRows, classification, eastWestExtraSide_(), eastWestLineMapState_.excludedTeams || []);
        renderPlayoffPicture(regionData, classification, sportLabel);
        armImageFallbacks_(tbody);
      }

      if (eastWestMapOverlay.classList.contains('open')) await renderEastWestMap_();
    }

    function buildEastWestMapExportHtml_() {
      const cloneDoc = document.documentElement.cloneNode(true);
      injectExportSnapshotBase_(cloneDoc);
      cloneDoc.querySelectorAll('script').forEach(el => el.remove());
      const body = cloneDoc.querySelector('body');
      if (body) body.className = document.body.className;

      const helperStyle = cloneDoc.ownerDocument.createElement('style');
      helperStyle.textContent = `
        body { margin: 0 !important; background: #0b1320 !important; }
        #eastWestMapOverlay { display: grid !important; visibility: visible !important; opacity: 1 !important; }
        .nc-map-ui,
        .east-west-map-info-cards,
        .east-west-map-context-menu,
        .east-west-map-close,
        .export-hidden,
        .no-export { display: none !important; visibility: hidden !important; opacity: 0 !important; }
      `;
      cloneDoc.querySelector('head')?.appendChild(helperStyle);
      return '<!DOCTYPE html>\n' + cloneDoc.outerHTML;
    }

    async function exportEastWestMapPng_() {
      const panel = eastWestMapOverlay.querySelector('.east-west-map-panel');
      if (!panel || !eastWestMapCanvas.querySelector('svg')) return;

      try {
        setStatus('Preparing East/West map PNG...');
        panel.querySelectorAll('img').forEach(img => {
          img.loading = 'eager';
          img.decoding = 'sync';
          if (img.dataset.loadedSrc) img.src = img.dataset.loadedSrc;
        });
        await waitForImagesInNode_(panel, 1800);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const { classification, sportLabel } = eastWestLineMapState_ || {};
        const classShort = classShortFromValue_(classification || classEl.value);
        const sportText = String(sportLabel || sportEl.value || '').trim();
        const filename = `${classShort} ${sportText} East-West Line Map.png`;
        const blob = await scheduleServerPngExport_({
          html: buildEastWestMapExportHtml_(),
          selector: '.east-west-map-panel',
          filename,
          background: '#0b1320'
        });
        downloadBlob_(blob, filename);
        setStatus('Map PNG saved.');
      } catch (err) {
        console.error(err);
        setStatus(`Map PNG export failed. ${err.message}`, true);
      }
    }

    async function openEastWestMap_() {
      eastWestMapOverlay.classList.add('open');
      eastWestMapOverlay.setAttribute('aria-hidden', 'false');
      await renderEastWestMap_();
    }

    function closeEastWestMap_() {
      eastWestMapOverlay.classList.remove('open');
      eastWestMapOverlay.setAttribute('aria-hidden', 'true');
      eastWestMapCanvas.classList.remove('is-panning');
      eastWestMapCanvas.classList.remove('is-measuring');
      setEastWestMapTransforming_(false);
      hideEastWestMapContextMenu_();
      hideEastWestMapInfoCard_();
      clearEastWestMapPlacementSolve_();
    }

    function eastWestMapMarkerBox_(x, y, half) {
      return {
        left: x - half,
        right: x + half,
        top: y - half,
        bottom: y + half
      };
    }

    function eastWestMapBoxesOverlap_(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function eastWestMapOverlapScore_(box, placedBoxes) {
      return placedBoxes.reduce((score, placed) => {
        const xOverlap = Math.max(0, Math.min(box.right, placed.right) - Math.max(box.left, placed.left));
        const yOverlap = Math.max(0, Math.min(box.bottom, placed.bottom) - Math.max(box.top, placed.top));
        return score + xOverlap * yOverlap;
      }, 0);
    }

    function simplifyEastWestMapBoundary_(points, maxPoints = 180) {
      if (!Array.isArray(points) || points.length <= maxPoints) return points || [];
      const stride = Math.ceil(points.length / maxPoints);
      return points.filter((point, index) => index % stride === 0 || index === points.length - 1);
    }

    function eastWestMapBoxPoints_(box) {
      const midX = (box.left + box.right) / 2;
      const midY = (box.top + box.bottom) / 2;
      return [
        [box.left, box.top],
        [midX, box.top],
        [box.right, box.top],
        [box.right, midY],
        [box.right, box.bottom],
        [midX, box.bottom],
        [box.left, box.bottom],
        [box.left, midY]
      ];
    }

    function eastWestMapPointInPolygon_(x, y, polygon) {
      if (!Array.isArray(polygon) || polygon.length < 3) return true;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const xi = Number(polygon[i][0]);
        const yi = Number(polygon[i][1]);
        const xj = Number(polygon[j][0]);
        const yj = Number(polygon[j][1]);
        if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
        const intersects = ((yi > y) !== (yj > y))
          && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
        if (intersects) inside = !inside;
      }
      return inside;
    }

    function eastWestMapBoxInsideState_(box) {
      const boundary = eastWestLineMapState_?.mapBoundarySvg || [];
      if (!boundary.length) return true;
      return eastWestMapBoxPoints_(box).every(([x, y]) => eastWestMapPointInPolygon_(x, y, boundary));
    }

    function eastWestMapBoxContainsPoint_(box, point) {
      const x = Number(point?.[0]);
      const y = Number(point?.[1]);
      return Number.isFinite(x) && Number.isFinite(y)
        && x >= box.left && x <= box.right
        && y >= box.top && y <= box.bottom;
    }

    function eastWestMapBoxTouchesState_(box) {
      const boundary = eastWestLineMapState_?.mapBoundarySvg || [];
      if (!boundary.length) return true;
      return eastWestMapBoxPoints_(box).some(([x, y]) => eastWestMapPointInPolygon_(x, y, boundary))
        || boundary.some(point => eastWestMapBoxContainsPoint_(box, point));
    }

    function eastWestMapBoxStatePenalty_(box) {
      const boundary = eastWestLineMapState_?.mapBoundarySvg || [];
      if (!boundary.length) return 0;
      return eastWestMapBoxPoints_(box).reduce((penalty, [x, y]) => (
        penalty + (eastWestMapPointInPolygon_(x, y, boundary) ? 0 : 1)
      ), 0);
    }

    function eastWestMapBoxTouchesRegion_(box, side) {
      const cutX = Number(eastWestLineMapState_?.mapCutX);
      if (!Number.isFinite(cutX)) return true;
      const sliver = 0.6;
      return side === 'east'
        ? box.right > cutX + sliver
        : box.left < cutX - sliver;
    }

    function eastWestMapBoxRegionPenalty_(box, side) {
      const cutX = Number(eastWestLineMapState_?.mapCutX);
      if (!Number.isFinite(cutX)) return 0;
      const width = Math.max(1, box.right - box.left);
      if (side === 'east') return Math.max(0, cutX - box.left) / width;
      return Math.max(0, box.right - cutX) / width;
    }

    function eastWestMapCornerDistance_(item, x, y, half) {
      return Math.min(
        Math.hypot((x - half) - item.x, (y - half) - item.y),
        Math.hypot((x + half) - item.x, (y - half) - item.y),
        Math.hypot((x - half) - item.x, (y + half) - item.y),
        Math.hypot((x + half) - item.x, (y + half) - item.y)
      );
    }

    function eastWestMapMarkerCandidates_(item, half, visibleHalf, collisionHalf) {
      const candidates = [];
      const seen = new Set();
      const step = Math.max(3, half * 0.34);
      const maxRings = 7;

      const addCandidate = (x, y, kind, ring = 0) => {
        const key = `${x.toFixed(2)},${y.toFixed(2)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const centerDistance = Math.hypot(x - item.x, y - item.y);
        const cornerDistance = eastWestMapCornerDistance_(item, x, y, half);
        const visibleBox = eastWestMapMarkerBox_(x, y, visibleHalf);
        const collisionBox = eastWestMapMarkerBox_(x, y, collisionHalf);
        const touchesState = eastWestMapBoxTouchesState_(visibleBox);
        const touchesRegion = eastWestMapBoxTouchesRegion_(visibleBox, item.side);
        const outsidePenalty = touchesState ? eastWestMapBoxStatePenalty_(visibleBox) : 100;
        const regionPenalty = touchesRegion ? eastWestMapBoxRegionPenalty_(visibleBox, item.side) : 100;
        const moved = centerDistance > 0.01;
        candidates.push({
          x,
          y,
          kind,
          ring,
          moved,
          centerDistance,
          cornerDistance,
          visibleBox,
          collisionBox,
          outsidePenalty,
          regionPenalty,
          validArea: touchesState && touchesRegion,
          score: moved
            ? 8 + cornerDistance * 14 + centerDistance * 0.18 + outsidePenalty * 1.5 + regionPenalty * 6 + ring * 0.35 + (kind === 'axis' ? half * 3 : 0)
            : 0
        });
      };

      addCandidate(item.x, item.y, 'center', 0);

      for (let ring = 0; ring <= maxRings; ring += 1) {
        const distance = half + ring * step;
        [-1, 1].forEach(sx => {
          [-1, 1].forEach(sy => addCandidate(item.x + sx * distance, item.y + sy * distance, 'corner', ring));
        });
      }

      for (let ring = 0; ring <= Math.min(maxRings, 4); ring += 1) {
        const distance = half + ring * step;
        addCandidate(item.x - distance, item.y, 'axis', ring);
        addCandidate(item.x + distance, item.y, 'axis', ring);
        addCandidate(item.x, item.y - distance, 'axis', ring);
        addCandidate(item.x, item.y + distance, 'axis', ring);
      }

      return candidates.sort((a, b) => Number(b.validArea) - Number(a.validArea) || a.score - b.score || a.outsidePenalty - b.outsidePenalty || a.regionPenalty - b.regionPenalty || a.centerDistance - b.centerDistance);
    }

    function resolveEastWestMapMarkerPlacements_(markers, markerScale) {
      const half = (EAST_WEST_MAP_MARKER_SIZE_ * markerScale) / 2;
      const padding = Math.max(1.5, 3 * markerScale);
      const visibleHalf = Math.max(0, half - 0.4);
      const collisionHalf = half + padding / 2;
      const items = markers.map((marker, index) => {
        const x = Number(marker.dataset.mapX);
        const y = Number(marker.dataset.mapY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const centerVisibleBox = eastWestMapMarkerBox_(x, y, visibleHalf);
        const centerCollisionBox = eastWestMapMarkerBox_(x, y, collisionHalf);
        return {
          marker,
          index,
          x,
          y,
          side: marker.classList.contains('east') ? 'east' : 'west',
          collisionCount: 0,
          centerValidArea: eastWestMapBoxTouchesState_(centerVisibleBox)
            && eastWestMapBoxTouchesRegion_(centerVisibleBox, marker.classList.contains('east') ? 'east' : 'west'),
          centerCollisionBox
        };
      }).filter(Boolean);

      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          if (!eastWestMapBoxesOverlap_(items[i].centerCollisionBox, items[j].centerCollisionBox)) continue;
          items[i].collisionCount += 1;
          items[j].collisionCount += 1;
        }
      }

      items.forEach(item => {
        item.needsMove = item.collisionCount > 0 || !item.centerValidArea;
        item.candidates = eastWestMapMarkerCandidates_(item, half, visibleHalf, collisionHalf);
      });

      const stableItems = items.filter(item => !item.needsMove);
      const moveItems = items.filter(item => item.needsMove);
      const orderVariants = [
        moveItems.slice().sort((a, b) => b.collisionCount - a.collisionCount || a.index - b.index),
        moveItems.slice().sort((a, b) => a.x - b.x || a.y - b.y),
        moveItems.slice().sort((a, b) => a.y - b.y || a.x - b.x)
      ];

      const solveForOrder = (orderedItems) => {
        const placements = new Map();
        const placedBoxes = [];
        let totalScore = 0;
        let totalOverlap = 0;
        let totalOutside = 0;
        let totalInvalid = 0;
        let movedCount = 0;
        let maxCornerDistance = 0;

        const place = (item, candidate) => {
          placements.set(item.marker, candidate);
          placedBoxes.push(candidate.collisionBox);
          totalScore += candidate.score;
          totalOutside += candidate.outsidePenalty;
          totalOutside += candidate.regionPenalty || 0;
          totalInvalid += candidate.validArea ? 0 : 1;
          movedCount += candidate.moved ? 1 : 0;
          maxCornerDistance = Math.max(maxCornerDistance, candidate.cornerDistance || 0);
        };

        stableItems.forEach(item => place(item, item.candidates[0]));

        orderedItems.forEach(item => {
          const validCandidates = item.candidates.filter(candidate => candidate.validArea);
          let best = validCandidates.find(candidate => !eastWestMapOverlapScore_(candidate.collisionBox, placedBoxes));
          if (!best) {
            best = validCandidates
              .map(candidate => ({ candidate, overlap: eastWestMapOverlapScore_(candidate.collisionBox, placedBoxes) }))
              .sort((a, b) => a.overlap - b.overlap || a.candidate.score - b.candidate.score || a.candidate.regionPenalty - b.candidate.regionPenalty)[0];
            if (best) totalOverlap += best.overlap;
            best = best?.candidate || null;
          }
          if (!best) {
            best = item.candidates
              .map(candidate => ({
                candidate,
                overlap: eastWestMapOverlapScore_(candidate.collisionBox, placedBoxes)
              }))
              .sort((a, b) => Number(b.candidate.validArea) - Number(a.candidate.validArea)
                || a.candidate.outsidePenalty - b.candidate.outsidePenalty
                || a.candidate.regionPenalty - b.candidate.regionPenalty
                || a.overlap - b.overlap
                || a.candidate.score - b.candidate.score)[0]?.candidate;
            if (best) {
              totalOverlap += eastWestMapOverlapScore_(best.collisionBox, placedBoxes);
              totalOutside += (best.outsidePenalty + best.regionPenalty) * 1000;
            }
          }
          place(item, best || item.candidates[0]);
        });

        return { placements, totalScore, totalOverlap, totalOutside, totalInvalid, movedCount, maxCornerDistance };
      };

      return orderVariants
        .map(solveForOrder)
        .sort((a, b) => a.totalInvalid - b.totalInvalid
          || a.totalOutside - b.totalOutside
          || a.totalOverlap - b.totalOverlap
          || a.totalScore - b.totalScore
          || a.movedCount - b.movedCount
          || a.maxCornerDistance - b.maxCornerDistance)[0]?.placements || new Map();
    }

    function buildEastWestMapPlacementCacheKey_(markers, markerScale) {
      return [
        markerScale.toFixed(4),
        markers.length,
        ...markers.map(marker => `${marker.dataset.teamKey || ''}:${marker.dataset.mapX || ''},${marker.dataset.mapY || ''}`)
      ].join('|');
    }

    function centeredEastWestMapMarkerPlacements_(markers) {
      const placements = new Map();
      markers.forEach(marker => {
        const x = Number(marker.dataset.mapX);
        const y = Number(marker.dataset.mapY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        placements.set(marker, { x, y, moved: false });
      });
      return placements;
    }

    function clearEastWestMapPlacementSolve_() {
      if (!eastWestMapPlacementSolveTimer_) return;
      clearTimeout(eastWestMapPlacementSolveTimer_);
      eastWestMapPlacementSolveTimer_ = null;
    }

    function scheduleEastWestMapPlacementSolve_() {
      clearEastWestMapPlacementSolve_();
      eastWestMapPlacementSolveTimer_ = setTimeout(() => {
        eastWestMapPlacementSolveTimer_ = null;
        if (!eastWestMapOverlay.classList.contains('open')) return;
        applyEastWestMapZoom_({ forcePlacement: true });
      }, 110);
    }

    function applyEastWestMapViewport_() {
      const viewport = eastWestMapCanvas.querySelector('#eastWestMapViewport');
      if (!viewport) return;
      viewport.setAttribute('transform', `translate(${eastWestMapTransform_.x.toFixed(2)} ${eastWestMapTransform_.y.toFixed(2)}) scale(${eastWestMapTransform_.scale.toFixed(4)})`);
    }

    function requestEastWestMapViewportApply_() {
      if (eastWestMapViewportFrame_) return;
      eastWestMapViewportFrame_ = requestAnimationFrame(() => {
        eastWestMapViewportFrame_ = 0;
        applyEastWestMapViewport_();
      });
    }

    function setEastWestMapTransforming_(active, settleMs = 0) {
      if (eastWestMapTransformingTimer_) {
        clearTimeout(eastWestMapTransformingTimer_);
        eastWestMapTransformingTimer_ = 0;
      }
      eastWestMapCanvas.classList.toggle('is-transforming', Boolean(active));
      if (!active || !settleMs) return;
      eastWestMapTransformingTimer_ = setTimeout(() => {
        eastWestMapTransformingTimer_ = 0;
        eastWestMapCanvas.classList.remove('is-transforming');
      }, settleMs);
    }

    function applyEastWestMapZoom_(options = {}) {
      applyEastWestMapViewport_();
      const markerScale = eastWestMapMarkerScale_();
      const markers = [...eastWestMapCanvas.querySelectorAll('.nc-map-marker')];
      let placements = null;
      if (!eastWestMapCleanView_) {
        clearEastWestMapPlacementSolve_();
        eastWestMapPlacementCacheKey_ = '';
        eastWestMapPlacementCache_ = null;
        placements = centeredEastWestMapMarkerPlacements_(markers);
      } else {
        const cacheKey = buildEastWestMapPlacementCacheKey_(markers, markerScale);
        const shouldSolve = options.forcePlacement || cacheKey !== eastWestMapPlacementCacheKey_ || !eastWestMapPlacementCache_;
        if (shouldSolve && options.deferPlacement && eastWestMapPlacementCache_) {
          scheduleEastWestMapPlacementSolve_();
        } else if (shouldSolve) {
          if (options.forcePlacement) clearEastWestMapPlacementSolve_();
          eastWestMapPlacementCacheKey_ = cacheKey;
          eastWestMapPlacementCache_ = resolveEastWestMapMarkerPlacements_(markers, markerScale);
        }
        placements = eastWestMapPlacementCache_ || centeredEastWestMapMarkerPlacements_(markers);
      }
      markers.forEach(marker => {
        const placement = placements.get(marker);
        if (!placement) return;
        marker.classList.toggle('is-offset', Boolean(placement.moved));
        marker.dataset.drawX = placement.x.toFixed(2);
        marker.dataset.drawY = placement.y.toFixed(2);
        marker.setAttribute('transform', `translate(${placement.x.toFixed(2)} ${placement.y.toFixed(2)}) scale(${markerScale.toFixed(4)})`);
      });
    }

    function requestEastWestMapZoomApply_(options = {}) {
      eastWestMapPendingApplyOptions_ = {
        ...(eastWestMapPendingApplyOptions_ || {}),
        ...options,
        forcePlacement: Boolean(eastWestMapPendingApplyOptions_?.forcePlacement || options.forcePlacement),
        deferPlacement: Boolean(eastWestMapPendingApplyOptions_?.deferPlacement || options.deferPlacement)
      };
      if (eastWestMapApplyFrame_) return;
      eastWestMapApplyFrame_ = requestAnimationFrame(() => {
        const nextOptions = eastWestMapPendingApplyOptions_ || {};
        eastWestMapPendingApplyOptions_ = null;
        eastWestMapApplyFrame_ = 0;
        applyEastWestMapZoom_(nextOptions);
      });
    }

    function eastWestMapMarkerScale_() {
      const scale = Math.max(EAST_WEST_MAP_MIN_SCALE_, eastWestMapTransform_.scale || 1);
      const isMobile = isMobileBoardLayout_();
      const zoomMin = isMobile ? 0.22 : 0.13;
      const zoomPower = isMobile ? 0.9 : 1.08;
      const zoomScale = Math.max(zoomMin, Math.min(1, 1 / Math.pow(scale, zoomPower)));
      const mobileBoost = isMobileBoardLayout_() ? 1.85 : 1;
      const markerScale = zoomScale * eastWestMapLogoScale_ * mobileBoost;
      return isMobile ? Math.min(2.2, markerScale) : markerScale;
    }

    function resetEastWestMapZoom_() {
      if (eastWestMapViewportFrame_) {
        cancelAnimationFrame(eastWestMapViewportFrame_);
        eastWestMapViewportFrame_ = 0;
      }
      if (eastWestMapApplyFrame_) {
        cancelAnimationFrame(eastWestMapApplyFrame_);
        eastWestMapApplyFrame_ = 0;
        eastWestMapPendingApplyOptions_ = null;
      }
      setEastWestMapTransforming_(false);
      eastWestMapTransform_.scale = 1;
      eastWestMapTransform_.x = 0;
      eastWestMapTransform_.y = 0;
      clearEastWestMapPlacementSolve_();
      applyEastWestMapZoom_({ forcePlacement: true });
    }

    function eastWestMapSvgPoint_(event) {
      const svg = eastWestMapCanvas.querySelector('svg');
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: ((event.clientX - rect.left) / rect.width) * 1200,
        y: ((event.clientY - rect.top) / rect.height) * 650,
        rect
      };
    }

    function eastWestMapCenterPoint_() {
      const svg = eastWestMapCanvas.querySelector('svg');
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return { x: 600, y: 325, rect };
    }

    function zoomEastWestMapAt_(zoomFactor, point) {
      if (!point) return;
      const oldScale = eastWestMapTransform_.scale;
      const newScale = Math.min(EAST_WEST_MAP_MAX_SCALE_, Math.max(EAST_WEST_MAP_MIN_SCALE_, oldScale * zoomFactor));
      const mapX = (point.x - eastWestMapTransform_.x) / oldScale;
      const mapY = (point.y - eastWestMapTransform_.y) / oldScale;
      eastWestMapTransform_.scale = newScale;
      eastWestMapTransform_.x = point.x - mapX * newScale;
      eastWestMapTransform_.y = point.y - mapY * newScale;
      requestEastWestMapZoomApply_({ deferPlacement: true });
    }

    function closestFromTarget_(target, selector) {
      return target?.closest ? target.closest(selector) : null;
    }

    function isMobileBoardLayout_() {
      return window.matchMedia?.('(max-width: 760px)').matches || window.innerWidth <= 760;
    }

    function isScheduleLogoTarget_(target) {
      return Boolean(closestFromTarget_(target, '.logo, .logo-placeholder'));
    }

    function toggleMobileStatsRow_(row) {
      if (!row) return;
      const isOpen = !row.classList.contains('mobile-stats-open');
      row.classList.toggle('mobile-stats-open', isOpen);
      row.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function eastWestMapUiTarget_(target) {
      return !!closestFromTarget_(target, '.nc-map-ui, .east-west-map-info-card, .east-west-map-context-menu');
    }

    function markerFromMapTarget_(target) {
      return closestFromTarget_(target, '.nc-map-marker');
    }

    function rowFromMapMarker_(marker) {
      const key = marker?.dataset?.teamKey || '';
      return eastWestMapRowsByKey_.get(key) || null;
    }

    function updateEastWestMapLogoScaleUi_() {
      const input = document.getElementById('eastWestMapLogoScale');
      const value = document.getElementById('eastWestMapLogoScaleValue');
      const extraEast = document.getElementById('eastWestMapExtraEast');
      const cleanView = document.getElementById('eastWestMapCleanView');
      const regionRankView = document.getElementById('eastWestMapRegionRankView');
      const performanceMode = document.getElementById('eastWestMapPerformanceMode');
      if (input) input.value = eastWestMapLogoScale_.toFixed(2);
      if (value) value.textContent = `${Math.round(eastWestMapLogoScale_ * 100)}%`;
      if (extraEast) {
        extraEast.checked = eastWestExtraEast.checked;
        extraEast.disabled = false;
      }
      if (cleanView) cleanView.checked = eastWestMapCleanView_;
      if (regionRankView) regionRankView.checked = eastWestMapRegionRankView_;
      if (performanceMode) performanceMode.checked = eastWestMapPerformanceMode_;
      syncOddTeamSplitToggleUi_();
      eastWestMapCanvas.classList.toggle('is-region-rank-view', eastWestMapRegionRankView_);
        eastWestMapCanvas.classList.toggle('county-lines-always-on', !eastWestMapPerformanceMode_);
      }

    function setEastWestMapLogoControlsOpen_(isOpen) {
      eastWestMapLogoControlsOpen_ = Boolean(isOpen);
      const wrap = document.getElementById('eastWestMapLogoScaleWrap');
      const settingsBtn = document.getElementById('eastWestMapSettingsBtn');
      if (wrap) wrap.classList.toggle('is-hidden', !eastWestMapLogoControlsOpen_);
      if (settingsBtn) {
        settingsBtn.classList.toggle('is-active', eastWestMapLogoControlsOpen_);
        settingsBtn.setAttribute('aria-pressed', eastWestMapLogoControlsOpen_ ? 'true' : 'false');
      }
      eastWestMapCanvas.querySelectorAll('[data-map-action="settings"]').forEach(btn => {
        btn.classList.toggle('is-active', eastWestMapLogoControlsOpen_);
        btn.setAttribute('aria-pressed', eastWestMapLogoControlsOpen_ ? 'true' : 'false');
      });
    }

    function toggleEastWestMapLogoControls_() {
      setEastWestMapLogoControlsOpen_(!eastWestMapLogoControlsOpen_);
    }

    function setEastWestMapLogoScale_(value) {
      const next = Math.min(EAST_WEST_MAP_LOGO_MAX_, Math.max(EAST_WEST_MAP_LOGO_MIN_, Number(value) || 1));
      eastWestMapLogoScale_ = next;
      updateEastWestMapLogoScaleUi_();
      applyEastWestMapZoom_({ deferPlacement: true });
    }

    function applyEastWestMarkerZOrder_() {
      const layer = eastWestMapCanvas.querySelector('#eastWestMapMarkerLayer');
      if (!layer) return;
      const markers = [...layer.querySelectorAll('.nc-map-marker')];
      markers.forEach(marker => {
        const key = marker.dataset.teamKey || '';
        marker.classList.toggle('is-focused', eastWestMapFocusedTeams_.has(key));
        marker.classList.toggle('is-unfocused', eastWestMapUnfocusedTeams_.has(key));
        marker.classList.toggle('is-measure-start', key && key === eastWestMapMeasureStartKey_);
      });
      const unfocused = markers.filter(marker => eastWestMapUnfocusedTeams_.has(marker.dataset.teamKey || ''));
      const focused = markers.filter(marker => eastWestMapFocusedTeams_.has(marker.dataset.teamKey || ''));
      const regular = markers.filter(marker => !eastWestMapUnfocusedTeams_.has(marker.dataset.teamKey || '') && !eastWestMapFocusedTeams_.has(marker.dataset.teamKey || ''));
      unfocused.concat(regular, focused).forEach(marker => layer.appendChild(marker));
    }

    function positionEastWestMapFloating_(el, clientX, clientY) {
      const panel = eastWestMapOverlay.querySelector('.east-west-map-panel');
      if (!panel) return;
      if ('hidden' in el) el.hidden = false;
      const panelRect = panel.getBoundingClientRect();
      const margin = 14;
      const width = el.offsetWidth || 340;
      const height = el.offsetHeight || 220;
      const x = Number.isFinite(clientX) ? clientX - panelRect.left + 12 : margin;
      const y = Number.isFinite(clientY) ? clientY - panelRect.top + 12 : panelRect.height - height - margin;
      el.style.left = `${Math.max(margin, Math.min(x, panelRect.width - width - margin))}px`;
      el.style.top = `${Math.max(margin, Math.min(y, panelRect.height - height - margin))}px`;
      el.style.bottom = 'auto';
    }

    function bringEastWestMapInfoCardToFront_(card) {
      if (!card) return;
      eastWestMapInfoCardZ_ += 1;
      card.style.zIndex = String(eastWestMapInfoCardZ_);
    }

    function createEastWestMapInfoCard_(html, event, options = {}) {
      const key = options.key || '';
      let card = key ? eastWestMapInfoCardsByKey_.get(key) : null;
      if (card && !card.isConnected) {
        eastWestMapInfoCardsByKey_.delete(key);
        card = null;
      }

      const isNew = !card;
      if (!card) {
        card = document.createElement('div');
        card.className = 'east-west-map-info-card';
        card.dataset.mapInfoCardId = String(++eastWestMapInfoCardSeq_);
        if (key) {
          card.dataset.mapInfoCardKey = key;
          eastWestMapInfoCardsByKey_.set(key, card);
        }
        eastWestMapInfoCards.appendChild(card);
      }

      card.dataset.mapInfoCardKind = options.kind || '';
      card.dataset.teamKey = options.teamKey || '';
      card.innerHTML = html;
      if (isNew || options.repositionExisting) {
        positionEastWestMapFloating_(card, event?.clientX, event?.clientY);
      }
      bringEastWestMapInfoCardToFront_(card);
      armImageFallbacks_(card);
      return card;
    }

    function removeEastWestMapInfoCard_(card) {
      if (!card) return;
      const key = card.dataset.mapInfoCardKey || '';
      const kind = card.dataset.mapInfoCardKind || '';
      const teamKey = card.dataset.teamKey || '';
      if (key) eastWestMapInfoCardsByKey_.delete(key);
      card.remove();
      if (kind === 'measure-start' && teamKey && teamKey === eastWestMapMeasureStartKey_) {
        eastWestMapMeasureRequestId_ += 1;
        eastWestMapMeasureStartKey_ = '';
        eastWestMapCanvas.classList.remove('is-measuring');
        applyEastWestMarkerZOrder_();
      }
      if (kind === 'distance' && !eastWestMapInfoCards.querySelector('[data-map-info-card-kind="distance"]')) {
        clearEastWestMeasureLine_();
      }
    }

    function hideEastWestMapInfoCard_() {
      eastWestMapMeasureRequestId_ += 1;
      eastWestMapInfoCards.innerHTML = '';
      eastWestMapInfoCardsByKey_.clear();
    }

    function hideEastWestMapContextMenu_() {
      eastWestMapContextMenu.hidden = true;
      eastWestMapContextMenu.innerHTML = '';
      eastWestMapContextTeamKey_ = '';
    }

    function eastWestMapCardLogoHtml_(row) {
      return imageHtmlWithFallback_(
        'east-west-map-card-logo',
        row.mapLogoUrl || row.logoUrl,
        `${row.school} logo`,
        'east-west-map-card-logo-placeholder'
      );
    }

    function showEastWestTeamDetails_(row, event) {
      eastWestMapMeasureRequestId_ += 1;
      clearEastWestMeasureLine_();
      eastWestMapMeasureStartKey_ = '';
      eastWestMapCanvas.classList.remove('is-measuring');
      applyEastWestMarkerZOrder_();
      const latText = `${formatCoordinate_(row.mapLatitude)}${row.mapLatitudeIsDefault ? ' default' : ''}`;
      const lonText = formatCoordinate_(row.mapLongitude);
      createEastWestMapInfoCard_(`
        <div class="east-west-map-card-head">
          ${eastWestMapCardLogoHtml_(row)}
          <div>
            <div class="east-west-map-card-title">${escapeHtml(row.school)}</div>
            <div class="east-west-map-card-subtitle">${escapeHtml(row.lineRegion || '')} Region</div>
          </div>
          <button class="east-west-map-card-close" type="button" data-map-card-close aria-label="Close details">&times;</button>
        </div>
        <div class="east-west-map-card-grid">
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Record</div><div class="east-west-map-card-value">${escapeHtml(row.record || 'Missing')}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">RPI</div><div class="east-west-map-card-value">${escapeHtml(row.rpi || 'Missing')}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Region Rank</div><div class="east-west-map-card-value">#${escapeHtml(row.regionRank || '?')}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">RPI Rank</div><div class="east-west-map-card-value">#${escapeHtml(row.rank || '?')}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Latitude</div><div class="east-west-map-card-value">${escapeHtml(latText)}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Longitude</div><div class="east-west-map-card-value">${escapeHtml(lonText)}</div></div>
        </div>`, event, { key: `team:${row.teamKey}`, kind: 'team', teamKey: row.teamKey });
    }

    function showEastWestMapContextMenu_(row, event) {
      eastWestMapContextTeamKey_ = row.teamKey;
      eastWestMapContextMenu.innerHTML = `
        <div class="east-west-map-menu-title">${escapeHtml(row.school)}</div>
        <button class="east-west-map-menu-item" type="button" data-map-menu-action="measure">Measure Distance</button>
        <button class="east-west-map-menu-item" type="button" data-map-menu-action="focus">Focus Team</button>
        <button class="east-west-map-menu-item" type="button" data-map-menu-action="unfocus">Unfocus Team</button>`;
      positionEastWestMapFloating_(eastWestMapContextMenu, event.clientX, event.clientY);
    }

    function focusEastWestMapTeam_(row) {
      eastWestMapFocusedTeams_.add(row.teamKey);
      eastWestMapUnfocusedTeams_.delete(row.teamKey);
      applyEastWestMarkerZOrder_();
    }

    function unfocusEastWestMapTeam_(row) {
      eastWestMapFocusedTeams_.delete(row.teamKey);
      eastWestMapUnfocusedTeams_.add(row.teamKey);
      applyEastWestMarkerZOrder_();
    }

    function clearEastWestMeasureLine_() {
      const layer = eastWestMapCanvas.querySelector('#eastWestMapMeasureLayer');
      if (layer) layer.innerHTML = '';
    }

    function drawEastWestMeasureLine_(from, to) {
      const layer = eastWestMapCanvas.querySelector('#eastWestMapMeasureLayer');
      if (!layer) return;
      layer.innerHTML = `<line class="nc-map-measure-line" x1="${Number(from.mapX).toFixed(2)}" y1="${Number(from.mapY).toFixed(2)}" x2="${Number(to.mapX).toFixed(2)}" y2="${Number(to.mapY).toFixed(2)}"></line>`;
    }

    function startEastWestMeasure_(row) {
      eastWestMapMeasureRequestId_ += 1;
      clearEastWestMeasureLine_();
      eastWestMapMeasureStartKey_ = row.teamKey;
      eastWestMapCanvas.classList.add('is-measuring');
      applyEastWestMarkerZOrder_();
      const card = createEastWestMapInfoCard_(`
        <div class="east-west-map-card-head">
          ${eastWestMapCardLogoHtml_(row)}
          <div>
            <div class="east-west-map-card-title">Measuring From ${escapeHtml(row.school)}</div>
            <div class="east-west-map-card-subtitle">Left click another team</div>
          </div>
          <button class="east-west-map-card-close" type="button" data-map-card-close aria-label="Close details">&times;</button>
        </div>
        <div class="east-west-map-card-note">Choose a second school logo to calculate straight-line miles, driving miles, and ETA.</div>`, null, { key: `team:${row.teamKey}`, kind: 'measure-start', teamKey: row.teamKey });
      card.style.left = '30px';
      card.style.top = 'auto';
      card.style.bottom = '30px';
    }

    function haversineMiles_(from, to) {
      const toRad = value => Number(value) * Math.PI / 180;
      const lat1 = toRad(from.mapLatitude);
      const lat2 = toRad(to.mapLatitude);
      const dLat = lat2 - lat1;
      const dLon = toRad(to.mapLongitude) - toRad(from.mapLongitude);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatMiles_(miles) {
      return Number.isFinite(miles) ? `${miles.toFixed(1)} mi` : 'Unavailable';
    }

    function formatDuration_(seconds) {
      if (!Number.isFinite(seconds)) return 'Unavailable';
      const mins = Math.max(1, Math.round(seconds / 60));
      if (mins < 60) return `${mins} min`;
      const hours = Math.floor(mins / 60);
      const rest = mins % 60;
      return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
    }

    function estimatedDrivingRoute_(straightMiles) {
      const miles = straightMiles * 1.28;
      return {
        miles,
        seconds: (miles / 48) * 3600,
        source: 'Estimated driving route'
      };
    }

    async function fetchJsonWithTimeout_(url, timeoutMs = ROUTE_REQUEST_TIMEOUT_MS_) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`Route fetch failed (${res.status})`);
        return await res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    }

    async function fetchValhallaDrivingRoute_(from, to) {
      const payload = {
        locations: [
          { lat: Number(from.mapLatitude), lon: Number(from.mapLongitude) },
          { lat: Number(to.mapLatitude), lon: Number(to.mapLongitude) }
        ],
        costing: 'auto',
        directions_options: { units: 'miles' }
      };
      const json = await fetchJsonWithTimeout_(`${VALHALLA_ROUTE_URL_}?json=${encodeURIComponent(JSON.stringify(payload))}`);
      const summary = json?.trip?.summary;
      if (!summary || !Number.isFinite(Number(summary.length)) || !Number.isFinite(Number(summary.time))) {
        throw new Error('No Valhalla route returned');
      }
      return {
        miles: Number(summary.length),
        seconds: Number(summary.time),
        source: 'Driving route'
      };
    }

    async function fetchOsrmDrivingRoute_(from, to, baseUrl) {
      const start = `${Number(from.mapLongitude).toFixed(6)},${Number(from.mapLatitude).toFixed(6)}`;
      const end = `${Number(to.mapLongitude).toFixed(6)},${Number(to.mapLatitude).toFixed(6)}`;
      const json = await fetchJsonWithTimeout_(`${baseUrl}${start};${end}?overview=false&alternatives=false&steps=false`);
      const route = json?.routes?.[0];
      if (!route || !Number.isFinite(Number(route.distance)) || !Number.isFinite(Number(route.duration))) {
        throw new Error('No OSRM route returned');
      }
      return {
        miles: Number(route.distance) / 1609.344,
        seconds: Number(route.duration),
        source: 'Driving route'
      };
    }

    async function fetchDrivingRoute_(from, to) {
      const attempts = [
        () => fetchValhallaDrivingRoute_(from, to),
        ...OSRM_ROUTE_BASE_URLS_.map(baseUrl => () => fetchOsrmDrivingRoute_(from, to, baseUrl))
      ];
      const errors = [];
      for (const attempt of attempts) {
        try {
          return await attempt();
        } catch (err) {
          errors.push(err);
        }
      }
      throw errors[0] || new Error('Driving route unavailable');
    }

    function renderEastWestDistanceCard_(from, to, straightMiles, route, event, existingCard = null) {
      if (existingCard && !existingCard.isConnected) return existingCard;
      const html = `
        <div class="east-west-map-card-head">
          ${eastWestMapCardLogoHtml_(to)}
          <div>
            <div class="east-west-map-card-title">${escapeHtml(from.school)} to ${escapeHtml(to.school)}</div>
            <div class="east-west-map-card-subtitle">Distance Measurement</div>
          </div>
          <button class="east-west-map-card-close" type="button" data-map-card-close aria-label="Close details">&times;</button>
        </div>
        <div class="east-west-map-card-grid">
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Straight Line</div><div class="east-west-map-card-value">${escapeHtml(formatMiles_(straightMiles))}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Driving Miles</div><div class="east-west-map-card-value">${escapeHtml(route ? formatMiles_(route.miles) : 'Calculating...')}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Driving ETA</div><div class="east-west-map-card-value">${escapeHtml(route ? formatDuration_(route.seconds) : 'Calculating...')}</div></div>
          <div class="east-west-map-card-stat"><div class="east-west-map-card-label">Route</div><div class="east-west-map-card-value">${escapeHtml(route?.source || 'Checking roads')}</div></div>
        </div>
        <div class="east-west-map-card-note">${route?.source === 'Estimated driving route' ? 'Road API unavailable, using straight-line estimate.' : 'Driving values use road routing when available.'}</div>`;
      let card = existingCard;
      if (card?.isConnected) {
        card.innerHTML = html;
        armImageFallbacks_(card);
        bringEastWestMapInfoCardToFront_(card);
      } else {
        card = createEastWestMapInfoCard_(html, event, { key: `distance:${from.teamKey}:${to.teamKey}`, kind: 'distance', repositionExisting: true });
      }
      if (event && card) {
        positionEastWestMapFloating_(card, event.clientX, event.clientY);
      } else {
        bringEastWestMapInfoCardToFront_(card);
      }
      return card;
    }

    async function completeEastWestMeasure_(to, event) {
      const from = eastWestMapRowsByKey_.get(eastWestMapMeasureStartKey_);
      if (!from || !to || from.teamKey === to.teamKey) return;
      eastWestMapMeasureStartKey_ = '';
      eastWestMapCanvas.classList.remove('is-measuring');
      applyEastWestMarkerZOrder_();
      const measureStartCard = eastWestMapInfoCardsByKey_.get(`team:${from.teamKey}`);
      if (measureStartCard?.dataset.mapInfoCardKind === 'measure-start') {
        removeEastWestMapInfoCard_(measureStartCard);
      }
      drawEastWestMeasureLine_(from, to);
      const straightMiles = haversineMiles_(from, to);
      const requestId = ++eastWestMapMeasureRequestId_;
      const card = renderEastWestDistanceCard_(from, to, straightMiles, null, event);
      try {
        const route = await fetchDrivingRoute_(from, to);
        if (requestId === eastWestMapMeasureRequestId_) renderEastWestDistanceCard_(from, to, straightMiles, route, null, card);
      } catch (err) {
        console.warn(err);
        if (requestId === eastWestMapMeasureRequestId_) renderEastWestDistanceCard_(from, to, straightMiles, estimatedDrivingRoute_(straightMiles), null, card);
      }
    }

    function buildEastWestLineRows_(rows, classification, extraSide = eastWestExtraSide_()) {
      const cap = playoffEligibleCap_(classification);
      const eligible = rows
        .filter(r => r.school && String(r.rpi || '').trim() !== '')
        .slice()
        .sort((a, b) => {
          const rpiDiff = numericRpi_(b.rpi) - numericRpi_(a.rpi);
          if (rpiDiff) return rpiDiff;
          return Number(a.rank || 0) - Number(b.rank || 0);
        })
        .slice(0, cap)
        .sort((a, b) => longitudeSortValue_(a) - longitudeSortValue_(b));

      const isOdd = eligible.length % 2 === 1;
      const oddExtraEast = isOdd && extraSide === 'east';
      const eastCount = Math.floor(eligible.length / 2) + (oddExtraEast ? 1 : 0);
      const east = eligible.slice(0, eastCount).map((row, i) => ({
        ...row,
        lineRank: i + 1,
        lineRegion: 'East',
        isOddExtra: isOdd && extraSide === 'east' && i === eastCount - 1,
        isLineCut: i === eastCount - 1 && eligible.length > 1
      }));
      const west = eligible.slice(eastCount).map((row, i) => ({
        ...row,
        lineRank: i + 1,
        lineRegion: 'West',
        isOddExtra: isOdd && extraSide === 'west' && i === 0,
        isLineCut: i === 0 && eligible.length > 1
      }));

      const applyRegionRanks = (sideRows) => {
        const ranks = new Map(sideRows
          .slice()
          .sort((a, b) => {
            const rpiDiff = numericRpi_(b.rpi) - numericRpi_(a.rpi);
            if (rpiDiff) return rpiDiff;
            return Number(a.rank || 0) - Number(b.rank || 0);
          })
          .map((row, i) => [canonicalTeamName_(row.school), i + 1]));
        sideRows.forEach(row => {
          row.regionRank = ranks.get(canonicalTeamName_(row.school)) || '';
        });
      };
      applyRegionRanks(east);
      applyRegionRanks(west);

      return {
        east,
        west,
        total: eligible.length,
        cap,
        extraSide,
        isOdd
      };
    }

    function buildRegionRows_(rows, classification, extraSide = eastWestExtraSide_(), excludedTeams = []) {
      const lineData = buildEastWestLineRows_(rows, classification, extraSide);

      const east = lineData.east
        .slice()
        .sort((a, b) => numericRpi_(b.rpi) - numericRpi_(a.rpi))
        .map((r, i) => ({ ...r, regionRank: i + 1 }));

      const west = lineData.west
        .slice()
        .sort((a, b) => numericRpi_(b.rpi) - numericRpi_(a.rpi))
        .map((r, i) => ({ ...r, regionRank: i + 1 }));

      return { west, east, total: lineData.total, cap: lineData.cap, extraSide: lineData.extraSide, excludedTeams };
    }

    function regionInfoLookupForRows_(rows, classification) {
      const lookup = new Map();
      try {
        const regionData = buildRegionRows_(rows, classification, eastWestExtraSide_(), []);
        regionData.east.concat(regionData.west).forEach(row => {
          if (row.school && row.regionRank) {
            lookup.set(canonicalTeamName_(row.school), {
              rank: row.regionRank,
              region: row.lineRegion || ''
            });
          }
        });
      } catch (err) {
        console.warn('Region info lookup unavailable:', err);
      }
      return lookup;
    }

    function setEastWestMapStateFromRows_(rows, classification, sportLabel, excludedTeams = []) {
      const lineData = buildEastWestLineRows_(rows, classification);
      eastWestLineMapState_ = { lineData, classification, sportLabel, year: selectedRpiYear_(), excludedTeams };
      return lineData;
    }

    function protectedSeedOrder_(protectedCount) {
      if (protectedCount === 4) return [3, 2, 4, 1];
      if (protectedCount === 8) return [7, 2, 3, 6, 5, 4, 8, 1];
      const seeds = [];
      for (let high = protectedCount - 1, low = 2; high >= low; high--, low++) {
        seeds.push(high);
        seeds.push(low);
      }
      seeds.push(protectedCount);
      seeds.push(1);
      return seeds;
    }

    function buildRegionPlayoff_(rows, classification, totalTeamCount = 0) {
      const slotCount = regionSlotCount_(classification, totalTeamCount || rows.length);
      const protectedCount = slotCount / 4;
      const halfBracket = slotCount / 2;
      const seedMap = new Map(rows.map(r => [r.regionRank, r]));

      const orderedProtectedSeeds = protectedSeedOrder_(protectedCount);

      const slots = orderedProtectedSeeds.map((protectedSeed) => {
        const lowSeed = halfBracket - protectedSeed + 1;
        const highSeed = slotCount + 1 - lowSeed;

        const protectedTeam = seedMap.get(protectedSeed) || null;
        const lowTeam = seedMap.get(lowSeed) || null;
        const highTeam = seedMap.get(highSeed) || null;

        let firstTop = null;
        let firstBottom = null;

        if (highTeam && lowTeam) {
          firstTop = { type: 'team', team: highTeam };
          firstBottom = { type: 'team', team: lowTeam };
        } else if (lowTeam) {
          firstTop = { type: 'text', text: 'BYE', bye: true };
          firstBottom = { type: 'team', team: lowTeam };
        } else if (highTeam) {
          firstTop = { type: 'team', team: highTeam };
          firstBottom = { type: 'text', text: 'BYE', bye: true };
        } else {
          firstTop = { type: 'empty', text: '' };
          firstBottom = { type: 'empty', text: '' };
        }

        let secondTop = null;
        if (highTeam && lowTeam) {
          secondTop = { type: 'text', text: `${highSeed} vs ${lowSeed} Winner` };
        } else if (lowTeam) {
          secondTop = { type: 'team', team: lowTeam };
        } else if (highTeam) {
          secondTop = { type: 'team', team: highTeam };
        } else {
          secondTop = { type: 'empty', text: '' };
        }

        const secondBottom = protectedTeam
          ? { type: 'team', team: protectedTeam }
          : { type: 'text', text: 'BYE', bye: true };

        return {
          protectedSeed,
          lowSeed,
          highSeed,
          firstRound: { top: firstTop, bottom: firstBottom },
          secondRound: { top: secondTop, bottom: secondBottom }
        };
      });

      return {
        slotCount,
        protectedCount,
        teamCount: rows.length,
        slots
      };
    }

    function driveImageCandidates_(url) {
      const s = String(url || '').trim();
      if (!s) return [];
      const idMatch = s.match(/[?&]id=([A-Za-z0-9_-]+)/i) || s.match(/\/d\/([A-Za-z0-9_-]+)/i) || s.match(/\/file\/d\/([A-Za-z0-9_-]+)/i);
      if (!idMatch) return [s];
      const id = idMatch[1];
      return [
        `https://lh3.googleusercontent.com/d/${id}=w1200`,
        `https://drive.google.com/thumbnail?id=${id}&sz=w1200`,
        `https://drive.google.com/uc?export=view&id=${id}`,
        `https://drive.google.com/uc?id=${id}`
      ];
    }

    function normalizeDriveImageUrl_(url) {
      return driveImageCandidates_(url)[0] || '';
    }

    function logoCandidates_(url) {
      const s = String(url || '').trim();
      return /drive\.google\.com|googleusercontent\.com/i.test(s) ? driveImageCandidates_(s) : (s ? [s] : []);
    }

    function imageHtmlWithFallback_(className, url, alt, placeholderClass) {
      const candidates = logoCandidates_(url);
      if (!candidates.length) return `<div class="${placeholderClass}"></div>`;
      const first = escapeHtml(candidates[0]);
      const all = escapeHtml(candidates.join('|||'));
      return `<img class="${className}" src="${first}" data-src-candidates="${all}" data-src-index="0" alt="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer">`;
    }

    function mobileRpiBoardHeaderHtml_() {
      return `
        <tr class="mobile-rpi-board-header" aria-hidden="true">
          <td colspan="${MAIN_TABLE_COLSPAN_}">
            ${playoffHeaderHtml_(classEl.value, sportEl.value, 'RPI Standings')}
          </td>
        </tr>`;
    }

    function rowsHaveLiveChanges_(rows) {
      return (rows || []).some(row =>
        Number.isFinite(Number(row.rankChange)) ||
        Number.isFinite(Number(row.rpiChange))
      );
    }

    function changeClass_(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n === 0) return '';
      return n > 0 ? 'up' : 'down';
    }

    function formatRankChange_(row) {
      const n = Number(row?.rankChange);
      if (!Number.isFinite(n) || n === 0) return '-';
      return n > 0 ? `▲ ${n}` : `▼ ${Math.abs(n)}`;
    }

    function rankChangeHtml_(row) {
      const n = Number(row?.rankChange);
      if (!Number.isFinite(n) || n === 0) return '-';
      const direction = n > 0 ? 'up' : 'down';
      const arrow = n > 0 ? '▲' : '▼';
      return `<span class="change-arrow ${direction}">${arrow}</span>${escapeHtml(Math.abs(n))}`;
    }

    function formatRpiChange_(row) {
      const n = Number(row?.rpiChange);
      if (!Number.isFinite(n) || n === 0) return '-';
      const fixed = `${n > 0 ? '+' : '-'}${Math.abs(n).toFixed(6)}`;
      return fixed.replace(/^([+-])0\./, '$1.');
    }

    function armImageFallbacks_(root = document) {
      const imgs = [...root.querySelectorAll('img[data-src-candidates]')];
      imgs.forEach(img => {
        if (img.dataset.fallbackArmed === '1') return;
        img.dataset.fallbackArmed = '1';
        const candidates = String(img.dataset.srcCandidates || '').split('|||').filter(Boolean);
        const useIndex = (idx) => {
          if (idx < 0 || idx >= candidates.length) return false;
          img.dataset.srcIndex = String(idx);
          img.src = candidates[idx];
          return true;
        };
        img.addEventListener('load', () => {
          img.dataset.loadedSrc = img.currentSrc || img.src || '';
        });
        img.addEventListener('error', () => {
          const next = Number(img.dataset.srcIndex || '0') + 1;
          if (!useIndex(next)) img.style.visibility = 'hidden';
        });
        if (!img.getAttribute('src') && candidates.length) useIndex(0);
      });
    }

    // ============================================================================
    // 10. Table and board rendering
    // ============================================================================

    function renderRows(rows) {
      const hasDetailedStats = rpiResultHasDetailedStats_(rows);
      const showChanges = rowsHaveLiveChanges_(rows);
      document.body.classList.toggle('has-rpi-changes', showChanges);
      setMainHeaderLabels_(showChanges
        ? (hasDetailedStats
          ? ['▲/▼', 'Rank', 'School', 'Record', 'WP', 'OWP', 'OOWP', 'RPI', '+/-']
          : ['▲/▼', 'Rank', 'School', 'Record', 'RPI', '+/-'])
        : (hasDetailedStats
          ? defaultHeaderLabels
          : ['Rank', 'School', 'Record', 'RPI']));

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="${showChanges ? (hasDetailedStats ? 9 : 6) : (hasDetailedStats ? 7 : 4)}" class="muted">No rankings returned.</td></tr>`;
        return;
      }

      const regionInfoByTeam = regionInfoLookupForRows_(rows, classEl.value);
      const rowHtml = rows.map(row => {
        const regionInfo = regionInfoByTeam.get(canonicalTeamName_(row.school)) || {};
        const scheduleRow = row.regionRank
          ? row
          : {
              ...row,
              regionRank: regionInfo.rank || '',
              lineRegion: regionInfo.region || ''
            };
        const logo = imageHtmlWithFallback_('logo', row.logoUrl, `${row.school} logo`, 'logo-placeholder');

        const mascot = row.mascot ? escapeHtml(row.mascot) : 'Team';
        const rankChangeClass = changeClass_(row.rankChange);
        const rpiChangeClass = changeClass_(row.rpiChange);

        const mobileRankChangeHtml = showChanges && rankChangeClass
          ? teamLogTriggerHtml_(scheduleRow, rankChangeHtml_(row), `mobile-rank-change ${rankChangeClass}`, { raw: true })
          : '';

        return `
          <tr class="${escapeHtml(scheduleRowClass_(scheduleRow))}" ${scheduleRowDataAttrs_(scheduleRow)}>
            ${showChanges ? `<td data-label="Change">${teamLogTriggerHtml_(scheduleRow, rankChangeHtml_(row), `rank-change ${rankChangeClass}`, { raw: true })}</td>` : ''}
            <td class="rank" data-label="Rank">${mobileRankChangeHtml}<span class="rank-number rpi-log-trigger" ${teamLogRowDataAttrs_(scheduleRow)}>${escapeHtml(row.rank)}</span></td>
            <td data-label="School">
              <div class="school">
                ${logo}
                <div class="team-meta">
                  <div class="team-name">${escapeHtml(row.school)}</div>
                  <div class="team-sub">${mascot}</div>
                </div>
              </div>
            </td>
            <td class="mobile-row-stats" data-label="Summary">
              ${teamLogTriggerHtml_(scheduleRow, `<span>Record</span><strong>${escapeHtml(row.record || '-')}</strong>`, 'mobile-row-pill', { raw: true })}
              ${teamLogTriggerHtml_(scheduleRow, `<span>RPI</span><strong>${escapeHtml(row.rpi || '-')}</strong>`, 'mobile-row-pill', { raw: true })}
            </td>
            <td data-label="Record">${teamLogTriggerHtml_(scheduleRow, row.record, 'stat')}</td>
            ${hasDetailedStats ? `
            <td data-label="WP">${teamLogTriggerHtml_(scheduleRow, row.wp, 'stat')}</td>
            <td data-label="OWP">${teamLogTriggerHtml_(scheduleRow, row.owp, 'stat')}</td>
            <td data-label="OOWP">${teamLogTriggerHtml_(scheduleRow, row.oowp, 'stat')}</td>` : ''}
            <td data-label="RPI">${teamLogTriggerHtml_(scheduleRow, row.rpi, 'rpi')}</td>
            ${showChanges ? `<td data-label="RPI +/-">${teamLogTriggerHtml_(scheduleRow, formatRpiChange_(row), `rpi-change ${rpiChangeClass}`)}</td>` : ''}
          </tr>`;
      }).join('');
      tbody.innerHTML = `${mobileRpiBoardHeaderHtml_()}${rowHtml}`;
    }

    function renderRegionRows(regionData, classification, sportLabel) {
      setEastWestMapStateFromRows_(regionData.west.concat(regionData.east), classification, sportLabel, regionData.excludedTeams || []);
      // Keep these column names in sync with the adjustable-column comments in playoff_board.desktop.css.
      const regionColumnGroup = `
        <colgroup>
          <col class="col-rank" />
          <col class="col-school" />
          <col class="col-record" />
          <col class="col-rpi" />
        </colgroup>`;
      const renderTable = (rows) => {
        const items = rows.map(row => {
          const logo = imageHtmlWithFallback_('logo', row.logoUrl, `${row.school} logo`, 'logo-placeholder');

          const mascot = row.mascot ? escapeHtml(row.mascot) : 'Team';

          return `
            <tr class="${escapeHtml(scheduleRowClass_(row, oddExtraClass_(row)))}" ${scheduleRowDataAttrs_(row)}>
              <td class="rank is-centered" data-col="rank" data-label="Rank"><span class="rank-number rpi-log-trigger" ${teamLogRowDataAttrs_(row)}>${escapeHtml(row.regionRank)}</span></td>
              <td data-col="school" data-label="School">
                <div class="school">
                  ${logo}
                  <div class="team-meta">
                    <div class="team-name">${escapeHtml(row.school)}</div>
                    <div class="team-sub">${mascot}</div>
                  </div>
                </div>
              </td>
              <td class="mobile-row-stats" data-label="Summary">
                ${teamLogTriggerHtml_(row, `<span>Record</span><strong>${escapeHtml(row.record || '-')}</strong>`, 'mobile-row-pill', { raw: true })}
                ${teamLogTriggerHtml_(row, `<span>RPI</span><strong>${escapeHtml(row.rpi || '-')}</strong>`, 'mobile-row-pill', { raw: true })}
              </td>
              <td class="is-centered" data-col="record" data-label="Record">${teamLogTriggerHtml_(row, row.record, 'stat')}</td>
              <td class="is-centered" data-col="rpi" data-label="RPI">${teamLogTriggerHtml_(row, row.rpi, 'rpi')}</td>
            </tr>`;
        }).join('');

        return `
          <table class="region-rankings-table adjustable-column-table">
            ${regionColumnGroup}
            <thead>
              <tr>
                <th class="is-centered" data-col="rank">Rank</th>
                <th data-col="school">School</th>
                <th class="is-centered" data-col="record">Record</th>
                <th class="is-centered" data-col="rpi">RPI</th>
              </tr>
            </thead>
            <tbody>${items || '<tr><td colspan="4" class="muted">No teams.</td></tr>'}</tbody>
            ${oddExtraNoteHtml_(rows, 4)}
          </table>
        `;
      };

      tbody.innerHTML = `
        <tr>
          <td colspan="${MAIN_TABLE_COLSPAN_}" style="padding:0;border-bottom:none;">
            <div class="region-standings-board">
              ${playoffHeaderHtml_(classification, sportLabel, 'Region Standings')}

              <div class="region-split">
                <div class="region-panel west">
                  <div class="region-title">West Region</div>
                  <div class="region-table-wrap">
                    ${renderTable(regionData.west)}
                  </div>
                </div>

                <div class="region-panel east">
                  <div class="region-title">East Region</div>
                  <div class="region-table-wrap">
                    ${renderTable(regionData.east)}
                  </div>
                </div>
              </div>
              ${excludedTeamsNoteHtml_(regionData.excludedTeams)}
            </div>
          </td>
        </tr>`;
    }

    function renderEastWestLine_(lineData, classification, sportLabel, excludedTeams = []) {
      eastWestLineMapState_ = { lineData, classification, sportLabel, year: selectedRpiYear_(), excludedTeams };
      const extraText = lineData.isOdd
        ? `Odd field: extra team assigned to ${lineData.extraSide === 'east' ? 'East' : 'West'}`
        : 'Even field';
      const subtitle = `Top ${lineData.cap} eligible teams by RPI sorted by longitude.`;
      // Keep these column names in sync with the adjustable-column comments in playoff_board.desktop.css.
      const eastWestColumnGroup = `
        <colgroup>
          <col class="col-rank" />
          <col class="col-team" />
          <col class="col-longitude" />
          <col class="col-rpi" />
          <col class="col-record" />
          <col class="col-region" />
        </colgroup>`;
      const renderSectionHeader = (label, side, count) => `
        <tr class="east-west-line-section-row ${side}">
          <td colspan="6">
            <span class="east-west-line-section-title ${side}">${escapeHtml(label)} Region - ${escapeHtml(count)} ${count === 1 ? 'Team' : 'Teams'}</span>
          </td>
        </tr>`;
      const renderTeamRow = (row) => {
        const side = row.lineRegion === 'East' ? 'east' : 'west';
        const oddExtraClass = oddExtraClass_(row);
        const logo = imageHtmlWithFallback_('logo', row.logoUrl, `${row.school} logo`, 'logo-placeholder');
        const mascot = row.mascot ? escapeHtml(row.mascot) : 'Team';
        const rowClass = scheduleRowClass_(row, `east-west-line-row ${side} ${oddExtraClass}`);
        return `
          <tr class="${escapeHtml(rowClass)}" ${scheduleRowDataAttrs_(row)}>
            <td class="rank is-centered" data-col="rank" data-label="#"><span class="rank-number rpi-log-trigger" ${teamLogRowDataAttrs_(row)}>${escapeHtml(row.lineRank)}</span></td>
            <td data-col="team" data-label="Team">
              <div class="school">
                ${logo}
                <div class="team-meta">
                  <div class="team-name">${escapeHtml(row.school)}</div>
                  <div class="team-sub">${mascot}</div>
                </div>
              </div>
            </td>
              <td class="mobile-row-stats" data-label="Summary">
                ${teamLogTriggerHtml_(row, `<span>Record</span><strong>${escapeHtml(row.record || '-')}</strong>`, 'mobile-row-pill', { raw: true })}
                ${teamLogTriggerHtml_(row, `<span>RPI</span><strong>${escapeHtml(row.rpi || '-')}</strong>`, 'mobile-row-pill', { raw: true })}
              </td>
            <td class="is-centered" data-col="longitude" data-label="Longitude">${teamLogTriggerHtml_(row, formatLongitude_(row.longitude), 'stat')}</td>
            <td class="is-centered" data-col="rpi" data-label="RPI">${teamLogTriggerHtml_(row, row.rpi, 'rpi')}</td>
            <td class="is-centered" data-col="record" data-label="Record">${teamLogTriggerHtml_(row, row.record, 'stat')}</td>
            <td class="is-centered" data-col="region" data-label="Region">${teamLogTriggerHtml_(row, row.lineRegion, `east-west-line-region ${side}`)}</td>
          </tr>`;
      };
      const westRows = lineData.west.map(renderTeamRow).join('');
      const eastRows = lineData.east.map(renderTeamRow).join('');
      const rowHtml = lineData.total
        ? `${renderSectionHeader('West', 'west', lineData.west.length)}${westRows}${renderSectionHeader('East', 'east', lineData.east.length)}${eastRows}`
        : '';

      tbody.innerHTML = `
        <tr>
          <td colspan="${MAIN_TABLE_COLSPAN_}" style="padding:0;border-bottom:none;">
            <div class="east-west-line-board">
              ${playoffHeaderHtml_(classification, sportLabel, 'East/West Line', subtitle)}
              <div class="table-scroll">
                <table class="east-west-line-table adjustable-column-table">
                  ${eastWestColumnGroup}
                  <thead>
                    <tr>
                      <th class="is-centered" data-col="rank">#</th>
                      <th data-col="team">Team</th>
                      <th class="is-centered" data-col="longitude">Longitude</th>
                      <th class="is-centered" data-col="rpi">RPI</th>
                      <th class="is-centered" data-col="record">Record</th>
                      <th class="is-centered" data-col="region">Region</th>
                    </tr>
                  </thead>
                  <tbody>${rowHtml || '<tr><td colspan="6" class="muted">No eligible teams.</td></tr>'}</tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>`;
    }

    function renderBracketEntry_(entry) {
      if (!entry || entry.type === 'empty') return '<div class="game-box empty-box"></div>';
      if (entry.type === 'text') {
        const winnerMatch = String(entry.text || '').match(/^\s*(\d+)\s+vs\s+(\d+)\s+Winner\s*$/i);
        if (winnerMatch) {
          return `<div class="game-box text-box"><span class="winner-seed-pill">${escapeHtml(winnerMatch[1])}</span><span class="winner-vs">vs</span><span class="winner-seed-pill">${escapeHtml(winnerMatch[2])}</span><span class="winner-label">Winner</span></div>`;
        }
        return `<div class="game-box text-box ${entry.bye ? 'bye-box' : ''}">${escapeHtml(entry.text)}</div>`;
      }

      const team = entry.team || {};
      const logo = imageHtmlWithFallback_('team-logo', team.logoUrl, `${team.school} logo`, 'team-logo-placeholder');
      const oddExtraClass = oddExtraClass_(team);
      const gameBoxClass = scheduleRowClass_(team, oddExtraClass);

      return `
        <div class="game-box ${escapeHtml(gameBoxClass)}" ${scheduleRowDataAttrs_(team)}>
          <div class="team-card">
            ${teamLogTriggerHtml_(team, team.regionRank, 'team-seed')}
            ${logo}
              <div class="team-copy">
                <div class="team-copy-name">${escapeHtml(team.school)}</div>
                <div class="team-copy-stats">
                  ${teamLogTriggerHtml_(team, team.record, 'team-copy-stat-pill')}
                  ${teamLogTriggerHtml_(team, team.rpi, 'team-copy-stat-pill')}
                </div>
                <div class="team-copy-record">${escapeHtml(team.record || '')}</div>
              </div>
          </div>
        </div>`;
    }

    function renderPlayoffRegion_(side, bracketData) {
      const isWest = side === 'west';
      const headerRow = isWest
        ? `
          <div class="round-label">1st Round</div>
          <div class="connector-header"></div>
          <div class="round-label">2nd Round</div>
        `
        : `
          <div class="round-label">2nd Round</div>
          <div class="connector-header"></div>
          <div class="round-label">1st Round</div>
        `;

      const rows = bracketData.slots.map(slot => {
        const round1Class = isWest ? 'round1-west' : 'round1-east';
        const round1Cell = `<div class="game-slot round1-slot ${round1Class}"><div class="game-stack"><div class="slot-round-label">Round 1</div>${renderBracketEntry_(slot.firstRound.top)}${renderBracketEntry_(slot.firstRound.bottom)}</div></div>`;
        const round2Cell = `<div class="game-slot round2-slot"><div class="game-stack"><div class="slot-round-label">Round 2</div>${renderBracketEntry_(slot.secondRound.top)}${renderBracketEntry_(slot.secondRound.bottom)}</div></div>`;
        const connector = `<div class="connector-cell"><div class="connector-line ${side}"></div></div>`;
        return isWest ? `<div class="bracket-row">${round1Cell}${connector}${round2Cell}</div>` : `<div class="bracket-row">${round2Cell}${connector}${round1Cell}</div>`;
      }).join('');

      return `
        <div class="bracket-region ${side}">
          <div class="bracket-region-title">${side === 'west' ? 'West Region' : 'East Region'}</div>
          <div class="bracket-grid">
            ${headerRow}
            ${rows}
          </div>
          ${bracketOddExtraNoteHtml_(side, bracketData)}
        </div>
      `;
    }

    function renderPlayoffPicture(regionData, classification, sportLabel) {
      setEastWestMapStateFromRows_(regionData.west.concat(regionData.east), classification, sportLabel, regionData.excludedTeams || []);
      const westBracket = buildRegionPlayoff_(regionData.west, classification, regionData.total);
      const eastBracket = buildRegionPlayoff_(regionData.east, classification, regionData.total);

      tbody.innerHTML = `
        <tr>
          <td colspan="${MAIN_TABLE_COLSPAN_}" style="padding:0;border-bottom:none;">
            <div class="playoff-board">
              ${playoffHeaderHtml_(classification, sportLabel, 'Playoff Picture', 'Projected first two rounds if the playoffs started today')}

              <div class="playoff-regions">
                ${renderPlayoffRegion_('west', westBracket)}
                ${renderPlayoffRegion_('east', eastBracket)}
              </div>
              ${excludedTeamsNoteHtml_(regionData.excludedTeams)}
            </div>
          </td>
        </tr>`;
    }

    function getTeamDetailsMapCached_() {
      if (!teamDetailsMapPromise_) {
        teamDetailsMapPromise_ = fetchTeamDetailsMap_().then(map => {
          teamDetailsMapResolved_ = map;
          return map;
        }).catch(err => {
          teamDetailsMapPromise_ = null;
          teamDetailsMapResolved_ = null;
          throw err;
        });
      }
      return teamDetailsMapPromise_;
    }

    async function getMergedRowsForSelection_(classification, sport, teamDetailsPromise = getTeamDetailsMapCached_()) {
      const [tdMap, rpiResult] = await Promise.all([
        teamDetailsPromise,
        fetchRpiRows_(classification, sport)
      ]);
      if (rpiResult?.source === 'fallback' && rpiResult.year) ensureSeasonYearOption_(rpiResult.year);
      const mergedRows = mergeRows_(rpiResult.rows, tdMap, sport, rpiResult);
      const { rows: filteredRows, excludedTeams } = filterOptedOutTeams_(mergedRows, sportKeyFromLabel_(sport), tdMap);
      const rowsWithChanges = await addLiveRpiChangeData_(filteredRows, sport, classification, rpiResult);
      return {
        sport,
        classification,
        rows: rowsWithChanges,
        rpiResult: {
          ...rpiResult,
          excludedTeams
        }
      };
    }

    async function getMergedRowsForCurrentSelection_() {
      return getMergedRowsForSelection_(classEl.value, sportEl.value);
    }

    async function waitForImagesInNode_(node, timeoutMs = 6000) {
      const images = [...node.querySelectorAll('img')];
      if (!images.length) return;
      await Promise.all(images.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(resolve => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });
          setTimeout(finish, timeoutMs);
        });
      }));
    }

    async function fetchImageAsDataUrl_(src) {
      const attempts = [
        src,
        'https://corsproxy.io/?' + encodeURIComponent(src),
        'https://api.codetabs.com/cors-proxy/?' + src
      ];

      let lastErr = null;
      for (const attempt of attempts) {
        try {
          const res = await fetch(attempt, { mode: 'cors', cache: 'no-store' });
          if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
          const blob = await res.blob();
          if (!blob || !blob.size) throw new Error('Empty image blob');
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          if (typeof dataUrl === 'string' && dataUrl.startsWith('data:')) return dataUrl;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error('Unable to inline image');
    }

    async function buildExportClone_(board) {
      const host = document.createElement('div');
      host.className = 'export-host';

      const clone = board.cloneNode(true);
      clone.style.width = `${Math.ceil(board.scrollWidth)}px`;
      clone.style.maxWidth = 'none';
      clone.style.margin = '0';
      clone.style.transform = 'none';
      clone.style.display = 'block';

      const originalImages = [...board.querySelectorAll('img')];
      const cloneImages = [...clone.querySelectorAll('img')];

      await Promise.all(cloneImages.map(async (img, i) => {
        const original = originalImages[i];
        const src = original?.dataset?.loadedSrc || original?.currentSrc || original?.src || img.currentSrc || img.src;
        if (!src) return;

        img.src = src;
        img.srcset = '';
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');

        try {
          const dataUrl = await fetchImageAsDataUrl_(src);
          img.src = dataUrl;
        } catch (err) {
          console.warn('Image inline failed, keeping live src:', src, err);
        }
      }));

      host.appendChild(clone);
      document.body.appendChild(host);
      await waitForImagesInNode_(clone);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { host, clone };
    }

    const exportPreviewState_ = {
      items: [],
      currentToken: 0
    };

    const ALL_CLASS_OPTIONS_ = [
      'Class 1A','Class 2A','Class 3A','Class 4A',
      'Class 5A','Class 6A','Class 7A','Class 8A'
    ];
    const MAX_EXPORT_RENDER_CONCURRENCY_ = 3;
    let exportPreviewClassesTouched_ = false;
let exportPreviewSportTouched_ = false;
let teamDetailsMapPromise_ = null;
let teamDetailsMapResolved_ = null;
let eastWestLineMapState_ = null;
    let ncBoundaryPromise_ = null;
    let ncCountyBoundariesPromise_ = null;
    const EAST_WEST_MAP_MIN_SCALE_ = 1;
    const EAST_WEST_MAP_MAX_SCALE_ = 7;
    const EAST_WEST_MAP_ZOOM_STEP_ = 1.08;
    const EAST_WEST_MAP_MARKER_SIZE_ = 56;
    const EAST_WEST_MAP_LOGO_MIN_ = 0.1;
    const EAST_WEST_MAP_LOGO_MAX_ = 1.5;
    const VALHALLA_ROUTE_URL_ = 'https://valhalla1.openstreetmap.de/route';
    const OSRM_ROUTE_BASE_URLS_ = [
      'https://router.project-osrm.org/route/v1/driving/',
      'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
    ];
    const ROUTE_REQUEST_TIMEOUT_MS_ = 4500;
    const eastWestMapTransform_ = { scale: 1, x: 0, y: 0 };
    let eastWestMapViewportFrame_ = 0;
    let eastWestMapApplyFrame_ = 0;
    let eastWestMapPendingApplyOptions_ = null;
    let eastWestMapTransformingTimer_ = 0;
    const eastWestMapRowsByKey_ = new Map();
    const eastWestMapInfoCardsByKey_ = new Map();
    const eastWestMapFocusedTeams_ = new Set();
    const eastWestMapUnfocusedTeams_ = new Set();
    let eastWestMapLogoScale_ = 0.7;
    let eastWestMapLogoControlsOpen_ = false;
    let eastWestMapCleanView_ = false;
    let eastWestMapRegionRankView_ = false;
    let eastWestMapPerformanceMode_ = false;
    let eastWestMapContextTeamKey_ = '';
    let eastWestMapMeasureStartKey_ = '';
    let eastWestMapMeasureRequestId_ = 0;
    let eastWestMapInfoCardSeq_ = 0;
    let eastWestMapInfoCardZ_ = 10;
    let eastWestMapCardDrag_ = null;
    let eastWestMapPlacementCacheKey_ = '';
    let eastWestMapPlacementCache_ = null;
    let eastWestMapPlacementSolveTimer_ = null;
    let exportRenderActiveCount_ = 0;
    const exportRenderQueue_ = [];

    function classShortFromValue_(value) {
      return String(value || '').replace(/^Class\s+/i, '').trim();
    }

    function exportKindLabel_(kind) {
      return kind === 'region' ? 'Region Standings' : 'Playoff Picture';
    }

    function selectOptionsHtmlFrom_(sourceSelect, getText = option => option.textContent || option.value) {
      return [...sourceSelect.options]
        .map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(getText(option))}</option>`)
        .join('');
    }

    function populateSelectFrom_(targetSelect, sourceSelect, getText) {
      if (!targetSelect) return;
      targetSelect.innerHTML = selectOptionsHtmlFrom_(sourceSelect, getText);
      targetSelect.value = sourceSelect.value;
    }

    function populateExportPreviewSportOptions_() {
      populateSelectFrom_(exportPreviewSport, sportEl);
    }

    function populateEastWestMapSelectors_() {
      populateSelectFrom_(eastWestMapClass, classEl);
      populateSelectFrom_(eastWestMapSport, sportEl, option => option.value);
      renderEastWestMapClassPickerOptions_();
      renderEastWestMapSportPickerOptions_();
      syncEastWestMapSelectors_();
    }

    function updateEastWestMapClassPicker_() {
      syncEastWestMapClassPickerUi_();
    }

    function updateEastWestMapSportPicker_() {
      syncEastWestMapSportPickerUi_();
    }

    function syncEastWestMapSelectors_() {
      if (eastWestMapClass && eastWestMapClass.value !== classEl.value) eastWestMapClass.value = classEl.value;
      if (eastWestMapSport && eastWestMapSport.value !== sportEl.value) eastWestMapSport.value = sportEl.value;
      updateEastWestMapClassPicker_();
      updateEastWestMapSportPicker_();
    }

    async function applyEastWestMapSelectorChange_(e) {
      e?.stopPropagation?.();
      const nextClass = eastWestMapClass?.value || classEl.value;
      const nextSport = eastWestMapSport?.value || sportEl.value;
      const classChanged = classEl.value !== nextClass;
      const sportChanged = sportEl.value !== nextSport;
      if (!classChanged && !sportChanged) return;

      classEl.value = nextClass;
      sportEl.value = nextSport;
      resetSnapshotSelectionsForNewTable_();
      syncClassPickerUi_();
      syncSportPickerUi_();
      if (classChanged) syncExportPreviewClassesToCurrent_();
      if (sportChanged) {
        syncExportPreviewSportToCurrent_();
        await refreshSeasonYearOptions_({ preserveValue: selectedRpiYear_() });
      }
      syncEastWestMapSelectors_();

      const mode = currentViewMode_();
      if (eastWestMapOverlay.classList.contains('open') && (!mode || mode === 'rankings')) {
        await buildEastWestLineView_({ openMapAfter: true });
      } else {
        await reloadCurrentBoardForSelection_();
      }
    }

    function exportSportLabel_() {
      return exportPreviewSport.value || sportEl.value;
    }

    function exportFileBase_(item) {
      return `${item.classShort} ${item.sportLabel || exportSportLabel_()} ${exportKindLabel_(item.kind)}`;
    }

    function exportPreviewClassInputs_() {
      return [...exportPreviewClassList.querySelectorAll('input[type="checkbox"]')];
    }

    function selectedExportPreviewClasses_() {
      return exportPreviewClassInputs_()
        .filter(input => input.checked)
        .map(input => input.value);
    }

    function updateExportPreviewClassSummary_() {
      const selected = selectedExportPreviewClasses_();
      if (!selected.length) {
        exportPreviewClassSummary.textContent = 'No classes selected';
      } else if (selected.length === ALL_CLASS_OPTIONS_.length) {
        exportPreviewClassSummary.textContent = 'All Classes';
      } else if (selected.length === 1) {
        exportPreviewClassSummary.textContent = selected[0];
      } else {
        exportPreviewClassSummary.textContent = `${selected.length} classes selected`;
      }

      exportPreviewSelectAllClasses.checked = selected.length === ALL_CLASS_OPTIONS_.length;
      exportPreviewSelectAllClasses.indeterminate = selected.length > 0 && selected.length < ALL_CLASS_OPTIONS_.length;
    }

    function setExportPreviewClassMenuOpen_(isOpen) {
      exportPreviewClassMenu.hidden = !isOpen;
      exportPreviewClassMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    function setAllExportPreviewClasses_(checked) {
      exportPreviewClassesTouched_ = true;
      exportPreviewClassInputs_().forEach(input => { input.checked = checked; });
      updateExportPreviewClassSummary_();
    }

    function renderExportPreviewClassOptions_() {
      exportPreviewClassList.innerHTML = ALL_CLASS_OPTIONS_.map(classValue => {
        const classShort = classShortFromValue_(classValue);
        const inputId = `exportPreviewClass_${classShort.replace(/[^a-z0-9_-]/gi, '')}`;
        const checked = classValue === classEl.value ? ' checked' : '';
        return `
          <label class="export-preview-class-option" for="${escapeHtml(inputId)}">
            <input id="${escapeHtml(inputId)}" type="checkbox" value="${escapeHtml(classValue)}"${checked}>
            <span>${escapeHtml(classShort)}</span>
          </label>`;
      }).join('');

      exportPreviewClassList.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
          exportPreviewClassesTouched_ = true;
          updateExportPreviewClassSummary_();
        });
      });
      updateExportPreviewClassSummary_();
    }

    function syncExportPreviewClassesToCurrent_() {
      if (exportPreviewClassesTouched_) return;
      exportPreviewClassInputs_().forEach(input => {
        input.checked = input.value === classEl.value;
      });
      updateExportPreviewClassSummary_();
    }

    function syncExportPreviewSportToCurrent_() {
      if (exportPreviewSportTouched_) return;
      if (exportPreviewSport.value !== sportEl.value) exportPreviewSport.value = sportEl.value;
    }

    function selectedExportPreviewKinds_() {
      const typeFilter = exportPreviewTypeFilter.value;
      if (typeFilter === 'region') return ['region'];
      if (typeFilter === 'playoff') return ['playoff'];
      return ['region', 'playoff'];
    }

    renderExportPreviewClassOptions_();
    populateExportPreviewSportOptions_();
    populateEastWestMapSelectors_();

    function exportFileNameValue_(inputEl, fallbackBase) {
      const raw = String(inputEl?.value || '').trim() || fallbackBase;
      return raw.toLowerCase().endsWith('.png') ? raw : `${raw}.png`;
    }

    function downloadBlob_(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function makeExportPreviewCard_(item, label, defaultName) {
      const key = item.key;
      return `
        <div class="export-preview-card is-loading" data-export-key="${escapeHtml(key)}">
          <div class="export-preview-card-title">
            <div class="export-preview-label">${escapeHtml(label)}</div>
          </div>
          <input class="export-preview-name" type="text" aria-label="File name" value="${escapeHtml(defaultName)}" />
          <div class="export-preview-progress">
            <div class="export-preview-progress-text">Queued</div>
          </div>
          <button type="button" class="download-export-btn" disabled>Download</button>
        </div>`;
    }

    function getExportCardEls_(key) {
      const card = exportPreviewGrid.querySelector(`[data-export-key="${CSS.escape(key)}"]`);
      if (!card) return null;
      return {
        card,
        input: card.querySelector('.export-preview-name'),
        progressText: card.querySelector('.export-preview-progress-text'),
        downloadBtn: card.querySelector('.download-export-btn')
      };
    }

    function exportProgressDisplay_(text, state) {
      if (state === 'ready') return 'Ready';
      if (state === 'error') return 'Error';
      const lower = String(text || '').toLowerCase();
      if (lower.includes('render')) return 'Rendering';
      if (lower.includes('load')) return 'Loading';
      if (lower.includes('queue')) return 'Queued';
      return text || 'Queued';
    }

    function setExportCardProgress_(key, text, state = 'loading') {
      const els = getExportCardEls_(key);
      if (!els) return;
      els.card.classList.toggle('is-loading', state === 'loading');
      els.card.classList.toggle('is-ready', state === 'ready');
      els.card.classList.toggle('is-error', state === 'error');
      if (els.progressText) {
        els.progressText.textContent = exportProgressDisplay_(text, state);
        els.progressText.title = text || '';
      }
      if (els.downloadBtn) els.downloadBtn.disabled = state !== 'ready';
    }

    function clearExportPreview_() {
      exportPreviewState_.items = [];
      exportPreviewGrid.innerHTML = '';
      exportPreviewGrid.style.removeProperty('grid-template-columns');
      exportPreviewGrid.style.removeProperty('--export-card-size');
      exportPreviewStatus.textContent = '';
      exportPreviewGrid.classList.remove('all-classes');
    }

    function exportSnapshotBaseHref_() {
      if (window.location.protocol === 'file:') return 'http://localhost:8000/';
      try {
        return new URL('./', window.location.href).href;
      } catch (_) {
        return 'http://localhost:8000/';
      }
    }

    function injectExportSnapshotBase_(cloneDoc) {
      const head = cloneDoc.querySelector('head');
      if (!head) return;
      head.querySelectorAll('base').forEach(el => el.remove());
      const base = cloneDoc.ownerDocument.createElement('base');
      base.href = exportSnapshotBaseHref_();
      head.insertBefore(base, head.firstChild);
    }

    function closeExportPreview_() {
      exportPreviewOverlay.classList.remove('open');
      exportPreviewOverlay.setAttribute('aria-hidden', 'true');
    }

    function openExportPreview_() {
      syncExportPreviewClassesToCurrent_();
      syncExportPreviewSportToCurrent_();
      exportPreviewOverlay.classList.add('open');
      exportPreviewOverlay.setAttribute('aria-hidden', 'false');
      if (!exportPreviewGrid.children.length) {
        setExportPreviewStatus_('Choose classes and view type, then click Build Exports.');
      }
      scheduleExportPreviewGridFit_();
    }

    function setExportPreviewStatus_(msg) {
      exportPreviewStatus.textContent = msg || '';
    }

    function updateExportPreviewGridFit_() {
      const visibleCards = [...exportPreviewGrid.querySelectorAll('.export-preview-card')]
        .filter(card => card.style.display !== 'none');

      if (!visibleCards.length) {
        exportPreviewGrid.style.removeProperty('grid-template-columns');
        exportPreviewGrid.style.removeProperty('--export-card-size');
        return;
      }

      const styles = getComputedStyle(exportPreviewGrid);
      const gap = parseFloat(styles.columnGap || styles.gap) || 14;
      const paddingX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
      const availableWidth = Math.max(1, exportPreviewGrid.clientWidth - paddingX);
      const availableHeight = Math.max(1, exportPreviewGrid.clientHeight - paddingY);
      const count = visibleCards.length;
      const maxTileSize = 260;
      const minTileSize = Math.min(145, availableWidth);
      let bestCols = 1;
      let bestSize = minTileSize;

      for (let cols = 1; cols <= count; cols += 1) {
        const rows = Math.ceil(count / cols);
        const sizeByWidth = (availableWidth - gap * (cols - 1)) / cols;
        const sizeByHeight = (availableHeight - gap * (rows - 1)) / rows;
        const size = Math.floor(Math.min(sizeByWidth, sizeByHeight, maxTileSize));
        if (size > bestSize) {
          bestSize = size;
          bestCols = cols;
        }
      }

      bestSize = Math.max(minTileSize, bestSize);
      exportPreviewGrid.style.setProperty('--export-card-size', `${bestSize}px`);
      exportPreviewGrid.style.gridTemplateColumns = `repeat(${bestCols}, ${bestSize}px)`;
    }

    function scheduleExportPreviewGridFit_() {
      requestAnimationFrame(updateExportPreviewGridFit_);
    }

    function visibleExportItems_() {
      const typeFilter = exportPreviewTypeFilter.value;
      return exportPreviewState_.items.filter(item => {
        if (typeFilter === 'all') return true;
        return item.kind === typeFilter;
      });
    }

    function downloadExportItem_(item) {
      const els = getExportCardEls_(item.key);
      if (!els || !item.blob) return;
      const fallback = exportFileBase_(item);
      downloadBlob_(item.blob, exportFileNameValue_(els.input, fallback));
    }

    function attachCardBehavior_(item) {
      const els = getExportCardEls_(item.key);
      if (!els) return;
      els.downloadBtn.disabled = !item.blob;
      els.downloadBtn.addEventListener('click', () => downloadExportItem_(item));
    }
    function buildServerExportHtml_() {
      const cloneDoc = document.documentElement.cloneNode(true);
      injectExportSnapshotBase_(cloneDoc);

      cloneDoc.querySelectorAll('script').forEach(el => el.remove());

      const body = cloneDoc.querySelector('body');
      if (body) {
        body.className = document.body.className;
      }

      const tbodyClone = cloneDoc.querySelector('#tbody');
      if (tbodyClone) {
        tbodyClone.innerHTML = tbody.innerHTML;
      }

      const statusClone = cloneDoc.querySelector('#statusText');
      if (statusClone) statusClone.textContent = '';
      const updatedClone = cloneDoc.querySelector('#updatedText');
      if (updatedClone) updatedClone.textContent = updatedText.textContent || '';

      const themeClone = cloneDoc.querySelector('#theme');
      if (themeClone) themeClone.value = themeEl.value;
      const sportClone = cloneDoc.querySelector('#sport');
      if (sportClone) sportClone.value = sportEl.value;
      const classClone = cloneDoc.querySelector('#classification');
      if (classClone) classClone.value = classEl.value;

      const exportBtnClone = cloneDoc.querySelector('#exportBtn');
      if (exportBtnClone) exportBtnClone.remove();

      const exportPreviewClone = cloneDoc.querySelector('#exportPreviewOverlay');
      if (exportPreviewClone) exportPreviewClone.remove();

      const helperStyle = cloneDoc.ownerDocument.createElement('style');
      helperStyle.textContent = `
        body { margin: 0 !important; }
        .wrap { max-width: 90% !important; }
        #exportPreviewOverlay { display: none !important; visibility: hidden !important; opacity: 0 !important; }
        .export-hidden, .no-export { display: none !important; visibility: hidden !important; opacity: 0 !important; }
      `;
      cloneDoc.querySelector('head')?.appendChild(helperStyle);

      return '<!DOCTYPE html>\n' + cloneDoc.outerHTML;
    }

    async function requestServerPngExport_(payload) {
      const endpoints = window.location.protocol === 'file:'
        ? ['http://localhost:8000/export-image', '/export-image']
        : ['/export-image', 'http://localhost:8000/export-image'];
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            let message = 'Server export failed.';
            try {
              const text = await response.text();
              if (text) {
                try {
                  const err = JSON.parse(text);
                  if (err && err.error) message = err.error;
                  else message = text;
                } catch (e) {
                  message = text;
                }
              }
            } catch (e) {}
            throw new Error(message);
          }

          return await response.blob();
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError || new Error('Server export failed.');
    }

    function pumpExportRenderQueue_() {
      while (exportRenderActiveCount_ < MAX_EXPORT_RENDER_CONCURRENCY_ && exportRenderQueue_.length) {
        const job = exportRenderQueue_.shift();
        exportRenderActiveCount_ += 1;
        requestServerPngExport_(job.payload)
          .then(job.resolve, job.reject)
          .finally(() => {
            exportRenderActiveCount_ -= 1;
            pumpExportRenderQueue_();
          });
      }
    }

    function scheduleServerPngExport_(payload) {
      return new Promise((resolve, reject) => {
        exportRenderQueue_.push({ payload, resolve, reject });
        pumpExportRenderQueue_();
      });
    }

    function clearPendingServerPngExports_() {
      exportRenderQueue_.length = 0;
    }

    async function createCurrentRenderedExportJob_(exportSelector, exportKind, classLabelForName, sportLabelForName) {
      const target = document.querySelector(exportSelector);
      if (!target) throw new Error(`Missing export target: ${exportSelector}`);

      setStatus(`Preparing ${exportKind.replace('_', ' ')} export...`);
      target.querySelectorAll('img').forEach(img => {
        img.loading = 'eager';
        img.decoding = 'sync';
        if (img.dataset.loadedSrc) img.src = img.dataset.loadedSrc;
      });
      await waitForImagesInNode_(target, 1800);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const htmlSnapshot = buildServerExportHtml_();
      const classShort = classShortFromValue_(classLabelForName || classEl.value);
      const filename = `${classShort} ${sportLabelForName || sportEl.value} ${exportKind === 'region_rankings' ? 'Region Standings' : 'Playoff Picture'}.png`;

      setStatus(`Queued ${exportKind.replace('_', ' ')} render...`);
      return {
        filename,
        blobPromise: scheduleServerPngExport_({
          html: htmlSnapshot,
          selector: exportSelector,
          filename,
          background: '#0b1320'
        })
      };
    }


    async function exportPlayoffBoardPng_() {
      openExportPreview_();
      setExportPreviewStatus_('Choose classes and view type, then click Build Exports.');
    }

    // ============================================================================
    // 11. Export preview generation and PNG export helpers
    // ============================================================================

    // Export preview generation and PNG export helpers.
    async function buildExportPreview_() {
      const originalMode =
        document.body.classList.contains('playoff-mode') ? 'playoff' :
        document.body.classList.contains('regions-mode') ? 'regions' :
        document.body.classList.contains('east-west-mode') ? 'east-west' :
        'rankings';

      setBoardActionsDisabled_(true, [buildExportPreviewBtn]);

      const oldUpdated = updatedText.textContent;
      const originalClass = classEl.value;
      const token = exportPreviewState_.currentToken + 1;
      exportPreviewState_.currentToken = token;
      clearPendingServerPngExports_();

      try {
        clearExportPreview_();
        openExportPreview_();

        const classesToBuild = selectedExportPreviewClasses_();
        const kindsToBuild = selectedExportPreviewKinds_();

        if (!classesToBuild.length) {
          setExportPreviewStatus_('Select at least one class.');
          setStatus('Select at least one class before building exports.', true);
          return false;
        }

        exportPreviewGrid.classList.toggle('all-classes', classesToBuild.length > 1);
        const totalViews = classesToBuild.length * kindsToBuild.length;
        setExportPreviewStatus_(`Preparing ${totalViews} export${totalViews === 1 ? '' : 's'}...`);

        const sportToBuild = exportSportLabel_();
        const allItems = classesToBuild.flatMap(classValue => {
          const classShort = classShortFromValue_(classValue);
          return kindsToBuild.map(kind => ({
            key: `${classShort}::${kind}`,
            classValue,
            classShort,
            sportLabel: sportToBuild,
            kind,
            blob: null
          }));
        });

        exportPreviewState_.items.push(...allItems);
        exportPreviewGrid.insertAdjacentHTML(
          'beforeend',
          allItems.map(item => {
            const label = exportFileBase_(item);
            return makeExportPreviewCard_(item, label, label);
          }).join('')
        );

        allItems.forEach(item => {
          attachCardBehavior_(item);
          setExportCardProgress_(item.key, 'Queued', 'loading');
        });
        scheduleExportPreviewGridFit_();

        const teamDetailsPromise = getTeamDetailsMapCached_();
        const classDataPromises = new Map(classesToBuild.map(classValue => [
          classValue,
          getMergedRowsForSelection_(classValue, sportToBuild, teamDetailsPromise)
        ]));
        const renderPromises = [];

        const trackExportJob_ = (item, job) => {
          const renderPromise = job.blobPromise
            .then(blob => {
              if (token !== exportPreviewState_.currentToken) return false;
              item.blob = blob;
              setExportCardProgress_(item.key, 'Ready to download.', 'ready');
              return true;
            })
            .catch(err => {
              console.error(err);
              if (token === exportPreviewState_.currentToken) {
                setExportCardProgress_(item.key, 'Error', 'error');
              }
              return false;
            });
          renderPromises.push(renderPromise);
        };

        for (let i = 0; i < classesToBuild.length; i += 1) {
          if (token !== exportPreviewState_.currentToken) return;

          const classValue = classesToBuild[i];
          const classShort = classShortFromValue_(classValue);

          setExportPreviewStatus_(`Loading ${classShort} data (${i + 1}/${classesToBuild.length})...`);
          classEl.value = classValue;
          syncClassPickerUi_();

          allItems
            .filter(item => item.classValue === classValue)
            .forEach(item => setExportCardProgress_(item.key, 'Loading data...', 'loading'));

          const { sport, classification, rows, rpiResult } = await classDataPromises.get(classValue);
          const regionData = buildRegionRows_(rows, classification, eastWestExtraSide_(), rpiResult?.excludedTeams || []);

          const regionKey = `${classShort}::region`;
          const playoffKey = `${classShort}::playoff`;

          if (kindsToBuild.includes('region')) {
            setExportPreviewStatus_(`Rendering ${classShort} Region Standings...`);
            setViewMode_('regions');
            setMainHeaderBlank();
            renderRegionRows(regionData, classification, sport);
            armImageFallbacks_(tbody);
            setUpdatedFromRpi_(rpiResult);
            setExportCardProgress_(regionKey, 'Rendering Region Standings...', 'loading');

            const regionJob = await createCurrentRenderedExportJob_('.region-standings-board', 'region_rankings', classValue, sportToBuild);
            if (token !== exportPreviewState_.currentToken) return;
            const item = exportPreviewState_.items.find(x => x.key === regionKey);
            if (item) trackExportJob_(item, regionJob);
          }

          if (kindsToBuild.includes('playoff')) {
            setExportPreviewStatus_(`Rendering ${classShort} Playoff Picture...`);
            setViewMode_('playoff');
            setMainHeaderBlank();
            renderPlayoffPicture(regionData, classification, sport);
            armImageFallbacks_(tbody);
            setUpdatedFromRpi_(rpiResult);
            setExportCardProgress_(playoffKey, 'Rendering Playoff Picture...', 'loading');

            const playoffJob = await createCurrentRenderedExportJob_('.playoff-board', 'playoff_board', classValue, sportToBuild);
            if (token !== exportPreviewState_.currentToken) return;
            const item = exportPreviewState_.items.find(x => x.key === playoffKey);
            if (item) trackExportJob_(item, playoffJob);
          }

          setExportPreviewStatus_(`Queued ${classShort} (${i + 1}/${classesToBuild.length}).`);
        }

        classEl.value = originalClass;
        syncClassPickerUi_();

        if (originalMode === 'regions') {
          const { sport, classification, rows, rpiResult } = await getMergedRowsForCurrentSelection_();
          const regionData = buildRegionRows_(rows, classification, eastWestExtraSide_(), rpiResult?.excludedTeams || []);
          setViewMode_('regions');
          setMainHeaderBlank();
          renderRegionRows(regionData, classification, sport);
          armImageFallbacks_(tbody);
          setUpdatedFromRpi_(rpiResult, oldUpdated);
        } else if (originalMode === 'playoff') {
          const { sport, classification, rows, rpiResult } = await getMergedRowsForCurrentSelection_();
          const regionData = buildRegionRows_(rows, classification, eastWestExtraSide_(), rpiResult?.excludedTeams || []);
          setViewMode_('playoff');
          setMainHeaderBlank();
          renderPlayoffPicture(regionData, classification, sport);
          armImageFallbacks_(tbody);
          setUpdatedFromRpi_(rpiResult, oldUpdated);
        } else if (originalMode === 'east-west') {
          const { sport, classification, rows, rpiResult } = await getMergedRowsForCurrentSelection_();
        const lineData = buildEastWestLineRows_(rows, classification);
        setViewMode_('east-west');
        setMainHeaderBlank();
        renderEastWestLine_(lineData, classification, sport, rpiResult?.excludedTeams || []);
        armImageFallbacks_(tbody);
        setUpdatedFromRpi_(rpiResult, oldUpdated);
        } else {
          const { rows, rpiResult } = await getMergedRowsForCurrentSelection_();
          setViewMode_('rankings');
          restoreMainHeader();
          renderRows(rows);
          armImageFallbacks_(tbody);
          setUpdatedFromRpi_(rpiResult, oldUpdated);
        }

        setExportPreviewStatus_(`Rendering ${renderPromises.length} queued export${renderPromises.length === 1 ? '' : 's'}...`);
        const renderResults = await Promise.all(renderPromises);
        if (token !== exportPreviewState_.currentToken) return false;

        const visibleCount = visibleExportItems_().length;
        const failedCount = renderResults.filter(result => !result).length;
        setExportPreviewStatus_(failedCount
          ? `Ready with ${failedCount} failed export${failedCount === 1 ? '' : 's'}. Showing ${visibleCount}.`
          : `Ready. Showing ${visibleCount} export${visibleCount === 1 ? '' : 's'}.`);
        setStatus(failedCount ? 'Some exports failed.' : 'Exports are ready.', Boolean(failedCount));
        return true;
      } catch (err) {
        console.error(err);
        classEl.value = originalClass;
        syncClassPickerUi_();
        exportPreviewState_.items
          .filter(item => !item.blob)
          .forEach(item => setExportCardProgress_(item.key, 'Error', 'error'));
        setExportPreviewStatus_(`Error: ${err.message}`);
        setStatus(`Server PNG export failed. ${err.message}`, true);
        updatedText.textContent = oldUpdated;
        return false;
      } finally {
        setBoardActionsDisabled_(false, [buildExportPreviewBtn]);
      }
    }

    // ============================================================================
    // 12. Primary board loading and view refresh entrypoints
    // ============================================================================

    async function loadRankings() {
      setBoardActionsDisabled_(true);
      updatedText.textContent = '';
      setViewMode_('rankings');
      eastWestLineMapState_ = null;
      restoreMainHeader();
      setStatus(`Loading ${sportEl.value} ${classEl.value}...`);
      setBoardLoading_(true, 'Loading RPI standings...', `${sportEl.value} ${classEl.value}`);
      await nextPaint_();

      try {
        const { rows, rpiResult } = await getMergedRowsForCurrentSelection_();
        setBoardLoading_(true, 'Rendering RPI standings...', `${rows.length} teams loaded`);
        await nextPaint_();
        renderRows(rows);
        armImageFallbacks_(tbody);
        setUpdatedFromRpi_(rpiResult);
        await idleFrame_();
        setStatus(`Loaded ${rows.length} teams.`);
      } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="${MAIN_TABLE_COLSPAN_}" class="muted">Unable to load data.</td></tr>`;
        setStatus(`${err.message}. If this is a browser CORS block, you'll need a tiny proxy/API layer.`, true);
      } finally {
        setBoardLoading_(false);
        setBoardActionsDisabled_(false);
      }
    }

    
  

