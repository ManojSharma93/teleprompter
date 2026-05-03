export { Room } from './room.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const ALLOWED_USERS = new Set(['manoj', 'krishna']);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

async function handleRoom(request, env) {
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
}

async function handleStorage(request, env, user) {
  if (!ALLOWED_USERS.has(user)) {
    return jsonResponse({ error: 'unknown-user' }, 404);
  }
  const key = `user:${user}:scripts`;

  if (request.method === 'GET') {
    const data = await env.USER_STORAGE.get(key);
    if (!data) return jsonResponse({ scripts: [], settings: {} });
    return new Response(data, {
      status: 200,
      headers: { 'content-type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (request.method === 'PUT') {
    const text = await request.text();
    try { JSON.parse(text); }
    catch { return jsonResponse({ error: 'bad-json' }, 400); }
    await env.USER_STORAGE.put(key, text);
    return jsonResponse({ ok: true });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/room' && request.method === 'POST') {
      return handleRoom(request, env);
    }

    const storageMatch = url.pathname.match(/^\/storage\/([a-z0-9_-]+)$/);
    if (storageMatch) {
      return handleStorage(request, env, storageMatch[1].toLowerCase());
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
  },
};
