import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Buffer } from "node:buffer";
import app from "./main.ts";

// ---------------------------------------------------------------------------
// Minimal HTTP server around Hono's fetch handler
// ---------------------------------------------------------------------------

let server: http.Server;
let base: string;

before(
  () =>
    new Promise<void>((resolve) => {
      server = http.createServer(async (req, res) => {
        const url = `http://localhost${req.url}`;
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === "string") headers.set(k, v);
          else if (Array.isArray(v)) v.forEach((s) => headers.append(k, s));
        }
        const body =
          req.method === "GET" || req.method === "HEAD"
            ? undefined
            : await new Promise<Buffer>((r) => {
                const chunks: Buffer[] = [];
                req.on("data", (c) => chunks.push(c));
                req.on("end", () => r(Buffer.concat(chunks)));
              });

        const honoRes = await app.fetch(
          //@ts-ignore - Deno's Request type is slightly different, but close enough for testing
          new Request(url, { method: req.method, headers, body: body?.length ? body : undefined }),
        );

        res.statusCode = honoRes.status;
        honoRes.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await honoRes.arrayBuffer()));
      });

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        base = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    }),
);

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function req(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: http.IncomingMessage["headers"]; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method ?? "GET",
      headers: options.headers,
    };
    const r = http.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }),
      );
    });
    r.on("error", reject);
    if (options.body) r.write(options.body);
    r.end();
  });
}

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

test("GET / with curl UA returns usage text", async () => {
  const res = await req("/", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  assert.match(res.body, /Usage:/);
  assert.match(res.body, /curl.*\/:namespace/);
});

test("GET / with browser UA returns HTML", async () => {
  const res = await req("/", { headers: { "user-agent": "Mozilla/5.0" } });
  assert.equal(res.status, 200);
  assert.match(res.body, /<!DOCTYPE html>/i);
});

// ---------------------------------------------------------------------------
// POST /:namespace — writes
// ---------------------------------------------------------------------------

test("POST /:namespace with form body stores content", async () => {
  const res = await req("/testns1", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "t=hello+form",
  });
  assert.equal(res.status, 200);
  assert.match(res.body, /\[ShareMe\]: ok/);
});

test("POST /:namespace with JSON body stores content", async () => {
  const res = await req("/testns2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "hello json" }),
  });
  assert.equal(res.status, 200);
  assert.match(res.body, /\[ShareMe\]: ok/);
});

test("POST /:namespace with text/plain body stores content", async () => {
  const res = await req("/testns3", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hello plain",
  });
  assert.equal(res.status, 200);
  assert.match(res.body, /\[ShareMe\]: ok/);
});

// ---------------------------------------------------------------------------
// GET /:namespace — reads back
// ---------------------------------------------------------------------------

test("GET /:namespace with curl UA returns stored content", async () => {
  await req("/readtest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "stored value" }),
  });

  const res = await req("/readtest", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  assert.equal(res.body, "stored value\n");
});

test("GET /:namespace with browser UA returns HTML", async () => {
  const res = await req("/readtest", { headers: { "user-agent": "Mozilla/5.0" } });
  assert.equal(res.status, 200);
  assert.match(res.body, /<!DOCTYPE html>/i);
});

test("GET /:namespace returns trailing newline when unset", async () => {
  const res = await req("/emptyns", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  assert.equal(res.body, "\n");
});

// ---------------------------------------------------------------------------
// POST /:namespace — fallback to current content
// ---------------------------------------------------------------------------

test("POST /:namespace with no content-type returns current content", async () => {
  await req("/fallbackns", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "existing" }),
  });

  const res = await req("/fallbackns", { method: "POST" });
  assert.equal(res.status, 200);
  assert.equal(res.body, "existing");
});

test("POST /:namespace with JSON missing 't' returns current content", async () => {
  await req("/fallbackns2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "initial" }),
  });

  const res = await req("/fallbackns2", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ other: "field" }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body, "initial");
});

// ---------------------------------------------------------------------------
// Namespace validation
// ---------------------------------------------------------------------------

test("POST with invalid namespace returns 400", async () => {
  const res = await req("/this-is-way-too-long-namespace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ t: "x" }),
  });
  assert.equal(res.status, 400);
  assert.match(res.body, /\[ShareMe\]: namespace is invalid/);
});

test("GET invalid namespace (has dot) falls through to static CSS", async () => {
  const res = await req("/style.css", { headers: { "user-agent": "curl/8.0" } });
  assert.equal(res.status, 200);
  assert.match(res.body, /\.red/);
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

test("OPTIONS preflight returns correct CORS headers", async () => {
  const res = await req("/abc", {
    method: "OPTIONS",
    headers: {
      origin: "http://example.com",
      "access-control-request-method": "POST",
    },
  });
  assert.equal(res.headers["access-control-allow-origin"], "http://example.com");
  assert.ok((res.headers["access-control-allow-methods"] as string).includes("POST"));
});

test("Regular request reflects Origin header", async () => {
  const res = await req("/abc", {
    headers: { "user-agent": "curl/8.0", origin: "http://mysite.com" },
  });
  assert.equal(res.headers["access-control-allow-origin"], "http://mysite.com");
});

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

test("GET /index.html returns HTML", async () => {
  const res = await req("/index.html");
  assert.equal(res.status, 200);
  assert.match(res.body, /<!DOCTYPE html>/i);
});

test("GET unknown path returns index.html (SPA fallback)", async () => {
  const res = await req("/some/unknown/path");
  assert.equal(res.status, 200);
  assert.match(res.body, /<!DOCTYPE html>/i);
});
