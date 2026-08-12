#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'smol-toml';

const REQUIRED_NODE_VERSION = '22.17.1';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function read(root, file) {
  return readFile(resolve(root, file), 'utf8');
}

const root = resolve(option('--root') ?? '.');
const failures = [];
const packageJson = JSON.parse(await read(root, 'package.json'));
const netlify = parse(await read(root, 'netlify.toml'));
const nvmVersion = (await read(root, '.nvmrc')).trim();
const nodeVersion = (await read(root, '.node-version')).trim();
const npmrc = (await read(root, '.npmrc')).split(/\r?\n/).map((line) => line.trim());

for (const [location, value] of [
  ['package.json engines.node', packageJson.engines?.node],
  ['.nvmrc', nvmVersion],
  ['.node-version', nodeVersion],
  ['netlify.toml build.environment.NODE_VERSION', netlify.build?.environment?.NODE_VERSION],
]) {
  if (value !== REQUIRED_NODE_VERSION) {
    failures.push(`${location} must equal ${REQUIRED_NODE_VERSION}`);
  }
}

if (!npmrc.includes('engine-strict=true')) {
  failures.push('.npmrc must enable engine-strict=true');
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`RUNTIME PIN: ${failure}`);
  process.exit(1);
}

console.log(`RUNTIME PIN: Node ${REQUIRED_NODE_VERSION} verified across package.json, contributor files, and Netlify`);
