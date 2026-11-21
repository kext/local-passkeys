"use strict";
const App = {};
App.bytes = (value) =>
  value instanceof Uint8Array ? value : new Uint8Array(value);
App.text = (value) => new TextEncoder().encode(value);
App.concat = (...parts) => {
  const values = parts.map(App.bytes);
  const result = new Uint8Array(
    values.reduce((n, value) => n + value.length, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
};
App.b64 = (value) => {
  let binary = "";
  for (const byte of App.bytes(value)) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};
App.unb64 = (value) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/.test(value))
    throw new Error("Invalid binary encoding.");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};
App.random = (size) => crypto.getRandomValues(new Uint8Array(size));
App.hash = async (value) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", value));
App.fail = (message, name = "NotSupportedError") => {
  throw new DOMException(message, name);
};
App.cbor = (value) => {
  const head = (major, n) => {
    if (n < 24) return Uint8Array.of((major << 5) | n);
    if (n < 256) return Uint8Array.of((major << 5) | 24, n);
    if (n < 65536) return Uint8Array.of((major << 5) | 25, n >> 8, n & 255);
    throw new Error("CBOR value is too large.");
  };
  if (Number.isInteger(value))
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === "string") {
    const data = App.text(value);
    return App.concat(head(3, data.length), data);
  }
  if (value instanceof Uint8Array)
    return App.concat(head(2, value.length), value);
  if (value instanceof Map)
    return App.concat(
      head(5, value.size),
      ...[...value].flatMap(([k, v]) => [App.cbor(k), App.cbor(v)]),
    );
  throw new Error("Unsupported CBOR value.");
};
App.der = (raw) => {
  if (raw.length !== 64) throw new Error("Unexpected ECDSA signature length.");
  const integer = (bytes) => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    let value = bytes.slice(start);
    if (value[0] & 128) value = App.concat(Uint8Array.of(0), value);
    return App.concat(Uint8Array.of(2, value.length), value);
  };
  const pair = App.concat(integer(raw.slice(0, 32)), integer(raw.slice(32)));
  return App.concat(Uint8Array.of(48, pair.length), pair);
};
