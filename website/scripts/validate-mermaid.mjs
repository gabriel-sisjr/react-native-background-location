#!/usr/bin/env node
/**
 * Build-time Mermaid syntax validator.
 *
 * Walks every Markdown/MDX file under `website/docs/**` (or a caller-supplied
 * list of paths), extracts every ```mermaid fenced block, and runs each block
 * through `mermaid.parse()` from the same Mermaid version Docusaurus uses at
 * render time.
 *
 * Exits 0 if every block parses; exits 1 with a grouped, line-numbered report
 * otherwise. Use this as a `prebuild` hook so broken diagrams can never reach
 * production.
 *
 * Usage:
 *   node scripts/validate-mermaid.mjs                # scan docs/**
 *   node scripts/validate-mermaid.mjs path/to/a.md   # scan specific files
 *
 * Performance: pure JS parser, no DOM / no Puppeteer. ~ms per block.
 */
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globby } from 'globby';
import { JSDOM } from 'jsdom';

// IMPORTANT: install a JSDOM window on the global scope BEFORE importing
// `mermaid`. Mermaid pulls in DOMPurify, which is a factory that probes for
// `window` at module-load time. Without this, parsing diagrams that contain
// quoted labels (e.g. flowcharts with strings) crashes with
// `DOMPurify.addHook is not a function`. We use a minimal HTML doc — no
// network, no resource loading, no scripts.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
const { window } = dom;
// Some Node 22+ globals (notably `navigator`) are read-only via Object getters
// on globalThis, so we can't blindly assign. Use a guarded helper that skips
// any name we can't override (mermaid's parse path tolerates these absences).
function defineGlobal(name, value) {
  const existing = Object.getOwnPropertyDescriptor(globalThis, name);
  if (existing && !existing.configurable && !existing.writable && !existing.set) {
    return; // immutable in this Node version — leave as-is
  }
  try {
    globalThis[name] = value;
  } catch {
    // Best-effort: ignore platform-locked globals (e.g. `navigator`).
  }
}

defineGlobal('window', window);
defineGlobal('document', window.document);
defineGlobal('HTMLElement', window.HTMLElement);
defineGlobal('Element', window.Element);
defineGlobal('Node', window.Node);
defineGlobal('DocumentFragment', window.DocumentFragment);
defineGlobal('NodeFilter', window.NodeFilter);
defineGlobal('getComputedStyle', window.getComputedStyle.bind(window));

// Dynamic import so the DOM globals exist before mermaid evaluates.
const mermaidModule = await import('mermaid');
const mermaid = mermaidModule.default ?? mermaidModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIR = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_GLOB = 'docs/**/*.{md,mdx}';

// Matches a fenced ```mermaid ... ``` block. Captures the block body.
// We deliberately use a tag-based RegExp (no /g flag tricks) and rely on
// matchAll() with the `g` flag below so each match has a stable `index`.
const MERMAID_FENCE_RE = /^([ \t]*)```mermaid[^\n]*\n([\s\S]*?)\n[ \t]*```/gm;

/**
 * Return the 1-based line number for a character offset within `source`.
 * Used to translate a regex match index into the source file's line number.
 */
function offsetToLine(source, offset) {
  if (offset <= 0) return 1;
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) {
    if (source.charCodeAt(i) === 0x0a /* \n */) line += 1;
  }
  return line;
}

/**
 * Resolve files to scan. If positional args were passed, treat them as
 * literal paths; otherwise glob `website/docs/**`.
 */
async function resolveTargets(cliArgs) {
  if (cliArgs.length > 0) {
    // Normalize to absolute paths and filter to .md/.mdx
    return cliArgs
      .map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)))
      .filter((p) => /\.(mdx?|md)$/i.test(p));
  }
  const matches = await globby(DEFAULT_GLOB, {
    cwd: WEBSITE_DIR,
    absolute: true,
    gitignore: false,
  });
  return matches;
}

/**
 * Resolve the Mermaid instance. We never render — only parse. Mermaid is
 * already loaded under a JSDOM window at module-import time (see the top of
 * this file), which is enough for DOMPurify and friends to initialize.
 */
async function initMermaid() {
  return mermaid;
}

/**
 * Extract every Mermaid block from one file. Returns rich descriptors with
 * the source line number of the opening fence (1-based).
 */
