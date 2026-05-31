import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../../env.js";
import { logger } from "../lib/logger.js";

export async function runMigrations() {
  const journalPath = "./src/db/migrations/meta/_journal.json";

  if (!existsSync(journalPath)) {
    logger.warn("⏭️  No migration journal found — skipping migrations.");
    return;
  }

  logger.info("⏳ Starting the database migration...");

  // For the migrations themselves, we only need ONE connection (max: 1)
  const migrationClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    // Specify the folder where drizzle-kit saved the .sql files
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    logger.info("✅ Migrations completed successfully!");
  } catch (error) {
    logger.error("❌ Migration failed:", { error: String(error) });
    process.exit(1); // If migrations fail, the container must restart
  } finally {
    await migrationClient.end();
  }
}
