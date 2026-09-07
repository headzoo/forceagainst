import { syncLegiScanStateBills } from '../lib/legiscan-sync';

const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');

function parseSyncStateBillsArguments() {
  let dryRun = false;
  let state: string | undefined;
  let detailBudget: number | undefined;
  const seen = new Set<string>();

  for (const argument of arguments_) {
    if (argument === '--dry-run') {
      if (seen.has('--dry-run')) throw new Error('Duplicate flag: --dry-run');
      seen.add('--dry-run');
      dryRun = true;
      continue;
    }

    if (argument.startsWith('--state=')) {
      if (seen.has('--state')) throw new Error('Duplicate flag: --state');
      seen.add('--state');
      const value = argument.slice('--state='.length).trim();
      if (!value) {
        throw new Error('--state requires a two-letter code or canonical slug.');
      }
      state = value;
      continue;
    }

    if (argument.startsWith('--detail-budget=')) {
      if (seen.has('--detail-budget')) throw new Error('Duplicate flag: --detail-budget');
      seen.add('--detail-budget');
      const raw = argument.slice('--detail-budget='.length);
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000) {
        throw new Error('--detail-budget must be a whole number between 0 and 10000.');
      }
      detailBudget = parsed;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return { dryRun, state, detailBudget };
}

try {
  const options = parseSyncStateBillsArguments();
  const result = await syncLegiScanStateBills({
    dryRun: options.dryRun,
    state: options.state,
    detailBudget: options.detailBudget,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.failedScopes.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'State bill sync failed.');
  process.exitCode = 1;
}
