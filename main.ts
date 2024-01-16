import { Application } from "oak";
import { type DB } from "./db/db.ts";
import { mongodb } from "./db/mongo.ts";
import { tmp } from "./db/tmp.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";

//? Config database
const MONGODB_URI = Deno.env.get("MONGODB_URI") ?? "";
const MONGO_DB = Deno.env.get("MONGODB_NAME") ?? "";
const MONGO_COLL = Deno.env.get("MONGODB_COLLECTION") ?? "";
let db: DB;
if (MONGODB_URI && MONGO_DB && MONGO_COLL) {
    console.log("Using MongoDB");
    db = await mongodb(MONGODB_URI, MONGO_DB, MONGO_COLL);
} else {
    console.log("Using TMP Cache");
    db = await tmp();
}
export { db };

//? Start HTTP server
const app = new Application();

app.use(async (ctx, next) => {
    // Enable CORS
    if (ctx.request.headers.has("origin")) {
        ctx.response.headers.set("access-control-allow-origin", ctx.request.headers.get("origin")!);
        ctx.response.headers.set("access-control-allow-methods", "*");
        ctx.response.headers.set("access-control-allow-headers", "*");
    }
    if (ctx.request.method === "OPTIONS") {
        ctx.response.status = 200;
        ctx.response.body = null;
        return;
    }
    await next();
});

import apiRouter from "./routes/api.ts";
app.use(apiRouter.routes());

import staticRouter from "./routes/static.ts";
app.use(staticRouter.routes());

const PORT = Deno.env.get("PORT") ? Number(Deno.env.get("PORT")) : 8080;
console.log(`Server listen at http://localhost:${PORT}`);
await app.listen({ port: PORT });
