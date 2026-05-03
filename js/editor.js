const STORAGE_KEY = 'teleprompter:v1';
const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS = {
  fontSize: 64,
  lineHeight: 1.6,
  marginPercent: 15,
  mirror: false,
  theme: 'dark',
};

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowIso() {
  return new Date().toISOString();
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { scripts: [], settings: { ...DEFAULT_SETTINGS } };
  try {
    const parsed = JSON.parse(raw);
    return {
      scripts: parsed.scripts || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch {
    return { scripts: [], settings: { ...DEFAULT_SETTINGS } };
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createEditor() {
  const state = load();

  return {
    list() {
      return state.scripts.map((s) => ({
        id: s.id,
        name: s.name,
        updatedAt: s.updatedAt,
      }));
    },

    get(id) {
      const found = state.scripts.find((s) => s.id === id);
      return found ? { ...found } : null;
    },

    create(name, content) {
      const now = nowIso();
      const script = { id: uuid(), name, content, createdAt: now, updatedAt: now };
      state.scripts.unshift(script);
      save(state);
      return { ...script };
    },

    update(id, partial) {
      const idx = state.scripts.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      const merged = { ...state.scripts[idx], ...partial, id, updatedAt: nowIso() };
      state.scripts[idx] = merged;
      save(state);
      return { ...merged };
    },

    delete(id) {
      state.scripts = state.scripts.filter((s) => s.id !== id);
      save(state);
    },

    duplicate(id) {
      const original = state.scripts.find((s) => s.id === id);
      if (!original) return null;
      const now = nowIso();
      const dupe = {
        id: uuid(),
        name: `${original.name} (copy)`,
        content: original.content,
        createdAt: now,
        updatedAt: now,
      };
      state.scripts.unshift(dupe);
      save(state);
      return { ...dupe };
    },

    exportAll() {
      return JSON.stringify({
        version: SCHEMA_VERSION,
        scripts: state.scripts,
        settings: state.settings,
      }, null, 2);
    },

    importAll(jsonString) {
      const parsed = JSON.parse(jsonString);
      if (!parsed.scripts || !Array.isArray(parsed.scripts)) {
        throw new Error('Invalid import: missing scripts array');
      }
      state.scripts = parsed.scripts;
      state.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
      save(state);
    },

    getSettings() {
      return { ...state.settings };
    },

    setSettings(partial) {
      state.settings = { ...state.settings, ...partial };
      save(state);
    },
  };
}
