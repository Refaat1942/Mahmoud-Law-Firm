// Verifies that every translation key used in the code exists in both messages/ar.json and messages/en.json.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const ar = new Set(flatten(JSON.parse(readFileSync("messages/ar.json", "utf8"))));
const en = new Set(flatten(JSON.parse(readFileSync("messages/en.json", "utf8"))));

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(name)) files.push(p);
  }
};
walk("src");

const used = new Map();
const add = (key, file) => {
  if (!used.has(key)) used.set(key, new Set());
  used.get(key).add(file);
};

const declRe = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)"|\{[^}]*namespace:\s*"([^"]*)"[^}]*\})?\s*\)/g;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  // A call belongs to the closest preceding declaration of the same variable name.
  const decls = [...src.matchAll(declRe)].map((m) => ({ name: m[1], ns: m[2] ?? m[3] ?? "", at: m.index }));
  for (const name of new Set(decls.map((d) => d.name))) {
    const own = decls.filter((d) => d.name === name);
    const callRe = new RegExp(`\\b${name}(?:\\.rich|\\.raw)?\\(\\s*"([^"]+)"`, "g");
    for (const c of src.matchAll(callRe)) {
      const decl = own.filter((d) => d.at < c.index).at(-1);
      if (!decl) continue;
      add(decl.ns ? `${decl.ns}.${c[1]}` : c[1], file);
    }
  }
  for (const m of src.matchAll(/"((?:v|errors)\.[A-Za-z0-9_]+)"/g)) add(m[1], file);
  for (const m of src.matchAll(/new ActionError\(\s*"([^"]+)"/g)) add(m[1], file);
}

const enumsSrc = readFileSync("src/lib/enums.ts", "utf8");
for (const m of enumsSrc.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
  for (const v of m[2].matchAll(/"([^"]+)"/g)) add(`enum.${m[1]}.${v[1]}`, "src/lib/enums.ts");
}

let missing = 0;
for (const [key, where] of [...used].sort()) {
  const lacks = [!ar.has(key) && "ar", !en.has(key) && "en"].filter(Boolean);
  if (lacks.length) {
    missing++;
    console.log(`missing [${lacks.join(",")}] ${key}  (${[...where][0]})`);
  }
}
const onlyAr = [...ar].filter((k) => !en.has(k));
const onlyEn = [...en].filter((k) => !ar.has(k));
for (const k of onlyAr) console.log(`only in ar: ${k}`);
for (const k of onlyEn) console.log(`only in en: ${k}`);

console.log(`\n${used.size} keys used, ${missing} missing, ${onlyAr.length + onlyEn.length} parity issues`);
process.exit(missing || onlyAr.length || onlyEn.length ? 1 : 0);
