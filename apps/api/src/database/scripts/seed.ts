import { runSeeder } from '../seeder.js';

async function main() {
  try {
    const summary = await runSeeder();
    console.log('\n=========================================');
    console.log(' DATABASE SEEDING SUMMARY');
    console.log('=========================================');
    for (const [key, val] of Object.entries(summary)) {
      console.log(`  - ${key}: ${val} rows`);
    }
    console.log('=========================================');
    console.log('STATUS: SEEDING SUCCESSFUL ✓\n');
    process.exit(0);
  } catch (error) {
    console.error('\n[DB:SEED_ERROR]', error);
    process.exit(1);
  }
}

main();
