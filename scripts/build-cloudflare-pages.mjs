#!/usr/bin/env node
/**
 * Allowlist build for Cloudflare Pages.
 * Usage: node scripts/build-cloudflare-pages.mjs
 * Output: dist/ (browser-facing files only)
 */
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const ROOT_HTML = readdirSync(ROOT).filter((name) => name.endsWith(".html"));

const ALLOW_DIRS = Object.freeze([
  "css",
  "js",
  "images",
  "assets",
  "pdf",
]);

/** Public downloadables referenced by HTML (not governance docs/SQL). */
const ALLOW_FILES = Object.freeze([
  ".nojekyll",
  "_headers",
  "robots.txt",
  "docs/formulario-recibo-articulos-coleccion-prestamo.docx",
]);

const REQUIRED_PATHS = Object.freeze([
  "index.html",
  "login.html",
  "dashboard.html",
  "css/main.css",
  "js/config.js",
  "js/app.js",
  "js/services/supabase.js",
  "images/logo-horizontal.jpg",
  "pdf/reglamento-museo-musica.pdf",
  "assets/brand/museo-musica-pr-logo.svg",
  "_headers",
  "robots.txt",
]);

const ROBOTS_META =
  '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">';

const SKIP_DIR_NAMES = new Set([
  ".git",
  ".github",
  "node_modules",
  "supabase",
  "dist",
  "scripts",
  "tests",
  "test",
  "__tests__",
]);

const SKIP_FILE_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".DS_Store",
  "Thumbs.db",
]);

const SENSITIVE_NAME_RE =
  /(^|\/)(\.env($|\.)|.*\.(pem|key|p12|pfx)$|service[_-]?role|secret|credentials)/i;

function fail(message) {
  console.error(`build-cloudflare-pages: ${message}`);
  process.exit(1);
}

function assertInsideRoot(target) {
  const resolved = path.resolve(target);
  const rel = path.relative(ROOT, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    fail(`refusing path outside repository: ${target}`);
  }
  return resolved;
}

function shouldSkipEntry(absPath, name) {
  if (name.startsWith(".") && name !== ".nojekyll") return true;
  if (SKIP_FILE_NAMES.has(name)) return true;
  if (SKIP_DIR_NAMES.has(name)) return true;
  if (SENSITIVE_NAME_RE.test(name)) return true;
  const rel = path.relative(ROOT, absPath).replace(/\\/g, "/");
  if (SENSITIVE_NAME_RE.test(rel)) return true;
  if (/\.(sql|md|txt|toml|mjs|cjs|ts|map)$/i.test(name) && !rel.startsWith("js/")) {
    // Browser JS under js/ is allowed; other code/docs formats are not published.
    // robots.txt is published explicitly via ALLOW_FILES.
    if (rel.startsWith("js/") && /\.js$/i.test(name)) return false;
    if (rel.startsWith("js/") && !/\.js$/i.test(name)) return true;
    return true;
  }
  return false;
}

function copyFileSafe(src, dest) {
  assertInsideRoot(src);
  assertInsideRoot(dest);
  if (lstatSync(src).isSymbolicLink()) {
    fail(`refusing symlink file: ${path.relative(ROOT, src)}`);
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { dereference: false });
}

function injectRobotsMeta(html) {
  if (/<meta\s+[^>]*name=["']robots["']/i.test(html)) {
    return html.replace(
      /<meta\s+[^>]*name=["']robots["'][^>]*>/i,
      ROBOTS_META,
    );
  }
  if (/<meta\s+charset=/i.test(html)) {
    return html.replace(/(<meta\s+charset=[^>]*>)/i, `$1\n  ${ROBOTS_META}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n  ${ROBOTS_META}`);
  }
  fail("unable to inject robots meta: missing <head> or charset meta");
}

function publishHtmlPage(relName) {
  const src = path.join(ROOT, relName);
  const dest = path.join(DIST, relName);
  assertInsideRoot(src);
  assertInsideRoot(dest);
  if (lstatSync(src).isSymbolicLink()) {
    fail(`refusing symlink file: ${relName}`);
  }
  const html = injectRobotsMeta(readFileSync(src, "utf8"));
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, html, "utf8");
}

function copyDirAllowlisted(relDir) {
  const srcDir = assertInsideRoot(path.join(ROOT, relDir));
  if (!existsSync(srcDir)) {
    fail(`required directory missing: ${relDir}`);
  }
  const walk = (currentRel) => {
    const abs = path.join(ROOT, currentRel);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const name = entry.name;
      const childRel = path.join(currentRel, name).replace(/\\/g, "/");
      const childAbs = path.join(ROOT, childRel);
      if (entry.isSymbolicLink()) {
        fail(`refusing symlink: ${childRel}`);
      }
      if (entry.isDirectory()) {
        if (shouldSkipEntry(childAbs, name)) continue;
        walk(childRel);
        continue;
      }
      if (!entry.isFile()) continue;
      if (shouldSkipEntry(childAbs, name)) continue;
      // Under assets/docs-like folders, never copy SQL/governance.
      if (/\.(sql|md)$/i.test(name)) continue;
      copyFileSafe(childAbs, path.join(DIST, childRel));
    }
  };
  walk(relDir);
}

