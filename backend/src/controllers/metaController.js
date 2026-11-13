import { listInterests } from '../data/interestsCatalog.js';

export function getInterests(_req, res) {
  res.json({ interests: listInterests() });
}
