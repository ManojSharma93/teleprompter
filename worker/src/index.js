export { Room } from './room.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/room' || request.method !== 'POST') {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS });
    }

    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ error: 'bad-json' }, 400); }

    const code = (body.code || '').toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return jsonResponse({ error: 'bad-code' }, 400);
    }

    const id = env.ROOMS.idFromName(code);
    const stub = env.ROOMS.get(id);

    const action = body.action;
    const subUrl = new URL(request.url);
    subUrl.searchParams.set('action', action);

    const subRequest = new Request(subUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await stub.fetch(subRequest);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    });
  },
};
