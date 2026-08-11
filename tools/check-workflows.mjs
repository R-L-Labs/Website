#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const root = resolve(option('--root') ?? '.');
const workflowDirectory = resolve(root, '.github', 'workflows');
const workflowFiles = (await readdir(workflowDirectory))
  .filter((file) => /\.ya?ml$/.test(file))
  .sort();
const findings = [];
const approvedActions = new Set(['actions/checkout', 'actions/setup-node']);
const approvedRunCommands = [
  'npm ci',
  'npm test',
  'npm run build',
  'npm run check:site',
  'npm run check:security',
  'npm run audit',
];

function inspectValue(value, file, key = '') {
  if (typeof value === 'string') {
    if (/\$\{\{\s*secrets\./.test(value)) {
      findings.push(`${file}: secret references are forbidden`);
    }
    if (key === 'run' && value.includes('${{')) {
      findings.push(`${file}: expression interpolation in run is forbidden`);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) inspectValue(entry, file, key);
    return;
  }

  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      inspectValue(childValue, file, childKey);
    }
  }
}

if (workflowFiles.length === 0) {
  console.error('WORKFLOW SECURITY: no workflow YAML files found');
  process.exit(1);
}

for (const file of workflowFiles) {
  const source = await readFile(resolve(workflowDirectory, file), 'utf8');
  const document = parseDocument(source, { maxAliasCount: 0 });
  if (document.errors.length > 0) {
    for (const error of document.errors) console.error(`WORKFLOW SECURITY: ${file}: ${error.message}`);
    process.exit(1);
  }
  const workflow = document.toJS({ maxAliasCount: 0 });
  if (workflow.on && Object.hasOwn(workflow.on, 'pull_request_target')) {
    findings.push(`${file}: pull_request_target is forbidden`);
  }

  const triggerNames = Object.keys(workflow.on ?? {}).sort();
  const pushBranches = workflow.on?.push?.branches;
  if (JSON.stringify(triggerNames) !== JSON.stringify(['pull_request', 'push'])
    || JSON.stringify(pushBranches) !== JSON.stringify(['main'])) {
    findings.push(`${file}: triggers must be pull_request and push to main`);
  }

  if (workflow.concurrency?.group !== 'website-ci-${{ github.workflow }}-${{ github.ref }}'
    || workflow.concurrency?.['cancel-in-progress'] !== true) {
    findings.push(`${file}: concurrency must cancel superseded runs`);
  }

  const permissionEntries = Object.entries(workflow.permissions ?? {});
  if (permissionEntries.length !== 1 || permissionEntries[0][0] !== 'contents' || permissionEntries[0][1] !== 'read') {
    findings.push(`${file}: permissions must be exactly contents: read`);
  }

  const runCommands = [];
  const actionNames = [];
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    if (Object.hasOwn(job, 'permissions')) {
      findings.push(`${file}: ${jobName}: job-level permissions are forbidden`);
    }
    if (job['runs-on'] !== 'ubuntu-latest') {
      findings.push(`${file}: ${jobName}: jobs must use ubuntu-latest`);
    }
    if (Object.hasOwn(job, 'environment')) {
      findings.push(`${file}: ${jobName}: deployment environments are forbidden`);
    }

    for (const step of job.steps ?? []) {
      if (step.run) runCommands.push(step.run.trim());
      if (!step.uses) continue;
      const actionMatch = /^([^@\s]+)@([0-9a-f]{40})$/.exec(step.uses);
      if (!actionMatch) {
        findings.push(`${file}: action references must use a full commit SHA`);
        continue;
      }
      if (!approvedActions.has(actionMatch[1])) {
        findings.push(`${file}: only approved official actions are allowed`);
      }
      actionNames.push(actionMatch[1]);
      if (actionMatch[1] === 'actions/checkout' && step.with?.['persist-credentials'] !== false) {
        findings.push(`${file}: checkout must disable persisted credentials`);
      }
      if (actionMatch[1] === 'actions/setup-node') {
        if (step.with?.['node-version-file'] !== '.nvmrc') {
          findings.push(`${file}: setup-node must use .nvmrc`);
        }
        if (Object.hasOwn(step.with ?? {}, 'cache')) {
          findings.push(`${file}: dependency caches are forbidden`);
        }
      }
    }
  }
  if (JSON.stringify(runCommands) !== JSON.stringify(approvedRunCommands)) {
    findings.push(`${file}: run steps must exactly match the approved verification commands`);
  }
  if (JSON.stringify(actionNames) !== JSON.stringify(['actions/checkout', 'actions/setup-node'])) {
    findings.push(`${file}: action steps must exactly match checkout and setup-node`);
  }
  inspectValue(workflow, file);
}

if (findings.length > 0) {
  for (const finding of findings) console.error(`WORKFLOW SECURITY: ${finding}`);
  process.exit(1);
}

console.log(`WORKFLOW SECURITY: ${workflowFiles.length} workflow${workflowFiles.length === 1 ? '' : 's'} reviewed, 0 findings`);
