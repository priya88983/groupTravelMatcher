import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import * as refreshRepo from '../repositories/refreshSessionRepository.js';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../utils/tokens.js';
import { HttpError } from '../utils/httpError.js';
import { isEmail, passwordIsStrong } from '../middleware/validate.js';

const BCRYPT_ROUNDS = 10;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function issueRefreshSession(userId, familyId) {
  const token = generateRefreshToken();
  const expiresAt = Date.now() + REFRESH_TTL_MS;
  refreshRepo.create({ userId, tokenHash: hashRefreshToken(token), familyId, expiresAt });
  return token;
}

export async function signup({ email, password }) {
  const normalized = String(email).trim().toLowerCase();
  if (!isEmail(normalized)) {
    throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  }
  if (!passwordIsStrong(password)) {
    throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters and contain letters and numbers.');
  }
  if (userRepo.findByEmail(normalized)) {
    throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = userRepo.create({ email: normalized, passwordHash });
  const familyId = crypto.randomUUID();
  const refreshToken = issueRefreshSession(userId, familyId);
  const accessToken = signAccessToken(userId);

  return { user: userRepo.findPublicById(userId), accessToken, refreshToken };
}

export async function login({ email, password }) {
  const normalized = String(email).trim().toLowerCase();
  const user = userRepo.findByEmail(normalized);
  const passwordIsValid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !passwordIsValid) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
  }

  const familyId = crypto.randomUUID();
  const refreshToken = issueRefreshSession(user.id, familyId);
  const accessToken = signAccessToken(user.id);

  return { user: userRepo.findPublicById(user.id), accessToken, refreshToken };
}

export function rotateRefresh(refreshToken) {
  if (!refreshToken) {
    throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh session.');
  }
  const session = refreshRepo.findByTokenHash(hashRefreshToken(refreshToken));

  if (!session) {
    throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh session.');
  }
  if (session.revoked) {
    // Reuse of an already-rotated/revoked token: revoke the entire family.
    refreshRepo.revokeFamily(session.family_id);
    throw new HttpError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected. Session revoked.');
  }
  if (Date.now() > session.expires_at) {
    refreshRepo.revoke(session.id);
    throw new HttpError(401, 'REFRESH_EXPIRED', 'Refresh session expired.');
  }

  const newToken = generateRefreshToken();
  const newExpiresAt = Date.now() + REFRESH_TTL_MS;
  const replacementId = refreshRepo.create({
    userId: session.user_id,
    tokenHash: hashRefreshToken(newToken),
    familyId: session.family_id,
    expiresAt: newExpiresAt,
  });
  refreshRepo.markReplaced(session.id, replacementId);

  return {
    user: userRepo.findPublicById(session.user_id),
    accessToken: signAccessToken(session.user_id),
    refreshToken: newToken,
  };
}

export function logout(refreshToken) {
  if (!refreshToken) return;
  const session = refreshRepo.findByTokenHash(hashRefreshToken(refreshToken));
  if (session) refreshRepo.revoke(session.id);
}
