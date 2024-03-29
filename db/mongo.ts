import { MongoClient, ServerApiVersion, type ObjectId } from "mongodb";
import { type DB } from "./db.ts";

export async function mongodb(uri: string, dbName: string, collectionName: string): Promise<DB> {
    const client = new MongoClient(
        uri,
        //@ts-ignore
        {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            },
        }
    );
    await client.connect();

    const db = client.db(dbName);
    const collection = db.collection<{
        _id: ObjectId;
        namespace: string;
        data: string;
    }>(collectionName);

    return {
        async get(namespace) {
            const result = await collection.findOne({ namespace });
            return result?.data || "";
        },
        async set(namespace, data) {
            const result = await collection.updateOne(
                { namespace },
                {
                    $set: { data },
                },
                { upsert: true }
            );
            return Boolean(result.matchedCount || result.modifiedCount || result.upsertedCount);
        },
    };
}
