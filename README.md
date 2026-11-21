# Local Passkeys 0.2.0

Experimental Firefox add-on. Do not use it as the only login method for an important account.

## Install

1. Extract the complete archive into a new folder.
2. Open `about:debugging#/runtime/this-firefox` in Firefox 149 or later.
3. Remove the earlier temporary instance, then choose Load Temporary Add-on.
4. Select `manifest.json`.
5. Reload the test website.

The add-on ID matches the earlier prototype. Back up any existing extension data before removing an installed version. Temporary installation is for development, not durable credential deployment.

## Register

Sign into a test account with its existing method. Choose Add passkey on the website. Confirm the website and account in the toolbar popup. Enter a secret twice, then choose Create passkey. The website must accept the result before login can work.

## Sign in

Choose explicit passkey login on the website. Select an eligible account, enter that credential's secret, and choose Sign in. Different credentials can use different secrets. No shared unlocking key exists.

## Storage

Account metadata stays unencrypted in extension storage. Each PKCS#8 private key uses AES-256-GCM with a separate random 12-byte nonce. PBKDF2-HMAC-SHA-256 uses a separate random 16-byte salt and 600,000 iterations to derive the encryption key. Stable credential fields are authenticated as additional data. The secret itself is not stored. A wrong secret and corrupted ciphertext produce the same error.

Short numeric PINs remain vulnerable to offline guessing after storage theft. No native keychain, hardware protection, or guaranteed JavaScript memory erasure exists here. The user selects the secret strength. The implementation rejects empty secrets only.

## Supported subset

- Explicit top-level WebAuthn registration and login.
- ES256 / P-256 keys and DER-encoded ECDSA signatures.
- Discoverable local credentials and allowCredentials filtering.
- None attestation, all-zero AAGUID, platform attachment, and internal transport.
- UP and UV flags after confirmation and secret-based key creation/unlocking.
- Constant zero signature counter, representing no counter support.
- credProps with rk=true at registration.
- Actual browser sender origin, with an RP ID identical to the hostname.
- HTTPS and local HTTP development on localhost or 127.0.0.1.

## Deliberate limits

Parent-domain RP IDs are rejected, even when WebAuthn would allow them. Full support needs public-suffix-aware domain validation. Embedded frames, direct/enterprise attestation, cross-platform-only requests, and extensions other than credProps are rejected. Conditional autofill remains with Firefox. Authenticator capability APIs remain native and may not advertise this provider correctly. Only one approval can run at a time.

Credential results are JavaScript compatibility objects, not native PublicKeyCredential instances. Common response properties, getters, toJSON(), and getClientExtensionResults() exist, but native brand checks and some libraries can reject them. This extension does not appear in Firefox's native provider picker.

Closing the popup, switching tabs, navigation, and timeout cancel approval. Operations cannot necessarily stop underlying Web Crypto work. Results from cancelled requests are not returned. A cancelled storage write can leave an unused local credential.

Registration stores a credential before returning it. Server rejection can leave an unused record. Duplicate account registrations create new credentials unless excludeCredentials blocks them. The account selector groups eligible credentials by user handle. A stored default chooses a credential, otherwise the first eligible credential represents that account.

No account management page, key deletion, export, recovery, secret change, or Argon2id migration exists yet. Removal of extension storage loses the keys. Keep another login method on every test account.

## Verification

All JavaScript files pass Node syntax checks. Offline tests pass for registration, storage, login, independent DER signature verification, wrong-secret rejection, authenticated metadata tampering, RP rejection, allow-list filtering, and duplicate exclusion. It does not include Firefox end-to-end testing or an independent security review.
