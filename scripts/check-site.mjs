// Static checks for the DIAPORIA site. No dependencies; run with `node scripts/check-site.mjs`.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html"];
const problems = [];
const fail = (msg) => problems.push(msg);

// Words that must never appear on the public site.
const banned = [/open[\s-]?source/i, /\baporia\b/i, /worktree/i, /benchmark/i, /\bprompt(s)?\b/i];
const allowedExternal = /^https:\/\/github\.com\/friendly-neighborhood-coding-man\/diaporia(\/|$)/;

for (const page of pages) {
  const html = readFileSync(join(root, page), "utf8");
  const text = html.replace(/<[^>]+>/g, " ");

  for (const re of banned) if (re.test(text) || re.test(html.replace(/DIAPORIA/gi, ""))) fail(`${page}: banned term ${re}`);

  if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail(`${page}: expected exactly one <h1>`);

  // Heading levels must not skip (h1 -> h3 etc.).
  let prev = 0;
  for (const m of html.matchAll(/<h([1-6])[\s>]/g)) {
    const level = Number(m[1]);
    if (prev && level > prev + 1) fail(`${page}: heading jumps from h${prev} to h${level}`);
    prev = level;
  }

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const dupes = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) !== i);
  if (dupes.length) fail(`${page}: duplicate ids ${dupes.join(", ")}`);

  for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    const [, attr, url] = m;
    if (url.startsWith("#")) {
      if (url.length > 1 && !ids.has(url.slice(1))) fail(`${page}: broken anchor ${url}`);
    } else if (/^[a-z]+:/i.test(url) || url.startsWith("//")) {
      if (attr === "src") fail(`${page}: external resource ${url}`);
      else if (!allowedExternal.test(url)) fail(`${page}: unexpected external link ${url}`);
    } else if (url.startsWith("/")) {
      fail(`${page}: root-absolute URL ${url} breaks the /diaporia/ project path`);
    } else {
      const file = url.split(/[?#]/)[0] || "index.html";
      const target = join(root, file.endsWith("/") ? file + "index.html" : file);
      if (!existsSync(target)) fail(`${page}: missing file ${url}`);
    }
  }

  for (const m of html.matchAll(/<link[^>]+href="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(m[1])) fail(`${page}: external <link> ${m[1]}`);
  }
  if (/<script[\s>]/i.test(html)) fail(`${page}: scripts are not expected on this site`);
  if (!/<html lang="/.test(html)) fail(`${page}: missing lang attribute`);
}

const css = readFileSync(join(root, "styles.css"), "utf8");
if (/@import|url\(\s*["']?(https?:)?\/\//.test(css)) fail("styles.css: external CSS resource");

if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join("\n"));
  process.exit(1);
}
console.log(`OK ${pages.length} page(s) checked`);
