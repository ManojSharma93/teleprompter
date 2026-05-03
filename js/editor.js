const STORAGE_KEY_BASE = 'teleprompter:v1';
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

function storageKey(user) {
  return user ? `${STORAGE_KEY_BASE}:user:${user}` : STORAGE_KEY_BASE;
}

function emptyState() {
  return { scripts: [], settings: { ...DEFAULT_SETTINGS } };
}

function load(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    return {
      scripts: parsed.scripts || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch {
    return emptyState();
  }
}

function persistLocal(key, state) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function createEditor({ user = null, cloudStorage = null, onCloudError = null } = {}) {
  const key = storageKey(user);
  const state = load(key);

  let cloudSyncTimer = null;
  function scheduleCloudSync() {
    if (!cloudStorage || !user) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
      cloudSyncTimer = null;
      try {
        await cloudStorage.save(user, {
          version: SCHEMA_VERSION,
          scripts: state.scripts,
          settings: state.settings,
        });
      } catch (err) {
        if (onCloudError) onCloudError(err);
      }
    }, 500);
  }

  function save() {
    persistLocal(key, state);
    scheduleCloudSync();
  }

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
      save();
      return { ...script };
    },

    update(id, partial) {
      const idx = state.scripts.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      const merged = { ...state.scripts[idx], ...partial, id, updatedAt: nowIso() };
      state.scripts[idx] = merged;
      save();
      return { ...merged };
    },

    delete(id) {
      state.scripts = state.scripts.filter((s) => s.id !== id);
      save();
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
      save();
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
      save();
    },

    getSettings() {
      return { ...state.settings };
    },

    setSettings(partial) {
      state.settings = { ...state.settings, ...partial };
      save();
    },

    async hydrateFromCloud() {
      if (!cloudStorage || !user) return;
      try {
        const cloud = await cloudStorage.load(user);
        if (!cloud) return;
        if (Array.isArray(cloud.scripts)) state.scripts = cloud.scripts;
        if (cloud.settings) state.settings = { ...DEFAULT_SETTINGS, ...cloud.settings };
        persistLocal(key, state);
      } catch (err) {
        if (onCloudError) onCloudError(err);
      }
    },
  };
}
