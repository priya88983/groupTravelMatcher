import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// Resolve JWT secrets from the environment. No hardcoded secrets are committed.
// In development an ephemeral random secret is generated per process (sessions do
// not survive a backend restart until real secrets are configured). In production
// the variables are required.
function resolveSecret(envKey, label) {
  const value = process.env[envKey];
  if (value && value.length >= 16) return value;
  const ephemeral = crypto.randomBytes(48).toString('hex');
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envKey} must be set in production`);
  }
  console.warn(`[auth] ${envKey} not set; using an ephemeral dev secret (sessions won't survive a backend restart). Set ${envKey} in .env for stable sessions.`);
  return ephemeral;
}

const ACCESS_SECRET = resolveSecret('JWT_ACCESS_SECRET', 'access');
const REFRESH_SECRET = resolveSecret('JWT_REFRESH_SECRET', 'refresh');
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

export function signAccessToken(userId) {
  const userIdNumber = Number(userId);
  return jwt.sign({ sub: String(userIdNumber), type: 'access' }, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    if (payload.type !== 'access') return null;
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function generateRefreshToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export { REFRESH_SECRET };
