import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = (name) => resolve(here, `../../../data/catalog/${name}.json`);

const hotels = JSON.parse(readFileSync(catalogPath('hotels'), 'utf8'));
const rooms = JSON.parse(readFileSync(catalogPath('rooms'), 'utf8'));
const availability = JSON.parse(readFileSync(catalogPath('availability'), 'utf8'));

const hotelsByCity = new Map();
for (const hotel of hotels) {
  const city = String(hotel.city || '').toLowerCase();
  if (!hotelsByCity.has(city)) hotelsByCity.set(city, []);
  hotelsByCity.get(city).push(hotel);
}

const roomsByHotel = new Map();
for (const room of rooms) {
  if (!roomsByHotel.has(room.hotel_id)) roomsByHotel.set(room.hotel_id, []);
  roomsByHotel.get(room.hotel_id).push(room);
}

const availabilityByRoom = new Map();
for (const entry of availability) {
  if (!availabilityByRoom.has(entry.room_id)) availabilityByRoom.set(entry.room_id, new Map());
  availabilityByRoom.get(entry.room_id).set(entry.date, Number(entry.rooms_left));
}

export function getHotelsByCity(city) {
  if (typeof city !== 'string') return [];
  return hotelsByCity.get(city.toLowerCase()) || [];
}

export function getHotelById(hotelId) {
  return hotels.find((h) => h.hotel_id === hotelId) || null;
}

export function getRoomsForHotel(hotelId) {
  return roomsByHotel.get(hotelId) || [];
}

export function getRoomById(roomId) {
  return rooms.find((r) => r.room_id === roomId) || null;
}

export function getAvailability(roomId, date) {
  const byDate = availabilityByRoom.get(roomId);
  if (!byDate) return 0;
  const n = byDate.get(date);
  return n == null ? 0 : Number(n);
}

export function roomPriceInr(room) {
  if (!room) return null;
  const price = room.price_per_night;
  if (!price) return null;
  if (typeof price === 'number') return price;
  if (price && typeof price === 'object') return Number(price.amount) || 0;
  return Number(price) || 0;
}

// A room's usable capacity for adult travellers (children not modelled).
export function roomCapacity(room) {
  if (!room) return 0;
  return Math.max(1, Number(room.max_adults) || 1);
}
