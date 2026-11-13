// Centralized travel preferences shared across the whole discovery flow.
//
// This context owns ONLY the four trip-specific values. Interests, gender and
// gender preference always come from the authenticated traveller profile via
// AuthContext — they are never duplicated here.
//
// Trip preferences are persisted per authenticated account in namespaced
// localStorage (keyed by the account's stable id). Secrets (JWT, passwords)
// are never stored. The context waits until session restoration completes
// before loading persisted preferences, and it resets on logout/account switch
// so one user's preferences are never shown to another.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext.jsx';

export const DESTINATIONS = ['Tokyo', 'Kyoto', 'Osaka', 'Dubai', 'Abu Dhabi'];
export const MIN_DATE = '2027-04-01';
export const MAX_DATE = '2027-04-20';

export const EMPTY_PREFERENCES = {
  destination: '',
  check_in: '',
  check_out: '',
  budget_inr: '',
};

const STORAGE_PREFIX = 'gtm:travel-preferences';

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId}`;
}

// Convert ISO date to UTC milliseconds (rejects impossible dates).
export function toUtcTime(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return NaN;
  const time = Date.parse(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(time)) return NaN;
  if (new Date(time).toISOString().slice(0, 10) !== dateString) return NaN;
  return time;
}

// Pure validator. Returns { field: message } for each invalid field.
export function validateTravelPreferences(preferences) {
  const errors = {};

  if (!DESTINATIONS.includes(preferences.destination)) {
    errors.destination = 'Please select a destination.';
  }

  const checkIn = toUtcTime(preferences.check_in);
  if (!Number.isFinite(checkIn)) {
    errors.check_in = 'Enter a valid check-in date.';
  } else if (preferences.check_in < MIN_DATE || preferences.check_in > MAX_DATE) {
    errors.check_in = 'Check-in must be between 1 and 20 April 2027.';
  }

  const checkOut = toUtcTime(preferences.check_out);
  if (!Number.isFinite(checkOut)) {
    errors.check_out = 'Enter a valid check-out date.';
  } else if (preferences.check_out < MIN_DATE || preferences.check_out > MAX_DATE) {
    errors.check_out = 'Check-out must be between 1 and 20 April 2027.';
  }

  if (Number.isFinite(checkIn) && Number.isFinite(checkOut) && checkOut <= checkIn) {
    errors.check_out = 'Check-out must be after check-in.';
  }

  const budget = Number(preferences.budget_inr);
  if (!Number.isInteger(budget) || budget <= 0) {
    errors.budget_inr = 'Enter a positive whole-number budget (INR).';
  }

  return errors;
}

const TravelPreferencesContext = createContext(null);

export function TravelPreferencesProvider({ children }) {
  const { user, status } = useAuth();
  const userId = status === 'authenticated' ? user?.id ?? null : null;

  const [preferences, setPreferences] = useState({ ...EMPTY_PREFERENCES });
  const [loadedForUser, setLoadedForUser] = useState(null);

  // Wait until the authenticated user is known, then load that user's saved
  // preferences. On logout/account switch we reset memory and key on the new id.
  useEffect(() => {
    if (!userId) {
      setPreferences({ ...EMPTY_PREFERENCES });
      setLoadedForUser(null);
      return;
    }
    if (userId === loadedForUser) return;

    let parsed = {};
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (raw) parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    setPreferences({ ...EMPTY_PREFERENCES, ...parsed });
    setLoadedForUser(userId);
  }, [userId, loadedForUser]);

  const persist = useCallback(
    (next) => {
      if (loadedForUser) {
        try {
          localStorage.setItem(storageKey(loadedForUser), JSON.stringify(next));
        } catch {
          /* storage unavailable (private mode) — preferences stay in memory */
        }
      }
    },
    [loadedForUser],
  );

  const updatePreferences = useCallback(
    (patch) => {
      setPreferences((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetPreferences = useCallback(() => {
    const next = { ...EMPTY_PREFERENCES };
    setPreferences(next);
    persist(next);
  }, [persist]);

  const validationErrors = useMemo(
    () => validateTravelPreferences(preferences),
    [preferences],
  );

  const hasCompletePreferences = useMemo(() => {
    if (Object.keys(validationErrors).length > 0) return false;
    return Boolean(
      preferences.destination &&
        preferences.check_in &&
        preferences.check_out &&
        preferences.budget_inr !== '',
    );
  }, [preferences, validationErrors]);

  const value = {
    preferences,
    updatePreferences,
    resetPreferences,
    hasCompletePreferences,
    validationErrors,
  };

  return (
    <TravelPreferencesContext.Provider value={value}>
      {children}
    </TravelPreferencesContext.Provider>
  );
}

export function useTravelPreferences() {
  return useContext(TravelPreferencesContext);
}
