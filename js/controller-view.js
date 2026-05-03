import { createEditor } from './editor.js';
import { createSync } from './sync.js';
import { createSignalingClient } from './signaling-client.js';
import { createScroller } from './scroller.js';
import { generateQrDataUrl } from './qr.js';
import { wordCount, readTimeSeconds } from './estimator.js';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:8787';

const els = {
  newScript: document.getElementById('new-script'),
  scriptList: document.getElementById('script-list'),
  exportAll: document.getElementById('export-all'),
  importFile: document.getElementById('import-file'),
  scriptName: document.getElementById('script-name'),
  scriptContent: document.getElementById('script-content'),
  duplicateScript: document.getElementById('duplicate-script'),
  deleteScript: document.getElementById('delete-script'),
  preview: document.getElementById('preview'),
  qrImage: document.getElementById('qr-image'),
  pairCode: document.getElementById('pair-code'),
  pairStatus: document.getElementById('pair-status'),
  speed: document.getElementById('speed'),
  speedVal: document.getElementById('speed-val'),
  fontSize: document.getElementById('font-size'),
  fontVal: document.getElementById('font-val'),
  mirror: document.getElementById('mirror'),
  readtime: document.getElementById('readtime'),
  restart: document.getElementById('restart'),
  playPause: document.getElementById('play-pause'),
  scrub: document.getElementById('scrub'),
  timeElapsed: document.getElementById('time-elapsed'),
  timeTotal: document.getElementById('time-total'),
};

const editor = createEditor();
const signaling = createSignalingClient(SIGNALING_URL);
const sync = createSync({ signaling });
const previewScroller = createScroller();
previewScroller.mount(els.preview);

let activeId = null;
let state = makeState();

function makeState() {
  const s = editor.getSettings();
  return {
    script: '',
    position: 0,
    speed: 1.0,
    isPlaying: false,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    marginPercent: s.marginPercent,
    mirror: s.mirror,
    theme: s.theme,
    countdown: null,
  };
}

function pushState() {
  previewScroller.setState(state);
  sync.sendState(state);
  updateTimes();
}

function updateTimes() {
  const words = wordCount(state.script);
  const total = readTimeSeconds(words, state.speed);
  const elapsed = Math.round(total * state.position);
  els.timeElapsed.textContent = fmt(elapsed);
  els.timeTotal.textContent = fmt(total);
  els.readtime.textContent = `${words} words, ~${fmt(total)} at ${state.speed.toFixed(1)}x`;
}

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function renderScriptList() {
  const list = editor.list();
  els.scriptList.innerHTML = '';
  for (const item of list) {
    const div = document.createElement('div');
    div.className = 'script-list-item' + (item.id === activeId ? ' active' : '');
    div.textContent = item.name || '(untitled)';
    div.addEventListener('click', () => loadScript(item.id));
    els.scriptList.appendChild(div);
  }
}

function loadScript(id) {
  const s = editor.get(id);
  if (!s) return;
  activeId = id;
  els.scriptName.value = s.name;
  els.scriptContent.value = s.content;
  state.script = s.content;
  state.position = 0;
  els.scrub.value = 0;
  pushState();
  renderScriptList();
}

function persistActive() {
  if (!activeId) return;
  editor.update(activeId, {
    name: els.scriptName.value,
    content: els.scriptContent.value,
  });
}

els.newScript.addEventListener('click', () => {
  const created = editor.create('Untitled', '');
  activeId = created.id;
  loadScript(created.id);
});

els.scriptName.addEventListener('input', persistActive);
els.scriptContent.addEventListener('input', () => {
  state.script = els.scriptContent.value;
  state.position = 0;
  els.scrub.value = 0;
  pushState();
  persistActive();
});

els.duplicateScript.addEventListener('click', () => {
  if (!activeId) return;
  const dupe = editor.duplicate(activeId);
  loadScript(dupe.id);
});

els.deleteScript.addEventListener('click', () => {
  if (!activeId) return;
  if (!confirm('Delete this script?')) return;
  editor.delete(activeId);
  activeId = null;
  els.scriptName.value = '';
  els.scriptContent.value = '';
  state.script = '';
  pushState();
  renderScriptList();
});

els.exportAll.addEventListener('click', () => {
  const blob = new Blob([editor.exportAll()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teleprompter-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    editor.importAll(text);
    activeId = null;
    els.scriptName.value = '';
    els.scriptContent.value = '';
    state = makeState();
    pushState();
    renderScriptList();
    alert('Import successful.');
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
});

els.speed.addEventListener('input', () => {
  state.speed = parseFloat(els.speed.value);
  els.speedVal.textContent = `${state.speed.toFixed(1)}x`;
  pushState();
});

els.fontSize.addEventListener('input', () => {
  state.fontSize = parseInt(els.fontSize.value, 10);
  els.fontVal.textContent = `${state.fontSize}px`;
  editor.setSettings({ fontSize: state.fontSize });
  pushState();
});

els.mirror.addEventListener('change', () => {
  state.mirror = els.mirror.checked;
  editor.setSettings({ mirror: state.mirror });
  pushState();
});

els.restart.addEventListener('click', () => {
  state.position = 0;
  els.scrub.value = 0;
  pushState();
});

els.playPause.addEventListener('click', () => {
  if (!state.isPlaying && state.position >= 0.999) {
    state.position = 0;
    els.scrub.value = 0;
  }
  state.isPlaying = !state.isPlaying;
  els.playPause.textContent = state.isPlaying ? 'Pause' : 'Play';
  pushState();
});

els.scrub.addEventListener('input', () => {
  state.position = parseInt(els.scrub.value, 10) / 1000;
  pushState();
});

setInterval(() => {
  if (!state.isPlaying) return;
  els.scrub.value = Math.round(state.position * 1000);
  updateTimes();
}, 200);

async function startPairing() {
  const code = randomCode();
  els.pairCode.textContent = code;
  const url = `${location.origin}/display.html?code=${code}`;
  els.qrImage.src = await generateQrDataUrl(url);
  els.pairStatus.textContent = 'Waiting for display...';
  try {
    await sync.connect(code, 'controller');
    els.pairStatus.textContent = 'Connected.';
  } catch (err) {
    els.pairStatus.textContent = `Pairing failed: ${err.message}`;
  }
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

renderScriptList();
els.fontSize.value = state.fontSize;
els.fontVal.textContent = `${state.fontSize}px`;
els.mirror.checked = state.mirror;
pushState();
startPairing();
