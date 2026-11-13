import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

// Returns a map of { interestCode -> label }.
export function useInterestLabels() {
  const [labels, setLabels] = useState({});
  useEffect(() => {
    let active = true;
    api.interests()
      .then((data) => {
        if (!active) return;
        const map = {};
        for (const entry of data.interests) map[entry.interest] = entry.label;
        setLabels(map);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return labels;
}

export function interestLabel(labels, code) {
  return labels[code] || code;
}

export function formatInterestList(labels, codes) {
  if (!Array.isArray(codes) || codes.length === 0) return '—';
  return codes.map((code) => interestLabel(labels, code)).join(', ');
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatInr(amount) {
  if (amount == null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}
