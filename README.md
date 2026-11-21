# Local Passkeys

Local Passkeys is a Firefox add-on that creates and stores passkeys inside your browser.

Use it to register passkeys, sign into websites, and manage your saved credentials. It needs no account, cloud service, or companion application.

The add-on encrypts each private key with a PIN or password you choose. Account names and website details remain unencrypted.

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

The add-on keeps one passkey for each combination of website RP ID and account identifier.

If you register another passkey for that combination, the popup shows a warning and a “Replace passkey” button.

Replacement saves the new credential before deleting the matching local credentials. It creates a new key pair and records the registration time.

If the website rejects registration afterward, the add-on does not restore the deleted keys.

## Manage saved passkeys

Select the add-on’s toolbar button, then choose “Manage passkeys.”

The overview lists each credential’s website URL, display name, and account name. The table updates automatically when stored credentials change.

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
- No interface exists for changing an unlocking secret.
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

### Development status

The add-on does not include an independent security review or comprehensive Firefox compatibility testing.

Do not use it as the only login method for an important account.
