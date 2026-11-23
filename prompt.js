"use strict";
const byId = (id) => document.getElementById(id);
const port = browser.runtime.connect({ name: "approval-popup" });
let operation;
let accounts = [];
let replaceExisting = false;
let action = "Sign in";
function clearSecrets() {
  byId("secret").value = "";
  byId("confirm").value = "";
}
function busy(value) {
  for (const id of ["account", "secret", "confirm", "makeDefault", "submit"]) {
    byId(id).disabled = value;
  }
}
port.onMessage.addListener((message) => {
  if (message.kind === "close") {
    clearSecrets();
    window.close();
    return;
  }
  if (message.kind === "idle") {
    byId("origin").hidden = true;
    byId("notice").hidden = false;
    byId("manageLink").hidden = false;
    return;
  }
  if (message.kind === "error") {
    busy(false);
    byId("submit").textContent = action;
    byId("submit").classList.remove("busy");
    clearSecrets();
    byId("error").textContent = message.message;
    byId("secret").focus();
    return;
  }
  if (message.kind !== "request") return;
  operation = message.operation;
  accounts = message.accounts;
  replaceExisting = operation === "create" && message.replacementCount > 0;
  action =
    operation === "create"
      ? replaceExisting
        ? "Replace passkey"
        : "Create passkey"
      : "Sign in";
  byId("heading").textContent = action;
  byId("origin").hidden = false;
  byId("origin").textContent = message.origin;
  byId("notice").hidden = true;
  byId("manageLink").hidden = true;
  byId("approval").hidden = false;
  byId("submit").textContent = action;
  byId("submit").classList.remove("busy");
  byId("replacementWarning").hidden = !replaceExisting;
  byId("confirmation").hidden = operation !== "create";
  byId("confirm").required = operation === "create";
  if (operation === "create") {
    byId("account").hidden = true;
    byId("accountLabel").hidden = false;
    byId("accountLabel").textContent = message.account;
  } else {
    const groups = new Map();
    for (const account of accounts) {
      if (!groups.has(account.userHandle)) groups.set(account.userHandle, []);
      groups.get(account.userHandle).push(account);
    }
    for (const group of groups.values()) {
      const chosen =
        group.find((item) => item.id === message.defaultId) || group[0];
      byId("account").add(
        new Option(
          chosen.displayName && chosen.displayName !== chosen.name
            ? `${chosen.name} — ${chosen.displayName}`
            : chosen.name,
          chosen.id,
        ),
      );
    }
    if (accounts.some((item) => item.id === message.defaultId))
      byId("account").value = message.defaultId;
    byId("defaultLabel").hidden = groups.size < 2;
    if (groups.size === 1) {
      byId("account").hidden = true;
      byId("accountLabel").hidden = false;
      byId("accountLabel").textContent =
        byId("account").selectedOptions[0].textContent;
    }
    if (!accounts.length) {
      byId("error").textContent =
        "No stored passkey matches this request. Register one through the website first.";
      byId("submit").disabled = true;
      byId("secret").disabled = true;
    }
  }
  byId("secret").focus();
});
port.onDisconnect.addListener(() => {
  clearSecrets();
  window.close();
});
byId("cancel").addEventListener("click", () => {
  clearSecrets();
  port.postMessage({ kind: "cancel" });
  window.close();
});
byId("approval").addEventListener("submit", (event) => {
  event.preventDefault();
  byId("error").textContent = "";
  if (
    operation === "create" &&
    byId("secret").value !== byId("confirm").value
  ) {
    byId("error").textContent = "The secrets do not match.";
    byId("confirm").focus();
    return;
  }
  const secret = byId("secret").value;
  clearSecrets();
  busy(true);
  byId("submit").textContent = "Processing…";
  byId("submit").classList.add("busy");
  port.postMessage({
    kind: "approve",
    secret,
    credentialId: byId("account").value,
    makeDefault: byId("makeDefault").checked,
    replaceExisting,
  });
});
window.addEventListener("pagehide", clearSecrets);
