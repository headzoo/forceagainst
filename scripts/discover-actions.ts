import { discoverNewActions } from '../lib/action-discovery';

const arguments_ = process.argv.slice(2);

function option(name: string) {
  const prefix = `--${name}=`;
  return arguments_.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const maxValue = option('max');
const maxNewActionsPerIssue = maxValue === undefined ? undefined : Number(maxValue);
const positionalIssues = arguments_.filter((argument) => !argument.startsWith('-'));
const optionIssue = option('issue');

if (positionalIssues.length > 1) {
  throw new Error('Provide at most one issue slug, such as: pnpm actions:discover lgbtq');
}

if (optionIssue && positionalIssues[0] && optionIssue !== positionalIssues[0]) {
  throw new Error('Provide the issue either positionally or with --issue=<slug>, not both.');
}

if (maxNewActionsPerIssue !== undefined && (!Number.isSafeInteger(maxNewActionsPerIssue) || maxNewActionsPerIssue < 1 || maxNewActionsPerIssue > 10)) {
  throw new Error('--max must be a whole number between 1 and 10.');
}

const result = await discoverNewActions({
  dryRun: arguments_.includes('--dry-run'),
  issueSlug: optionIssue ?? positionalIssues[0],
  maxNewActionsPerIssue,
});

console.log(JSON.stringify(result, null, 2));

if (result.errors.length > 0) process.exitCode = 1;
