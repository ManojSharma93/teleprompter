import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor } from './editor.js';

const STORAGE_KEY = 'teleprompter:v1';

beforeEach(() => {
  localStorage.clear();
});

describe('Editor', () => {
  it('starts with an empty list', () => {
    const editor = createEditor();
    expect(editor.list()).toEqual([]);
  });

  it('creates a script and persists it', () => {
    const editor = createEditor();
    const script = editor.create('My script', 'Hello world');
    expect(script.id).toBeTruthy();
    expect(script.name).toBe('My script');
    expect(script.content).toBe('Hello world');
    expect(script.createdAt).toBeTruthy();
    expect(script.updatedAt).toBe(script.createdAt);

    const fresh = createEditor();
    expect(fresh.list().length).toBe(1);
  });

  it('lists scripts with id, name, updatedAt only', () => {
    const editor = createEditor();
    editor.create('A', 'a content');
    editor.create('B', 'b content');
    const list = editor.list();
    expect(list.length).toBe(2);
    expect(list[0]).toHaveProperty('id');
    expect(list[0]).toHaveProperty('name');
    expect(list[0]).toHaveProperty('updatedAt');
    expect(list[0]).not.toHaveProperty('content');
  });

  it('gets a script by id', () => {
    const editor = createEditor();
    const created = editor.create('X', 'xxx');
    const got = editor.get(created.id);
    expect(got.content).toBe('xxx');
  });

  it('returns null for missing id', () => {
    const editor = createEditor();
    expect(editor.get('nope')).toBeNull();
  });

  it('updates a script and bumps updatedAt', async () => {
    const editor = createEditor();
    const created = editor.create('A', 'a');
    await new Promise((r) => setTimeout(r, 5));
    const updated = editor.update(created.id, { content: 'aaa' });
    expect(updated.content).toBe('aaa');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.createdAt).getTime()
    );
  });

  it('deletes a script', () => {
    const editor = createEditor();
    const created = editor.create('A', 'a');
    editor.delete(created.id);
    expect(editor.list()).toEqual([]);
    expect(editor.get(created.id)).toBeNull();
  });

  it('duplicates a script with a new id and "(copy)" name suffix', () => {
    const editor = createEditor();
    const original = editor.create('Hello', 'content');
    const dupe = editor.duplicate(original.id);
    expect(dupe.id).not.toBe(original.id);
    expect(dupe.name).toBe('Hello (copy)');
    expect(dupe.content).toBe('content');
    expect(editor.list().length).toBe(2);
  });

  it('exports all scripts as JSON', () => {
    const editor = createEditor();
    editor.create('A', 'aaa');
    editor.create('B', 'bbb');
    const json = editor.exportAll();
    const parsed = JSON.parse(json);
    expect(parsed.scripts.length).toBe(2);
    expect(parsed.version).toBe(1);
  });

  it('imports JSON, replacing existing scripts', () => {
    const editor = createEditor();
    editor.create('Old', 'old content');

    const importJson = JSON.stringify({
      version: 1,
      scripts: [
        { id: 'imported-1', name: 'New', content: 'new content',
          createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
      ],
      settings: { fontSize: 80, mirror: true }
    });

    editor.importAll(importJson);
    expect(editor.list().length).toBe(1);
    expect(editor.list()[0].name).toBe('New');
    expect(editor.getSettings().fontSize).toBe(80);
  });

  it('throws on malformed import JSON', () => {
    const editor = createEditor();
    expect(() => editor.importAll('not json')).toThrow();
    expect(() => editor.importAll('{}')).toThrow();
  });

  it('returns default settings when none saved', () => {
    const editor = createEditor();
    const s = editor.getSettings();
    expect(s.fontSize).toBe(64);
    expect(s.mirror).toBe(false);
  });

  it('saves and reloads settings', () => {
    const editor = createEditor();
    editor.setSettings({ fontSize: 80, mirror: true });
    const fresh = createEditor();
    expect(fresh.getSettings().fontSize).toBe(80);
    expect(fresh.getSettings().mirror).toBe(true);
  });
});
