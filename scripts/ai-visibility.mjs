#!/usr/bin/env node
// AI visibility check for teamlider.co.il (GROWTH-PLAN GEO-8).
//
// This script covers the half that a machine can actually settle: whether every
// page an AI engine might cite is reachable, indexable, structured and linked.
// A page that fails here cannot be cited no matter how good the copy is.
//
// It deliberately does NOT pretend to measure the engines themselves. Asking
// ChatGPT / Gemini / Perplexity / Claude and reading Google AI Overviews needs a
// logged-in human, so the script ends by printing that panel as a checklist.
// Record the answers in WikiBrain: wiki/projects/team-lider-ai-visibility.md
//
//   node scripts/ai-visibility.mjs            # against the live site
//   node scripts/ai-visibility.mjs --local    # against the working copy
//
// Exit code 1 if any page fails a machine check.

import { readFile } from 'node:fs/promises';

const LOCAL = process.argv.includes('--local');
const ORIGIN = 'https://teamlider.co.il';

const PANEL = [
  'אימוני כושר לילדים בראש העין',
  'חוג כושר לילדים ראש העין',
  'אימוני כושר לנשים בראש העין',
  'אימוני כושר לאמהות ראש העין',
  'אימוני כושר לגברים בראש העין',
  'אימוני כושר לאבות ראש העין',
  'אימון קבוצתי בפארק ראש העין',
  'אימוני כושר למבוגרים בראש העין',
  'אימוני כוח לילדים זה בטוח',
  // 11/09/2026: an AI answer named the wrong person as the women's coach.
  // Keep asking until the answer names the real one.
  'מי מאמן את קבוצת האמהות בטים לידר',
];

const ENGINES = ['ChatGPT', 'Gemini', 'Perplexity', 'Claude', 'Google AI Overviews'];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function load(url) {
  if (LOCAL) {
    const file = url.replace(ORIGIN + '/', '') || 'index.html';
    return { status: 200, body: await readFile(file, 'utf8') };
  }
  const r = await fetch(url + '?cb=' + Date.now(), { redirect: 'follow' });
  return { status: r.status, body: await r.text() };
}

function ldJson(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { out.push(JSON.parse(m[1])); } catch { out.push({ __broken: true }); }
  }
  return out;
}

function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== 'object') return [];
  if (node['@graph']) return flatten(node['@graph']);
  return [node, ...Object.values(node).flatMap((v) =>
    v && typeof v === 'object' ? flatten(v) : [])];
}

const sitemapXml = LOCAL
  ? await readFile('sitemap.xml', 'utf8')
  : await (await fetch(ORIGIN + '/sitemap.xml?cb=' + Date.now())).text();
const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

if (urls.length === 0) {
  console.error(red('sitemap.xml has no <loc> entries. Nothing to check.'));
  process.exit(1);
}

console.log(`\nteamlider.co.il · AI visibility · ${new Date().toISOString().slice(0, 10)}` +
            `${LOCAL ? dim('  (working copy)') : ''}\n`);
console.log('כל עמוד שאפשר לצטט, והאם הוא באמת ניתן לציטוט');
console.log('─'.repeat(78));

const failures = [];
const pages = [];

for (const url of urls) {
  const name = url.replace(ORIGIN + '/', '') || 'index.html';
  const problems = [];
  let types = [], author = null;

  try {
    const { status, body } = await load(url);
    if (status !== 200) problems.push(`HTTP ${status}`);
    if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(body)) problems.push('noindex');
    if (!/<link rel="canonical"/.test(body)) problems.push('אין canonical');
    if (!/<title>.{10,}<\/title>/s.test(body)) problems.push('אין title');
    if (!/<meta name="description" content=".{50,}"/.test(body)) problems.push('description קצר');

    const blocks = ldJson(body);
    if (blocks.some((b) => b.__broken)) problems.push('JSON-LD שבור');
    const nodes = blocks.flatMap(flatten);
    types = [...new Set(nodes.map((n) => n['@type']).filter(Boolean))];
    if (types.length === 0) problems.push('אין structured data');

    const article = nodes.find((n) => n['@type'] === 'Article');
    if (article) {
      author = article.author?.name ?? null;
      // The whole point of the personal-authority work: a company byline loses.
      if (article.author?.['@type'] !== 'Person') problems.push('author אינו Person');
      if (!/מאת <a href="\/#/.test(body)) problems.push('אין קרדיט גלוי');
    }
    // The canonical Person node is the full one (it carries knowsAbout). The
    // author stub nested inside Article is a short @id reference by design -
    // checking that one for sameAs reports a failure on a perfectly good page.
    const people = nodes.filter((n) => n['@type'] === 'Person');
    const canonical = people.find((n) => n.knowsAbout);
    if (people.length && !canonical) problems.push('Person בלי צומת קנוני');
    if (canonical && !(canonical.sameAs?.length > 0)) problems.push('Person בלי sameAs');
  } catch (e) {
    problems.push(`לא נטען: ${e.message}`);
  }

  pages.push({ name, author, types, problems });
  if (problems.length) failures.push(`${name}: ${problems.join(', ')}`);

  const mark = problems.length ? red('✗') : green('✓');
  const who = author ? ` ${dim('· ' + author)}` : '';
  console.log(`${mark} ${name.padEnd(26)} ${dim(types.join(', ').slice(0, 30).padEnd(30))}${who}`);
  if (problems.length) console.log(`  ${red('└ ' + problems.join(' · '))}`);
}

// Orphan check runs on the local tree; the live crawl would need the whole graph.
if (LOCAL) {
  const files = urls.map((u) => u.replace(ORIGIN + '/', '') || 'index.html');
  const bodies = Object.fromEntries(await Promise.all(
    files.map(async (f) => [f, await readFile(f, 'utf8')])));
  const orphans = files.filter((f) => f !== 'index.html' &&
    !files.some((o) => o !== f && bodies[o].includes(`href="${f}"`)));
  if (orphans.length) {
    failures.push(`עמודים יתומים: ${orphans.join(', ')}`);
    console.log(`\n${red('✗')} עמודים שאף עמוד אחר לא מקשר אליהם: ${orphans.join(', ')}`);
  }
}

const bylined = pages.filter((p) => p.author);
console.log('─'.repeat(78));
console.log(`${urls.length} עמודים · ${bylined.length} חתומים על אדם ` +
            `(${[...new Set(bylined.map((p) => p.author))].join(', ')})`);

console.log(`\n${failures.length ? red(`${failures.length} כשלים`) : green('כל הבדיקות האוטומטיות עברו')}`);
for (const f of failures) console.log('  ' + red('· ' + f));

console.log(`\n${'─'.repeat(78)}\nהחלק שדורש אדם: ${PANEL.length} שאילתות × ${ENGINES.length} מנועים`);
console.log(dim('אנונימי, ממכשיר ישראלי. לכל שאילתה: הוזכר TL? מה צוטט? צילום מסך.'));
console.log(dim('לרשום ב-WikiBrain: wiki/projects/team-lider-ai-visibility.md\n'));
PANEL.forEach((q, i) => console.log(`  ${String(i + 1).padStart(2)}. ${q}`));
console.log(`\n  מנועים: ${ENGINES.join(' · ')}\n`);

process.exit(failures.length ? 1 : 0);
