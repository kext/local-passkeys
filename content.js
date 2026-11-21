(() => {
  const channel = "local-passkeys";
  const active = new Map();
  const reply = (id, payload) =>
    window.postMessage(
      { channel, kind: "result", id, ...payload },
      location.origin,
    );
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      window !== window.top
    )
      return;
    const message = event.data;
    if (
      message?.channel !== channel ||
      typeof message.id !== "string" ||
      message.id.length > 64
    )
      return;
    if (message.kind === "cancel") {
      active.get(message.id)?.disconnect();
      return;
    }
    if (
      message.kind !== "request" ||
      !["create", "get"].includes(message.operation) ||
      active.has(message.id)
    )
      return;
    if (active.size || JSON.stringify(message).length > 131072) {
      reply(message.id, {
        error: {
          name: "NotAllowedError",
          message: "The request is too large or another request is active.",
        },
      });
      return;
    }
    const port = browser.runtime.connect({ name: "passkey-request" });
    let completed = false;
    active.set(message.id, port);
    port.onMessage.addListener((payload) => {
      completed = true;
      active.delete(message.id);
      reply(message.id, payload);
      port.disconnect();
    });
    port.onDisconnect.addListener(() => {
      active.delete(message.id);
      if (!completed)
        reply(message.id, {
          error: {
            name: "NotAllowedError",
            message: "The request was cancelled.",
          },
        });
    });
    port.postMessage({
      operation: message.operation,
      options: message.options,
    });
  });
  window.addEventListener("pagehide", () => {
    for (const port of active.values()) port.disconnect();
    active.clear();
  });
})();
