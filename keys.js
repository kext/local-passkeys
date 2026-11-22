"use strict";
App.keys = {
  minIterations: 600_000,
  maxIterations: 38_400_000,
  targetDerivationMs: 150,
  aad(record) {
    return App.text(
      JSON.stringify([
        record.version,
        record.credentialId,
        record.rpId,
        record.userHandle,
        record.algorithm,
      ]),
    );
  },
  async derive(secret, kdf) {
    if (
      !kdf ||
      kdf.algorithm !== "PBKDF2" ||
      kdf.hash !== "SHA-256" ||
      !Number.isSafeInteger(kdf.iterations) ||
      kdf.iterations < 1 ||
      kdf.iterations > this.maxIterations
    )
      throw new Error("Unsupported derivation settings.");
    const bytes = App.text(secret);
    try {
      const base = await crypto.subtle.importKey(
        "raw",
        bytes,
        "PBKDF2",
        false,
        ["deriveKey"],
      );
      return await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          hash: kdf.hash,
          salt: App.unb64(kdf.salt),
          iterations: kdf.iterations,
        },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    } finally {
      bytes.fill(0);
    }
  },
  async deriveForEncryption(secret) {
    const kdf = {
      algorithm: "PBKDF2",
      hash: "SHA-256",
      salt: App.b64(App.random(16)),
      iterations: this.minIterations,
    };
    for (;;) {
      const start = performance.now();
      const key = await this.derive(secret, kdf);
      const elapsed = performance.now() - start;
      if (
        elapsed >= this.targetDerivationMs ||
        kdf.iterations >= this.maxIterations
      ) {
        return { key, kdf };
      }
      kdf.iterations = Math.min(kdf.iterations * 2, this.maxIterations);
    }
  },
  async generate(record, secret) {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const privateBytes = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
    );
    try {
      const { key, kdf } = await this.deriveForEncryption(secret);
      record.kdf = kdf;
      const iv = App.random(12);
      record.encryption = {
        algorithm: "AES-GCM",
        nonce: App.b64(iv),
        tagLength: 128,
      };
      record.encryptedPrivateKey = App.b64(
        await crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv,
            additionalData: this.aad(record),
            tagLength: 128,
          },
          key,
          privateBytes,
        ),
      );
      return {
        jwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
        spki: App.b64(await crypto.subtle.exportKey("spki", pair.publicKey)),
      };
    } finally {
      privateBytes.fill(0);
    }
  },
  async changeSecret(record, currentSecret, newSecret) {
    if (record.encryption.algorithm !== "AES-GCM" || record.algorithm !== -7)
      throw new Error("Unsupported stored key.");
    const oldKey = await this.derive(currentSecret, record.kdf);
    let plain;
    try {
      plain = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: App.unb64(record.encryption.nonce),
            additionalData: this.aad(record),
            tagLength: 128,
          },
          oldKey,
          App.unb64(record.encryptedPrivateKey),
        ),
      );
    } catch {
      throw new Error("Incorrect current PIN or password, or damaged passkey.");
    }
    try {
      const { key, kdf } = await this.deriveForEncryption(newSecret);
      const iv = App.random(12);
      const encryptedPrivateKey = App.b64(
        await crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv,
            additionalData: this.aad(record),
            tagLength: 128,
          },
          key,
          plain,
        ),
      );
      return {
        kdf,
        encryption: {
          algorithm: "AES-GCM",
          nonce: App.b64(iv),
          tagLength: 128,
        },
        encryptedPrivateKey,
      };
    } finally {
      plain.fill(0);
    }
  },
  async sign(record, secret, data) {
    if (record.encryption.algorithm !== "AES-GCM" || record.algorithm !== -7)
      throw new Error("Unsupported stored key.");
    const key = await this.derive(secret, record.kdf);
    let plain;
    try {
      plain = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: App.unb64(record.encryption.nonce),
            additionalData: this.aad(record),
            tagLength: 128,
          },
          key,
          App.unb64(record.encryptedPrivateKey),
        ),
      );
    } catch {
      throw new Error("Incorrect secret or damaged credential.");
    }
    try {
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        plain,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      );
      return App.der(
        new Uint8Array(
          await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            privateKey,
            data,
          ),
        ),
      );
    } finally {
      plain.fill(0);
    }
  },
};
