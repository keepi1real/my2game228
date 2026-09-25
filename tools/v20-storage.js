// Isolate preview checkpoints from the stable game on the same origin.
(() => {
  if (window.V20Storage) return;
  const legacyKey = 'undermountain-biomes-v3';
  const key = 'undermountain-biomes-v20-preview';
  if (SeamlessFloor.key !== legacyKey && SeamlessFloor.key !== key)
    throw new Error('Unexpected seamless checkpoint key; v20 storage isolation not installed');
  // Every v19 save/resume/menu call reads this property at call time. Switching
  // it before Game construction also covers pagehide and v20 map wrappers.
  // Do this even if storage access is denied: never fall back to legacy writes.
  SeamlessFloor.key = key;
  let migration = 'not-needed';
  try {
    if (localStorage.getItem(key) === null) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) {
        // Copy verbatim; existing resume validation remains authoritative.
        // A stored "null" tombstone is present and must not trigger fallback.
        localStorage.setItem(key, legacy);
        migration = 'copied';
      } else migration = 'no-legacy-checkpoint';
    }
  } catch (_) {
    migration = 'storage-unavailable';
  }
  window.V20Storage = Object.freeze({version:20, key, legacyKey, migration});
})();
