"use strict";
App.webauthn = {
  async prepare(operation, options, origin) {
    const url = new URL(origin);
    if (!options || typeof options !== "object")
      App.fail("Missing public-key options.", "TypeError");
    const challenge = App.unb64(options.challenge);
    if (!challenge.length || challenge.length > 4096)
      App.fail("Invalid challenge.", "TypeError");
    const rpId =
      operation === "create"
        ? (options.rp?.id ?? url.hostname)
        : (options.rpId ?? url.hostname);
    if (rpId !== url.hostname)
      App.fail(
        "This version supports only an RP ID identical to the website hostname.",
        "SecurityError",
      );
    const extensions = options.extensions || {};
    if (Object.keys(extensions).some((name) => name !== "credProps"))
      App.fail(
        "This version does not support the requested WebAuthn extensions.",
      );
    const verification =
      operation === "create"
        ? options.authenticatorSelection?.userVerification
        : options.userVerification;
    if (
      verification !== undefined &&
      !["required", "preferred", "discouraged"].includes(verification)
    )
      App.fail("Invalid verification requirement.", "TypeError");
    const records = (await App.storage.list()).filter(
      (record) => record.rpId === rpId,
    );
    if (operation === "create") {
      if (
        !options.pubKeyCredParams?.some(
          (item) => item.type === "public-key" && item.alg === -7,
        )
      )
        App.fail("The website does not accept ES256.");
      if (
        !options.user ||
        typeof options.user.name !== "string" ||
        typeof options.user.displayName !== "string"
      )
        App.fail("Invalid account data.", "TypeError");
      const userId = App.unb64(options.user.id);
      if (!userId.length || userId.length > 64)
        App.fail("Invalid user handle.", "TypeError");
      if (
        options.authenticatorSelection?.authenticatorAttachment ===
        "cross-platform"
      )
        App.fail("Cross-platform authenticators are not supported.");
      if (!["none", "indirect", undefined].includes(options.attestation))
        App.fail("Direct and enterprise attestation are not supported.");
      const excluded = options.excludeCredentials || [];
      if (!Array.isArray(excluded))
        App.fail("Invalid exclusions.", "TypeError");
      if (
        excluded.some(
          (item) =>
            item.type === "public-key" &&
            records.some((record) => record.credentialId === item.id),
        )
      )
        App.fail(
          "A matching passkey is already registered.",
          "InvalidStateError",
        );
      return {
        operation,
        options,
        origin,
        rpId,
        records: [],
        account: options.user.name,
      };
    }
    const allowed = options.allowCredentials || [];
    if (!Array.isArray(allowed))
      App.fail("Invalid allowed credentials.", "TypeError");
    const eligible = records.filter(
      (record) =>
        !allowed.length ||
        allowed.some(
          (item) =>
            item.type === "public-key" && item.id === record.credentialId,
        ),
    );
    return { operation, options, origin, rpId, records: eligible };
  },
  client(request) {
    return App.text(
      JSON.stringify({
        type:
          request.operation === "create" ? "webauthn.create" : "webauthn.get",
        challenge: request.options.challenge,
        origin: request.origin,
        crossOrigin: false,
      }),
    );
  },
  async authData(rpId, registration = false, tail = new Uint8Array()) {
    return App.concat(
      await App.hash(App.text(rpId)),
      Uint8Array.of(registration ? 0x45 : 0x05),
      new Uint8Array(4),
      tail,
    );
  },
  async register(request, secret) {
    const record = {
      version: 1,
      credentialId: App.b64(App.random(32)),
      rpId: request.rpId,
      userHandle: request.options.user.id,
      userName: request.options.user.name,
      displayName: request.options.user.displayName,
      algorithm: -7,
    };
    const publicKey = await App.keys.generate(record, secret);
    const cose = App.cbor(
      new Map([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, App.unb64(publicKey.jwk.x)],
        [-3, App.unb64(publicKey.jwk.y)],
      ]),
    );
    const id = App.unb64(record.credentialId);
    const tail = App.concat(
      new Uint8Array(16),
      Uint8Array.of(0, id.length),
      id,
      cose,
    );
    const auth = await this.authData(request.rpId, true, tail);
    const attestation = App.cbor(
      new Map([
        ["fmt", "none"],
        ["authData", auth],
        ["attStmt", new Map()],
      ]),
    );
    const extensions = request.options.extensions?.credProps
      ? { credProps: { rk: true } }
      : {};
    return {
      record,
      result: {
        operation: "create",
        id: record.credentialId,
        clientDataJSON: App.b64(this.client(request)),
        attestationObject: App.b64(attestation),
        authenticatorData: App.b64(auth),
        publicKey: publicKey.spki,
        extensions,
      },
    };
  },
  async authenticate(request, record, secret) {
    const client = this.client(request);
    const auth = await this.authData(request.rpId);
    const signature = await App.keys.sign(
      record,
      secret,
      App.concat(auth, await App.hash(client)),
    );
    return {
      operation: "get",
      id: record.credentialId,
      clientDataJSON: App.b64(client),
      authenticatorData: App.b64(auth),
      signature: App.b64(signature),
      userHandle: record.userHandle,
      extensions: {},
    };
  },
};
