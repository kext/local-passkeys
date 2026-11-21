"use strict";
App.keys = {
  aad(record) {
    return App.text(JSON.stringify([record.version, record.credentialId, record.rpId, record.userHandle, record.algorithm]));
  },
  async derive(secret, kdf) {
    if (kdf.algorithm !== 'PBKDF2' || kdf.hash !== 'SHA-256' || kdf.iterations !== 600000) throw new Error('Unsupported derivation settings.');
    const bytes = App.text(secret);
    try {
      const base = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
      return await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: kdf.hash, salt: App.unb64(kdf.salt), iterations: kdf.iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    } finally { bytes.fill(0); }
  },
  async generate(record, secret) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const privateBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    try {
      record.kdf = { algorithm: 'PBKDF2', hash: 'SHA-256', salt: App.b64(App.random(16)), iterations: 600000 };
      const key = await this.derive(secret, record.kdf);
      const iv = App.random(12);
      record.encryption = { algorithm: 'AES-GCM', nonce: App.b64(iv), tagLength: 128 };
      record.encryptedPrivateKey = App.b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: this.aad(record), tagLength: 128 }, key, privateBytes));
      return { jwk: await crypto.subtle.exportKey('jwk', pair.publicKey), spki: App.b64(await crypto.subtle.exportKey('spki', pair.publicKey)) };
    } finally { privateBytes.fill(0); }
  },
  async sign(record, secret, data) {
    if (record.encryption.algorithm !== 'AES-GCM' || record.algorithm !== -7) throw new Error('Unsupported stored key.');
    const key = await this.derive(secret, record.kdf);
    let plain;
    try {
      plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: App.unb64(record.encryption.nonce), additionalData: this.aad(record), tagLength: 128 }, key, App.unb64(record.encryptedPrivateKey)));
    } catch { throw new Error('Incorrect secret or damaged credential.'); }
    try {
      const privateKey = await crypto.subtle.importKey('pkcs8', plain, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
      return App.der(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data)));
    } finally { plain.fill(0); }
  }
};
