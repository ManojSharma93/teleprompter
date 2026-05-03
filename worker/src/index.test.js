// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';

let worker;

beforeAll(async () => {
  worker = await unstable_dev('worker/src/index.js', {
    config: 'worker/wrangler.toml',
    experimental: { disableExperimentalWarning: true },
  });
});

afterAll(async () => {
  if (worker) await worker.stop();
});

async function postJson(path, body) {
  const res = await worker.fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

describe('signaling worker', () => {
  it('creates a room', async () => {
    const res = await postJson('/room', { action: 'create', code: 'TEST01' });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
  });

  it('rejects join on a missing room', async () => {
    const res = await postJson('/room', { action: 'join', code: 'NOROOM' });
    expect(res.status).toBe(404);
  });

  it('relays offer from controller to display', async () => {
    await postJson('/room', { action: 'create', code: 'CODE01' });
    const setOffer = await postJson('/room', {
      action: 'set-offer', code: 'CODE01', sdp: 'OFFER_SDP',
    });
    expect(setOffer.status).toBe(200);

    const getOffer = await postJson('/room', {
      action: 'get-offer', code: 'CODE01',
    });
    expect(getOffer.status).toBe(200);
    expect(getOffer.json.sdp).toBe('OFFER_SDP');
  });

  it('relays answer from display to controller', async () => {
    await postJson('/room', { action: 'create', code: 'CODE02' });
    await postJson('/room', { action: 'set-offer', code: 'CODE02', sdp: 'O' });
    const setA = await postJson('/room', {
      action: 'set-answer', code: 'CODE02', sdp: 'ANSWER_SDP',
    });
    expect(setA.status).toBe(200);

    const getA = await postJson('/room', {
      action: 'get-answer', code: 'CODE02',
    });
    expect(getA.status).toBe(200);
    expect(getA.json.sdp).toBe('ANSWER_SDP');
  });

  it('relays ICE candidates in both directions', async () => {
    await postJson('/room', { action: 'create', code: 'CODE03' });
    await postJson('/room', {
      action: 'add-ice', code: 'CODE03', from: 'controller', candidate: 'C1',
    });
    await postJson('/room', {
      action: 'add-ice', code: 'CODE03', from: 'display', candidate: 'D1',
    });
    const got = await postJson('/room', { action: 'get-ice', code: 'CODE03' });
    expect(got.status).toBe(200);
    expect(got.json.controller).toContain('C1');
    expect(got.json.display).toContain('D1');
  });
});
