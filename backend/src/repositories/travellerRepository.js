import crypto from 'node:crypto';
import db from '../config/database.js';

const PROFILE_COLUMNS = `
  traveller_id, user_id, name, age, gender, home_city, home_airport,
  gender_preference, created_at, updated_at
`;

export function findByUserId(userId) {
  return db
    .prepare(`SELECT ${PROFILE_COLUMNS} FROM travellers WHERE user_id = ?`)
    .get(userId);
}

export function findById(travellerId) {
  return db
    .prepare(`SELECT ${PROFILE_COLUMNS} FROM travellers WHERE traveller_id = ?`)
    .get(travellerId);
}

export function findInterests(travellerId) {
  const rows = db
    .prepare('SELECT interest FROM traveller_interests WHERE traveller_id = ? ORDER BY id')
    .all(travellerId);
  return rows.map((row) => row.interest);
}

// Auto-generated IDs use a random suffix (e.g. T-a1b2c3) so they can never
// collide with the seeded dataset ids, which are always of the form T-NNN.
export function nextTravellerId() {
  return `T-${crypto.randomBytes(3).toString('hex')}`;
}

export function createProfile({ travellerId, userId, fields, interests }) {
  const insertTraveller = db.prepare(`
    INSERT INTO travellers (traveller_id, user_id, name, age, gender, home_city, home_airport, gender_preference)
    VALUES (@travellerId, @userId, @name, @age, @gender, @homeCity, @homeAirport, @genderPreference)
  `);
  const insertInterest = db.prepare(
    'INSERT INTO traveller_interests (traveller_id, interest) VALUES (?, ?)',
  );

  const tx = db.transaction(() => {
    insertTraveller.run({
      travellerId,
      userId,
      name: fields.name,
      age: fields.age,
      gender: fields.gender,
      homeCity: fields.homeCity,
      homeAirport: fields.homeAirport,
      genderPreference: fields.genderPreference,
    });
    for (const interest of interests) {
      insertInterest.run(travellerId, interest);
    }
  });
  tx();
  return combineProfile(findById(travellerId), interests);
}

export function updateProfile({ travellerId, fields, interests }) {
  const updateTraveller = db.prepare(`
    UPDATE travellers
    SET name = @name, age = @age, gender = @gender, home_city = @homeCity,
        home_airport = @homeAirport, gender_preference = @genderPreference,
        updated_at = datetime('now')
    WHERE traveller_id = @travellerId
  `);
  const deleteInterests = db.prepare(
    'DELETE FROM traveller_interests WHERE traveller_id = ?',
  );
  const insertInterest = db.prepare(
    'INSERT INTO traveller_interests (traveller_id, interest) VALUES (?, ?)',
  );

  const tx = db.transaction(() => {
    updateTraveller.run({ ...fields, travellerId });
    deleteInterests.run(travellerId);
    for (const interest of interests) {
      insertInterest.run(travellerId, interest);
    }
  });
  tx();
  return combineProfile(findById(travellerId), interests);
}

function combineProfile(row, interests) {
  if (!row) return null;
  const { user_id: _userId, ...profile } = row;
  return { ...profile, interests };
}
