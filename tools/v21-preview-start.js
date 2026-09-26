// Install after v20-storage, before v20-save-atomic. The existing explicit
// debug map startup handles launch; this patch only isolates its checkpoint.
(() => {
  'use strict';
  if (window.V21PreviewStart) return;
  const query = typeof URLSearchParams === 'function'
    ? new URLSearchParams(window.location?.search || '') : null;
  const active = query?.get('debug') === '1' && query?.get('map') === 'tideobservatory';
  const key = 'undermountain-biomes-v21-observatory-preview';
  if (active) SeamlessFloor.key = key;
  window.V21PreviewStart = Object.freeze({version:21, active, key});
})();
