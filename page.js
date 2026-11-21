(() => {
  const channel = 'local-passkeys-prototype-v1';
  const credentials = navigator.credentials;
  if (!credentials || !window.isSecureContext) return;
  const pending = new Map();
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (message?.channel !== channel || message.kind !== 'result') return;
    const request = pending.get(message.id);
    if (!request) return;
    request.reject(new DOMException('The prototype cancelled the passkey request.', 'NotAllowedError'));
  });
  for (const operation of ['create', 'get']) {
    const original = credentials[operation];
    Object.defineProperty(credentials, operation, {
      configurable: true, writable: true,
      value: function(options) {
        if (this !== credentials || !options?.publicKey) return Reflect.apply(original, this, arguments);
        if (window !== window.top) return Promise.reject(new DOMException('Embedded frames are not supported by this prototype.', 'NotAllowedError'));
        if (operation === 'get' && options.mediation === 'conditional') return Reflect.apply(original, this, arguments);
        return new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          const signal = options.signal;
          if (signal?.aborted) { reject(signal.reason); return; }
          const finish = error => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            pending.delete(id);
            window.postMessage({ channel, kind: 'cancel', id }, location.origin);
            reject(error);
          };
          const abort = () => finish(signal.reason);
          const timer = setTimeout(() => finish(new DOMException('The passkey request expired.', 'NotAllowedError')), 120000);
          pending.set(id, { reject: finish });
          signal?.addEventListener('abort', abort, { once: true });
          window.postMessage({ channel, kind: 'request', id, operation }, location.origin);
        });
      }
    });
  }
})();
