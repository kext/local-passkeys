"use strict";
const el = (id) => document.getElementById(id);
let selected = null;
let generation = 0;
let deleting = false;
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
      actions.className = "row-actions";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "delete-button";
      const label = `Delete passkey for ${record.userName || record.displayName || "this account"} on ${record.rpId}`;
      button.setAttribute("aria-label", label);
      button.title = label;
      const icon = document.createElement("span");
      icon.className = "delete-icon";
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
      actions.append(button);
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
