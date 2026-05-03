import { describe, it, expect, vi } from 'vitest';
import { createSync } from './sync.js';

function fakeSignaling() {
  let offer = null, answer = null;
  const ice = { controller: [], display: [] };
  return {
    async createRoom() { return true; },
    async joinRoom() { return true; },
    async setOffer(_, sdp) { offer = sdp; },
    async getOffer() { return offer; },
    async setAnswer(_, sdp) { answer = sdp; },
    async getAnswer() { return answer; },
    async addIce(_, from, c) { ice[from].push(c); },
    async getIce() { return { controller: [...ice.controller], display: [...ice.display] }; },
    async destroy() {},
  };
}

class FakeChannel {
  constructor() {
    this.sent = [];
    this.readyState = 'connecting';
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
  }
  send(s) { this.sent.push(s); }
  open() { this.readyState = 'open'; this.onopen?.(); }
  receive(s) { this.onmessage?.({ data: s }); }
  close() { this.readyState = 'closed'; this.onclose?.(); }
}

class FakePeer {
  constructor() {
    this.localDesc = null;
    this.remoteDesc = null;
    this.channels = [];
    this.onicecandidate = null;
    this.ondatachannel = null;
    this.onconnectionstatechange = null;
    this.connectionState = 'new';
  }
  createDataChannel(name) {
    const ch = new FakeChannel();
    this.channels.push(ch);
    return ch;
  }
  async createOffer() { return { type: 'offer', sdp: 'OFFER_SDP' }; }
  async createAnswer() { return { type: 'answer', sdp: 'ANSWER_SDP' }; }
  async setLocalDescription(d) { this.localDesc = d; }
  async setRemoteDescription(d) { this.remoteDesc = d; }
  async addIceCandidate(c) { this.lastIce = c; }
  close() { this.connectionState = 'closed'; }
}

describe('sync', () => {
  it('controller: creates room, sets offer, polls for answer', async () => {
    const signaling = fakeSignaling();
    const peer = new FakePeer();
    const sync = createSync({
      signaling,
      newPeer: () => peer,
      pollIntervalMs: 1,
    });

    const statuses = [];
    sync.onStatusChange((s) => statuses.push(s));

    const connectPromise = sync.connect('ABC123', 'controller');

    await new Promise((r) => setTimeout(r, 5));
    expect(peer.localDesc?.sdp).toBe('OFFER_SDP');

    await signaling.setAnswer('ABC123', 'ANSWER_SDP');

    peer.channels[0].open();
    await connectPromise;

    expect(peer.remoteDesc?.sdp).toBe('ANSWER_SDP');
    expect(statuses).toContain('pairing');
    expect(statuses).toContain('connected');
  });

  it('display: joins room, reads offer, sets answer', async () => {
    const signaling = fakeSignaling();
    await signaling.setOffer('ABC123', 'OFFER_SDP');
    const peer = new FakePeer();
    const sync = createSync({
      signaling,
      newPeer: () => peer,
      pollIntervalMs: 1,
    });

    const connectPromise = sync.connect('ABC123', 'display');

    await new Promise((r) => setTimeout(r, 5));
    expect(peer.remoteDesc?.sdp).toBe('OFFER_SDP');
    expect(peer.localDesc?.sdp).toBe('ANSWER_SDP');

    const ch = new FakeChannel();
    peer.ondatachannel?.({ channel: ch });
    ch.open();
    await connectPromise;
  });

  it('sendState writes JSON to data channel', async () => {
    const signaling = fakeSignaling();
    const peer = new FakePeer();
    const sync = createSync({ signaling, newPeer: () => peer, pollIntervalMs: 1 });
    const connectPromise = sync.connect('ABC123', 'controller');
    await new Promise((r) => setTimeout(r, 5));
    await signaling.setAnswer('ABC123', 'ANSWER_SDP');
    peer.channels[0].open();
    await connectPromise;

    sync.sendState({ position: 0.5, isPlaying: true });
    expect(peer.channels[0].sent.length).toBe(1);
    expect(JSON.parse(peer.channels[0].sent[0])).toEqual({
      position: 0.5,
      isPlaying: true,
    });
  });

  it('onState fires when channel receives a message', async () => {
    const signaling = fakeSignaling();
    await signaling.setOffer('ABC123', 'OFFER_SDP');
    const peer = new FakePeer();
    const sync = createSync({ signaling, newPeer: () => peer, pollIntervalMs: 1 });
    const connectPromise = sync.connect('ABC123', 'display');
    await new Promise((r) => setTimeout(r, 5));

    const ch = new FakeChannel();
    peer.ondatachannel?.({ channel: ch });
    ch.open();
    await connectPromise;

    const received = [];
    sync.onState((s) => received.push(s));
    ch.receive(JSON.stringify({ position: 0.7 }));
    expect(received).toEqual([{ position: 0.7 }]);
  });

  it('throttles sendState to at most once per 30ms', async () => {
    const signaling = fakeSignaling();
    const peer = new FakePeer();
    const sync = createSync({ signaling, newPeer: () => peer, pollIntervalMs: 1 });
    const connectPromise = sync.connect('ABC123', 'controller');
    await new Promise((r) => setTimeout(r, 5));
    await signaling.setAnswer('ABC123', 'ANSWER_SDP');
    peer.channels[0].open();
    await connectPromise;

    sync.sendState({ position: 0.1 });
    sync.sendState({ position: 0.2 });
    sync.sendState({ position: 0.3 });

    expect(peer.channels[0].sent.length).toBe(1);

    await new Promise((r) => setTimeout(r, 35));
    expect(peer.channels[0].sent.length).toBe(2);
    expect(JSON.parse(peer.channels[0].sent[1])).toEqual({ position: 0.3 });
  });
});
