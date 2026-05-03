function countWords(text) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const THEMES = {
  dark:           { bg: '#0f1115', fg: '#f5f6f7', accent: '#b3d237', rgb: '15,17,21' },
  black:          { bg: '#000000', fg: '#ffffff', accent: '#b3d237', rgb: '0,0,0' },
  sepia:          { bg: '#2c1f10', fg: '#f5e6c8', accent: '#e8b65a', rgb: '44,31,16' },
  'high-contrast':{ bg: '#000000', fg: '#ffff00', accent: '#ffff00', rgb: '0,0,0' },
  light:          { bg: '#f5f6f7', fg: '#0f1115', accent: '#3b7a1b', rgb: '245,246,247' },
};

export function createScroller() {
  let host = null;
  let viewport = null;
  let textEl = null;
  let eyelineEl = null;
  let countdownEl = null;
  let state = null;
  let rafHandle = null;
  let lastFrameAt = 0;

  let markerLeft = null;
  let markerRight = null;

  function mount(hostEl) {
    host = hostEl;
    host.innerHTML = '';

    viewport = document.createElement('div');
    viewport.className = 'tp-viewport';
    viewport.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;

    textEl = document.createElement('div');
    textEl.className = 'tp-text';
    textEl.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      top: 100%;
      white-space: pre-wrap;
      will-change: transform;
    `;

    eyelineEl = document.createElement('div');
    eyelineEl.className = 'tp-eyeline';
    eyelineEl.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
    `;

    markerLeft = document.createElement('div');
    markerLeft.style.cssText = `
      position: absolute;
      left: 0;
      top: 30%;
      width: 0;
      height: 0;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      opacity: 0.85;
      pointer-events: none;
    `;
    markerRight = document.createElement('div');
    markerRight.style.cssText = `
      position: absolute;
      right: 0;
      top: 30%;
      width: 0;
      height: 0;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      opacity: 0.85;
      pointer-events: none;
    `;

    viewport.appendChild(textEl);
    viewport.appendChild(eyelineEl);
    viewport.appendChild(markerLeft);
    viewport.appendChild(markerRight);
    host.appendChild(viewport);
  }

  function applyTheme(themeName, dim = 0.5) {
    const t = THEMES[themeName] || THEMES.dark;
    viewport.style.background = t.bg;
    viewport.style.color = t.fg;
    const topOpacity = 0.4 + 0.4 * dim;
    const midDimOpacity = 0.25 + 0.3 * dim;
    const botOpacity = 0.35 + 0.4 * dim;
    eyelineEl.style.background = `linear-gradient(
      to bottom,
      rgba(${t.rgb},${topOpacity}) 0%,
      rgba(${t.rgb},${midDimOpacity}) 12%,
      rgba(${t.rgb},0) 22%,
      rgba(${t.rgb},0) 38%,
      rgba(${t.rgb},${midDimOpacity}) 60%,
      rgba(${t.rgb},${botOpacity}) 100%
    )`;
    markerLeft.style.borderLeft = `14px solid ${t.accent}`;
    markerRight.style.borderRight = `14px solid ${t.accent}`;
  }

  function setState(next) {
    const prevScript = state?.script;
    state = next;

    if (next.script !== prevScript) {
      textEl.textContent = next.script;
    }

    textEl.style.fontSize = `${next.fontSize}px`;
    textEl.style.lineHeight = String(next.lineHeight);
    const margin = `${next.marginPercent}%`;
    textEl.style.paddingLeft = margin;
    textEl.style.paddingRight = margin;

    applyTheme(next.theme, typeof next.dim === 'number' ? next.dim : 0.5);

    viewport.style.transform = next.mirror ? 'scaleX(-1)' : '';

    updateCountdown(next.countdown);
    updateScrollPosition();

    if (next.isPlaying) startLoop();
    else stopLoop();
  }

  function updateCountdown(value) {
    if (value === null || value === undefined) {
      if (countdownEl) {
        countdownEl.remove();
        countdownEl = null;
      }
      return;
    }
    if (!countdownEl) {
      countdownEl = document.createElement('div');
      countdownEl.className = 'tp-countdown';
      countdownEl.style.cssText = `
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 30vw;
        font-weight: 800;
        color: #b3d237;
        background: rgba(0,0,0,0.6);
        pointer-events: none;
      `;
      viewport.appendChild(countdownEl);
    }
    countdownEl.textContent = String(value);
  }

  function updateScrollPosition() {
    const totalScrollPx = textEl.scrollHeight + viewport.clientHeight;
    const offset = state.position * totalScrollPx;
    textEl.style.transform = `translateY(${-offset}px)`;
  }

  function startLoop() {
    if (rafHandle) return;
    lastFrameAt = performance.now();
    const tick = (now) => {
      const dtSec = (now - lastFrameAt) / 1000;
      lastFrameAt = now;
      const words = countWords(state.script);
      const wpm = 150 * (state.speed || 1);
      const totalSec = words > 0 ? (words / wpm) * 60 : 30;
      if (totalSec > 0) {
        const positionDelta = dtSec / totalSec;
        state.position = Math.min(1, state.position + positionDelta);
      }
      updateScrollPosition();
      if (state.isPlaying && state.position < 1) {
        rafHandle = requestAnimationFrame(tick);
      } else {
        rafHandle = null;
      }
    };
    rafHandle = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (rafHandle) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  }

  function unmount() {
    stopLoop();
    if (host) host.innerHTML = '';
    host = null;
    viewport = null;
    textEl = null;
    eyelineEl = null;
    countdownEl = null;
    state = null;
  }

  return { mount, setState, unmount };
}
