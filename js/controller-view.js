import { createEditor } from './editor.js';
import { createSync } from './sync.js';
import { createSignalingClient } from './signaling-client.js';
import { createScroller } from './scroller.js';
import { generateQrDataUrl } from './qr.js';
import { wordCount, readTimeSeconds } from './estimator.js';
import { createCloudStorage } from './cloud-storage.js';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:8787';
const NUDGE_SECONDS = 2;
const ACTIVE_USER_KEY = 'teleprompter:v1:active-user';
const ALLOWED_USERS = ['manoj', 'krishna'];

const cloudStorage = createCloudStorage(SIGNALING_URL);
const signaling = createSignalingClient(SIGNALING_URL);

const loginScreen = document.getElementById('login-screen');
const loginStatus = document.getElementById('login-status');
const controllerShell = document.getElementById('controller-shell');

document.querySelectorAll('.login-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const user = btn.dataset.user;
    if (!ALLOWED_USERS.includes(user)) return;
    localStorage.setItem(ACTIVE_USER_KEY, user);
    bootControllerFor(user);
  });
});

const savedUser = localStorage.getItem(ACTIVE_USER_KEY);
const initialUser = (savedUser && ALLOWED_USERS.includes(savedUser)) ? savedUser : 'manoj';
if (!savedUser) localStorage.setItem(ACTIVE_USER_KEY, initialUser);
loginScreen.style.display = 'none';
controllerShell.style.display = 'none';
bootControllerFor(initialUser);

let cloudErrorCallback = null;

async function bootControllerFor(user) {
  loginStatus.textContent = 'Loading your scripts...';

  const editor = createEditor({
    user,
    cloudStorage,
    onCloudError: (err) => {
      console.warn('Cloud sync error:', err);
      if (cloudErrorCallback) cloudErrorCallback(err);
    },
  });

  try {
    await editor.hydrateFromCloud();
  } catch (err) {
    console.warn('Cloud hydrate failed; using local copy.', err);
  }

  loginScreen.style.display = 'none';
  controllerShell.style.display = '';

  initController(user, editor);
}

