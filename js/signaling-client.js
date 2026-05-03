export function createSignalingClient(baseUrl) {
  async function call(action, payload = {}) {
    const res = await fetch(`${baseUrl}/room`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    const data = await res.json();
    return { ok: true, status: res.status, ...data };
  }

  return {
    async createRoom(code) {
      const r = await call('create', { code });
      return r.ok;
    },
    async joinRoom(code) {
      const r = await call('join', { code });
      return r.ok;
    },
    async setOffer(code, sdp) {
      await call('set-offer', { code, sdp });
    },
    async getOffer(code) {
      const r = await call('get-offer', { code });
      return r.sdp || null;
    },
    async setAnswer(code, sdp) {
      await call('set-answer', { code, sdp });
    },
    async getAnswer(code) {
      const r = await call('get-answer', { code });
      return r.sdp || null;
    },
    async addIce(code, from, candidate) {
      await call('add-ice', { code, from, candidate });
    },
    async getIce(code) {
      const r = await call('get-ice', { code });
      return { controller: r.controller || [], display: r.display || [] };
    },
    async destroy(code) {
      await call('destroy', { code });
    },
  };
}
