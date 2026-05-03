export function createCloudStorage(baseUrl) {
  return {
    async load(user) {
      const res = await fetch(`${baseUrl}/storage/${encodeURIComponent(user)}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`load failed (${res.status})`);
      }
      return await res.json();
    },

    async save(user, payload) {
      const res = await fetch(`${baseUrl}/storage/${encodeURIComponent(user)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
    },
  };
}