function initController(user, editor) {
  const els = {
    currentUser: document.getElementById('current-user'),
    switchUser: document.getElementById('switch-user'),
    newScript: document.getElementById('new-script'),
    scriptList: document.getElementById('script-list'),
    exportAll: document.getElementById('export-all'),
    importFile: document.getElementById('import-file'),
    scriptName: document.getElementById('script-name'),
    scriptContent: document.getElementById('script-content'),
    saveNow: document.getElementById('save-now'),
    saveIndicator: document.getElementById('save-indicator'),
    addBookmark: document.getElementById('add-bookmark'),
    bookmarkList: document.getElementById('bookmark-list'),
    duplicateScript: document.getElementById('duplicate-script'),
    deleteScript: document.getElementById('delete-script'),
    preview: document.getElementById('preview'),
    previewFrame: document.getElementById('preview-frame'),
    previewFullscreen: document.getElementById('preview-fullscreen'),
    previewRestart: document.getElementById('preview-restart'),
    previewPlayPause: document.getElementById('preview-play-pause'),
    previewTime: document.getElementById('preview-time'),
    qrImage: document.getElementById('qr-image'),
    pairCode: document.getElementById('pair-code'),
    pairStatus: document.getElementById('pair-status'),
    newPairCode: document.getElementById('new-pair-code'),
    speed: document.getElementById('speed'),
    speedVal: document.getElementById('speed-val'),
    fontSize: document.getElementById('font-size'),
    fontVal: document.getElementById('font-val'),
    lineHeight: document.getElementById('line-height'),
    lineVal: document.getElementById('line-val'),
    margin: document.getElementById('margin'),
    marginVal: document.getElementById('margin-val'),
    theme: document.getElementById('theme'),
    dim: document.getElementById('dim'),
    dimVal: document.getElementById('dim-val'),
    countdownSec: document.getElementById('countdown-sec'),
    mirror: document.getElementById('mirror'),
    readtime: document.getElementById('readtime'),
    restart: document.getElementById('restart'),
    playPause: document.getElementById('play-pause'),
    scrub: document.getElementById('scrub'),
    timeElapsed: document.getElementById('time-elapsed'),
    timeTotal: document.getElementById('time-total'),
  };

  els.currentUser.textContent = user.charAt(0).toUpperCase() + user.slice(1);

  let saveTimer = null;
  function flashSaving() {
    els.saveIndicator.textContent = 'Saving...';
    els.saveIndicator.className = 'save-indicator saving';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      els.saveIndicator.textContent = 'Saved';
      els.saveIndicator.className = 'save-indicator saved';
    }, 700);
  }
  function flashError(msg) {
    if (saveTimer) clearTimeout(saveTimer);
    els.saveIndicator.textContent = msg || 'Save failed';
    els.saveIndicator.className = 'save-indicator error';
  }
  els.saveIndicator.textContent = 'Saved';
  els.saveIndicator.className = 'save-indicator saved';
  cloudErrorCallback = (err) => flashError('Sync failed');

  const sync = createSync({ signaling });
  const previewScroller = createScroller({ mode: 'preview' });
  previewScroller.mount(els.preview);

  function isPreviewFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    return fsEl === els.previewFrame;
  }

  els.previewFullscreen.addEventListener('click', () => {
    if (isPreviewFullscreen()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else if (els.previewFrame.requestFullscreen) {
      els.previewFrame.requestFullscreen();
    } else if (els.previewFrame.webkitRequestFullscreen) {
      els.previewFrame.webkitRequestFullscreen();
    }
    els.previewFullscreen.blur();
  });

  document.addEventListener('fullscreenchange', () => {
    els.previewFullscreen.textContent = isPreviewFullscreen() ? 'Exit fullscreen' : 'Fullscreen';
  });
  document.addEventListener('webkitfullscreenchange', () => {
    els.previewFullscreen.textContent = isPreviewFullscreen() ? 'Exit fullscreen' : 'Fullscreen';
  });

  els.switchUser.addEventListener('click', () => {
    const nextUser = user === 'manoj' ? 'krishna' : 'manoj';
    const nextLabel = nextUser.charAt(0).toUpperCase() + nextUser.slice(1);
    if (!confirm(`Switch to ${nextLabel}? Current session will end.`)) return;
    try { sync.disconnect(); } catch {}
    localStorage.setItem(ACTIVE_USER_KEY, nextUser);
    location.reload();
  });

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
      dim: typeof s.dim === 'number' ? s.dim : 0.1,
      countdown: null,
    };
  }

  function pushState() {
    previewScroller.setState(state);
    sync.sendState(state);
    updateTimes();
    syncPreviewTransport();
  }

  function updateTimes() {
    const words = wordCount(state.script);
    const total = readTimeSeconds(words, state.speed);
    const elapsed = Math.round(total * state.position);
    els.timeElapsed.textContent = fmt(elapsed);
    els.timeTotal.textContent = fmt(total);
    els.readtime.textContent = `${words} words, ~${fmt(total)} at ${state.speed.toFixed(1)}x`;
    els.previewTime.textContent = `${fmt(elapsed)} / ${fmt(total)}`;
  }

  function syncPreviewTransport() {
    els.previewPlayPause.textContent = els.playPause.textContent;
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

  function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function jumpToCharIndex(charIndex) {
    previewScroller.setScrollToCharIndex(charIndex);
    els.scrub.value = Math.round(state.position * 1000);
    pushState();
  }

  function renderBookmarks() {
    els.bookmarkList.innerHTML = '';

    const startChip = document.createElement('div');
    startChip.className = 'bookmark-chip';
    startChip.style.borderColor = 'var(--accent)';
    startChip.title = 'Jump to start of script';
    const startLabel = document.createElement('span');
    startLabel.textContent = 'Start';
    const startIcon = document.createElement('span');
    startIcon.className = 'bm-time';
    startIcon.textContent = '0:00';
    startChip.appendChild(startLabel);
    startChip.appendChild(startIcon);
    startChip.addEventListener('click', () => {
      jumpToCharIndex(0);
    });
    els.bookmarkList.appendChild(startChip);

    if (!activeId) {
      els.addBookmark.disabled = true;
      return;
    }
    els.addBookmark.disabled = false;

    const script = editor.get(activeId);
    const bookmarks = (script?.bookmarks || []).slice().sort((a, b) => (a.charIndex || 0) - (b.charIndex || 0));
    const words = wordCount(state.script);
    const totalSeconds = readTimeSeconds(words, state.speed);

    for (const bm of bookmarks) {
      const chip = document.createElement('div');
      chip.className = 'bookmark-chip';
      const timeAt = Math.round(totalSeconds * (bm.position || 0));

      const label = document.createElement('span');
      label.textContent = bm.label;

      const time = document.createElement('span');
      time.className = 'bm-time';
      time.textContent = fmtTime(timeAt);

      const xBtn = document.createElement('button');
      xBtn.className = 'bm-x';
      xBtn.textContent = '×';
      xBtn.title = 'Delete bookmark';
      xBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editor.deleteBookmark(activeId, bm.id);
        renderBookmarks();
        flashSaving();
      });

      chip.title = 'Click to jump to first letter of this line. Right-click to rename.';
      chip.appendChild(label);
      chip.appendChild(time);
      chip.appendChild(xBtn);
      chip.addEventListener('click', () => {
        if (typeof bm.charIndex === 'number') {
          jumpToCharIndex(bm.charIndex);
        } else {
          state.position = bm.position;
          els.scrub.value = Math.round(bm.position * 1000);
          pushState();
        }
      });
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const newLabel = prompt('Rename bookmark:', bm.label);
        if (newLabel && newLabel.trim()) {
          editor.renameBookmark(activeId, bm.id, newLabel.trim());
          renderBookmarks();
          flashSaving();
        }
      });

      els.bookmarkList.appendChild(chip);
    }
  }

  els.addBookmark.addEventListener('click', () => {
    if (!activeId) return;
    const script = editor.get(activeId);
    const count = (script?.bookmarks || []).length;
    const charIndex = previewScroller.getCurrentCharIndex();
    const snippet = previewScroller.getLineSnippet(charIndex, 30);
    const defaultLabel = snippet || `Mark ${count + 1}`;
    const label = (prompt('Label for this mark:', defaultLabel) || defaultLabel).trim();
    const bm = editor.addBookmark(activeId, state.position, label);
    if (bm) {
      editor.update(activeId, {
        bookmarks: (editor.get(activeId).bookmarks || []).map((b) =>
          b.id === bm.id ? { ...b, charIndex } : b
        ),
      });
    }
    renderBookmarks();
    flashSaving();
  });

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
    renderBookmarks();
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

  els.scriptName.addEventListener('input', () => {
    persistActive();
    flashSaving();
    renderScriptList();
  });
  els.scriptContent.addEventListener('input', () => {
    state.script = els.scriptContent.value;
    state.position = 0;
    els.scrub.value = 0;
    pushState();
    persistActive();
    flashSaving();
  });

  els.saveNow.addEventListener('click', () => {
    persistActive();
    flashSaving();
    renderScriptList();
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
    a.download = `teleprompter-${user}-${new Date().toISOString().slice(0,10)}.json`;
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

  els.lineHeight.addEventListener('input', () => {
    state.lineHeight = parseFloat(els.lineHeight.value);
    els.lineVal.textContent = state.lineHeight.toFixed(1);
    editor.setSettings({ lineHeight: state.lineHeight });
    pushState();
  });

  els.margin.addEventListener('input', () => {
    state.marginPercent = parseInt(els.margin.value, 10);
    els.marginVal.textContent = `${state.marginPercent}%`;
    editor.setSettings({ marginPercent: state.marginPercent });
    pushState();
  });

  els.theme.addEventListener('change', () => {
    state.theme = els.theme.value;
    editor.setSettings({ theme: state.theme });
    pushState();
  });

  function dimLabel(v) {
    if (v < 0.2) return 'Bright';
    if (v < 0.5) return 'Medium';
    if (v < 0.8) return 'Dim';
    return 'Cinema';
  }
  els.dim.addEventListener('input', () => {
    state.dim = parseFloat(els.dim.value);
    els.dimVal.textContent = dimLabel(state.dim);
    editor.setSettings({ dim: state.dim });
    pushState();
  });

  let countdownSeconds = parseInt(els.countdownSec.value, 10);
  els.countdownSec.addEventListener('change', () => {
    countdownSeconds = parseInt(els.countdownSec.value, 10);
  });

  els.mirror.addEventListener('change', () => {
    state.mirror = els.mirror.checked;
    editor.setSettings({ mirror: state.mirror });
    pushState();
  });

  function restart() {
    state.position = 0;
    els.scrub.value = 0;
    pushState();
  }
  els.restart.addEventListener('click', restart);
  els.previewRestart.addEventListener('click', restart);

  function togglePlayPause() {
    if (state.isPlaying) {
      state.isPlaying = false;
      state.countdown = null;
      els.playPause.textContent = 'Play';
      pushState();
      return;
    }

    const isFreshStart = state.position < 0.001 || state.position >= 0.999;
    if (state.position >= 0.999) {
      state.position = 0;
      els.scrub.value = 0;
    }

    if (isFreshStart && countdownSeconds > 0) {
      runCountdownThenPlay(countdownSeconds);
    } else {
      state.isPlaying = true;
      state.countdown = null;
      els.playPause.textContent = 'Pause';
      pushState();
    }
  }

  function runCountdownThenPlay(seconds) {
    let remaining = seconds;
    state.isPlaying = false;
    state.countdown = remaining;
    els.playPause.textContent = 'Pause';
    pushState();

    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        state.countdown = null;
        state.isPlaying = true;
        pushState();
      } else {
        state.countdown = remaining;
        pushState();
        setTimeout(tick, 1000);
      }
    };
    setTimeout(tick, 1000);
  }

  els.playPause.addEventListener('click', togglePlayPause);
  els.previewPlayPause.addEventListener('click', togglePlayPause);

  els.scrub.addEventListener('input', () => {
    state.position = parseInt(els.scrub.value, 10) / 1000;
    pushState();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'r' || e.key === 'R') {
      state.position = 0;
      els.scrub.value = 0;
      pushState();
    } else if (e.key === 'f' || e.key === 'F') {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen();
        }
      } catch {}
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      if (e.shiftKey) {
        state.speed = Math.max(0.3, Math.min(3, Math.round((state.speed + dir * 0.1) * 10) / 10));
        els.speed.value = state.speed;
        els.speedVal.textContent = `${state.speed.toFixed(1)}x`;
      } else {
        const words = wordCount(state.script);
        const total = readTimeSeconds(words, state.speed);
        const delta = total > 0 ? (NUDGE_SECONDS / total) * dir : 0;
        state.position = Math.max(0, Math.min(1, state.position + delta));
        els.scrub.value = Math.round(state.position * 1000);
      }
      pushState();
    }
  });

  setInterval(() => {
    if (!state.isPlaying) return;
    els.scrub.value = Math.round(state.position * 1000);
    updateTimes();
  }, 250);

  const PAIR_CODE_KEY = `teleprompter:v1:paircode:${user}`;

  function getOrCreatePairCode() {
    let code = localStorage.getItem(PAIR_CODE_KEY);
    if (!code) {
      code = randomCode();
      localStorage.setItem(PAIR_CODE_KEY, code);
    }
    return code;
  }

  async function startPairing(code) {
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

  els.newPairCode.addEventListener('click', () => {
    const code = randomCode();
    localStorage.setItem(PAIR_CODE_KEY, code);
    try { sync.disconnect(); } catch {}
    startPairing(code);
  });

  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  renderScriptList();
  renderBookmarks();
  els.fontSize.value = state.fontSize;
  els.fontVal.textContent = `${state.fontSize}px`;
  els.lineHeight.value = state.lineHeight;
  els.lineVal.textContent = state.lineHeight.toFixed(1);
  els.margin.value = state.marginPercent;
  els.marginVal.textContent = `${state.marginPercent}%`;
  els.theme.value = state.theme;
  els.dim.value = state.dim;
  els.dimVal.textContent = dimLabel(state.dim);
  els.mirror.checked = state.mirror;
  pushState();
  startPairing(getOrCreatePairCode());
}
