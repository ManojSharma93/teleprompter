const BASE_PX_PER_SECOND = 60;

export function createScroller() {
  let host = null;
  let viewport = null;
  let textEl = null;
  let eyelineEl = null;
  let countdownEl = null;
  let state = null;
  let rafHandle = null;
  let lastFrameAt = 0;

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
      background: #0f1115;
      color: #f5f6f7;
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
      background: linear-gradient(
        to bottom,
        rgba(15,17,21,0.85) 0%,
        rgba(15,17,21,0.55) 12%,
        rgba(15,17,21,0) 22%,
        rgba(15,17,21,0) 38%,
        rgba(15,17,21,0.4) 60%,
        rgba(15,17,21,0.75) 100%
      );
    `;

    const markerLeft = document.createElement('div');
    markerLeft.style.cssText = `
      position: absolute;
      left: 0;
      top: 30%;
      width: 0;
      height: 0;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 14px solid #b3d237;
      opacity: 0.85;
      pointer-events: none;
    `;
    const markerRight = document.createElement('div');
    markerRight.style.cssText = `
      position: absolute;
      right: 0;
      top: 30%;
      width: 0;
      height: 0;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-right: 14px solid #b3d237;
      opacity: 0.85;
      pointer-events: none;
    `;

    viewport.appendChild(textEl);
    viewport.appendChild(eyelineEl);
    viewport.appendChild(markerLeft);
    viewport.appendChild(markerRight);
    host.appendChild(viewport);
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
      const totalScrollPx = textEl.scrollHeight + viewport.clientHeight;
      if (totalScrollPx > 0) {
        const deltaPx = state.speed * BASE_PX_PER_SECOND * dtSec;
        state.position = Math.min(1, state.position + deltaPx / totalScrollPx);
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
