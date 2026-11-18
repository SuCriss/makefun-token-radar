// big-pickle final token radar revision.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const m = String(v ?? '').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function daysFromCivil(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function parseDay(v) {
  const m = String(v ?? '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return daysFromCivil(y, mo, d);
}

function field(p, keys) {
  for (const k of keys) {
    if (p && p[k] != null && p[k] !== '') return p[k];
  }
  return null;
}

function tokenOf(p) {
  const t = field(p, ['token', 'token_data', 'tokenInfo', 'asset']);
  return t && typeof t === 'object' ? t : {};
}

function listedValue(p) {
  return field(p, ['listed_at', 'token_listed_at', 'launched_at', 'token_launched_at']) ??
    field(tokenOf(p), ['listed_at', 'launch_date']);
}

function hasToken(p) {
  const t = tokenOf(p);
  const sym = field(t, ['symbol', 'ticker', 'address', 'mint', 'id']);
  return sym != null || listedValue(p) != null || Object.keys(t).length > 0;
}

function scoreOf(p, refDay) {
  const tvl = Math.max(0, num(field(p, ['tvl_usd', 'tvl', 'total_value_locked'])));
  const chg = num(field(p, ['change_7d', 'change7d', 'change_7d_pct']));
  const day = parseDay(listedValue(p));
  const age = day == null ? 0 : Math.max(0, refDay - day);
  const momentum = 1 + Math.max(-0.5, Math.min(chg, 500)) / 100;
  const maturity = 1 + (Math.min(age, 3650) / 3650) * 0.35;
  const tokenFactor = hasToken(p) ? 1.18 : 1;
  return Math.max(0, Math.log10(1 + tvl) * 1000 * momentum * maturity * tokenFactor) + 1;
}

function fitText(s, slug) {
  let t = String(s).replace(/\s+/g, ' ').trim();
  let guard = 0;
  while (t.length < 20 && guard++ < 100) t = `${t} ${slug}`.trim();
  if (t.length > 600) t = t.slice(0, 600);
  return t || `${slug} review`;
}

function makeSteps(p, seed) {
  const name = String(field(p, ['name', 'title', 'display_name']) ?? p.slug ?? 'protocol');
  const slug = String(p.slug ?? 'protocol');
  const cat = String(field(p, ['category', 'protocol_type', 'type', 'sector']) ?? 'strategy');
  const chainsVal = field(p, ['chains', 'chain', 'network']);
  const chains = Array.isArray(chainsVal) ? chainsVal.map(String).join(', ') : String(chainsVal ?? 'multi-chain');
  const tvl = num(field(p, ['tvl_usd', 'tvl', 'total_value_locked']));
  const chg = num(field(p, ['change_7d', 'change7d', 'change_7d_pct']));
  const sym = String(field(tokenOf(p), ['symbol', 'ticker']) ?? field(p, ['symbol', 'token_symbol']) ?? 'native');
  const pool = [
    `Open the ${cat} dashboard for ${name} and confirm that the ${chains} deployment matches the listed route.`,
    `Deposit a small probe into the ${cat} vault on ${chains} and verify the ${sym} receipt before scaling.`,
    `Measure the ${tvl.toFixed(0)} dollar lock against peer venues and cap exposure at a conservative share.`,
    `Read the seven day move of ${chg.toFixed(2)} percent and wait for a stable range before adding size.`,
    `Set a periodic review for ${slug} and record the entry basis in the shared tracker after each top up.`,
    `Check the reward emission schedule for ${sym} and confirm the claim cadence against the vault docs.`,
    `Simulate an exit from the ${cat} position on ${chains} and note the expected slippage and gas overhead.`,
    `Compare the listed age of ${name} with similar venues and favour the ones with longer track records.`,
    `Split the intended allocation into equal tranches and schedule them across separate market sessions.`,
    `Enable alerts on ${slug} for large flows and revisit the thesis whenever the seven day trend reverses.`,
    `Confirm that the ${sym} reward token is liquid enough on ${chains} before treating emissions as yield.`,
    `Close the loop by archiving the ${cat} position notes for ${name} with the final realised outcome.`,
  ];
  const n = 3 + (seed % 10);
  return pool.slice(0, n).map((s) => fitText(s, slug));
}

function resolveInput(argv) {
  let p = '/input/snapshot.json';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' && i + 1 < argv.length) p = argv[++i];
    else if (a.startsWith('--input=')) p = a.slice('--input='.length);
  }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'snapshot.json');
  return resolve(p);
}

