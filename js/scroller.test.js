import { describe, it, expect, beforeEach } from 'vitest';
import { createScroller } from './scroller.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="root" style="height:600px;width:400px"></div>';
});

describe('Scroller', () => {
  it('renders the script content into the host element', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'Hello world',
      position: 0,
      speed: 1,
      isPlaying: false,
      fontSize: 64,
      lineHeight: 1.6,
      marginPercent: 15,
      mirror: false,
      theme: 'dark',
      countdown: null,
    });
    expect(root.textContent).toContain('Hello world');
  });

  it('applies mirror transform when mirror is true', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'x',
      position: 0,
      speed: 1,
      isPlaying: false,
      fontSize: 64,
      lineHeight: 1.6,
      marginPercent: 15,
      mirror: true,
      theme: 'dark',
      countdown: null,
    });
    const viewport = root.querySelector('.tp-viewport');
    expect(viewport.style.transform).toContain('scaleX(-1)');
  });

  it('shows countdown overlay when countdown is set', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'x', position: 0, speed: 1, isPlaying: false,
      fontSize: 64, lineHeight: 1.6, marginPercent: 15,
      mirror: false, theme: 'dark', countdown: 3,
    });
    expect(root.querySelector('.tp-countdown').textContent).toBe('3');
  });

  it('hides countdown overlay when countdown is null', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'x', position: 0, speed: 1, isPlaying: false,
      fontSize: 64, lineHeight: 1.6, marginPercent: 15,
      mirror: false, theme: 'dark', countdown: null,
    });
    expect(root.querySelector('.tp-countdown')).toBeNull();
  });

  it('applies font size to text element', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'x', position: 0, speed: 1, isPlaying: false,
      fontSize: 96, lineHeight: 1.6, marginPercent: 15,
      mirror: false, theme: 'dark', countdown: null,
    });
    const text = root.querySelector('.tp-text');
    expect(text.style.fontSize).toBe('96px');
  });

  it('renders an eye-line indicator', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'x', position: 0, speed: 1, isPlaying: false,
      fontSize: 64, lineHeight: 1.6, marginPercent: 15,
      mirror: false, theme: 'dark', countdown: null,
    });
    expect(root.querySelector('.tp-eyeline')).toBeTruthy();
  });

  it('positions the text based on position state', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'long content '.repeat(100),
      position: 0.5, speed: 1, isPlaying: false,
      fontSize: 64, lineHeight: 1.6, marginPercent: 15,
      mirror: false, theme: 'dark', countdown: null,
    });
    const text = root.querySelector('.tp-text');
    expect(text.style.transform).toContain('translateY');
  });

  it('unmount removes the scroller from the host', () => {
    const root = document.getElementById('root');
    const s = createScroller();
    s.mount(root);
    s.setState({
      script: 'x', position: 0, speed: 1, isPlaying: false,
      fontSize: 64, lineHeight: 1.6, marginPercent: 15,
      mirror: false, theme: 'dark', countdown: null,
    });
    s.unmount();
    expect(root.querySelector('.tp-viewport')).toBeNull();
  });
});
