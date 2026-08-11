import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const checkoutSha = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const setupNodeSha = '820762786026740c76f36085b0efc47a31fe5020';

function secureWorkflow() {
  return `name: Website CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: website-ci-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${checkoutSha}
        with:
          persist-credentials: false
      - uses: actions/setup-node@${setupNodeSha}
        with:
          node-version-file: .nvmrc
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run check:site
      - run: npm run check:security
      - run: npm run audit
`;
}

async function createWorkflowRoot(source) {
  const root = await mkdtemp(join(tmpdir(), 'afterlight-workflow-security-'));
  const workflows = join(root, '.github', 'workflows');
  await mkdir(workflows, { recursive: true });
  await writeFile(join(workflows, 'website-ci.yml'), source);
  return root;
}

function runWorkflowCheck(root) {
  return spawnSync(process.execPath, [
    'tools/check-workflows.mjs',
    '--root', root,
  ], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
}

test('accepts parsed least-privilege website CI', async () => {
  const root = await createWorkflowRoot(secureWorkflow());
  const result = runWorkflowCheck(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WORKFLOW SECURITY: 1 workflow reviewed, 0 findings/);
});

test('rejects externally triggerable code and credential exposure paths', async (context) => {
  const expression = '${' + '{ github.event.pull_request.title }}';
  const secretExpression = '${' + '{ secrets.DEPLOY_TOKEN }}';
  const cases = [
    {
      name: 'pull_request_target',
      source: secureWorkflow().replace('pull_request:', 'pull_request_target:'),
      finding: /pull_request_target is forbidden/,
    },
    {
      name: 'expression injection',
      source: secureWorkflow().replace('run: npm test', `run: echo "${expression}"`),
      finding: /expression interpolation in run is forbidden/,
    },
    {
      name: 'secret exposure',
      source: secureWorkflow().replace('jobs:', `env:\n  DEPLOY_TOKEN: ${secretExpression}\n\njobs:`),
      finding: /secret references are forbidden/,
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, async () => {
      const root = await createWorkflowRoot(fixture.source);
      const result = runWorkflowCheck(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, fixture.finding);
    });
  }
});

test('rejects privilege and supply-chain expansion', async (context) => {
  const cases = [
    {
      name: 'write permission',
      source: secureWorkflow().replace('contents: read', 'contents: write'),
      finding: /permissions must be exactly contents: read/,
    },
    {
      name: 'mutable action reference',
      source: secureWorkflow().replace(checkoutSha, 'v7'),
      finding: /action references must use a full commit SHA/,
    },
    {
      name: 'third-party action',
      source: secureWorkflow().replace(`actions/setup-node@${setupNodeSha}`, `example/setup-node@${setupNodeSha}`),
      finding: /only approved official actions are allowed/,
    },
    {
      name: 'job-level permission escalation',
      source: secureWorkflow().replace('runs-on: ubuntu-latest', 'permissions:\n      contents: write\n    runs-on: ubuntu-latest'),
      finding: /job-level permissions are forbidden/,
    },
    {
      name: 'self-hosted runner',
      source: secureWorkflow().replace('ubuntu-latest', 'self-hosted'),
      finding: /jobs must use ubuntu-latest/,
    },
    {
      name: 'persisted checkout credentials',
      source: secureWorkflow().replace('persist-credentials: false', 'persist-credentials: true'),
      finding: /checkout must disable persisted credentials/,
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, async () => {
      const root = await createWorkflowRoot(fixture.source);
      const result = runWorkflowCheck(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, fixture.finding);
    });
  }
});

test('rejects CI integrity and deployment drift', async (context) => {
  const cases = [
    {
      name: 'missing pull request trigger',
      source: secureWorkflow().replace('  pull_request:\n', ''),
      finding: /triggers must be pull_request and push to main/,
    },
    {
      name: 'push to non-main branch',
      source: secureWorkflow().replace('branches: [main]', 'branches: [dev]'),
      finding: /triggers must be pull_request and push to main/,
    },
    {
      name: 'disabled concurrency cancellation',
      source: secureWorkflow().replace('cancel-in-progress: true', 'cancel-in-progress: false'),
      finding: /concurrency must cancel superseded runs/,
    },
    {
      name: 'dependency cache',
      source: secureWorkflow().replace('node-version-file: .nvmrc', 'node-version-file: .nvmrc\n          cache: npm'),
      finding: /dependency caches are forbidden/,
    },
    {
      name: 'missing audit gate',
      source: secureWorkflow().replace('      - run: npm run audit\n', ''),
      finding: /run steps must exactly match the approved verification commands/,
    },
    {
      name: 'deploy command',
      source: secureWorkflow().replace('      - run: npm run audit', '      - run: npm run audit\n      - run: npm run deploy'),
      finding: /run steps must exactly match the approved verification commands/,
    },
    {
      name: 'deployment environment',
      source: secureWorkflow().replace('runs-on: ubuntu-latest', 'runs-on: ubuntu-latest\n    environment: production'),
      finding: /deployment environments are forbidden/,
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, async () => {
      const root = await createWorkflowRoot(fixture.source);
      const result = runWorkflowCheck(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, fixture.finding);
    });
  }
});
