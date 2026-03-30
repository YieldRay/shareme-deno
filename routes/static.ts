import { Hono } from "hono";
import { serveStatic } from "hono/bun";

export function createStaticRoutes(): Hono {
  const staticApp = new Hono();

  staticApp.use("*", serveStatic({ root: "./public" }));
  staticApp.get("*", serveStatic({ path: "./public/index.html" }));

  return staticApp;
}

export default createStaticRoutes;
