import { syncCongressBills } from '../lib/congress-bill-sync';

const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
const seen = new Set<string>();

for (const argument of arguments_) {
  if (argument === '--dry-run') {
    if (seen.has('--dry-run')) throw new Error('Duplicate flag: --dry-run');
    seen.add('--dry-run');
    continue;
  }

  throw new Error(`Unknown argument: ${argument}`);
}

try {
  const result = await syncCongressBills({ dryRun: seen.has('--dry-run') });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Federal bill sync failed.');
  process.exitCode = 1;
}