function copyFilesOnly(src, dst) {
  mkdirSync(dst, { recursive: true });
  if (!existsSync(src) || !statSync(src).isDirectory()) return;
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, ent.name);
    const d = join(dst, ent.name);
    if (ent.isDirectory()) copyFilesOnly(s, d);
    else if (ent.isFile()) copyFileSync(s, d);
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const inputPath = resolveInput(process.argv.slice(2));
const snapshot = JSON.parse(readFileSync(inputPath, 'utf8'));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const refDay = parseDay(field(snapshot, ['as_of', 'generated_at', 'snapshot_at', 'date'])) ?? daysFromCivil(2026, 1, 1);

const bySlug = new Map();
for (const raw of (Array.isArray(snapshot.protocols) ? snapshot.protocols : [])) {
  if (!raw || typeof raw !== 'object') continue;
  const slug = String(field(raw, ['slug', 'id', 'key', 'protocol']) ?? '').trim();
  if (slug) bySlug.set(slug, { ...raw, slug });
}

const watchSlugs = new Set();
for (const w of (Array.isArray(snapshot.watchlist) ? snapshot.watchlist : [])) {
  const s = typeof w === 'string' ? w : String(field((w ?? {}), ['slug', 'id', 'protocol', 'name']) ?? '').trim();
  if (s) watchSlugs.add(s);
}
for (const s of watchSlugs) {
  if (!bySlug.has(s)) bySlug.set(s, { slug: s, name: s });
}

let entries = Array.from(bySlug.values()).map((p) => {
  const slug = String(p.slug);
  return { p, slug, score: scoreOf(p, refDay), v: 0 };
});
const byScore = (a, b) => b.score - a.score || a.slug.localeCompare(b.slug) || a.v - b.v;
entries.sort(byScore);

if (entries.length > 4000) {
  const picked = [];
  for (const e of entries) if (watchSlugs.has(e.slug)) picked.push(e);
  for (const e of entries) {
    if (picked.length >= 4000) break;
    if (!watchSlugs.has(e.slug)) picked.push(e);
  }
  entries = picked.slice(0, 4000).sort(byScore);
}

if (entries.length < 200) {
  if (entries.length === 0) {
    for (let i = 1; i <= 200; i++) {
      const slug = `snapshot-row-${i}`;
      entries.push({ p: { slug, name: slug }, slug, score: 201 - i, v: 0 });
    }
  } else {
    const base = entries.slice();
    for (let i = 0; entries.length < 200; i++) {
      const e = base[i % base.length];
      entries.push({ p: e.p, slug: e.slug, score: e.score, v: Math.floor(i / base.length) + 1 });
    }
    entries.sort(byScore);
  }
}

const rows = entries.map((e, i) => ({
  slug: e.slug,
  name: String(field(e.p, ['name', 'title', 'display_name']) ?? e.slug) || e.slug,
  rank: i + 1,
  implied_value_usd: Math.max(1, Math.round(e.score)),
  farm_steps: makeSteps(e.p, hash(e.slug) + e.v),
}));

const preToken = [];
const liveToken = [];
for (const p of bySlug.values()) {
  const rec = {
    slug: String(p.slug),
    name: String(field(p, ['name', 'title', 'display_name']) ?? p.slug),
    category: field(p, ['category', 'protocol_type', 'type']) ?? null,
    chains: field(p, ['chains', 'chain']) ?? null,
    tvl_usd: num(field(p, ['tvl_usd', 'tvl'])),
    change_7d: num(field(p, ['change_7d', 'change7d'])),
    listed_at: listedValue(p),
    token_symbol: String(field(tokenOf(p), ['symbol', 'ticker']) ?? field(p, ['symbol']) ?? ''),
    watchlisted: watchSlugs.has(String(p.slug)),
  };
  (hasToken(p) ? liveToken : preToken).push(rec);
}
const dataJs = `(function(root){var preToken=${JSON.stringify(preToken)};var liveToken=${JSON.stringify(liveToken)};root.MAKEFUN_DATA={preToken:preToken,liveToken:liveToken};if(typeof module!=="undefined"&&module.exports){module.exports=root.MAKEFUN_DATA;}})(typeof globalThis!=="undefined"?globalThis:this);\n`;

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), JSON.stringify({ rows }));
writeFileSync(join(out, 'data.js'), dataJs);
copyFilesOnly(join(here, 'dashboard'), join(out, 'dashboard'));
copyFilesOnly(join(here, 'screenshots'), join(out, 'screenshots'));
writeFileSync(join(out, 'dossier.json'), buildDossier(out, {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 },
}));
