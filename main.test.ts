import { test, after } from "node:test";
import assert from "node:assert/strict";
import server from "./main.ts";

const fetch = (path: string, init?: RequestInit) => server.fetch(new Request(`http://localhost${path}`, init));

// Clean up the Bun server after all tests
after(() => {
  if ("stop" in server && typeof server.stop === "function") server.stop();
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

test("GET / with curl UA returns usage text", async () => {
  const res = await fetch("/", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Usage:/);
  assert.match(body, /curl http:\/\/localhost\/:namespace/);
});

test("GET / with browser UA returns HTML", async () => {
  const res = await fetch("/", { headers: { "user-agent": "Mozilla/5.0" } });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<!DOCTYPE html>/i);
});

// ---------------------------------------------------------------------------
// POST /:namespace — writes
// ---------------------------------------------------------------------------

test("POST /:namespace with form body stores content", async () => {
  const res = await fetch("/testns1", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "t=hello+form",
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /\[ShareMe\]: ok/);
});

test("POST /:namespace with JSON body stores content", async () => {
  const res = await fetch("/testns2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "hello json" }),
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /\[ShareMe\]: ok/);
});

test("POST /:namespace with text/plain body stores content", async () => {
  const res = await fetch("/testns3", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hello plain",
  });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /\[ShareMe\]: ok/);
});

// ---------------------------------------------------------------------------
// GET /:namespace — reads back
// ---------------------------------------------------------------------------

test("GET /:namespace with curl UA returns stored content", async () => {
  // Write first
  await fetch("/readtest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "stored value" }),
  });

  const res = await fetch("/readtest", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.equal(body, "stored value\n");
});

test("GET /:namespace with browser UA returns HTML", async () => {
  const res = await fetch("/readtest", { headers: { "user-agent": "Mozilla/5.0" } });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<!DOCTYPE html>/i);
});

test("GET /:namespace returns empty string with trailing newline when unset", async () => {
  const res = await fetch("/emptyns", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "\n");
});

// ---------------------------------------------------------------------------
// POST /:namespace — no body falls back to returning current content
// ---------------------------------------------------------------------------

test("POST /:namespace with no content-type returns current content", async () => {
  await fetch("/fallbackns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "existing" }),
  });

  const res = await fetch("/fallbackns", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "existing");
});

test("POST /:namespace with JSON body missing 't' returns current content", async () => {
  await fetch("/fallbackns2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "initial" }),
  });

  const res = await fetch("/fallbackns2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ other: "field" }),
  });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "initial");
});

// ---------------------------------------------------------------------------
// Namespace validation
// ---------------------------------------------------------------------------

test("POST with invalid namespace (too long) returns 400", async () => {
  const res = await fetch("/this-is-way-too-long-namespace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "x" }),
  });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /\[ShareMe\]: namespace is invalid/);
});

test("GET invalid namespace (has dot) falls through to static HTML", async () => {
  const res = await fetch("/style.css", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /\.red/); // CSS content
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

test("OPTIONS preflight returns correct CORS headers", async () => {
  const res = await fetch("/abc", {
    method: "OPTIONS",
    headers: {
      origin: "http://example.com",
      "access-control-request-method": "POST",
    },
  });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://example.com");
  assert.ok(res.headers.get("access-control-allow-methods")?.includes("POST"));
});

test("Regular request reflects Origin header", async () => {
  const res = await fetch("/abc", {
    headers: { "user-agent": "curl/8.0", origin: "http://mysite.com" },
  });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://mysite.com");
});

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

test("GET /index.html returns HTML", async () => {
  const res = await fetch("/index.html", { headers: { "user-agent": "Mozilla/5.0" } });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<!DOCTYPE html>/i);
});

test("GET unknown path returns index.html (SPA fallback)", async () => {
  const res = await fetch("/some/unknown/path", { headers: { "user-agent": "Mozilla/5.0" } });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<!DOCTYPE html>/i);
});
