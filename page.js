(() => {
  const channel = "local-passkeys-v2";
  const credentials = navigator.credentials;
  if (!credentials || !window.isSecureContext) return;
  const pending = new Map();
  const b64 = (value) => {
    const bytes = ArrayBuffer.isView(value)
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : new Uint8Array(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };
  const buffer = (value) =>
    Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0),
    ).buffer;
  const encode = (value) => {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
      return b64(value);
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, encode(v)]),
      );
    return value;
  };
  const makeCredential = (data) => {
    const response = { clientDataJSON: buffer(data.clientDataJSON) };
    const result = {
      id: data.id,
      rawId: buffer(data.id),
      type: "public-key",
      authenticatorAttachment: "platform",
      response,
      getClientExtensionResults: () => structuredClone(data.extensions || {}),
    };
    if (data.operation === "create") {
      response.attestationObject = buffer(data.attestationObject);
      response.getAuthenticatorData = () => buffer(data.authenticatorData);
      response.getPublicKey = () => buffer(data.publicKey);
      response.getPublicKeyAlgorithm = () => -7;
      response.getTransports = () => ["internal"];
    } else {
      response.authenticatorData = buffer(data.authenticatorData);
      response.signature = buffer(data.signature);
      response.userHandle = buffer(data.userHandle);
    }
    result.toJSON = () => ({
      id: data.id,
      rawId: data.id,
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: structuredClone(data.extensions || {}),
      response:
        data.operation === "create"
          ? {
              clientDataJSON: data.clientDataJSON,
              attestationObject: data.attestationObject,
              authenticatorData: data.authenticatorData,
              publicKey: data.publicKey,
              publicKeyAlgorithm: -7,
              transports: ["internal"],
            }
          : {
              clientDataJSON: data.clientDataJSON,
              authenticatorData: data.authenticatorData,
              signature: data.signature,
              userHandle: data.userHandle,
            },
    });
    return result;
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (data?.channel !== channel || data.kind !== "result") return;
    const entry = pending.get(data.id);
    if (!entry) return;
    if (data.error)
      entry.finish(new DOMException(data.error.message, data.error.name));
    else {
      try {
        entry.finish(null, makeCredential(data.result));
      } catch {
        entry.finish(
          new DOMException("Invalid credential response.", "UnknownError"),
        );
      }
    }
  });
  for (const operation of ["create", "get"]) {
    const original = credentials[operation];
    Object.defineProperty(credentials, operation, {
      configurable: true,
      writable: true,
      value: function (options) {
        if (this !== credentials || !options?.publicKey)
          return Reflect.apply(original, this, arguments);
        if (window !== window.top)
          return Promise.reject(
            new DOMException(
              "Embedded frames are unsupported.",
              "NotAllowedError",
            ),
          );
        if (operation === "get" && options.mediation === "conditional")
          return Reflect.apply(original, this, arguments);
        return new Promise((resolve, reject) => {
          const id = crypto.randomUUID();
          const signal = options.signal;
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          let done = false;
          const finish = (error, result) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", abort);
            pending.delete(id);
            window.postMessage(
              { channel, kind: "cancel", id },
              location.origin,
            );
            if (error) reject(error);
            else resolve(result);
          };
          const abort = () =>
            finish(
              signal.reason || new DOMException("Cancelled.", "AbortError"),
            );
          const hint = Number(options.publicKey.timeout);
          const timeout =
            Number.isFinite(hint) && hint > 0
              ? Math.min(Math.max(hint, 15000), 120000)
              : 120000;
          const timer = setTimeout(
            () =>
              finish(
                new DOMException("The request expired.", "NotAllowedError"),
              ),
            timeout,
          );
          pending.set(id, { finish });
          signal?.addEventListener("abort", abort, { once: true });
          window.postMessage(
            {
              channel,
              kind: "request",
              id,
              operation,
              options: encode(options.publicKey),
            },
            location.origin,
          );
        });
      },
    });
  }
})();
