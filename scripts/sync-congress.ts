import { syncCongress } from '../lib/government-sync';

const allowedArguments = new Set(['--dry-run']);
const invalidArguments = process.argv.slice(2).filter((argument) => !allowedArguments.has(argument));
if (invalidArguments.length > 0) {
  throw new Error(`Unknown argument(s): ${invalidArguments.join(', ')}`);
}

const result = await syncCongress({ dryRun: process.argv.includes('--dry-run') });
console.log(JSON.stringify(result, null, 2));
