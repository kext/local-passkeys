# Local Passkeys

An experimental Firefox add-on for creating, using, and managing passkeys stored locally in your browser. No separate account, cloud service, or companion application required.

Do not use it for important accounts. Keep another way to sign in: there is no backup or forgotten-password recovery.

Each private key is encrypted with a PIN or password you choose. Account names and website details remain unencrypted.

This project was developed with AI assistance and has not undergone an independent security review.

## Requirements

- Firefox 149 or later.
- A website that supports passkeys.
- Another login method for recovery.

## Install

1. Open the Local Passkeys listing on Firefox Add-ons (AMO).
2. Select “Add to Firefox.”
3. Review the requested permissions and confirm installation.
4. Reload any open website where you want to use the add-on.

The add-on needs website access to handle passkey requests. It uses local storage to save your credentials.

## Create a passkey

1. Sign into the website with your existing login method.
2. Open its account settings and choose its passkey registration option.
3. Check the website and account shown in the add-on popup.
4. Enter a PIN or password, then enter it again to confirm.
5. Select “Create passkey.”

Wait for the website to confirm registration.

Each registration creates a separate key pair. The website receives the public key, while the add-on stores the encrypted private key.

You can choose a different unlocking secret for each passkey. The add-on does not store the secret itself.

## Sign in

1. Choose the website’s passkey sign-in option.
2. Select your account if the popup offers several accounts.
3. Enter the PIN or password you chose for that passkey.
4. Select “Sign in” or press Enter.

The website checks the signed response and completes the login if verification succeeds.

Closing the popup or selecting Cancel cancels the request. Changing tabs, navigating away, or reaching the timeout also cancels it.

## Use multiple accounts

The add-on supports multiple accounts on the same website.

The sign-in popup shows only credentials that match the website’s request. Some websites restrict the request to an account you already selected.

When several accounts are available, you can choose a default for that website. Selecting another account does not change the default automatically.

## Replace a passkey

Registering another passkey for the same account can replace its existing local credential. The popup asks you to approve this explicitly.

Replacement creates a new key pair. The add-on saves the new credential before deleting the matching old local credentials.

Keep another way to sign in before replacing a passkey. If the website rejects the new registration, the add-on keeps the new local record but does not restore the deleted keys.

Accounts are matched using the website’s RP ID and WebAuthn user handle, not the displayed account name.

## Manage saved passkeys

Select the add-on’s toolbar button, then choose “Manage passkeys.”

The overview lists each credential’s website URL, display name, and account name. The table updates automatically when stored credentials change.

To change a passkey’s PIN or password:

1. Select its pencil button.
2. Enter the current PIN or password.
3. Enter the new PIN or password twice.
4. Select “Save.”

This re-encrypts the existing private key. It does not replace the passkey
or require another registration on the website.

You must know the current PIN or password to change it.

To delete an entry:

1. Select its trash button.
2. Check the account and website in the confirmation dialog.
3. Select “Delete passkey.”

Deletion removes the local private key and account record. It does not remove the passkey registration from the website.

Deleting a passkey on the website also does not automatically delete its local record.

## Storage and security

Private keys stay encrypted in the add-on’s local browser storage.

| Data | Protection |
|---|---|
| Private keys | AES-256-GCM encryption |
| Unlocking secrets | Not stored |
| Account names and display names | Stored without encryption |
| Website details and credential identifiers | Stored without encryption |

The add-on derives an encryption key from your secret with PBKDF2-HMAC-SHA-256 and 600,000 iterations. Each credential uses a random salt.

Your PIN or password unlocks the selected private key. The website never receives that secret or the private key.

### Choose a strong secret

Prefer a long password or passphrase.

Someone who copies the stored data can test guesses outside the add-on. A short numeric PIN offers limited protection against that attack.

The add-on does not use hardware protection or an operating-system keychain. It cannot protect an unlocked key from a compromised browser or device.

## Limitations

Local Passkeys is experimental software. Keep another login method for every account.

### No recovery or synchronization

- Passkeys stay in this browser profile.
- No synchronization, backup, or export feature exists.
- No forgotten-secret recovery exists.
- Removing the add-on or its storage can permanently destroy the saved keys.

### Website compatibility

The add-on supports explicit passkey registration and sign-in with ES256 keys.

It does not support every WebAuthn feature:

| Feature | Current limitation |
|---|---|
| Autofill | The add-on does not supply passkeys through conditional autofill |
| Embedded pages | Requests from embedded frames are rejected |
| RP IDs | The RP ID must exactly match the website hostname |
| Attestation | Direct and enterprise attestation are unsupported |
| Additional extensions | Only `credProps` is supported |
| Concurrent requests | Only one approval request can run at a time |

The add-on intercepts website requests rather than joining Firefox’s native passkey picker. Some websites or authentication libraries may not work with it.

### Website addresses

The overview shows the recorded website origin, including its protocol and any non-default port. It does not show the page path.

A record without a stored origin displays “URL unavailable.” The add-on records the origin during registration and local authentication.

Passkey scope uses the RP ID, which contains no protocol or port. Services on `localhost` with different ports therefore share that scope.

## Development

Requires Bun 1.4.4 or later.

Install development dependencies:

    bun install

Format the source, validate the extension, and build a package:

    bun run build

The generated ZIP is written to `web-ext-artifacts/`. It is unsigned;
creating an installable release requires Mozilla signing.

## License

Except for the icons, this project is dedicated to the public domain under
CC0 1.0 Universal. See [LICENSE](LICENSE) for the full legal text.

The icons are from [Lucide](https://lucide.dev/) and are not covered by
the project's CC0 dedication. They are distributed under the ISC license,
with additional MIT terms for icons derived from Feather.
See [icons/LICENSE](icons/LICENSE) for the full license and copyright notices.
