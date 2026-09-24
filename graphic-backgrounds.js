import { backgroundSports, validateBackground } from './supabase/functions/_shared/graphic-backgrounds.js';

const localLab = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const apiBase = localLab ? location.origin : String(window.RPI_APP_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
const asset = name => new URL(name, import.meta.url).href;
const court = sport => ['boys', 'girls', 'volleyball'].includes(sport);
const defaults = sport => ({ brightness: 100, saturation: 100, shadow: court(sport) ? 52 : 74, imageUrl: '' });
let saved = {};
let loadError = '';
async function request(path, options = {}) {
  const response = await fetch(apiBase + '/graphic-backgrounds' + path, { ...options, signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function apply(board, settings) {
  if (!settings) { delete board.dataset.customBackground; return; }
  const sport = board.dataset.backgroundSport;
  board.dataset.customBackground = 'true';
  const image = settings.imageUrl || asset(court(sport) ? 'sports-court.png' : 'sports-turf.png');
  board.style.setProperty('--bg-image', `url(${JSON.stringify(image)})`);
  board.style.setProperty('--bg-shadow', settings.shadow / 100);
  board.style.setProperty('--bg-center', Math.min(.95, settings.shadow / 100 + .12));
  board.style.setProperty('--bg-brightness', settings.brightness / 100);
  board.style.setProperty('--bg-saturation', settings.saturation / 100);
  board.style.setProperty('--bg-size', settings.imageUrl || court(sport) ? 'cover' : '600px 600px');
  board.style.setProperty('--bg-repeat', settings.imageUrl || court(sport) ? 'no-repeat' : 'repeat');
}
function applyAll() { document.querySelectorAll('.sports-graphic[data-background-sport]').forEach(board => apply(board, saved[board.dataset.backgroundSport])); }
const ready = request('').then(data => {
  const storageBase = new URL(apiBase).origin + (localLab ? '/data/graphic-backgrounds/' : '/storage/v1/object/public/graphic-backgrounds/');
  for (const [sport, value] of Object.entries(data.settings || {})) saved[sport] = validateBackground(sport, value, storageBase);
  applyAll();
}).catch(() => { loadError = 'Background service unavailable. Defaults remain active; publishing requires the backend update.'; });
new MutationObserver(applyAll).observe(document.getElementById('tbody') || document.body, { childList: true, subtree: true });

const dialog = document.createElement('dialog');
dialog.className = 'background-editor';
dialog.innerHTML = `<header><h2>Sport Backgrounds</h2><button type="button" data-close aria-label="Close">&#215;</button></header>
<div class="bg-controls"><label>Sport<select data-sport></select></label>
${['brightness','saturation','shadow'].map(name => `<label>${name[0].toUpperCase()+name.slice(1)} <output data-value="${name}"></output><input type="range" data-setting="${name}" min="${name==='brightness'?50:0}" max="${name==='shadow'?90:name==='brightness'?180:160}"></label>`).join('')}
<label>Upload background<input data-upload type="file" accept="image/png,image/jpeg,image/webp"></label></div>
<div class="bg-preview"><iframe title="Background preview"></iframe></div>
<footer><button data-reset type="button">Reset This Sport</button><span role="status" aria-live="polite"></span><button data-save type="button">Save Changes</button></footer>`;
document.body.append(dialog);
const select = dialog.querySelector('[data-sport]');
for (const [key, label] of Object.entries(backgroundSports)) select.add(new Option(label, key));
const status = dialog.querySelector('[role=status]');
const iframe = dialog.querySelector('iframe');
let drafts = {}, files = {}, urls = [], context = null, busy = false;
function preview() {
  const sport = select.value;
  const value = drafts[sport] === null ? defaults(sport) : drafts[sport] || saved[sport] || defaults(sport);
  dialog.querySelectorAll('[data-setting]').forEach(input => {
    input.value = value[input.dataset.setting];
    dialog.querySelector(`[data-value="${input.dataset.setting}"]`).textContent = input.value + '%';
  });
  const board = iframe.contentDocument?.querySelector('.sports-graphic');
  if (board) {
    board.dataset.backgroundSport = sport;
    board.dataset.surface = court(sport) ? 'court' : 'turf';
    apply(board, Object.hasOwn(drafts, sport) ? drafts[sport] : saved[sport]);
  }
  iframe.style.transform = `scale(${dialog.querySelector('.bg-preview').clientWidth / 1600})`;
}
new ResizeObserver(preview).observe(dialog.querySelector('.bg-preview'));
iframe.addEventListener('load', preview);
select.addEventListener('change', () => { dialog.querySelector('[data-upload]').value = ''; status.textContent = ''; preview(); });
dialog.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('input', () => {
  const sport = select.value;
  drafts[sport] = { ...(Object.hasOwn(drafts, sport) ? drafts[sport] : saved[sport]) || defaults(sport), [input.dataset.setting]: Number(input.value) };
  status.textContent = 'Unsaved preview'; preview();
}));
dialog.querySelector('[data-upload]').addEventListener('change', async event => {
  const file = event.target.files[0], sport = select.value;
  if (!file) return;
  try {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5242880) throw new Error('Choose PNG, JPEG, or WebP up to 5 MB.');
    const bitmap = await createImageBitmap(file);
    const tooLarge = bitmap.width * bitmap.height > 40000000;
    bitmap.close();
    if (tooLarge) throw new Error('Use an image under 40 megapixels.');
    const imageUrl = URL.createObjectURL(file); urls.push(imageUrl); files[sport] = file;
    drafts[sport] = { ...(Object.hasOwn(drafts, sport) ? drafts[sport] : saved[sport]) || defaults(sport), imageUrl };
    status.textContent = 'Upload ready; save to publish.'; preview();
  } catch (error) { status.textContent = error.message; }
});
dialog.querySelector('[data-reset]').addEventListener('click', () => {
  drafts[select.value] = null; delete files[select.value]; dialog.querySelector('[data-upload]').value = '';
  status.textContent = 'Default restored in preview. Save to publish this reset.'; preview();
});
dialog.querySelector('[data-save]').addEventListener('click', async () => {
  if (busy || !context) return;
  const sport = select.value;
  if (!Object.hasOwn(drafts, sport)) { status.textContent = 'No changes for this sport.'; return; }
  busy = true;
  dialog.querySelectorAll('button,input,select').forEach(node => node.disabled = true);
  try {
    await ready;
    let settings = drafts[sport] && { ...drafts[sport] };
    const headers = { 'x-rpi-admin-secret': context.secret };
    if (settings && files[sport]) {
      status.textContent = 'Uploading background...';
      const result = await request('/upload?sport=' + sport, { method: 'POST', headers: { ...headers, 'Content-Type': files[sport].type }, body: files[sport] });
      settings.imageUrl = result.imageUrl;
    }
    status.textContent = 'Saving...';
    const result = await request('?sport=' + sport, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
    saved[sport] = result.settings; delete drafts[sport]; delete files[sport]; applyAll(); preview();
    status.textContent = `${backgroundSports[sport]} saved.${localLab ? ' Local lab only.' : ''}`;
  } catch (error) { status.textContent = `Not saved: ${error.message}`; }
  finally { busy = false; dialog.querySelectorAll('button,input,select').forEach(node => node.disabled = false); }
});
function close() { if (!busy) dialog.close(); }
dialog.querySelector('[data-close]').addEventListener('click', close);
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
dialog.addEventListener('close', () => { urls.forEach(URL.revokeObjectURL); urls = []; drafts = {}; files = {}; context = null; iframe.srcdoc = ''; });
window.GraphicBackgrounds = {
  ready, applyAll, close,
  async open(options) {
    await ready;
    if (!options.secret) return;
    context = options; select.value = Object.hasOwn(backgroundSports, options.sport) ? options.sport : 'football';
    iframe.srcdoc = options.html;
    status.textContent = loadError || ''; dialog.showModal(); preview();
  }
};