function extractBlocks(source) {
  const blocks = [];
  for (const match of source.matchAll(MERMAID_FENCE_RE)) {
    const matchIndex = match.index ?? 0;
    blocks.push({
      // The opening ``` fence sits one line above the actual diagram body.
      // Reporting the fence line is what readers will grep for in their editor.
      line: offsetToLine(source, matchIndex),
      body: match[2] ?? '',
    });
  }
  return blocks;
}

/**
 * Pretty-print a Mermaid parse error for terminal output.
 *
 * Mermaid's parser attaches a `hash` payload with the offending token, the
 * expected tokens, and 1-based line/column inside the *block body*. We
 * surface a one-line summary plus an "Expecting ..., got 'X'" hint when
 * available, so editors can jump straight to the issue.
 */
function formatErrorMessage(error) {
  if (!error) return 'Unknown parse error';
  if (typeof error === 'string') return error.replace(/\s+/g, ' ').trim();

  // The first non-empty line of error.message is the canonical summary.
  const rawMessage = error.message ?? error.name ?? String(error);
  const firstLine = rawMessage.split('\n').find((l) => l.trim().length > 0) ?? rawMessage;

  if (error.hash && typeof error.hash.line === 'number') {
    const inner = `block line ${error.hash.line + 1}, col ${error.hash.loc?.first_column ?? '?'}`;
    const got = error.hash.token ? `got '${error.hash.token}'` : '';
    const expected = Array.isArray(error.hash.expected) && error.hash.expected.length
      ? `expected ${error.hash.expected.slice(0, 4).join(', ')}${error.hash.expected.length > 4 ? ', ...' : ''}`
      : '';
    const hint = [got, expected].filter(Boolean).join('; ');
    return `${firstLine} [${inner}${hint ? ` -- ${hint}` : ''}]`;
  }

  return firstLine;
}

/**
 * Validate a single file. Returns an array of failure descriptors.
 */
async function validateFile(filePath, mermaidInstance) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (err) {
    return [
      {
        file: filePath,
        line: 1,
        message: `Could not read file: ${err.message}`,
        diagram: '',
      },
    ];
  }

  const blocks = extractBlocks(source);
  if (blocks.length === 0) return [];

  const failures = [];
  for (const block of blocks) {
    try {
      // Mermaid's parser accepts an options bag; we leave suppressErrors off so
      // the promise rejects on failure (giving us the rich hash payload).
      await mermaidInstance.parse(block.body);
    } catch (err) {
      failures.push({
        file: filePath,
        line: block.line,
        message: formatErrorMessage(err),
        diagram: block.body,
      });
    }
  }
  return failures;
}

/**
 * Group failures by file and print a stable, terminal-friendly report.
 * Format per finding: `path/to/file.md:LINE — <message>`
 */
function printReport(failures) {
  if (failures.length === 0) return;
  const byFile = new Map();
  for (const f of failures) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  console.error('\nMermaid validation failed.\n');
  for (const [file, items] of byFile) {
    const rel = path.relative(process.cwd(), file);
    for (const item of items) {
      console.error(`${rel}:${item.line} - ${item.message}`);
    }
  }
  console.error(`\nTotal failures: ${failures.length}`);
}

async function main() {
  const cliArgs = process.argv.slice(2);
  const targets = await resolveTargets(cliArgs);

  if (targets.length === 0) {
    console.log('[validate-mermaid] No Markdown files matched. Nothing to do.');
    return;
  }

  const startedAt = performance.now();
  const mermaidInstance = await initMermaid();

  // Process files in parallel; mermaid.parse is sync-fast and CPU-bound.
  const fileResults = await Promise.all(
    targets.map((file) => validateFile(file, mermaidInstance))
  );
  const failures = fileResults.flat();

  const totalBlocks = (
    await Promise.all(
      targets.map(async (file) => extractBlocks(await readFile(file, 'utf8')).length)
    )
  ).reduce((sum, n) => sum + n, 0);

  const elapsedMs = Math.round(performance.now() - startedAt);

  if (failures.length > 0) {
    printReport(failures);
    console.error(
      `\n[validate-mermaid] Scanned ${targets.length} file(s), ${totalBlocks} block(s) in ${elapsedMs}ms.`
    );
    process.exit(1);
  }

  console.log(
    `[validate-mermaid] OK: ${targets.length} file(s), ${totalBlocks} Mermaid block(s) parsed in ${elapsedMs}ms.`
  );
}

// Only run when invoked as a script (allows future programmatic use).
const invokedFromCli = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (invokedFromCli) {
  main().catch((err) => {
    console.error('[validate-mermaid] Unexpected error:', err);
    process.exit(2);
  });
}

export { extractBlocks, validateFile, initMermaid };
