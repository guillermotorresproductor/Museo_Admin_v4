import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pglitePath = pathToFileURL("C:/Users/guill/AppData/Local/Temp/pglite-horarios/node_modules/@electric-sql/pglite/dist/index.js");
const { PGlite } = await import(pglitePath.href);
const db = new PGlite();
const fixture = readFileSync(join(here, "horarios-week-draft.fixture.sql"), "utf8");
const migration = readFileSync(join(here, "../migrations/202610270001_schedule_week_drafts.sql"), "utf8");
const scenarios = readFileSync(join(here, "horarios-week-draft.scenarios.sql"), "utf8");

const parts = scenarios.split(/(?=^do \$)/m).map((part) => part.trim()).filter(Boolean);
let failed = 0;
await db.exec(fixture);
await db.exec(migration);
for (const part of parts) {
  const name = part.match(/^do \$([a-z0-9_]+)\$/i)?.[1] || part.slice(0, 24);
  try {
    await db.exec(part);
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error?.message || error);
    break;
  }
}
await db.close();
if (failed) process.exit(1);
console.log("HORARIOS isolated database: all scenarios passed");
