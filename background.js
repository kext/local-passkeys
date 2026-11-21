let pending = null;
const promptUrl = browser.runtime.getURL('prompt.html');

function cancel(request) {
  if (!request || pending !== request) return;
  pending = null;
  clearTimeout(request.timer);
  request.port.disconnect();
  request.popup?.disconnect();
}

browser.runtime.onConnect.addListener(port => {
  const sender = port.sender;
  if (sender?.id !== browser.runtime.id) { port.disconnect(); return; }
  if (port.name === 'approval-popup') {
    if (sender.url !== promptUrl || !pending) { port.disconnect(); return; }
    const request = pending;
    if (request.popup) { port.disconnect(); return; }
    request.popup = port;
    port.onDisconnect.addListener(() => cancel(request));
    port.onMessage.addListener(message => {
      if (message?.kind === 'cancel') cancel(request);
    });
    port.postMessage({ origin: request.origin, operation: request.operation });
    return;
  }
  if (port.name !== 'passkey-prototype' || sender.frameId !== 0 || !sender.tab) {
    port.disconnect(); return;
  }
  let origin;
  try {
    const url = new URL(sender.url);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Unsupported origin');
    origin = url.origin;
  } catch { port.disconnect(); return; }
  let request;
  port.onDisconnect.addListener(() => cancel(request));
  port.onMessage.addListener(async message => {
    if (request || pending || !['create', 'get'].includes(message?.operation)) { port.disconnect(); return; }
    request = { port, origin, operation: message.operation, tabId: sender.tab.id, windowId: sender.tab.windowId };
    pending = request;
    request.timer = setTimeout(() => cancel(request), 120000);
    try {
      const activeTabs = await browser.tabs.query({ active: true, windowId: request.windowId });
      const window = await browser.windows.get(request.windowId);
      if (pending !== request) return;
      if (!window.focused || activeTabs[0]?.id !== request.tabId) { cancel(request); return; }
      await browser.browserAction.openPopup({ windowId: request.windowId });
    } catch { cancel(request); }
  });
});

browser.tabs.onUpdated.addListener((tabId, change) => {
  if (pending?.tabId === tabId && (change.status === 'loading' || change.url)) cancel(pending);
});
browser.tabs.onRemoved.addListener(tabId => {
  if (pending?.tabId === tabId) cancel(pending);
});
browser.tabs.onActivated.addListener(info => {
  if (pending && info.windowId === pending.windowId && info.tabId !== pending.tabId) cancel(pending);
});
