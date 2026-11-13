
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import {
  useInterestLabels,
  formatDate,
  formatInr,
  formatInterestList,
} from '../utils/interests.js';

const DESTINATIONS = [
  'Tokyo',
  'Kyoto',
  'Osaka',
  'Dubai',
  'Abu Dhabi',
];

const MIN_DATE = '2027-04-01';
const MAX_DATE = '2027-04-20';

// Check whether a person's preference allows another gender.
function genderAllows(preference, myGender, otherGender) {
  if (!myGender || !otherGender) return false;

  if (preference === 'ANY') return true;

  if (preference === 'SAME_GENDER') {
    return myGender === otherGender;
  }

  if (preference === 'OPPOSITE_GENDER') {
    return myGender !== otherGender;
  }

  return false;
}

// Convert an ISO date to UTC milliseconds.
function toUtcTime(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) {
    return NaN;
  }

  const time = Date.parse(`${dateString}T00:00:00Z`);

  if (!Number.isFinite(time)) return NaN;

  // Reject impossible dates that JavaScript could normalize.
  if (
    new Date(time).toISOString().slice(0, 10) !== dateString
  ) {
    return NaN;
  }

  return time;
}

// Calculate overlapping nights between two date ranges.
function calculateOverlapNights(
  groupCheckIn,
  groupCheckOut,
  seekerCheckIn,
  seekerCheckOut
) {
  const start = Math.max(
    toUtcTime(groupCheckIn),
    toUtcTime(seekerCheckIn)
  );

  const end = Math.min(
    toUtcTime(groupCheckOut),
    toUtcTime(seekerCheckOut)
  );

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, (end - start) / 86400000);
}

// Validate the seeker's travel preferences.
function validatePreferences(preferences) {
  const budget = Number(preferences.budget_inr);

  if (!DESTINATIONS.includes(preferences.destination)) {
    return 'Please select a destination.';
  }

  const checkIn = toUtcTime(preferences.check_in);
  const checkOut = toUtcTime(preferences.check_out);

  if (!Number.isFinite(checkIn) || !Number.isFinite(checkOut)) {
    return 'Please enter valid check-in and check-out dates.';
  }

  if (
    preferences.check_in < MIN_DATE ||
    preferences.check_out > MAX_DATE
  ) {
    return 'Dates must be between 1 and 20 April 2027.';
  }

  if (checkOut <= checkIn) {
    return 'Check-out must be after check-in.';
  }

  if (!Number.isInteger(budget) || budget <= 0) {
    return 'Please enter a positive whole-number budget.';
  }

  return '';
}

// All six mandatory matching conditions.
// Frontend check is only for UI feedback.
// Backend must independently enforce eligibility.
function localEligibility(group, traveller, tripPreferences) {
  const failed = [];
  const explanations = [];

  const owner = group.owner || {};
  const spots =
    group.available_spots ??
    (Number(group.max_size) - Number(group.member_count));

  // 1. GROUP CAPACITY
  if (spots <= 0) {
    failed.push('GROUP_FULL');
    explanations.push('Group is full');
  } else {
    explanations.push(
      `${spots} spot${spots === 1 ? '' : 's'} remaining`
    );
  }

  // 2. COMMON INTERESTS
  const seekerInterests = traveller.interests || [];
  const ownerInterests = owner.interests || [];

  const sharedInterests = seekerInterests.filter(
    (interest) => ownerInterests.includes(interest)
  );

  const sharedCount = new Set(sharedInterests).size;

  if (sharedCount < 2) {
    failed.push('NOT_ENOUGH_SHARED_INTERESTS');
    explanations.push(
      `Only ${sharedCount} shared interests (minimum 2 required)`
    );
  } else {
    explanations.push(`${sharedCount} shared interests`);
  }

  // 3. MUTUAL GENDER COMPATIBILITY
  const seekerAllowsOwner = genderAllows(
    traveller.gender_preference,
    traveller.gender,
    owner.gender
  );

  const ownerAllowsSeeker = genderAllows(
    owner.gender_preference,
    owner.gender,
    traveller.gender
  );

  if (!seekerAllowsOwner || !ownerAllowsSeeker) {
    failed.push('GENDER_PREFERENCE_MISMATCH');
    explanations.push('Gender preferences are not compatible');
  } else {
    explanations.push('Gender preferences are compatible');
  }

  // 4. DESTINATION
  if (group.city !== tripPreferences.destination) {
    failed.push('DESTINATION_MISMATCH');
    explanations.push(
      `Destination mismatch: group is visiting ${group.city}`
    );
  } else {
    explanations.push('Destination matches');
  }

  // 5. DATE OVERLAP
  const overlappingNights = calculateOverlapNights(
    group.check_in,
    group.check_out,
    tripPreferences.check_in,
    tripPreferences.check_out
  );

  if (overlappingNights < 2) {
    failed.push('INSUFFICIENT_DATE_OVERLAP');
    explanations.push(
      `Only ${overlappingNights} overlapping nights (minimum 2 required)`
    );
  } else {
    explanations.push(`${overlappingNights} overlapping nights`);
  }

  // 6. BUDGET COMPATIBILITY
  const groupBudget = Number(group.budget_inr);
  const seekerBudget = Number(tripPreferences.budget_inr);

  const lowerBudget = Math.min(groupBudget, seekerBudget);
  const difference = Math.abs(groupBudget - seekerBudget);

  if (
    !Number.isFinite(lowerBudget) ||
    lowerBudget <= 0 ||
    difference > 0.4 * lowerBudget
  ) {
    failed.push('BUDGET_MISMATCH');
    explanations.push('Budget difference exceeds 40%');
  } else {
    explanations.push('Budgets are compatible');
  }

  return {
    eligible: failed.length === 0,
    failed,
    explanations,
  };
}

