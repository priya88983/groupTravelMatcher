import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized } from '../utils/httpError.js';

export function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token ? verifyAccessToken(token) : null;
  if (!userId) {
    return next(unauthorized('UNAUTHENTICATED', 'Authentication required.'));
  }
  req.userId = userId;
  next();
}
