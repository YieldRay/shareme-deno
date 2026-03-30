import process from "node:process";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { type DB } from "./db/db.ts";
import { mongodb } from "./db/mongo.ts";
import { tmp } from "./db/tmp.ts";
import { createApiRoutes } from "./routes/api.ts";
import { createStaticRoutes } from "./routes/static.ts";

const MONGODB_URI = process.env.MONGODB_URI ?? "";
const MONGO_DB = process.env.MONGODB_NAME ?? "";
const MONGO_COLL = process.env.MONGODB_COLLECTION ?? "";

let db: DB;
if (MONGODB_URI && MONGO_DB && MONGO_COLL) {
  console.log("Using MongoDB");
  db = await mongodb(MONGODB_URI, MONGO_DB, MONGO_COLL);
} else {
  console.log("Using TMP Cache");
  db = await tmp();
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
    allowHeaders: ["*"],
  }),
);

app.route("/", createApiRoutes(db));
app.route("/", createStaticRoutes());

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
console.log(`Server listening at http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
