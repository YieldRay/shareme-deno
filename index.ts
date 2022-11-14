import { Application } from "./deps.ts";
import { type DB } from "./db/db.ts";
import { mongodb } from "./db/mongo.ts";
import { tmp } from "./db/tmp.ts";
import "https://deno.land/x/dotenv@v3.2.0/load.ts";

//? Config database
const MONGO_SRV = Deno.env.get("MONGO_DB_URI") || "";
const MONGO_DB = Deno.env.get("MONGO_DB_NAME") || "";
const MONGO_COLL = Deno.env.get("MONGO_DB_COLLECTION") || "";
let db: DB;
if (MONGO_SRV && MONGO_DB && MONGO_COLL) {
    console.log("Using MongoDB");
    db = await mongodb(MONGO_SRV, MONGO_DB, MONGO_COLL);
} else {
    console.log("Using TMP Cache");
    db = await tmp();
}
export { db };

//? Start HTTP server
const app = new Application();

import apiRouter from "./routes/api.ts";
app.use(apiRouter.routes());

import staticRouter from "./routes/static.ts";
app.use(staticRouter.routes());

const PORT = Deno.env.get("PORT") ? Number(Deno.env.get("PORT")) : 8080;
console.log(`Server listen at http://localhost:${PORT}`);
await app.listen({ port: PORT });
