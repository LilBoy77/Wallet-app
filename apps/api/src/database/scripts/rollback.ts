import { migrateDown } from '../migrator.js';

async function main() {
  try {
    const isAll = process.argv.includes('--all');
    const rolledBack = await migrateDown({ all: isAll, steps: isAll ? undefined : 1 });
    console.log(
      `\n[DB:ROLLBACK] Completed successfully. Reverted ${rolledBack.length} migration(s).`
    );
    process.exit(0);
  } catch (error) {
    console.error('\n[DB:ROLLBACK_ERROR]', error);
    process.exit(1);
  }
}

main();
