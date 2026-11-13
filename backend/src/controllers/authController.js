import * as authService from '../services/authService.js';
import * as travellerService from '../services/travellerService.js';
import * as userRepo from '../repositories/userRepository.js';
import { unauthorized } from '../utils/httpError.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: authService.REFRESH_TTL_MS,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
}

export async function signup(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.signup(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    setRefreshCookie(res, refreshToken);
    res.json({ user, accessToken });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    const result = authService.rotateRefresh(token);
    setRefreshCookie(res, result.refreshToken);
    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (error) {
    next(error);
  }
}

export function logout(req, res, next) {
  try {
    authService.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export function me(req, res, next) {
  try {
    if (!req.userId) {
      throw unauthorized('UNAUTHENTICATED', 'Authentication required.');
    }
    const user = userRepo.findPublicById(req.userId);
    if (!user) {
      throw unauthorized('UNAUTHENTICATED', 'Authentication required.');
    }
    const traveller = travellerService.getOwnProfile(req.userId);
    res.json({ user, traveller });
  } catch (error) {
    next(error);
  }
}
