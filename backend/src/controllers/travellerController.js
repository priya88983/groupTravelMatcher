import * as travellerService from '../services/travellerService.js';
import { notFound } from '../utils/httpError.js';

export function getMe(req, res, next) {
  try {
    const profile = travellerService.getOwnProfile(req.userId);
    if (!profile) {
      throw notFound('PROFILE_NOT_FOUND', 'No traveller profile exists for this account.');
    }
    res.json({ traveller: profile });
  } catch (error) {
    next(error);
  }
}

export function putMe(req, res, next) {
  try {
    const traveller = travellerService.upsertProfile(req.userId, req.body);
    res.status(201).json({ traveller });
  } catch (error) {
    next(error);
  }
}
