import Dexie from "dexie";
import type { OfflineReport } from "@/types";
class SpeakUpDB extends Dexie {
    reports!: Dexie.Table<OfflineReport, number>;
    constructor() {
        super("SpeakUpPayatas");
        this.version(1).stores({
            reports: "++offline_id, reporter_hash, category, is_synced, created_at",
        });
    }
}
export const db = new SpeakUpDB();
