const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

execFileSync(process.execPath, [path.join(root, "scripts", "build-cloudflare-pages.mjs")], {
  cwd: root,
  stdio: "pipe",
});

const headersPath = path.join(dist, "_headers");
const robotsPath = path.join(dist, "robots.txt");
const headersSrc = path.join(root, "_headers");
const robotsSrc = path.join(root, "robots.txt");

test("source _headers and robots.txt are versioned", () => {
  assert.ok(fs.existsSync(headersSrc), "missing root _headers");
  assert.ok(fs.existsSync(robotsSrc), "missing root robots.txt");
});

test("dist/_headers exists with global X-Robots-Tag rule", () => {
  assert.ok(fs.existsSync(headersPath), "missing dist/_headers");
  const text = fs.readFileSync(headersPath, "utf8");
  assert.match(text, /^\/\*\s*$/m);
  assert.match(text, /X-Robots-Tag:\s*noindex,\s*nofollow,\s*noarchive,\s*nosnippet/);
});

test("dist/robots.txt blocks all crawlers", () => {
  assert.ok(fs.existsSync(robotsPath), "missing dist/robots.txt");
  const text = fs.readFileSync(robotsPath, "utf8");
  assert.match(text, /User-agent:\s*\*/);
  assert.match(text, /Disallow:\s*\//);
});

test("every published HTML includes meta robots noindex", () => {
  const htmlFiles = fs.readdirSync(dist).filter((name) => name.endsWith(".html"));
  assert.ok(htmlFiles.length > 0, "no HTML in dist");
  const metaRe = /<meta\s+name=["']robots["']\s+content=["']noindex,\s*nofollow,\s*noarchive,\s*nosnippet["']\s*>/i;
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(dist, file), "utf8");
    assert.match(html, metaRe, `${file} missing meta robots`);
  }
});

test("SQL and migrations stay out of dist", () => {
  const walk = (dir, acc = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs, acc);
      else acc.push(path.relative(dist, abs).replace(/\\/g, "/"));
    }
    return acc;
  };
  const files = walk(dist);
  assert.doesNotMatch(files.join("\n"), /\.sql$/i);
  assert.ok(!files.some((f) => f.startsWith("supabase/")));
  assert.ok(!files.some((f) => f.includes("migration")));
});

test("noindex artifacts stay in this Museo build only", () => {
  assert.ok(fs.existsSync(path.join(root, "_headers")));
  assert.ok(fs.existsSync(path.join(root, "robots.txt")));
  assert.ok(fs.existsSync(path.join(root, "scripts", "build-cloudflare-pages.mjs")));
  assert.ok(!fs.existsSync(path.join(root, "..", "Instituva_App", "dist", "_headers")));
});

console.log("All demo noindex checks passed.");
