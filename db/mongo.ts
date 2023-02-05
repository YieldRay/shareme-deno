import { MongoClient, ObjectId } from 'mongo';
import { type DB } from './db.ts';

export async function mongodb(
	srv: string,
	dbName: string,
	collectionName: string,
): Promise<DB> {
	const client = new MongoClient();
	await client.connect(srv);

	const db = client.database(dbName);
	const collection = db.collection<{
		_id: ObjectId;
		namespace: string;
		data: string;
	}>(collectionName);

	return {
		async get(namespace) {
			const result = await collection.findOne({ namespace });
			return result?.data || '';
		},
		async set(namespace, data) {
			const result = await collection.updateOne({ namespace }, {
				$set: { data },
			}, { upsert: true });
			return Boolean(
				result.matchedCount || result.modifiedCount ||
					result.upsertedCount,
			);
		},
	};
}
