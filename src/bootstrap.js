// Explicit boot diagnostics: a broken module graph must never fail silently.
try {
  await import('./app.js');
  window.__storyverseBoot = 'ready';
  window.dispatchEvent(new Event('storyverse-ready'));
} catch (e) {
  window.__storyverseBoot = 'failed';
  window.__storyverseBootError = String(e?.stack || e);
  console.error('[STORYVERSE BOOT]', e);
  window.dispatchEvent(new Event('storyverse-failed'));
}
