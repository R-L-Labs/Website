#!/usr/bin/env node

import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
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

function islandOptions(node) {
  const value = attributes(node).opts;
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function componentModuleMatches(value, component) {
  if (typeof value !== 'string') return false;
  const prefix = `/_astro/${component}.`;
  return value.startsWith(prefix)
    && value.endsWith('.js')
    && value.length > prefix.length + '.js'.length
    && !value.slice(prefix.length).includes('/');
}

function validateRequiredIslands(document, route, requiredIslands) {
  const failures = [];
  const islands = elements(document, 'astro-island');

  for (const expected of requiredIslands ?? []) {
    const expectedCount = expected.count ?? 1;
    const namedIslands = islands.filter((node) => islandOptions(node)?.name === expected.component);
    const identityMatches = namedIslands.filter((node) => {
      const actual = attributes(node);
      return actual['component-export'] === (expected.export ?? 'default')
        && componentModuleMatches(actual['component-url'], expected.component);
    });

    if (namedIslands.length > 0 && identityMatches.length !== namedIslands.length) {
      failures.push(`${route}: ${expected.component} Astro island component identity changed`);
    }

    const hydrated = identityMatches.filter((node) => (
      attributes(node).client === expected.hydration
    ));
    if (hydrated.length !== expectedCount) {
      failures.push(`${route}: expected ${expectedCount} ${expected.component} Astro island with client:${expected.hydration}, found ${hydrated.length}`);
    }
  }

  return failures;
}

function pathWithin(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === ''
    || (!isAbsolute(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`));
}

function rawReferencePath(reference) {
  const withoutFragment = reference.split('#', 1)[0];
  const withoutQuery = withoutFragment.split('?', 1)[0];
  const authority = /^(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/\//.exec(withoutQuery);
  if (!authority) return withoutQuery;

  const pathStart = withoutQuery.indexOf('/', authority[0].length);
  return pathStart === -1 ? '/' : withoutQuery.slice(pathStart);
}

function decodedReferencePath(reference) {
  try {
    return { path: decodeURIComponent(rawReferencePath(reference)) };
  } catch {
    return { error: 'malformed' };
  }
}

function containsParentTraversal(pathname) {
  return pathname.replaceAll('\\', '/').split('/').includes('..');
}

async function outputExists(distDirectory, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return { exists: false, malformed: true };
  }

  if (containsParentTraversal(decodedPath)) {
    return { exists: false, traversal: true };
  }

  const distRoot = resolve(distDirectory);
  const distRealPath = await realpath(distRoot);
  const relativePath = decodedPath.replace(/^\/+/, '');
  const candidates = decodedPath.endsWith('/')
    ? [resolve(distRoot, relativePath, 'index.html')]
    : [
      resolve(distRoot, relativePath),
      resolve(distRoot, `${relativePath}.html`),
      resolve(distRoot, relativePath, 'index.html'),
    ];

  for (const candidate of candidates) {
    if (!pathWithin(distRoot, candidate)) {
      return { exists: false, escaped: true };
    }

    try {
      const resolvedCandidate = await realpath(candidate);
      if (!pathWithin(distRealPath, resolvedCandidate)) {
        return { exists: false, escaped: true };
      }

      if ((await stat(resolvedCandidate)).isFile()) {
        return { exists: true };
      }
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
    }
  }

  return { exists: false };
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

    const decodedReference = decodedReferencePath(reference);
    if (decodedReference.error === 'malformed') {
      failures.push(`${route}: malformed internal URL encoding in ${reference}`);
      continue;
    }
    if (containsParentTraversal(decodedReference.path)) {
      failures.push(`${route}: parent traversal is forbidden in ${reference}`);
      continue;
    }

    const output = await outputExists(distDirectory, url.pathname);
    if (output.malformed) {
      failures.push(`${route}: malformed internal URL encoding in ${reference}`);
    } else if (output.traversal) {
      failures.push(`${route}: parent traversal is forbidden in ${reference}`);
    } else if (output.escaped) {
      failures.push(`${route}: generated output escapes dist for ${url.pathname}`);
    } else if (!output.exists) {
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

  failures.push(...validateRequiredIslands(document, route, expected.requiredIslands));

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
