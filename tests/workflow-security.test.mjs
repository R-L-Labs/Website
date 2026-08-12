import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { parse, stringify } from 'yaml';

const checkoutSha = '3d3c42e5aac5ba805825da76410c181273ba90b1';
const setupNodeSha = '820762786026740c76f36085b0efc47a31fe5020';

function secureWorkflow() {
  return stringify({
    name: 'Website CI',
    on: {
      pull_request: null,
      push: { branches: ['main'] },
    },
    permissions: { contents: 'read' },
    concurrency: {
      group: 'website-ci-${{ github.workflow }}-${{ github.ref }}',
      'cancel-in-progress': true,
    },
    jobs: {
      verify: {
        'runs-on': 'ubuntu-latest',
        steps: [
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
        ],
      },
    },
  }, { lineWidth: 0 });
}

function mutateWorkflow(mutator) {
  const workflow = parse(secureWorkflow());
  mutator(workflow);
  return stringify(workflow, { lineWidth: 0 });
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

async function assertRejected(fixture) {
  const root = await createWorkflowRoot(fixture.source);
  const result = runWorkflowCheck(root);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, fixture.finding);
}

test('accepts parsed least-privilege website CI', async () => {
  const root = await createWorkflowRoot(secureWorkflow());
  const result = runWorkflowCheck(root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WORKFLOW SECURITY: 1 workflow reviewed, 0 findings/);
});

test('rejects additional workflow files outside the one approved CI shape', async () => {
  const root = await createWorkflowRoot(secureWorkflow());
  await writeFile(join(root, '.github', 'workflows', 'shadow.yml'), secureWorkflow());
  const result = runWorkflowCheck(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /workflow files must be exactly website-ci\.yml/);
});

test('rejects externally triggerable code and credential exposure paths', async (context) => {
  const cases = [
    {
      name: 'pull_request_target',
      source: mutateWorkflow((workflow) => {
        workflow.on.pull_request_target = workflow.on.pull_request;
        delete workflow.on.pull_request;
      }),
      finding: /pull_request_target is forbidden/,
    },
    {
      name: 'expression injection',
      source: mutateWorkflow((workflow) => {
        workflow.jobs.verify.steps[3].run = 'echo "${{ github.event.pull_request.title }}"';
      }),
      finding: /expression interpolation in run is forbidden/,
    },
    {
      name: 'secret exposure',
      source: mutateWorkflow((workflow) => {
        workflow.env = { DEPLOY_TOKEN: '${{ secrets.DEPLOY_TOKEN }}' };
      }),
      finding: /secret references are forbidden/,
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, () => assertRejected(fixture));
  }
});

test('rejects privilege and supply-chain expansion', async (context) => {
  const cases = [
    {
      name: 'write permission',
      source: mutateWorkflow((workflow) => { workflow.permissions.contents = 'write'; }),
      finding: /permissions must be exactly contents: read/,
    },
    {
      name: 'mutable action reference',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[0].uses = 'actions/checkout@v7'; }),
      finding: /action references must use a full commit SHA/,
    },
    {
      name: 'unapproved checkout commit',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[0].uses = `actions/checkout@${'0'.repeat(40)}`; }),
      finding: /checkout must use the approved commit/,
    },
    {
      name: 'third-party action',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[1].uses = `example/setup-node@${setupNodeSha}`; }),
      finding: /only approved official actions are allowed/,
    },
    {
      name: 'job-level permission escalation',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.permissions = { contents: 'write' }; }),
      finding: /unapproved job key permissions/,
    },
    {
      name: 'self-hosted runner',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify['runs-on'] = 'self-hosted'; }),
      finding: /jobs must use ubuntu-latest/,
    },
    {
      name: 'persisted checkout credentials',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[0].with['persist-credentials'] = true; }),
      finding: /checkout must disable persisted credentials/,
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, () => assertRejected(fixture));
  }
});

test('rejects CI integrity and deployment drift', async (context) => {
  const cases = [
    {
      name: 'missing pull request trigger',
      source: mutateWorkflow((workflow) => { delete workflow.on.pull_request; }),
      finding: /triggers must be pull_request and push to main/,
    },
    {
      name: 'push to non-main branch',
      source: mutateWorkflow((workflow) => { workflow.on.push.branches = ['dev']; }),
      finding: /triggers must be pull_request and push to main/,
    },
    {
      name: 'disabled concurrency cancellation',
      source: mutateWorkflow((workflow) => { workflow.concurrency['cancel-in-progress'] = false; }),
      finding: /concurrency must cancel superseded runs/,
    },
    {
      name: 'dependency cache',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[1].with.cache = 'npm'; }),
      finding: /unapproved with key cache/,
    },
    {
      name: 'missing audit gate',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps.pop(); }),
      finding: /required steps must exactly match the approved order/,
    },
    {
      name: 'deploy command',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps.push({ name: 'Deploy', run: 'npm run deploy' }); }),
      finding: /required steps must exactly match the approved order/,
    },
    {
      name: 'deployment environment',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.environment = 'production'; }),
      finding: /unapproved job key environment/,
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, () => assertRejected(fixture));
  }
});

test('rejects semantic bypasses on required jobs and gates', async (context) => {
  const cases = [
    {
      name: 'job condition',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.if = false; }),
      finding: /unapproved job key if/,
    },
    {
      name: 'step condition',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[3].if = false; }),
      finding: /Run tests: unapproved step key if/,
    },
    {
      name: 'step failure suppression',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[3]['continue-on-error'] = true; }),
      finding: /Run tests: unapproved step key continue-on-error/,
    },
    {
      name: 'job failure suppression',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify['continue-on-error'] = true; }),
      finding: /unapproved job key continue-on-error/,
    },
    {
      name: 'step timeout bypass',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[4]['timeout-minutes'] = 1; }),
      finding: /Build static site: unapproved step key timeout-minutes/,
    },
    {
      name: 'job timeout bypass',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify['timeout-minutes'] = 1; }),
      finding: /unapproved job key timeout-minutes/,
    },
    {
      name: 'service addition',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.services = { database: { image: 'postgres' } }; }),
      finding: /unapproved job key services/,
    },
    {
      name: 'checkout ref override',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[0].with.ref = 'main'; }),
      finding: /Check out repository: unapproved with key ref/,
    },
    {
      name: 'checkout token override',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[0].with.token = 'not-a-secret'; }),
      finding: /Check out repository: unapproved with key token/,
    },
    {
      name: 'reordered gates',
      source: mutateWorkflow((workflow) => {
        [workflow.jobs.verify.steps[3], workflow.jobs.verify.steps[4]] = [workflow.jobs.verify.steps[4], workflow.jobs.verify.steps[3]];
      }),
      finding: /required steps must exactly match the approved order/,
    },
    {
      name: 'duplicated gate',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps.splice(4, 0, { ...workflow.jobs.verify.steps[3] }); }),
      finding: /required steps must exactly match the approved order/,
    },
    {
      name: 'shadowed gate command',
      source: mutateWorkflow((workflow) => { workflow.jobs.verify.steps[3].run = 'npm test || true'; }),
      finding: /required steps must exactly match the approved order/,
    },
    {
      name: 'extra job',
      source: mutateWorkflow((workflow) => { workflow.jobs.shadow = structuredClone(workflow.jobs.verify); }),
      finding: /jobs must be exactly verify/,
    },
  ];

  for (const fixture of cases) {
    await context.test(fixture.name, () => assertRejected(fixture));
  }
});
