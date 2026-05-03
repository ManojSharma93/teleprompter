import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignalingClient } from './signaling-client.js';

describe('signaling client', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  function mockResponse(body, status = 200) {
    fetchMock.mockResolvedValueOnce({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }

  it('posts to /room with the action and code', async () => {
    mockResponse({ ok: true });
    const client = createSignalingClient('https://signaling.example');
    await client.createRoom('ABC123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signaling.example/room',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', code: 'ABC123' }),
      })
    );
  });

  it('joinRoom returns true on 200', async () => {
    mockResponse({ ok: true });
    const client = createSignalingClient('https://signaling.example');
    expect(await client.joinRoom('ABC123')).toBe(true);
  });

  it('joinRoom returns false on 404', async () => {
    mockResponse({ error: 'not-found' }, 404);
    const client = createSignalingClient('https://signaling.example');
    expect(await client.joinRoom('NOPE12')).toBe(false);
  });

  it('setOffer / getOffer round-trip', async () => {
    mockResponse({ ok: true });
    mockResponse({ sdp: 'SDP_DATA' });
    const client = createSignalingClient('https://signaling.example');
    await client.setOffer('ABC123', 'SDP_DATA');
    expect(await client.getOffer('ABC123')).toBe('SDP_DATA');
  });

  it('addIce sends candidate with from-role', async () => {
    mockResponse({ ok: true });
    const client = createSignalingClient('https://signaling.example');
    await client.addIce('ABC123', 'controller', 'CANDIDATE');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://signaling.example/room',
      expect.objectContaining({
        body: JSON.stringify({
          action: 'add-ice',
          code: 'ABC123',
          from: 'controller',
          candidate: 'CANDIDATE',
        }),
      })
    );
  });
});
