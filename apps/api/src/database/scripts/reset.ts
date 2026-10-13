import { migrateDown, migrateUp } from '../migrator.js';
import { runSeeder, assertEnvironmentSafety } from '../seeder.js';

async function main() {
  try {
    console.log('[DB:RESET] Verifying environment safety before reset...');
    assertEnvironmentSafety();

    console.log('\n[DB:RESET] Step 1: Rolling back all migrations...');
    await migrateDown({ all: true });

    console.log('\n[DB:RESET] Step 2: Running all migrations UP...');
    await migrateUp();

    console.log('\n[DB:RESET] Step 3: Running seeder...');
    await runSeeder();

    console.log('\n[DB:RESET] Database reset and seed completed successfully ✓\n');
    process.exit(0);
  } catch (error) {
    console.error('\n[DB:RESET_ERROR]', error);
    process.exit(1);
  }
}

main();
