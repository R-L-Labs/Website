#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const checkoutSha = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const setupNodeSha = '820762786026740c76f36085b0efc47a31fe5020';
const approvedWorkflowKeys = new Set(['name', 'on', 'permissions', 'concurrency', 'jobs']);
const approvedJobKeys = new Set(['runs-on', 'steps']);
const approvedSteps = [
  {
    name: 'Check out repository',
    uses: `actions/checkout@${checkoutSha}`,
    with: { 'persist-credentials': false },
  },
  {
    name: 'Set up pinned Node',
    uses: `actions/setup-node@${setupNodeSha}`,
    with: { 'node-version-file': '.nvmrc' },
  },
  { name: 'Install exact dependencies', run: 'npm ci' },
  { name: 'Run tests', run: 'npm test' },
  { name: 'Build static site', run: 'npm run build' },
  { name: 'Verify routes, markers, and links', run: 'npm run check:site' },
  { name: 'Scan repository and workflow security', run: 'npm run check:security' },
  { name: 'Require zero npm advisories', run: 'npm run audit' },
];

const root = resolve(option('--root') ?? '.');
const workflowDirectory = resolve(root, '.github', 'workflows');
let workflowFiles;

try {
  workflowFiles = (await readdir(workflowDirectory))
    .filter((file) => /\.ya?ml$/.test(file))
    .sort();
} catch {
  console.error('WORKFLOW SECURITY: no workflow YAML files found');
  process.exit(1);
}

const findings = [];

function sameKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function reportUnapprovedKeys(value, allowed, describe) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push(`${describe}: unapproved ${key}`);
  }
}

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

function inspectActionReference(file, step, expected) {
  const actionMatch = /^([^@\s]+)@([0-9a-f]{40})$/.exec(step.uses ?? '');
  if (!actionMatch) {
    findings.push(`${file}: action references must use a full commit SHA`);
    return;
  }

  if (!['actions/checkout', 'actions/setup-node'].includes(actionMatch[1])) {
    findings.push(`${file}: only approved official actions are allowed`);
    return;
  }

  if (actionMatch[1] === 'actions/checkout' && actionMatch[2] !== checkoutSha) {
    findings.push(`${file}: checkout must use the approved commit`);
  }
  if (actionMatch[1] === 'actions/setup-node' && actionMatch[2] !== setupNodeSha) {
    findings.push(`${file}: setup-node must use the approved commit`);
  }

  if (step.uses !== expected.uses) {
    findings.push(`${file}: required steps must exactly match the approved order`);
  }
}

function inspectStep(file, step, expected, index) {
  const label = typeof step?.name === 'string' ? step.name : `step ${index + 1}`;
  const allowedKeys = new Set(expected.uses ? ['name', 'uses', 'with'] : ['name', 'run']);

  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    findings.push(`${file}: required steps must exactly match the approved order`);
    return;
  }

  for (const key of Object.keys(step)) {
    if (!allowedKeys.has(key)) findings.push(`${file}: ${label}: unapproved step key ${key}`);
  }

  if (step.name !== expected.name) {
    findings.push(`${file}: required steps must exactly match the approved order`);
  }

  if (expected.uses) {
    inspectActionReference(file, step, expected);
    const expectedWithKeys = new Set(Object.keys(expected.with));
    for (const key of Object.keys(step.with ?? {})) {
      if (!expectedWithKeys.has(key)) findings.push(`${file}: ${label}: unapproved with key ${key}`);
    }

    if (!sameKeys(step.with, expectedWithKeys)) {
      findings.push(`${file}: required steps must exactly match the approved order`);
    }

    if (expected.uses.startsWith('actions/checkout@')
      && step.with?.['persist-credentials'] !== false) {
      findings.push(`${file}: checkout must disable persisted credentials`);
    }
    if (expected.uses.startsWith('actions/setup-node@')
      && step.with?.['node-version-file'] !== '.nvmrc') {
      findings.push(`${file}: setup-node must use .nvmrc`);
    }

    for (const [key, value] of Object.entries(expected.with)) {
      if (step.with?.[key] !== value) {
        findings.push(`${file}: required steps must exactly match the approved order`);
      }
    }
  } else if (typeof step.run !== 'string' || step.run.trim() !== expected.run) {
    findings.push(`${file}: required steps must exactly match the approved order`);
  }
}

