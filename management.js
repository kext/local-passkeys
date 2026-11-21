"use strict";
const managementUrl = browser.runtime.getURL('passkeys.html');
let managementDeleting = false;
const originalRegister = App.webauthn.register;
App.webauthn.register = async function(request, secret) {
  const created = await originalRegister.call(this, request, secret);
  created.record.websiteOrigin = request.origin;
  return created;
};
const originalAuthenticate = App.webauthn.authenticate;
App.webauthn.authenticate = async function(request, record, secret) {
  const result = await originalAuthenticate.call(this, request, record, secret);
  if (pending?.prepared === request) {
    const key = `credential:${record.credentialId}`;
    const stored = (await browser.storage.local.get(key))[key];
    if (stored && pending?.prepared === request && stored.websiteOrigin !== request.origin) {
      stored.websiteOrigin = request.origin;
      await browser.storage.local.set({ [key]: stored });
    }
  }
  return result;
};
function managementMetadata(record) {
  return {
    credentialId: record.credentialId, rpId: record.rpId,
    websiteOrigin: record.websiteOrigin || null,
    displayName: record.displayName || '', userName: record.userName || '',
    registeredAt: record.registeredAt || null
  };
}
browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== browser.runtime.id || sender.url !== managementUrl) return;
  if (message?.type === 'passkeys:list') {
    return App.storage.list().then(records => ({ records: records.map(managementMetadata) })).catch(() => ({ error: 'Could not read the stored passkeys.' }));
  }
  if (message?.type !== 'passkeys:delete') return;
  return (async () => {
    if (pending || managementDeleting) return { error: 'Finish or cancel the current passkey request before deleting an entry.' };
    if (typeof message.credentialId !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(message.credentialId)) return { error: 'Invalid credential ID.' };
    managementDeleting = true;
    try {
      const record = (await App.storage.list()).find(item => item.credentialId === message.credentialId);
      if (!record) return { ok: true };
      await browser.storage.local.remove(`credential:${record.credentialId}`);
      const defaultKey = `default:${record.rpId}`;
      if (await App.storage.defaultFor(record.rpId) === record.credentialId) {
        const remaining = (await App.storage.list()).filter(item => item.rpId === record.rpId);
        remaining.sort((a, b) => (b.registeredAt || '').localeCompare(a.registeredAt || '') || a.credentialId.localeCompare(b.credentialId));
        if (remaining.length) await App.storage.setDefault(record.rpId, remaining[0].credentialId);
        else await browser.storage.local.remove(defaultKey);
      }
      return { ok: true };
    } catch {
      return { error: 'Deletion or default cleanup failed. The list will update automatically.' };
    } finally {
      managementDeleting = false;
      if (pending) cancel(pending);
    }
  })();
});
