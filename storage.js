"use strict";
App.storage = {
  async list() {
    const values = await browser.storage.local.get(null);
    return Object.entries(values).filter(([key]) => key.startsWith('credential:')).map(([, value]) => value);
  },
  async save(record, makeDefault, replaceExisting = false) {
    const existing = (await this.list()).filter(item => item.rpId === record.rpId && item.userHandle === record.userHandle && item.credentialId !== record.credentialId);
    if (existing.length && !replaceExisting) throw new Error('Confirm replacement of the existing passkey.');
    const key = `default:${record.rpId}`;
    const current = (await browser.storage.local.get(key))[key];
    const replacesDefault = existing.some(item => item.credentialId === current);
    record.registeredAt = new Date().toISOString();
    const update = { [`credential:${record.credentialId}`]: record };
    if (makeDefault || !current || replacesDefault) update[key] = record.credentialId;
    await browser.storage.local.set(update);
    if (existing.length) {
      try {
        await browser.storage.local.remove(existing.map(item => `credential:${item.credentialId}`));
      } catch {
        throw new Error('The new passkey was saved, but old records could not be removed. Registration did not finish. Retry registration to replace these records.');
      }
    }
  },
  async defaultFor(rpId) {
    const key = `default:${rpId}`;
    return (await browser.storage.local.get(key))[key];
  },
  async setDefault(rpId, credentialId) {
    await browser.storage.local.set({ [`default:${rpId}`]: credentialId });
  }
};
