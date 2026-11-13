import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { useInterestLabels, formatDate, formatInr, formatInterestList } from '../utils/interests.js';

function genderAllows(pref, myGender, otherGender) {
  console.log(pref, otherGender, myGender)
  if (pref === 'ANY') return true;
  if (pref === 'SAME_GENDER') return otherGender === myGender;
  if (pref === 'OPPOSITE_GENDER') return otherGender !== myGender;
  return false;
}

// Lightweight client-side check mirroring the backend rules. The backend
// remains the source of truth and enforces these on join.
function localEligibility(group, traveller) {
  const failed = [];
  const explanations = [];
  const spots = group.available_spots ?? (group.max_size - group.member_count);

  if (spots <= 0) {
    failed.push('GROUP_FULL');
    explanations.push('Group is full');
  } else {
    explanations.push(`${spots} spot${spots === 1 ? '' : 's'} remaining`);
  }

  const shared = (traveller.interests || []).filter((i) => (group.owner?.interests || []).includes(i)).length;
  if (shared < 2) {
    failed.push('NOT_ENOUGH_SHARED_INTERESTS');
    explanations.push(`Needs at least 2 shared interests with the owner (you share ${shared})`);
  } else {
    explanations.push(`${shared} shared interests`);
  }

  const genderOk =
    genderAllows(traveller.gender_preference, traveller.gender, group.owner?.gender) &&
    genderAllows(group.owner?.gender_preference, group.owner?.gender, traveller.gender);

  if (!genderOk) {
    failed.push('GENDER_PREFERENCE_MISMATCH');
    explanations.push('Gender preferences are not mutually compatible');
  } else {
    explanations.push('Compatible gender preference');
  }

  return { eligible: failed.length === 0, failed, explanations };
}

function statusBadge(status) {
  switch (status) {
    case 'PENDING': return <span className="badge badge-open">Request Pending</span>;
    case 'APPROVED': return <span className="badge badge-open">Member</span>;
    case 'REJECTED': return <span className="badge badge-full">Rejected</span>;
    default: return null;
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

  async function loadGroup() {
    try {
      const { group: data } = await api.getGroup(groupId);
      setGroup(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function loadRequests() {
    try {
      const { requests: data } = await api.getGroupRequests(groupId);
      setRequests(data);
    } catch (err) {
      setRequests([]);
    }
  }

  async function onInterested() {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await api.sendJoinRequest(groupId, {
        destination: group.city,
        check_in: group.check_in,
        check_out: group.check_out,
        budget_inr: group.budget_inr,
        interests: traveller.interests,
      });
      setNotice('Interest sent — request pending owner approval.');
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
    try {
      await api.decideRequest(requestId, action);
      await loadRequests();
      await loadGroup();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return (<Layout><div className="container status">Loading group…</div></Layout>);

  if (error && !group) {
    return (
      <Layout>
        <div className="container">
          <div className="alert alert-error">{error}</div>
          <Link to="/explore" className="button secondary">Back to Explore</Link>
        </div>
      </Layout>
    );
  }

  const isOwner = group.viewer_role === 'OWNER';
  const isMember = group.viewer_role === 'MEMBER';
  const elig = traveller ? localEligibility(group, traveller) : null;

  return (
    <Layout>
      <div className="container wide">
        <Link to="/explore" className="text-button">← Explore</Link>
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
          <section>
            <h2>Itinerary</h2>
            <p>{group.itinerary || 'No itinerary provided.'}</p>

            <h2>Owner</h2>
            <dl className="profile-list">
              <div><dt>Name</dt><dd>{group.owner?.name}</dd></div>
              <div><dt>Interests</dt><dd>{formatInterestList(labels, group.owner?.interests)}</dd></div>
            </dl>

            <h2>Members ({group.member_count}/{group.max_size})</h2>
            {group.members.length === 0 ? (
              <p className="hint">No members yet.</p>
            ) : (
              <ul className="member-list">
                {group.members.map((member) => (
                  <li key={member.traveller_id}>
                    <span>{member.name}</span>
                    <span className="badge">{member.role === 'owner' ? 'Creator' : 'Member'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside>
            {notice && <div className="alert alert-success">{notice}</div>}
            {error && <div className="alert alert-error">{error}</div>}

            {isOwner && (
              <div className="card action-card">
                <h3>Manage Requests</h3>
                {!requests && (
                  <button type="button" className="primary" onClick={loadRequests}>Load pending requests</button>
                )}
                {requests && (
                  <RequestList requests={requests} onDecide={onDecide} labels={labels} busy={busy} />
                )}
              </div>
            )}

            {isMember && (
              <div className="card action-card">
                <span className="badge badge-open">You are a member of this group</span>
              </div>
            )}

            {group.viewer_role === 'REQUESTER' && (
              <div className="card action-card">
                {statusBadge(group.requester_status)}
                {group.requester_status === 'REJECTED' && <p className="hint">The owner rejected your request.</p>}
                {group.requester_status === 'PENDING' && <p className="hint">Waiting for the owner to reply.</p>}
              </div>
            )}

            {group.viewer_role === 'OTHER' && (
              <div className="card action-card">
                <h3>Join this group</h3>
                {elig.eligible ? (
                  <button type="button" className="primary" onClick={onInterested} disabled={busy}>
                    {busy ? 'Sending…' : 'Interested'}
                  </button>
                ) : (
                  <div className="match-box">
                    {elig.explanations.map((exp) => (
                      <span key={exp} className="chip chip-disabled">{exp}</span>
                    ))}
                    <p className="hint">This group does not currently match your profile, so joining is disabled.</p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}

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
            <span className={`badge ${req.status === 'PENDING' ? 'badge-open' : 'badge-full'}`}>{req.status}</span>
          </div>
          <p className="group-card-meta">{req.age} · {req.gender} · {req.home_city}</p>
          <p className="group-card-meta">Interests: {formatInterestList(labels, req.interests)}</p>
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
