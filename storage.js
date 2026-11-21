"use strict";
App.storage = {
  async list() {
    const values = await browser.storage.local.get(null);
    return Object.entries(values).filter(([key]) => key.startsWith('credential:')).map(([, value]) => value);
  },
  async save(record, makeDefault) {
    const update = { [`credential:${record.credentialId}`]: record };
    const key = `default:${record.rpId}`;
    const current = await browser.storage.local.get(key);
    if (makeDefault || !current[key]) update[key] = record.credentialId;
    await browser.storage.local.set(update);
  },
  async defaultFor(rpId) {
    const key = `default:${rpId}`;
    return (await browser.storage.local.get(key))[key];
  },
  async setDefault(rpId, credentialId) {
    await browser.storage.local.set({ [`default:${rpId}`]: credentialId });
  }
};
