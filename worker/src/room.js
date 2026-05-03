const TEN_MINUTES_MS = 10 * 60 * 1000;

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.data = {
      created: false,
      offer: null,
      answer: null,
      ice: { controller: [], display: [] },
      lastActivity: Date.now(),
    };
  }

  async load() {
    const stored = await this.state.storage.get('data');
    if (stored) this.data = stored;
  }

  async persist() {
    this.data.lastActivity = Date.now();
    await this.state.storage.put('data', this.data);
  }

  async expired() {
    return Date.now() - this.data.lastActivity > TEN_MINUTES_MS;
  }

  async fetch(request) {
    await this.load();

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (await this.expired() && action !== 'create') {
      return new Response(JSON.stringify({ error: 'expired' }), {
        status: 410, headers: { 'content-type': 'application/json' },
      });
    }

    switch (action) {
      case 'create':
        this.data = {
          created: true,
          offer: null,
          answer: null,
          ice: { controller: [], display: [] },
          lastActivity: Date.now(),
        };
        await this.persist();
        return Response.json({ ok: true });

      case 'join':
        if (!this.data.created) {
          return new Response(JSON.stringify({ error: 'not-found' }), { status: 404 });
        }
        await this.persist();
        return Response.json({ ok: true });

      case 'set-offer': {
        const { sdp } = await request.json();
        this.data.offer = sdp;
        await this.persist();
        return Response.json({ ok: true });
      }

      case 'get-offer':
        await this.persist();
        return Response.json({ sdp: this.data.offer });

      case 'set-answer': {
        const { sdp } = await request.json();
        this.data.answer = sdp;
        await this.persist();
        return Response.json({ ok: true });
      }

      case 'get-answer':
        await this.persist();
        return Response.json({ sdp: this.data.answer });

      case 'add-ice': {
        const { from, candidate } = await request.json();
        if (from === 'controller' || from === 'display') {
          this.data.ice[from].push(candidate);
          await this.persist();
        }
        return Response.json({ ok: true });
      }

      case 'get-ice':
        await this.persist();
        return Response.json({
          controller: this.data.ice.controller,
          display: this.data.ice.display,
        });

      case 'destroy':
        await this.state.storage.deleteAll();
        return Response.json({ ok: true });

      default:
        return new Response('Unknown action', { status: 400 });
    }
  }
}
