(() => {
  const channel = 'local-passkeys-prototype-v1';
  const active = new Map();
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || window !== window.top) return;
    const message = event.data;
    if (message?.channel !== channel || typeof message.id !== 'string' || message.id.length > 64) return;
    if (message.kind === 'cancel') {
      active.get(message.id)?.disconnect();
      return;
    }
    if (message.kind !== 'request' || !['create', 'get'].includes(message.operation)) return;
    if (active.has(message.id)) return;
    if (active.size) {
      window.postMessage({ channel, kind: 'result', id: message.id }, location.origin);
      return;
    }
    const port = browser.runtime.connect({ name: 'passkey-prototype' });
    active.set(message.id, port);
    port.onDisconnect.addListener(() => {
      active.delete(message.id);
      window.postMessage({ channel, kind: 'result', id: message.id }, location.origin);
    });
    port.postMessage({ operation: message.operation });
  });
  window.addEventListener('pagehide', () => {
    for (const port of active.values()) port.disconnect();
    active.clear();
  });
})();
