import { createScroller } from './scroller.js';
import { createSync } from './sync.js';
import { createSignalingClient } from './signaling-client.js';
import { createScanner, parseRoomCodeFromText } from './qr.js';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:8787';

const els = {
  pairScreen: document.getElementById('pair-screen'),
  readingScreen: document.getElementById('reading-screen'),
  qrVideo: document.getElementById('qr-video'),
  startScan: document.getElementById('start-scan'),
  codeInput: document.getElementById('code-input'),
  joinByCode: document.getElementById('join-by-code'),
  pairStatus: document.getElementById('pair-status'),
  overlay: document.getElementById('overlay'),
  connLabel: document.getElementById('conn-label'),
  disconnect: document.getElementById('disconnect'),
};

const signaling = createSignalingClient(SIGNALING_URL);
const sync = createSync({ signaling });
const scroller = createScroller();
let scanner = null;
let wakeLock = null;

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (err) {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch {}
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLock && !els.readingScreen.classList.contains('hidden')) {
    acquireWakeLock();
  }
});

async function connect(code) {
  els.pairStatus.textContent = 'Connecting...';
  try {
    await sync.connect(code, 'display');
    enterReading();
  } catch (err) {
    els.pairStatus.textContent = `Could not connect (${err.message}). Try again.`;
  }
}

function enterFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      const p = el.requestFullscreen({ navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  } catch {}
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function fullscreenSupported() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

async function exitFullscreen() {
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {}
}

function showIosHintIfNeeded() {
  const hint = document.getElementById('ios-hint');
  if (!hint) return;
  const ua = navigator.userAgent;
  const isIPhone = /iPhone|iPod/.test(ua) && !window.MSStream;
  if (isIPhone && !fullscreenSupported() && !isStandalone()) {
    hint.classList.remove('hidden');
  }
}
showIosHintIfNeeded();

function enterReading() {
  hide(els.pairScreen);
  show(els.readingScreen);
  scroller.mount(els.readingScreen);
  if (scanner) {
    scanner.stop();
    scanner.destroy();
    scanner = null;
  }
  acquireWakeLock();
  enterFullscreen();
  els.readingScreen.classList.add('needs-fullscreen-tap');
}

sync.onState((state) => scroller.setState(state));
sync.onStatusChange((s) => {
  els.connLabel.textContent = s === 'connected' ? 'Connected' : s;
});

els.startScan.addEventListener('click', async () => {
  if (scanner) return;
  enterFullscreen();
  try {
    scanner = await createScanner(els.qrVideo, (code) => connect(code));
    await scanner.start();
    els.pairStatus.textContent = 'Point camera at the QR on your computer.';
  } catch (err) {
    const reason = err && err.name ? err.name : (err && err.message) || 'unknown error';
    els.pairStatus.textContent = `Camera not available (${reason}). Use the code input instead.`;
  }
});

els.joinByCode.addEventListener('click', () => {
  const raw = els.codeInput.value;
  const code = parseRoomCodeFromText(raw);
  if (!code) {
    els.pairStatus.textContent = 'Enter a 6-character code.';
    return;
  }
  enterFullscreen();
  connect(code);
});

els.readingScreen.addEventListener('click', () => {
  enterFullscreen();
  els.readingScreen.classList.remove('needs-fullscreen-tap');
  els.overlay.classList.toggle('hidden');
  if (!els.overlay.classList.contains('hidden')) {
    setTimeout(() => els.overlay.classList.add('hidden'), 3000);
  }
});

els.disconnect.addEventListener('click', () => {
  sync.disconnect();
  scroller.unmount();
  releaseWakeLock();
  exitFullscreen();
  hide(els.readingScreen);
  show(els.pairScreen);
  els.pairStatus.textContent = '';
});

const params = new URLSearchParams(location.search);
const urlCode = params.get('code') ? params.get('code').toUpperCase() : null;
if (urlCode) {
  els.codeInput.value = urlCode;
  connect(urlCode);
}

const forceUpdateBtn = document.getElementById('force-update');
if (forceUpdateBtn) {
  forceUpdateBtn.addEventListener('click', async () => {
    forceUpdateBtn.textContent = 'Updating...';
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch {}
    location.reload();
  });
}
