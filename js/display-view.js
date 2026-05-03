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
}

sync.onState((state) => scroller.setState(state));
sync.onStatusChange((s) => {
  els.connLabel.textContent = s === 'connected' ? 'Connected' : s;
});

els.startScan.addEventListener('click', async () => {
  if (scanner) return;
  try {
    scanner = await createScanner(els.qrVideo, (code) => connect(code));
    await scanner.start();
    els.pairStatus.textContent = 'Point camera at the QR on your computer.';
  } catch (err) {
    els.pairStatus.textContent = 'Camera not available. Use the code input instead.';
  }
});

els.joinByCode.addEventListener('click', () => {
  const raw = els.codeInput.value;
  const code = parseRoomCodeFromText(raw);
  if (!code) {
    els.pairStatus.textContent = 'Enter a 6-character code.';
    return;
  }
  connect(code);
});

els.readingScreen.addEventListener('click', () => {
  els.overlay.classList.toggle('hidden');
  if (!els.overlay.classList.contains('hidden')) {
    setTimeout(() => els.overlay.classList.add('hidden'), 3000);
  }
});

els.disconnect.addEventListener('click', () => {
  sync.disconnect();
  scroller.unmount();
  releaseWakeLock();
  hide(els.readingScreen);
  show(els.pairScreen);
  els.pairStatus.textContent = '';
});

const params = new URLSearchParams(location.search);
if (params.get('code')) {
  els.codeInput.value = params.get('code').toUpperCase();
}
