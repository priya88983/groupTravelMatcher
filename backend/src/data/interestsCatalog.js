import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const interestsPath = resolve(here, '../../../data/problem-3/interests.json');

const raw = JSON.parse(readFileSync(interestsPath, 'utf8'));

export function listInterests() {
  return raw.map((entry) => ({ interest: entry.interest, label: entry.label, category: entry.category }));
}

const VALID = new Set(raw.map((entry) => entry.interest));

export function isValidInterest(interest) {
  return VALID.has(interest);
}
