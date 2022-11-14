import { type DB } from "./db.ts";

export async function tmp(): Promise<DB> {
    const m = new Map<string, string>();
    return {
        async get(namespace) {
            return m.get(namespace) || "";
        },
        async set(namespace, data) {
            m.set(namespace, data);
            return true;
        },
    };
}
