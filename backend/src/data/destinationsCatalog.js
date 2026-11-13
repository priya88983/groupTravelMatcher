import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const destinationsPath = resolve(here, '../../../data/catalog/destinations.json');
const raw = JSON.parse(readFileSync(destinationsPath, 'utf8'));

export function listDestinationCities() {
  const cities = [];
  const countries = Array.isArray(raw) ? raw : raw.countries || [];
  for (const country of countries) {
    for (const city of country.cities || []) {
      cities.push(city.name);
    }
  }
  return [...new Set(cities)].sort();
}

export function isValidDestinationCity(city) {
  if (typeof city !== 'string') return false;
  const source = Array.isArray(raw) ? raw : raw.countries || [];
  return source.some((country) =>
    (country.cities || []).some((c) => c.name === city),
  );
}

export const DATA_WINDOW = {
  firstNight: '2027-04-01',
  lastDeparture: '2027-04-20',
};
