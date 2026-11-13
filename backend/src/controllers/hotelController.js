import * as hotelService from '../services/hotelService.js';

export function listOptions(req, res, next) {
  try {
    const data = hotelService.listHotelOptions(req.params.groupId, req.userId, req.query);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export function getPlan(req, res, next) {
  try {
    const data = hotelService.getHotelPlan(req.params.groupId, req.userId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export function saveSelection(req, res, next) {
  try {
    const data = hotelService.saveSelection(req.params.groupId, req.userId, req.body);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

export function updateSelection(req, res, next) {
  try {
    const data = hotelService.updateSelection(
      req.params.groupId,
      req.userId,
      req.params.selectionId,
      req.body,
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export function removeSelection(req, res, next) {
  try {
    const data = hotelService.deleteSelection(
      req.params.groupId,
      req.userId,
      req.params.selectionId,
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
}
