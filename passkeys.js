"use strict";
const el = (id) => document.getElementById(id);
let selected = null;
let generation = 0;
let deleting = false;
let passwordRecord = null;
let changingPassword = false;
let reloadTimer;
let retryTimer;
function showError(message) {
  el("error").textContent = message;
  el("error").hidden = !message;
}
function cell(text) {
  const td = document.createElement("td");
  td.textContent = text || "—";
  return td;
}
function website(record) {
  if (record.websiteOrigin) {
    try {
      const url = new URL(record.websiteOrigin);
      if (
        ["https:", "http:"].includes(url.protocol) &&
        url.hostname === record.rpId
      )
        return url.origin;
    } catch {}
  }
  return "URL unavailable";
}
async function load() {
  const ticket = ++generation;
  clearTimeout(retryTimer);
  try {
    const result = await browser.runtime.sendMessage({ type: "passkeys:list" });
    if (ticket !== generation) return;
    if (!result || result.error)
      throw new Error(
        result?.error || "The background script did not respond.",
      );
    const records = result.records;
    records.sort(
      (a, b) =>
        a.rpId.localeCompare(b.rpId) ||
        a.userName.localeCompare(b.userName) ||
        a.credentialId.localeCompare(b.credentialId),
    );
    const rows = document.createDocumentFragment();
    for (const record of records) {
      const row = document.createElement("tr");
      const site = cell(website(record));
      site.title = record.rpId;
      row.append(site, cell(record.displayName), cell(record.userName));
      const actions = document.createElement("td");
      actions.className = "controls";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary danger icon-only";
      const label = `Delete passkey for ${record.userName || record.displayName || "this account"} on ${record.rpId}`;
      button.setAttribute("aria-label", label);
      button.title = label;
      const icon = document.createElement("span");
      icon.className = "icon trash";
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      button.addEventListener("click", () => {
        if (deleting) return;
        selected = record;
        el("deleteAccount").textContent =
          `${record.userName || record.displayName || "Account"} · ${website(record)}`;
        el("deleteDialog").returnValue = "";
        el("deleteDialog").showModal();
        el("cancelDelete").focus();
      });
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button secondary icon-only";
      edit.title = "Change PIN or password";
      edit.setAttribute(
        "aria-label",
        `Change PIN or password for ${record.userName || record.displayName || "this account"} on ${record.rpId}`,
      );
      const pencil = document.createElement("span");
      pencil.className = "icon pencil";
      pencil.setAttribute("aria-hidden", "true");
      edit.append(pencil);
      edit.addEventListener("click", () => {
        if (deleting || changingPassword) return;
        passwordRecord = record;
        el("passwordForm").reset();
        el("passwordError").hidden = true;
        el("passwordError").textContent = "";
        el("passwordAccount").textContent =
          `${record.userName || record.displayName || "Account"} · ${website(record)}`;
        el("passwordDialog").showModal();
        el("currentSecret").focus();
      });
      actions.append(edit, button);
      row.append(actions);
      rows.append(row);
    }
    el("entries").replaceChildren(rows);
    el("count").textContent =
      `${records.length} ${records.length === 1 ? "passkey" : "passkeys"}`;
    el("empty").hidden = records.length !== 0;
    if (el("error").dataset.source === "load") showError("");
  } catch (error) {
    if (ticket === generation) {
      el("error").dataset.source = "load";
      showError(error.message);
      el("count").textContent = "Could not load passkeys. Retrying…";
      retryTimer = setTimeout(load, 3000);
    }
  }
}
function scheduleLoad() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(load, 50);
}
el("deleteDialog").addEventListener("close", async () => {
  const record = selected;
  selected = null;
  if (el("deleteDialog").returnValue !== "delete" || !record || deleting)
    return;
  deleting = true;
  showError("");
  try {
    const result = await browser.runtime.sendMessage({
      type: "passkeys:delete",
      credentialId: record.credentialId,
    });
    if (!result?.ok)
      throw new Error(result?.error || "Could not delete the passkey.");
  } catch (error) {
    el("error").dataset.source = "delete";
    showError(error.message);
  } finally {
    deleting = false;
    await load();
    document.querySelector(".table-wrap").focus();
  }
});
browser.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    Object.keys(changes).some(
      (key) => key.startsWith("credential:") || key.startsWith("default:"),
    )
  )
    scheduleLoad();
});
window.addEventListener("focus", scheduleLoad);
window.addEventListener("pageshow", scheduleLoad);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) scheduleLoad();
});
load();

el("cancelPassword").addEventListener("click", () => {
  if (!changingPassword) el("passwordDialog").close();
});
el("passwordDialog").addEventListener("cancel", (event) => {
  if (changingPassword) event.preventDefault();
});
el("passwordDialog").addEventListener("close", () => {
  passwordRecord = null;
  el("passwordForm").reset();
  document.querySelector(".table-wrap").focus();
});
el("passwordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (changingPassword || deleting || !passwordRecord) return;
  const error = el("passwordError");
  error.hidden = true;
  if (el("newSecret").value !== el("confirmSecret").value) {
    error.textContent = "The new PINs or passwords do not match.";
    error.hidden = false;
    el("confirmSecret").focus();
    return;
  }
  changingPassword = true;
  const controls = [...el("passwordForm").querySelectorAll("input, button")];
  controls.forEach((control) => {
    control.disabled = true;
  });
  el("savePassword").textContent = "Saving…";
  try {
    const request = browser.runtime.sendMessage({
      type: "passkeys:change-secret",
      credentialId: passwordRecord.credentialId,
      currentSecret: el("currentSecret").value,
      newSecret: el("newSecret").value,
    });
    el("passwordForm").reset();
    const result = await request;
    if (!result?.ok)
      throw new Error(result?.error || "Could not change the PIN or password.");
    el("managementNotice").textContent = "PIN or password changed.";
    el("passwordDialog").close();
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  } finally {
    changingPassword = false;
    controls.forEach((control) => {
      control.disabled = false;
    });
    el("savePassword").textContent = "Save";
    if (el("passwordDialog").open) el("currentSecret").focus();
  }
});
