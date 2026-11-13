import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTravelPreferences } from '../context/TravelPreferencesContext.jsx';
import { evaluateEligibility } from '../utils/eligibility.js';
import { api } from '../services/api.js';
import {
  useInterestLabels,
  formatDate,
  formatInr,
  formatInterestList,
} from '../utils/interests.js';

function statusBadge(status) {
  switch (status) {
    case 'PENDING':
      return <span className="badge badge-open">Request Pending</span>;
    case 'APPROVED':
      return <span className="badge badge-open">Member</span>;
    case 'REJECTED':
      return <span className="badge badge-full">Rejected</span>;
    default:
      return null;
  }
}

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const { traveller } = useAuth();
  const { preferences, hasCompletePreferences } = useTravelPreferences();
  const labels = useInterestLabels();

  const [group, setGroup] = useState(null);
  const [requests, setRequests] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

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
      const { requests: data } = await api.getGroupRequests(groupId);
      setRequests(data);
    } catch (err) {
      setError(err.message);
    }
  }

  // Eligibility uses the centralized shared preferences + profile. The backend
  // remains authoritative and re-validates on submit.
  const eligibility =
    group && traveller && hasCompletePreferences
      ? evaluateEligibility(group, traveller, preferences)
      : null;

  async function onInterested() {
    if (!traveller || !eligibility?.eligible || busy) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      // Send the SEEKER'S shared preferences, not the group's values.
      await api.sendJoinRequest(groupId, {
        destination: preferences.destination,
        check_in: preferences.check_in,
        check_out: preferences.check_out,
        budget_inr: Number(preferences.budget_inr),
        interests: traveller.interests || [],
      });

      setNotice('Interest sent successfully — waiting for owner approval.');
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
      setNotice(action === 'approve' ? 'Request approved successfully.' : 'Request rejected.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="container status">Loading group…</div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="container">
          <div className="alert alert-error">{error || 'Group not found.'}</div>
          <Link to="/explore" className="button secondary">Back to Explore</Link>
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
        <Link to="/explore" className="text-button">← Explore</Link>

        {/* GROUP HEADER */}
        <div className="details-header">
          <span className="badge">{group.city}</span>
          <span className={`badge ${group.status === 'FULL' ? 'badge-full' : 'badge-open'}`}>
            {group.status === 'FULL' ? 'Full' : 'Open'}
          </span>
          <h1>{group.name}</h1>
        </div>

        <p className="group-card-meta">
          {formatDate(group.check_in)} → {formatDate(group.check_out)} · {formatInr(group.budget_inr)} / person
        </p>

        {isOwner && (
          <div className="alert alert-info">
            You are the creator of this group. View and manage join requests below.
          </div>
        )}

        <div className="detail-grid">
          {/* LEFT: GROUP INFORMATION */}
          <section>
            <h2>Itinerary</h2>
            <p>{group.itinerary || 'No itinerary provided.'}</p>

            <h2>Owner</h2>
            <dl className="profile-list">
              <div><dt>Name</dt><dd>{group.owner?.name}</dd></div>
              <div><dt>Gender</dt><dd>{group.owner?.gender || 'Not available'}</dd></div>
              <div><dt>Grouping Preference</dt><dd>{group.owner?.gender_preference || 'Not available'}</dd></div>
              <div><dt>Interests</dt><dd>{formatInterestList(labels, group.owner?.interests || [])}</dd></div>
            </dl>

            <h2>Members ({group.member_count}/{group.max_size})</h2>
            {!group.members?.length ? (
              <p className="hint">No members yet.</p>
            ) : (
              <ul className="member-list">
                {group.members.map((member) => (
                  <li key={member.traveller_id}>
                    <span>{member.name}</span>
                    <span className="badge">
                      {member.role === 'owner' ? 'Creator' : 'Member'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* RIGHT: ACTIONS */}
          <aside>
            {notice && <div className="alert alert-success">{notice}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            {/* OWNER ACTIONS */}
            {isOwner && (
              <div className="card action-card">
                <h3>Manage Requests</h3>
                {requests === null ? (
                  <button type="button" className="primary" onClick={loadRequests}>
                    Load pending requests
                  </button>
                ) : (
                  <RequestList requests={requests} onDecide={onDecide} labels={labels} busy={busy} />
                )}
                <div className="actions">
                  <Link to={`/groups/${group.group_id}/hotels`} className="button secondary">
                    View Hotels
                  </Link>
                </div>
              </div>
            )}

            {/* EXISTING MEMBER */}
            {isMember && (
              <div className="card action-card">
                <span className="badge badge-open">You are a member of this group</span>
                <div className="actions">
                  <Link to={`/groups/${group.group_id}/hotels`} className="button secondary">
                    View Hotels
                  </Link>
                </div>
              </div>
            )}

            {/* EXISTING REQUEST */}
            {isRequester && (
              <div className="card action-card">
                {statusBadge(group.requester_status)}
                {group.requester_status === 'PENDING' && (
                  <p className="hint">Waiting for the owner to respond.</p>
                )}
                {group.requester_status === 'REJECTED' && (
                  <p className="hint">The owner rejected your request.</p>
                )}
              </div>
            )}

            {/* NEW SEEKER */}
            {isOther && (
              <div className="card action-card">
                <h3>Join this group</h3>

                {!hasCompletePreferences ? (
                  <>
                    <p className="hint">
                      Set your travel preferences to check compatibility with this group.
                    </p>
                    <div className="actions">
                      <Link to="/search" className="button secondary">
                        Edit preferences
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="hint">
                      Checking compatibility against your saved preferences.
                    </p>
                    <h4>Compatibility Results</h4>
                    {eligibility && (
                      <div className="match-box">
                        {eligibility.explanations.map((explanation) => (
                          <p key={explanation} className="hint">{explanation}</p>
                        ))}
                        {eligibility.eligible ? (
                          <div className="alert alert-success">All six matching conditions passed!</div>
                        ) : (
                          <div className="alert alert-error">Some matching conditions failed.</div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="primary"
                      onClick={onInterested}
                      disabled={busy || !eligibility?.eligible}
                    >
                      {busy ? 'Sending…' : 'Interested'}
                    </button>
                  </>
                )}
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
    return <p className="hint">No join requests yet.</p>;
  }

  return (
    <ul className="request-list">
      {requests.map((req) => (
        <li key={req.id} className="request-item">
          <div className="request-head">
            <strong>{req.name}</strong>
            <span className={`badge ${req.status === 'PENDING' ? 'badge-open' : 'badge-full'}`}>
              {req.status}
            </span>
          </div>
          <p className="group-card-meta">
            {req.age} · {req.gender} · {req.home_city}
          </p>
          <p className="group-card-meta">
            Interests: {formatInterestList(labels, req.interests || [])}
          </p>
          <p className="group-card-meta">
            {formatDate(req.check_in)} → {formatDate(req.check_out)} · {formatInr(req.budget_inr)}
          </p>
          {req.status === 'PENDING' && (
            <div className="actions">
              <button type="button" className="primary" disabled={busy} onClick={() => onDecide(req.id, 'approve')}>
                Approve
              </button>
              <button type="button" className="button secondary" disabled={busy} onClick={() => onDecide(req.id, 'reject')}>
                Reject
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
