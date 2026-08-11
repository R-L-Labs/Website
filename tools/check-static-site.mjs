#!/usr/bin/env node

import { access, readdir, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { parse } from 'parse5';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function visit(node, callback) {
  callback(node);
  for (const child of node.childNodes ?? []) {
    visit(child, callback);
  }
}

function elementText(node) {
  let value = '';
  visit(node, (child) => {
    if (child.nodeName === '#text') value += child.value;
  });
  return normalizeText(value);
}

function attributes(node) {
  return Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
}

function elements(document, tag) {
  const matches = [];
  visit(document, (node) => {
    if (node.tagName === tag) matches.push(node);
  });
  return matches;
}

function matchesElement(node, expected) {
  const actualAttributes = attributes(node);
  const actualClasses = new Set((actualAttributes.class ?? '').split(/\s+/).filter(Boolean));

  return (expected.text === undefined || elementText(node) === expected.text)
    && (expected.classes ?? []).every((className) => actualClasses.has(className))
    && Object.entries(expected.attributes ?? {}).every(([name, value]) => actualAttributes[name] === value)
    && Object.entries(expected.attributeTokens ?? {}).every(([name, tokens]) => {
      const actualTokens = new Set((actualAttributes[name] ?? '').split(/\s+/).filter(Boolean));
      return tokens.every((token) => actualTokens.has(token));
    });
}

async function outputExists(distDirectory, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const relativePath = decodedPath.replace(/^\/+/, '');
  const candidates = decodedPath.endsWith('/')
    ? [resolve(distDirectory, relativePath, 'index.html')]
    : [
      resolve(distDirectory, relativePath),
      resolve(distDirectory, `${relativePath}.html`),
      resolve(distDirectory, relativePath, 'index.html'),
    ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {
    }
  }

  return false;
}

async function validateInternalLinks(document, distDirectory, route) {
  const failures = [];
  const references = [];
  const routeBase = route === '/' ? '/' : `${route}/`;

  visit(document, (node) => {
    const actualAttributes = attributes(node);
    for (const name of ['href', 'src']) {
      if (actualAttributes[name]) references.push(actualAttributes[name]);
    }
  });

  for (const reference of references) {
    if (reference.startsWith('#')) continue;

    let url;
    try {
      url = new URL(reference, `https://static.invalid${routeBase}`);
    } catch {
      failures.push(`${route}: invalid link ${reference}`);
      continue;
    }

    if (url.origin !== 'https://static.invalid') continue;
    if (!await outputExists(distDirectory, url.pathname)) {
      failures.push(`broken internal link ${url.pathname} from ${route}`);
    }
  }

  return { failures, count: references.length };
}

async function validateRoute(distDirectory, route, expected) {
  const failures = [];
  let source;

  try {
    source = await readFile(resolve(distDirectory, expected.file), 'utf8');
  } catch {
    return { failures: [`${route}: missing ${expected.file}`], linkCount: 0 };
  }

  const document = parse(source);
  const title = elements(document, 'title')[0];
  if (!title || elementText(title) !== expected.title) {
    failures.push(`${route}: title changed`);
  }

  const outline = [];
  visit(document, (node) => {
    if (/^h[1-6]$/.test(node.tagName ?? '')) {
      outline.push({ tag: node.tagName, text: elementText(node) });
    }
  });
  if (JSON.stringify(outline) !== JSON.stringify(expected.outline)) {
    failures.push(`${route}: heading outline changed`);
  }

  for (const required of expected.requiredElements ?? []) {
    const count = elements(document, required.tag).filter((node) => matchesElement(node, required)).length;
    if (count !== (required.count ?? 1)) {
      failures.push(`${route}: expected ${required.count ?? 1} matching <${required.tag}> element, found ${count}`);
    }
  }

  const links = await validateInternalLinks(document, distDirectory, route);
  failures.push(...links.failures);

  return { failures, linkCount: links.count };
}

async function generatedRoutes(distDirectory) {
  const routes = [];

  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await collect(entryPath);
      } else if (entry.name.endsWith('.html')) {
        const file = relative(distDirectory, entryPath).split(sep).join('/');
        const route = file === 'index.html'
          ? '/'
          : `/${file.replace(/\/index\.html$/, '').replace(/\.html$/, '')}`;
        routes.push(route);
      }
    }
  }

  await collect(distDirectory);
  return routes.sort();
}

const distDirectory = option('--dist');
const contractPath = option('--contract');

if (!distDirectory || !contractPath) {
  console.error('Usage: node tools/check-static-site.mjs --dist <directory> --contract <file>');
  process.exit(2);
}

const contract = JSON.parse(await readFile(contractPath, 'utf8'));
const failures = [];
let linkCount = 0;

for (const route of await generatedRoutes(distDirectory)) {
  if (!(route in contract.routes)) {
    failures.push(`unexpected generated route ${route}`);
  }
}

for (const [route, expected] of Object.entries(contract.routes)) {
  const result = await validateRoute(distDirectory, route, expected);
  failures.push(...result.failures);
  linkCount += result.linkCount;
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`STATIC CONTRACT: ${failure}`);
  process.exit(1);
}

const routeCount = Object.keys(contract.routes).length;
console.log(`STATIC CONTRACT: ${routeCount} route${routeCount === 1 ? '' : 's'} verified`);
console.log(`STATIC LINKS: ${linkCount} generated references verified`);
