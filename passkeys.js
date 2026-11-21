"use strict";
const el = (id) => document.getElementById(id);
let selected = null;
let generation = 0;
let deleting = false;
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
  return record.rpId;
}
async function load() {
  const ticket = ++generation;
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
      row.append(
        cell(website(record)),
        cell(record.displayName),
        cell(record.userName),
      );
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
          `${record.userName || record.displayName || "Account"} · ${record.rpId}`;
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
  } catch (error) {
    if (ticket === generation) {
      showError(error.message);
      el("count").textContent = "Could not load passkeys.";
    }
  }
}
el("deleteDialog").addEventListener("close", async () => {
  const record = selected;
  selected = null;
  if (el("deleteDialog").returnValue !== "delete" || !record || deleting)
    return;
  deleting = true;
  el("refresh").disabled = true;
  showError("");
  try {
    const result = await browser.runtime.sendMessage({
      type: "passkeys:delete",
      credentialId: record.credentialId,
    });
    if (!result?.ok)
      throw new Error(result?.error || "Could not delete the passkey.");
  } catch (error) {
    showError(error.message);
  } finally {
    deleting = false;
    el("refresh").disabled = false;
    await load();
    el("refresh").focus();
  }
});
el("refresh").addEventListener("click", () => {
  showError("");
  load();
});
browser.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    Object.keys(changes).some((key) => key.startsWith("credential:"))
  )
    load();
});
load();
