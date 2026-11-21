const port = browser.runtime.connect({ name: 'approval-popup' });
port.onMessage.addListener(message => {
  document.getElementById('heading').textContent = message.operation === 'create' ? 'Create a passkey' : 'Sign in';
  document.getElementById('origin').textContent = message.origin;
});
port.onDisconnect.addListener(() => window.close());
document.getElementById('cancel').addEventListener('click', () => {
  port.postMessage({ kind: 'cancel' });
  window.close();
});
