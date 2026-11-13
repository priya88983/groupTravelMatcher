import db from '../config/database.js';

const SELECTION_SELECT = `
  SELECT id, group_id, hotel_id, room_id, check_in, check_out,
         rooms_count, price_per_night, currency, room_capacity,
         created_by, created_at, updated_at
  FROM hotel_selections
`;

export function createSelection({
  groupId,
  hotelId,
  roomId,
  checkIn,
  checkOut,
  roomsCount,
  pricePerNight,
  currency = 'INR',
  roomCapacity,
  createdBy,
}) {
  const result = db.prepare(`
    INSERT INTO hotel_selections
      (group_id, hotel_id, room_id, check_in, check_out, rooms_count,
       price_per_night, currency, room_capacity, created_by)
    VALUES (@groupId, @hotelId, @roomId, @checkIn, @checkOut, @roomsCount,
            @pricePerNight, @currency, @roomCapacity, @createdBy)
  `).run({
    groupId,
    hotelId,
    roomId,
    checkIn,
    checkOut,
    roomsCount,
    pricePerNight,
    currency,
    roomCapacity,
    createdBy,
  });
  return findById(Number(result.lastInsertRowid));
}

export function findById(id) {
  return db.prepare(`${SELECTION_SELECT} WHERE id = ?`).get(id);
}

export function listByGroup(groupId) {
  return db
    .prepare(`${SELECTION_SELECT} WHERE group_id = ? ORDER BY check_in ASC, id ASC`)
    .all(groupId);
}

export function updateSelection(id, fields) {
  db.prepare(`
    UPDATE hotel_selections
    SET hotel_id = @hotelId, room_id = @roomId, check_in = @checkIn,
        check_out = @checkOut, rooms_count = @roomsCount,
        price_per_night = @pricePerNight, room_capacity = @roomCapacity,
        updated_at = datetime('now')
    WHERE id = @id
  `).run({ id, ...fields });
  return findById(id);
}

export function deleteSelection(id) {
  db.prepare('DELETE FROM hotel_selections WHERE id = ?').run(id);
}

export function deleteByGroup(groupId) {
  db.prepare('DELETE FROM hotel_selections WHERE group_id = ?').run(groupId);
}

export function countByGroup(groupId) {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM hotel_selections WHERE group_id = ?')
    .get(groupId);
  return Number(row.n);
}
