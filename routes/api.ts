import { Hono } from "hono";
import { type DB } from "../db/db.ts";

export function isNamespaceValid(str: string): boolean {
  return /^[a-zA-Z0-9]{1,16}$/.test(str);
}

function notBrowser(ua: string | null): boolean {
  if (typeof ua !== "string") return true;
  if (ua.startsWith("curl")) return true;
  if (ua.startsWith("Mozilla")) return false;
  if (ua.length <= 10) return true;
  return false;
}

export function createApiRoutes(db: DB): Hono {
  const api = new Hono();

  api.get("/", (c, next) => {
    if (!notBrowser(c.req.header("user-agent") ?? null)) {
      return next();
    }
    const url = `${new URL(c.req.url).origin}/:namespace`;
    return c.text(
      `Usage:\n(replace ':namespace' with a namespace you want)\n\n` +
        `$ curl ${url}\n` +
        `$ curl ${url} -d t=any_thing_you_want_to_store\n` +
        `$ echo "any_thing_you_want_to_store" | curl ${url} -H content-type:text/plain -d @-\n`,
    );
  });

  api.get("/:namespace", async (c, next) => {
    const namespace = c.req.param("namespace");
    if (!isNamespaceValid(namespace)) {
      return next();
    }
    if (!notBrowser(c.req.header("user-agent") ?? null)) {
      return next();
    }
    const content = await db.get(namespace);
    return c.text(content + "\n");
  });

  api.post("/:namespace", async (c) => {
    const namespace = c.req.param("namespace");

    if (!isNamespaceValid(namespace)) {
      return c.text("[ShareMe]: namespace is invalid, is can only contain letters and numbers\n", 400);
    }

    const respondWithContent = async (): Promise<Response> => {
      const content = await db.get(namespace);
      return c.text(content);
    };

    const contentType = c.req.header("content-type") ?? "";
    let content = "";

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      let body: Record<string, string | File>;
      try {
        body = (await c.req.parseBody()) as Record<string, string | File>;
      } catch {
        return respondWithContent();
      }
      if (typeof body["t"] === "string") {
        content = body["t"];
      } else {
        return respondWithContent();
      }
    } else if (contentType.includes("application/json")) {
      let json: Record<string, unknown>;
      try {
        json = await c.req.json();
      } catch {
        return respondWithContent();
      }
      if (typeof json["t"] === "string") {
        content = json["t"];
      } else {
        return respondWithContent();
      }
    } else if (contentType.includes("text/plain")) {
      try {
        content = await c.req.text();
      } catch {
        return respondWithContent();
      }
    } else {
      return respondWithContent();
    }

    const ok = await db.set(namespace, content);
    return ok ? c.text("[ShareMe]: ok\n", 200) : c.text("[ShareMe]: server failed to save data\n", 500);
  });

  return api;
}

export default createApiRoutes;