function statusBadge(status) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="badge badge-open">
          Request Pending
        </span>
      );

    case 'APPROVED':
      return (
        <span className="badge badge-open">
          Member
        </span>
      );

    case 'REJECTED':
      return (
        <span className="badge badge-full">
          Rejected
        </span>
      );

    default:
      return null;
  }
}

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const { traveller } = useAuth();
  const labels = useInterestLabels();

  const [group, setGroup] = useState(null);
  const [requests, setRequests] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Seeker's OWN trip preferences.
  const [tripPreferences, setTripPreferences] = useState({
    destination: '',
    check_in: '',
    check_out: '',
    budget_inr: '',
  });

  function updatePreference(field, value) {
    setTripPreferences((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function loadGroup() {
    try {
      const { group: data } = await api.getGroup(groupId);
      setGroup(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setGroup(null);
    setRequests(null);
    setError('');
    loadGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function loadRequests() {
    try {
      const { requests: data } =
        await api.getGroupRequests(groupId);

      setRequests(data);
    } catch (err) {
      setError(err.message);
    }
  }

  // Preferences validation.
  const preferenceError = validatePreferences(tripPreferences);

  // Eligibility is evaluated only once preferences are valid.
  const eligibility =
    group && traveller && !preferenceError
      ? localEligibility(group, traveller, tripPreferences)
      : null;

  async function onInterested() {
    if (!traveller || !eligibility?.eligible || busy) {
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      // Send the SEEKER'S preferences, not the group values.
      await api.sendJoinRequest(groupId, {
        destination: tripPreferences.destination,
        check_in: tripPreferences.check_in,
        check_out: tripPreferences.check_out,
        budget_inr: Number(tripPreferences.budget_inr),
        interests: traveller.interests || [],
      });

      setNotice(
        'Interest sent successfully — waiting for owner approval.'
      );

      await loadGroup();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(requestId, action) {
    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.decideRequest(requestId, action);

      await loadRequests();
      await loadGroup();

      setNotice(
        action === 'approve'
          ? 'Request approved successfully.'
          : 'Request rejected.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="container status">
          Loading group…
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="container">
          <div className="alert alert-error">
            {error || 'Group not found.'}
          </div>

          <Link to="/explore" className="button secondary">
            Back to Explore
          </Link>
        </div>
      </Layout>
    );
  }

  const isOwner = group.viewer_role === 'OWNER';
  const isMember = group.viewer_role === 'MEMBER';
  const isRequester = group.viewer_role === 'REQUESTER';
  const isOther = group.viewer_role === 'OTHER';

  return (
    <Layout>
      <div className="container wide">
        <Link to="/explore" className="text-button">
          ← Explore
        </Link>

        {/* GROUP HEADER */}
        <div className="details-header">
          <span className="badge">{group.city}</span>

          <span
            className={`badge ${
              group.status === 'FULL'
                ? 'badge-full'
                : 'badge-open'
            }`}
          >
            {group.status === 'FULL' ? 'Full' : 'Open'}
          </span>

          <h1>{group.name}</h1>
        </div>

        <p className="group-card-meta">
          {formatDate(group.check_in)}
          {' → '}
          {formatDate(group.check_out)}
          {' · '}
          {formatInr(group.budget_inr)} / person
        </p>

        {isOwner && (
          <div className="alert alert-info">
            You are the creator of this group.
            View and manage join requests below.
          </div>
        )}

        <div className="detail-grid">
          {/* LEFT SIDE: GROUP INFORMATION */}
          <section>
            <h2>Itinerary</h2>

            <p>
              {group.itinerary || 'No itinerary provided.'}
            </p>

            <h2>Owner</h2>

            <dl className="profile-list">
              <div>
                <dt>Name</dt>
                <dd>{group.owner?.name}</dd>
              </div>

              <div>
                <dt>Gender</dt>
                <dd>{group.owner?.gender || 'Not available'}</dd>
              </div>

              <div>
                <dt>Grouping Preference</dt>
                <dd>
                  {group.owner?.gender_preference || 'Not available'}
                </dd>
              </div>

              <div>
                <dt>Interests</dt>
                <dd>
                  {formatInterestList(
                    labels,
                    group.owner?.interests || []
                  )}
                </dd>
              </div>
            </dl>

            <h2>
              Members ({group.member_count}/{group.max_size})
            </h2>

            {!group.members?.length ? (
              <p className="hint">No members yet.</p>
            ) : (
              <ul className="member-list">
                {group.members.map((member) => (
                  <li key={member.traveller_id}>
                    <span>{member.name}</span>

                    <span className="badge">
                      {member.role === 'owner'
                        ? 'Creator'
                        : 'Member'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* RIGHT SIDE: ACTIONS */}
          <aside>
            {notice && (
              <div className="alert alert-success">
                {notice}
              </div>
            )}

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            {/* OWNER ACTIONS */}
            {isOwner && (
              <div className="card action-card">
                <h3>Manage Requests</h3>

                {requests === null && (
                  <button
                    type="button"
                    className="primary"
                    onClick={loadRequests}
                  >
                    Load pending requests
                  </button>
                )}

                {requests !== null && (
                  <RequestList
                    requests={requests}
                    onDecide={onDecide}
                    labels={labels}
                    busy={busy}
                  />
                )}
              </div>
            )}

            {/* EXISTING MEMBER */}
            {isMember && (
              <div className="card action-card">
                <span className="badge badge-open">
                  You are a member of this group
                </span>
              </div>
            )}

            {/* EXISTING REQUEST */}
            {isRequester && (
              <div className="card action-card">
                {statusBadge(group.requester_status)}

                {group.requester_status === 'PENDING' && (
                  <p className="hint">
                    Waiting for the owner to respond.
                  </p>
                )}

                {group.requester_status === 'REJECTED' && (
                  <p className="hint">
                    The owner rejected your request.
                  </p>
                )}
              </div>
            )}

            {/* NEW SEEKER */}
            {isOther && (
              <div className="card action-card">
                <h3>Join this group</h3>

                <p className="hint">
                  Enter your travel preferences to check
                  whether this group is compatible with you.
                </p>

                {/* DESTINATION */}
                <label>
                  Destination

                  <select
                    value={tripPreferences.destination}
                    onChange={(event) =>
                      updatePreference(
                        'destination',
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Select destination
                    </option>

                    {DESTINATIONS.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>

                {/* CHECK-IN */}
                <label>
                  Your Check-in Date

                  <input
                    type="date"
                    min={MIN_DATE}
                    max={MAX_DATE}
                    value={tripPreferences.check_in}
                    onChange={(event) =>
                      updatePreference(
                        'check_in',
                        event.target.value
                      )
                    }
                  />
                </label>

                {/* CHECK-OUT */}
                <label>
                  Your Check-out Date

                  <input
                    type="date"
                    min={MIN_DATE}
                    max={MAX_DATE}
                    value={tripPreferences.check_out}
                    onChange={(event) =>
                      updatePreference(
                        'check_out',
                        event.target.value
                      )
                    }
                  />
                </label>

                {/* BUDGET */}
                <label>
                  Your Budget (INR)

                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter your budget"
                    value={tripPreferences.budget_inr}
                    onChange={(event) =>
                      updatePreference(
                        'budget_inr',
                        event.target.value
                      )
                    }
                  />
                </label>

                {/* FORM VALIDATION */}
                {preferenceError ? (
                  <p className="hint">
                    {preferenceError}
                  </p>
                ) : (
                  <>
                    <h4>Compatibility Results</h4>

                    {eligibility && (
                      <div className="match-box">
                        {eligibility.explanations.map(
                          (explanation, index) => (
                            <p key={index} className="hint">
                              {explanation}
                            </p>
                          )
                        )}

                        {eligibility.eligible ? (
                          <div className="alert alert-success">
                            All six matching conditions passed!
                          </div>
                        ) : (
                          <div className="alert alert-error">
                            Some matching conditions failed.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* INTERESTED BUTTON */}
                <button
                  type="button"
                  className="primary"
                  onClick={onInterested}
                  disabled={
                    busy ||
                    Boolean(preferenceError) ||
                    !eligibility?.eligible
                  }
                >
                  {busy ? 'Sending…' : 'Interested'}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}

// OWNER REQUEST LIST
function RequestList({ requests, onDecide, labels, busy }) {
  if (requests.length === 0) {
    return (
      <p className="hint">
        No join requests yet.
      </p>
    );
  }

  return (
    <ul className="request-list">
      {requests.map((req) => (
        <li key={req.id} className="request-item">
          <div className="request-head">
            <strong>{req.name}</strong>

            <span
              className={`badge ${
                req.status === 'PENDING'
                  ? 'badge-open'
                  : 'badge-full'
              }`}
            >
              {req.status}
            </span>
          </div>

          <p className="group-card-meta">
            {req.age}
            {' · '}
            {req.gender}
            {' · '}
            {req.home_city}
          </p>

          <p className="group-card-meta">
            Interests:{' '}
            {formatInterestList(labels, req.interests || [])}
          </p>

          <p className="group-card-meta">
            {formatDate(req.check_in)}
            {' → '}
            {formatDate(req.check_out)}
            {' · '}
            {formatInr(req.budget_inr)}
          </p>

          {req.status === 'PENDING' && (
            <div className="actions">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() =>
                  onDecide(req.id, 'approve')
                }
              >
                Approve
              </button>

              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  onDecide(req.id, 'reject')
                }
              >
                Reject
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
