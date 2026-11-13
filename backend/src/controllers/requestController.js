import * as requestService from '../services/requestService.js';

export function send(req, res, next) {
  try {
    const request = requestService.sendRequest(req.params.groupId, req.userId, req.body);
    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
}

export function listForGroup(req, res, next) {
  try {
    const requests = requestService.listForGroup(req.params.groupId, req.userId);
    res.json({ requests });
  } catch (error) {
    next(error);
  }
}

export function profileSummary(req, res, next) {
  try {
    res.json(requestService.profileRequests(req.userId));
  } catch (error) {
    next(error);
  }
}

export function decide(req, res, next) {
  try {
    const request = requestService.decideRequest(req.params.requestId, req.userId, req.body.action);
    res.json({ request });
  } catch (error) {
    next(error);
  }
}