if (JSON.stringify(workflowFiles) !== JSON.stringify(['website-ci.yml'])) {
  findings.push('workflow files must be exactly website-ci.yml');
}

for (const file of workflowFiles) {
  const source = await readFile(resolve(workflowDirectory, file), 'utf8');
  const document = parseDocument(source, { maxAliasCount: 0 });
  if (document.errors.length > 0) {
    for (const error of document.errors) findings.push(`${file}: ${error.message}`);
    continue;
  }

  const workflow = document.toJS({ maxAliasCount: 0 });
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    findings.push(`${file}: workflow must be a YAML mapping`);
    continue;
  }

  reportUnapprovedKeys(workflow, approvedWorkflowKeys, `${file}: unapproved workflow key`);
  if (!sameKeys(workflow, approvedWorkflowKeys)) {
    findings.push(`${file}: workflow keys must match the approved CI shape`);
  }
  if (workflow.name !== 'Website CI') {
    findings.push(`${file}: workflow name must be Website CI`);
  }

  if (workflow.on && Object.hasOwn(workflow.on, 'pull_request_target')) {
    findings.push(`${file}: pull_request_target is forbidden`);
  }
  const triggerNames = Object.keys(workflow.on ?? {}).sort();
  const pushBranches = workflow.on?.push?.branches;
  if (JSON.stringify(triggerNames) !== JSON.stringify(['pull_request', 'push'])
    || workflow.on?.pull_request !== null
    || JSON.stringify(pushBranches) !== JSON.stringify(['main'])
    || !sameKeys(workflow.on?.push, new Set(['branches']))) {
    findings.push(`${file}: triggers must be pull_request and push to main`);
  }

  if (!sameKeys(workflow.concurrency, new Set(['group', 'cancel-in-progress']))
    || workflow.concurrency?.group !== 'website-ci-${{ github.workflow }}-${{ github.ref }}'
    || workflow.concurrency?.['cancel-in-progress'] !== true) {
    findings.push(`${file}: concurrency must cancel superseded runs`);
  }

  if (!sameKeys(workflow.permissions, new Set(['contents']))
    || workflow.permissions?.contents !== 'read') {
    findings.push(`${file}: permissions must be exactly contents: read`);
  }

  if (JSON.stringify(Object.keys(workflow.jobs ?? {})) !== JSON.stringify(['verify'])) {
    findings.push(`${file}: jobs must be exactly verify`);
  }

  const job = workflow.jobs?.verify;
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    findings.push(`${file}: verify job is required`);
  } else {
    for (const key of Object.keys(job)) {
      if (!approvedJobKeys.has(key)) findings.push(`${file}: verify: unapproved job key ${key}`);
    }
    if (!sameKeys(job, approvedJobKeys)) {
      findings.push(`${file}: verify job keys must match the approved CI shape`);
    }
    if (job['runs-on'] !== 'ubuntu-latest') {
      findings.push(`${file}: verify: jobs must use ubuntu-latest`);
    }

    if (!Array.isArray(job.steps) || job.steps.length !== approvedSteps.length) {
      findings.push(`${file}: required steps must exactly match the approved order`);
    }
    for (const [index, expected] of approvedSteps.entries()) {
      if (job.steps?.[index] !== undefined) inspectStep(file, job.steps[index], expected, index);
    }
  }

  inspectValue(workflow, file);
}

if (findings.length > 0) {
  for (const finding of [...new Set(findings)]) console.error(`WORKFLOW SECURITY: ${finding}`);
  process.exit(1);
}

console.log('WORKFLOW SECURITY: 1 workflow reviewed, 0 findings');