function collectPublishedFiles(dir = DIST, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) collectPublishedFiles(abs, acc);
    else if (entry.isFile()) acc.push(path.relative(DIST, abs).replace(/\\/g, "/"));
  }
  return acc;
}

function extractLocalRefs(content, fromFile) {
  const refs = new Set();
  const patterns = [
    /(?:src|href)=["']([^"']+)["']/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) {
      const raw = match[1].trim();
      if (!raw || raw.startsWith("#") || raw.startsWith("data:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue; // absolute URL / protocol
      if (raw.startsWith("//")) continue;
      const cleaned = raw.split("?")[0].split("#")[0];
      if (!cleaned) continue;
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(fromFile), cleaned.replace(/\\/g, "/")),
      );
      if (resolved.startsWith("../")) continue;
      refs.add(resolved.replace(/^\.\//, ""));
    }
  }
  return [...refs];
}

function validateAssetReferences(files) {
  const missing = [];
  for (const file of files) {
    // Only static markup/styles: JS templates produce false positives.
    if (!/\.(html|css)$/i.test(file)) continue;
    const content = readFileSync(path.join(DIST, file), "utf8");
    for (const ref of extractLocalRefs(content, file)) {
      if (ref.includes("${") || ref.includes("{{")) continue;
      if (!existsSync(path.join(DIST, ref))) {
        missing.push(`${file} -> ${ref}`);
      }
    }
  }
  if (missing.length) {
    fail(`broken local asset references:\n  ${missing.slice(0, 40).join("\n  ")}`);
  }
}

function assertNoSensitive(files) {
  const bad = files.filter((file) => SENSITIVE_NAME_RE.test(file) || file.includes(".env"));
  if (bad.length) {
    fail(`sensitive paths leaked into dist:\n  ${bad.join("\n  ")}`);
  }
  const bannedSnippets = ["SERVICE_ROLE", "service_role", "BEGIN PRIVATE KEY"];
  for (const file of files) {
    if (!/\.(html|js|css|json|txt|map)$/i.test(file)) continue;
    const text = readFileSync(path.join(DIST, file), "utf8");
    for (const snippet of bannedSnippets) {
      if (text.includes(snippet)) {
        fail(`banned content "${snippet}" found in dist/${file}`);
      }
    }
  }
}

function assertNoindexArtifacts(files) {
  if (!files.includes("_headers")) fail("dist/_headers missing");
  if (!files.includes("robots.txt")) fail("dist/robots.txt missing");
  const headers = readFileSync(path.join(DIST, "_headers"), "utf8");
  if (!/X-Robots-Tag:\s*noindex,\s*nofollow,\s*noarchive,\s*nosnippet/.test(headers)) {
    fail("dist/_headers missing required X-Robots-Tag rule");
  }
  const robots = readFileSync(path.join(DIST, "robots.txt"), "utf8");
  if (!/User-agent:\s*\*/.test(robots) || !/Disallow:\s*\//.test(robots)) {
    fail("dist/robots.txt must disallow all crawlers");
  }
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  for (const file of htmlFiles) {
    const html = readFileSync(path.join(DIST, file), "utf8");
    if (!/<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow,\s*noarchive,\s*nosnippet["']\s*>/i.test(html)) {
      fail(`dist/${file} missing robots meta tag`);
    }
  }
}

function main() {
  if (existsSync(DIST)) {
    rmSync(DIST, { recursive: true, force: true });
  }
  mkdirSync(DIST, { recursive: true });

  for (const html of ROOT_HTML) {
    publishHtmlPage(html);
  }

  for (const dir of ALLOW_DIRS) {
    copyDirAllowlisted(dir);
  }

  for (const rel of ALLOW_FILES) {
    const src = path.join(ROOT, rel);
    if (!existsSync(src)) {
      // Optional public downloads: warn but fail only if listed in REQUIRED.
      if (REQUIRED_PATHS.includes(rel)) fail(`required file missing: ${rel}`);
      console.warn(`build-cloudflare-pages: optional public file missing, skipped: ${rel}`);
      continue;
    }
    copyFileSafe(src, path.join(DIST, rel));
  }

  for (const rel of REQUIRED_PATHS) {
    if (!existsSync(path.join(DIST, rel))) {
      fail(`required published path missing after copy: ${rel}`);
    }
  }

  const files = collectPublishedFiles().sort();
  assertNoSensitive(files);
  assertNoindexArtifacts(files);
  validateAssetReferences(files);

  console.log(`build-cloudflare-pages: wrote ${files.length} files to dist/`);
  for (const file of files) {
    console.log(`  ${file}`);
  }
}

main();
