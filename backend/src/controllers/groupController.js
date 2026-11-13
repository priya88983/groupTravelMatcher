import * as groupService from '../services/groupService.js';

export function create(req, res, next) {
  try {
    const group = groupService.createGroup(req.userId, req.body);
    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
}

export function list(req, res, next) {
  try {
    const data = groupService.listGroups(req.query);
    res.json({ groups: data.groups, total: data.total });
  } catch (error) {
    next(error);
  }
}

export function detail(req, res, next) {
  try {
    const group = groupService.getGroup(req.params.groupId, req.userId);
    res.json({ group });
  } catch (error) {
    next(error);
  }
}

export function search(req, res, next) {
  try {
    const results = groupService.searchGroups(req.userId, req.body);
    res.json({ results });
  } catch (error) {
    next(error);
  }
}

export function myGroups(req, res, next) {
  try {
    const groups = groupService.myGroups(req.userId);
    res.json({ groups });
  } catch (error) {
    next(error);
  }
}
