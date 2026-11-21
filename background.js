"use strict";
let pending = null;
const promptUrl = browser.runtime.getURL("prompt.html");
const safeSend = (port, value) => {
  try {
    port.postMessage(value);
  } catch {}
};
function finish(request, payload) {
  if (pending !== request) return;
  pending = null;
  clearTimeout(request.timer);
  safeSend(request.port, payload);
  if (request.popup) {
    safeSend(request.popup, { kind: "close" });
    request.popup.disconnect();
  }
}
function cancel(request) {
  if (request && pending === request)
    finish(request, {
      error: { name: "NotAllowedError", message: "The request was cancelled." },
    });
}
async function active(request) {
  if (pending !== request) return false;
  const tabs = await browser.tabs.query({
    active: true,
    windowId: request.windowId,
  });
  const window = await browser.windows.get(request.windowId);
  const tab = tabs[0];
  return (
    pending === request &&
    window.focused &&
    tab?.id === request.tabId &&
    new URL(tab.url).origin === request.origin
  );
}
browser.runtime.onConnect.addListener((port) => {
  const sender = port.sender;
  if (sender?.id !== browser.runtime.id) {
    port.disconnect();
    return;
  }
  if (port.name === "approval-popup") {
    const request = pending;
    if (sender.url !== promptUrl) {
      port.disconnect();
      return;
    }
    if (!request || !request.prepared || request.popup) {
      safeSend(port, { kind: "idle" });
      return;
    }
    request.popup = port;
    port.onDisconnect.addListener(() => cancel(request));
    const prepared = request.prepared;
    safeSend(port, {
      kind: "request",
      operation: prepared.operation,
      origin: request.origin,
      account: prepared.account,
      replacementCount: request.replacementCount,
      defaultId: request.defaultId,
      accounts: prepared.records.map((record) => ({
        id: record.credentialId,
        userHandle: record.userHandle,
        name: record.userName,
        displayName: record.displayName,
      })),
    });
    port.onMessage.addListener(async (message) => {
      if (message?.kind === "cancel") {
        cancel(request);
        return;
      }
      if (message?.kind !== "approve" || pending !== request || request.busy)
        return;
      request.busy = true;
      let secret = message.secret;
      message.secret = "";
      try {
        if (
          typeof secret !== "string" ||
          !secret.length ||
          secret.length > 1024
        )
          throw new Error(
            "Enter a PIN or password of at most 1024 characters.",
          );
        if (!(await active(request))) {
          cancel(request);
          return;
        }
        let result;
        if (prepared.operation === "create") {
          if (request.replacementCount && message.replaceExisting !== true)
            throw new Error("Confirm replacement of the existing passkey.");
          const created = await App.webauthn.register(prepared, secret);
          if (!(await active(request))) {
            cancel(request);
            return;
          }
          await App.storage.save(
            created.record,
            false,
            message.replaceExisting === true,
          );
          result = created.result;
        } else {
          const record = prepared.records.find(
            (item) => item.credentialId === message.credentialId,
          );
          if (!record) throw new Error("Select an eligible account.");
          result = await App.webauthn.authenticate(prepared, record, secret);
          if (!(await active(request))) {
            cancel(request);
            return;
          }
          if (message.makeDefault === true)
            await App.storage.setDefault(prepared.rpId, record.credentialId);
        }
        if (pending === request) finish(request, { result });
      } catch (error) {
        if (pending === request) {
          request.busy = false;
          safeSend(port, {
            kind: "error",
            message: error.message || "The operation failed.",
          });
        }
      } finally {
        secret = "";
      }
    });
    return;
  }
  if (port.name !== "passkey-request" || sender.frameId !== 0 || !sender.tab) {
    port.disconnect();
    return;
  }
  let origin;
  try {
    const url = new URL(sender.url);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw new Error();
    origin = url.origin;
  } catch {
    port.disconnect();
    return;
  }
  let request;
  port.onDisconnect.addListener(() => cancel(request));
  port.onMessage.addListener(async (message) => {
    if (request || pending || !["create", "get"].includes(message?.operation)) {
      port.disconnect();
      return;
    }
    request = {
      port,
      origin,
      tabId: sender.tab.id,
      windowId: sender.tab.windowId,
      busy: false,
      replacementCount: 0,
    };
    pending = request;
    request.timer = setTimeout(() => cancel(request), 120000);
    try {
      request.prepared = await App.webauthn.prepare(
        message.operation,
        message.options,
        origin,
      );
      if (message.operation === "create") {
        request.replacementCount = (await App.storage.list()).filter(
          (record) =>
            record.rpId === request.prepared.rpId &&
            record.userHandle === request.prepared.options.user.id,
        ).length;
      }
      request.defaultId = await App.storage.defaultFor(request.prepared.rpId);
      if (!(await active(request))) {
        cancel(request);
        return;
      }
      await browser.browserAction.openPopup({ windowId: request.windowId });
    } catch (error) {
      finish(request, {
        error: {
          name: error instanceof DOMException ? error.name : "NotAllowedError",
          message: error.message || "The request failed.",
        },
      });
    }
  });
});
browser.tabs.onUpdated.addListener((tabId, change) => {
  if (pending?.tabId === tabId && (change.status === "loading" || change.url))
    cancel(pending);
});
browser.tabs.onRemoved.addListener((tabId) => {
  if (pending?.tabId === tabId) cancel(pending);
});
browser.tabs.onActivated.addListener((info) => {
  if (
    pending &&
    info.windowId === pending.windowId &&
    info.tabId !== pending.tabId
  )
    cancel(pending);
});
