export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function passwordIsStrong(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 8 || value.length > 72) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(value)) return false;
  return true;
}

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}
