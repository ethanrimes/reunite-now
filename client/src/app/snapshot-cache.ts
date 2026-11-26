// Only cache public data, in memory. A reload always starts a new session.
export function snapshotCache<T>(load: () => Promise<T>, ttl = 60_000) {
  let entry: { promise: Promise<T>; expires: number } | undefined;
  return {
    read() {
      if (entry && Date.now() < entry.expires) return entry.promise;
      const promise = load();
      entry = { promise, expires: Infinity };
      promise.then(
        () => {
          if (entry?.promise === promise) entry.expires = Date.now() + ttl;
        },
        () => {
          if (entry?.promise === promise) entry = undefined;
        },
      );
      return promise;
    },
    clear() {
      entry = undefined;
    },
  };
}

export function keyedSnapshotCache<T>(maxEntries: number) {
  const entries = new Map<string, ReturnType<typeof snapshotCache<T>>>();
  return {
    read(key: string, load: () => Promise<T>) {
      const cached = entries.get(key) ?? snapshotCache(load);
      entries.delete(key);
      entries.set(key, cached);
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (!oldest.done) entries.delete(oldest.value);
      }
      return cached.read();
    },
    clear() {
      for (const entry of entries.values()) entry.clear();
      entries.clear();
    },
  };
}
