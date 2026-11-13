import { Link } from 'react-router-dom';
import { formatDate, formatInr } from '../utils/interests.js';

export default function GroupCard({ group, style = 'card', match }) {
  const spots = group.available_spots ?? (group.max_size - group.member_count);
  const full = spots <= 0;

  return (
    <div className={`group-card ${style}`}>
      <div className="group-card-top">
        <span className="badge">{group.city}</span>
        {group.status ? (
          <span className={`badge ${full ? 'badge-full' : 'badge-open'}`}>
            {full ? 'Full' : 'Open'}
          </span>
        ) : null}
      </div>
      <h3 className="group-card-title">{group.name}</h3>
      <p className="group-card-meta">
        {formatDate(group.check_in)} → {formatDate(group.check_out)}
      </p>
      <p className="group-card-meta">
        {group.owner_name ?? group.owner?.name ?? 'Unknown'} · {formatInr(group.budget_inr)} / person
      </p>
      <p className="group-card-meta">
        {group.member_count}/{group.max_size} members · {Math.max(0, spots)} spot{spots === 1 ? '' : 's'} left
      </p>
      {group.itinerary ? <p className="group-card-itinerary">{group.itinerary}</p> : null}
      {match ? (
        <div className="match-box">
          {match.explanations.map((exp) => (
            <span key={exp} className="chip chip-active">{exp}</span>
          ))}
        </div>
      ) : null}
      <Link to={`/groups/${group.group_id}`} className="button primary">View Details</Link>
    </div>
  );
}
