import { getMigrationStatus } from '../migrator.js';

async function main() {
  try {
    const statuses = await getMigrationStatus();
    console.log('\n=========================================');
    console.log(' DATABASE MIGRATION STATUS');
    console.log('=========================================');
    for (const s of statuses) {
      const state = s.applied ? 'APPLIED ✓' : 'PENDING ⏳';
      const time = s.appliedAt ? ` (at ${s.appliedAt.toISOString()})` : '';
      console.log(`[${state}] ${s.name}${time}`);
    }
    console.log('=========================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n[DB:STATUS_ERROR]', error);
    process.exit(1);
  }
}

main();
