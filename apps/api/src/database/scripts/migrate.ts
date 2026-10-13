import { migrateUp } from '../migrator.js';

async function main() {
  try {
    const applied = await migrateUp();
    console.log(`\n[DB:MIGRATE] Completed successfully. Applied ${applied.length} migration(s).`);
    process.exit(0);
  } catch (error) {
    console.error('\n[DB:MIGRATE_ERROR]', error);
    process.exit(1);
  }
}

main();
