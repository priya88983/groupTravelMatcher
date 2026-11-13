
import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { formatDate, formatInr } from '../utils/interests.js';

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function isOwnerRole(viewerRole) {
  return viewerRole === 'OWNER';
}

function getNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;

  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }

  return Math.max(0, (end - start) / 86400000);
}

function getHotelImage(image) {
  if (!image) return '';

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  return `/${image.replace(/^\/+/, '')}`;
}



function BookingSuccessModal({ booking, onClose, onViewBooking }) {
  if (!booking) return null;

  return (
    <div className="booking-modal-overlay">
      <div
        className="booking-modal booking-success-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
      >
        <div className="booking-success-icon">
          ✓
        </div>

        <h2 id="booking-success-title">
          Booking Confirmed!
        </h2>

        <p>
          Your hotel has been successfully added
          to your group's travel plan.
        </p>

        <span className="badge badge-open">
          Mock Booking Confirmed
        </span>

        <div className="booking-summary">
          <div className="booking-summary-row">
            <span>Hotel</span>
            <strong>{booking.hotel_name}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Check-in</span>
            <strong>{formatDate(booking.check_in)}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Check-out</span>
            <strong>{formatDate(booking.check_out)}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Estimated Group Total</span>
            <strong>{formatInr(booking.total_estimated)}</strong>
          </div>
        </div>

        <p className="hint">
          This is a mock booking. No payment has been
          charged and no real hotel reservation was made.
        </p>

        <div className="booking-modal-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="primary"
            onClick={onViewBooking}
          >
            View My Booking
          </button>
        </div>
      </div>
    </div>
  );
}


// --------------------------------------------------
// HOTEL CARD
// --------------------------------------------------

function HotelOptionCard({
  option,
  isOwner,
  onBook,
  busy,
}) {
  return (
    <div className="hotel-card card">

      {option.image && (
        <img
          className="hotel-img"
          src={getHotelImage(option.image)}
          alt={option.hotel_name}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}

      <div className="hotel-body">

        <div className="hotel-top">
          <h3>{option.hotel_name}</h3>

          <span className="badge">
            {option.city}
          </span>
        </div>

        <p className="group-card-meta">
          {option.room_name} · Sleeps {option.capacity}
        </p>

        <p className="group-card-meta">
          Room price:{' '}
          <strong>
            {formatInr(option.price_per_night)}/night
          </strong>
        </p>

        <p className="group-card-meta">
          Rooms needed:{' '}
          <strong>{option.rooms_needed}</strong>
          {' · '}
          {option.nights} nights
        </p>

        <p className="group-card-meta">
          Total estimated price:{' '}
          <strong>
            {formatInr(option.total_estimated)}
          </strong>
        </p>

        <p className="group-card-meta">
          Per-person nightly share:{' '}
          <strong>
            {formatInr(option.per_person_min)}
            {' – '}
            {formatInr(option.per_person_max)}
          </strong>
        </p>

        {isOwner ? (
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy || option.available === false}
              onClick={() => onBook(option)}
            >
              {option.available === false
                ? 'Unavailable'
                : 'Book Hotel'}
            </button>
          </div>
        ) : (
          <p className="hint">
            Your group creator manages hotel bookings.
          </p>
        )}

      </div>
    </div>
  );
}

// --------------------------------------------------
// BOOKING CONFIRMATION MODAL
// --------------------------------------------------

function BookingConfirmationModal({
  option,
  checkIn,
  checkOut,
  busy,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [busy, onClose]);

  if (!option) return null;

  const nights = getNights(checkIn, checkOut);

  return (
    <div
      className="booking-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy
        ) {
          onClose();
        }
      }}
    >
      <div
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >

        <div className="booking-modal-header">
          <span className="badge badge-open">
            Booking confirmation
          </span>

          <button
            type="button"
            className="booking-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close confirmation"
          >
            ×
          </button>
        </div>

        <h2 id="booking-modal-title">
          Confirm Hotel Booking
        </h2>

        <p className="hint">
          Please review your group's accommodation
          details before confirming.
        </p>

        {option.image && (
          <img
            className="booking-modal-image"
            src={getHotelImage(option.image)}
            alt={option.hotel_name}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}

        <h3>{option.hotel_name}</h3>

        <div className="booking-summary">

          <div className="booking-summary-row">
            <span>Destination</span>
            <strong>{option.city}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Room type</span>
            <strong>{option.room_name}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Check-in</span>
            <strong>{formatDate(checkIn)}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Check-out</span>
            <strong>{formatDate(checkOut)}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Number of nights</span>
            <strong>{nights}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Rooms needed</span>
            <strong>{option.rooms_needed}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Price per room / night</span>
            <strong>
              {formatInr(option.price_per_night)}
            </strong>
          </div>

          <div className="booking-summary-row">
            <span>Estimated group total</span>
            <strong>
              {formatInr(option.total_estimated)}
            </strong>
          </div>

          <div className="booking-summary-row">
            <span>Per-person nightly share</span>
            <strong>
              {formatInr(option.per_person_min)}
              {' – '}
              {formatInr(option.per_person_max)}
            </strong>
          </div>

        </div>

        <p className="hint">
          This is a mock booking for group planning.
          No payment will be charged or real hotel
          reservation created. Final availability and
          pricing will be validated on confirmation.
        </p>

        <div className="booking-modal-actions">

          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Go Back
          </button>

          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy
              ? 'Confirming...'
              : 'Confirm Booking'}
          </button>

        </div>

      </div>
    </div>
  );
}

// --------------------------------------------------
// CANCELLATION CONFIRMATION MODAL
// --------------------------------------------------

function CancelBookingModal({
  selection,
  busy,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [busy, onClose]);

  if (!selection) return null;

  return (
    <div
      className="booking-modal-overlay"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy
        ) {
          onClose();
        }
      }}
    >
      <div
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
      >

        <h2 id="cancel-booking-title">
          Cancel Hotel Booking?
        </h2>

        <p>
          Are you sure you want to remove this
          hotel arrangement from your group plan?
        </p>

        <div className="booking-summary">
          <div className="booking-summary-row">
            <span>Hotel</span>
            <strong>{selection.hotel_name}</strong>
          </div>

          <div className="booking-summary-row">
            <span>Check-in</span>
            <strong>
              {formatDate(selection.check_in)}
            </strong>
          </div>

          <div className="booking-summary-row">
            <span>Check-out</span>
            <strong>
              {formatDate(selection.check_out)}
            </strong>
          </div>
        </div>

        <p className="hint">
          The saved hotel arrangement will be removed
          from the group plan. This does not cancel
          any external hotel reservation.
        </p>

        <div className="booking-modal-actions">

          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Keep Booking
          </button>

          <button
            type="button"
            className="button secondary danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy
              ? 'Cancelling...'
              : 'Yes, Cancel Booking'}
          </button>

        </div>

      </div>
    </div>
  );
}

// --------------------------------------------------
// COST BREAKDOWN
// --------------------------------------------------

function CostBreakdown({ selection }) {
  const rows = selection.breakdown?.rows || [];

  return (
    <div className="cost-breakdown">

      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Night</th>
            <th>Active members</th>
            <th>Rooms</th>
            <th>Total hotel cost</th>
            <th>Per person</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.night}>
              <td>{formatDate(row.night)}</td>
              <td>{row.active_members}</td>
              <td>{row.rooms}</td>

              <td>
                {formatInr(row.total_cost)}
              </td>

              <td>
                {formatInr(row.per_person)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="member-totals">
        <h4>Member shares</h4>

        {Object.entries(
          selection.breakdown?.memberTotals || {}
        ).map(([id, amount]) => {

          const member = selection._members?.find(
            (m) => m.traveller_id === id
          );

          return (
            <p
              key={id}
              className="group-card-meta"
            >
              {member ? member.name : id}:{' '}
              <strong>{formatInr(amount)}</strong>
            </p>
          );
        })}
      </div>

    </div>
  );
}

// --------------------------------------------------
// MAIN HOTEL PLANNING PAGE
// --------------------------------------------------

export default function HotelPlanningPage() {
  const { groupId } = useParams();
  const { traveller } = useAuth();
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [group, setGroup] = useState(null);
  const [plan, setPlan] = useState(null);
  const [options, setOptions] = useState(null);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Date range
  const [browseIn, setBrowseIn] = useState('');
  const [browseOut, setBrowseOut] = useState('');

  // Booking confirmation
  const [bookingOption, setBookingOption] = useState(null);
  const [bookingRange, setBookingRange] = useState(null);

  // Cancellation confirmation
  const [cancellingSelection, setCancellingSelection] =
    useState(null);

  // Editing saved ranges
  const [editingId, setEditingId] = useState(null);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');

  // -----------------------------------
  // LOAD GROUP HOTEL PLAN
  // -----------------------------------

  const loadPlan = useCallback(async () => {
    try {
      const data = await api.getHotelPlan(groupId);

      const withMembers = (data.selections || []).map(
        (selection) => ({
          ...selection,
          _members: data.members || [],
        })
      );

      setPlan({
        ...data,
        selections: withMembers,
      });

    } catch (err) {
      setError(err.message);
    }
  }, [groupId]);

  // -----------------------------------
  // LOAD HOTEL OPTIONS
  // -----------------------------------

  const loadOptions = useCallback(async () => {
    if (!browseIn || !browseOut || browseOut <= browseIn) {
      setOptions([]);
      return;
    }

    setOptionsLoading(true);

    try {
      const data = await api.listHotelOptions(groupId, {
        check_in: browseIn,
        check_out: browseOut,
      });

      const nights = getNights(browseIn, browseOut);

      const hotelOptions = (data.options || []).map(
        (option) => ({
          ...option,
          nights,
        })
      );

      setOptions(hotelOptions);

    } catch (err) {
      setOptions([]);
      setError(err.message);
    } finally {
      setOptionsLoading(false);
    }
  }, [groupId, browseIn, browseOut]);

  // -----------------------------------
  // INITIAL PAGE LOAD
  // -----------------------------------

  useEffect(() => {
    let active = true;

    setLoading(true);
    setGroup(null);
    setPlan(null);
    setOptions(null);
    setError('');

    async function initialize() {
      try {
        const [groupData, planData] = await Promise.all([
          api.getGroup(groupId),
          api.getHotelPlan(groupId),
        ]);

        if (!active) return;

        const currentGroup = groupData.group;

        setGroup(currentGroup);
        setBrowseIn(currentGroup.check_in);
        setBrowseOut(currentGroup.check_out);

        const selections = (
          planData.selections || []
        ).map((selection) => ({
          ...selection,
          _members: planData.members || [],
        }));

        setPlan({
          ...planData,
          selections,
        });

      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [groupId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const isOwner = group
    ? isOwnerRole(group.viewer_role)
    : false;

  // -----------------------------------
  // OPEN BOOKING CONFIRMATION
  // -----------------------------------

  function openBookingConfirmation(option) {
    if (!isOwner || busy) return;

    setError('');
    setNotice('');

    setBookingRange({
      check_in: browseIn,
      check_out: browseOut,
    });

    setBookingOption(option);
  }

  function closeBookingConfirmation() {
    if (busy) return;

    setBookingOption(null);
    setBookingRange(null);
  }

  // -----------------------------------
  // CONFIRM HOTEL BOOKING
  // -----------------------------------


  async function confirmBooking() {
    if (!bookingOption || !bookingRange || !isOwner || busy) {
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    const option = bookingOption;
    const range = bookingRange;

    try {
      // Save mock booking to SQLite through existing API.
      await api.saveHotelSelection(groupId, {
        room_id: option.room_id,
        check_in: range.check_in,
        check_out: range.check_out,
      });

      // Refresh saved hotel arrangements.
      await loadPlan();

      // Close confirmation modal.
      setBookingOption(null);
      setBookingRange(null);

      // Show success modal only after successful API save.
      setConfirmedBooking({
        hotel_name: option.hotel_name,
        check_in: range.check_in,
        check_out: range.check_out,
        total_estimated: option.total_estimated,
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }


  // -----------------------------------
  // OPEN CANCELLATION CONFIRMATION
  // -----------------------------------

  function openCancelConfirmation(selection) {
    if (!isOwner || busy) return;

    setError('');
    setNotice('');
    setCancellingSelection(selection);
  }

  function closeCancelConfirmation() {
    if (busy) return;
    setCancellingSelection(null);
  }

  // -----------------------------------
  // CONFIRM CANCELLATION
  // -----------------------------------

  async function confirmCancellation() {
    if (!cancellingSelection || !isOwner || busy) {
      return;
    }

    setBusy(true);
    setError('');

    const selection = cancellingSelection;

    try {
      await api.deleteHotelSelection(
        groupId,
        selection.id
      );

      await loadPlan();

      setCancellingSelection(null);

      setNotice(
        `The hotel arrangement for ${selection.hotel_name} (${formatDate(selection.check_in)} – ${formatDate(selection.check_out)}) was removed from the group plan.`
      );

    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------------
  // EDIT BOOKING DATE RANGE
  // -----------------------------------

  function startEdit(selection) {
    setEditingId(selection.id);
    setEditIn(selection.check_in);
    setEditOut(selection.check_out);
  }

  async function saveEdit(selection) {
    if (!isOwner || busy) return;

    if (
      !editIn ||
      !editOut ||
      editOut <= editIn ||
      editIn < group.check_in ||
      editOut > group.check_out
    ) {
      setError(
        'Please choose a valid date range within the group trip.'
      );
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      await api.updateHotelSelection(
        groupId,
        selection.id,
        {
          check_in: editIn,
          check_out: editOut,
        }
      );

      setEditingId(null);

      await loadPlan();

      setNotice('Booking date range updated.');

    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------------
  // LOADING / ERROR
  // -----------------------------------

  if (loading) {
    return (
      <Layout>
        <div className="container status">
          Loading hotel planner…
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

          <Link
            to="/my-groups"
            className="button secondary"
          >
            Back to My Groups
          </Link>

        </div>
      </Layout>
    );
  }

  // -----------------------------------
  // PAGE
  // -----------------------------------

  return (
    <Layout>

      <div className="container wide">

        <Link
          to={`/groups/${groupId}`}
          className="text-button"
        >
          ← Group details
        </Link>

        <div className="details-header">

          <span className="badge">
            {group.city}
          </span>

          <span
            className={`badge ${group.status === 'FULL'
                ? 'badge-full'
                : 'badge-open'
              }`}
          >
            {group.status === 'FULL'
              ? 'Full'
              : 'Open'}
          </span>

          <h1>
            Hotel Planning — {group.name}
          </h1>

        </div>

        <p className="group-card-meta">
          Trip: {formatDate(group.check_in)}
          {' → '}
          {formatDate(group.check_out)}
          {' · '}
          {formatInr(group.budget_inr)} / person
        </p>

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


        {/* -----------------------------
            OUR HOTEL PLAN
        ----------------------------- */}

        <section>

          <h2>Our Hotel Plan</h2>

          <p className="hint">
            These are mock hotel bookings saved for
            your group. No real reservations or
            payments have been made.
          </p>

          {!plan ? (
            <div className="status">
              Loading hotel plan…
            </div>
          ) : plan.selections.length === 0 ? (
            <div className="card empty-state">

              <p>
                No hotel bookings yet.
                {' '}
                {isOwner
                  ? 'Choose a date range below and book a hotel.'
                  : 'The group creator will manage the hotel bookings.'}
              </p>

            </div>
          ) : (
            <>

              {plan.selections.map((selection) => (
                <div
                  key={selection.id}
                  className="card plan-card"
                >

                  <div className="plan-head">

                    <div>
                      <span className="badge badge-open">
                        Mock booking confirmed
                      </span>

                      <h3>{selection.hotel_name}</h3>

                      <p className="group-card-meta">
                        {selection.room_name ||
                          selection.room_type}
                        {' · '}
                        {formatInr(
                          selection.price_per_night
                        )}/night
                      </p>

                      <p className="group-card-meta">
                        {formatDate(
                          selection.check_in
                        )}
                        {' → '}
                        {formatDate(
                          selection.check_out
                        )}
                      </p>
                    </div>

                    {/* CREATOR ACTIONS ONLY */}
                    {isOwner && (
                      <div className="actions">

                        {editingId === selection.id ? (
                          <>

                            <input
                              type="date"
                              min={group.check_in}
                              max={group.check_out}
                              value={editIn}
                              onChange={(event) =>
                                setEditIn(event.target.value)
                              }
                            />

                            <input
                              type="date"
                              min={editIn || group.check_in}
                              max={group.check_out}
                              value={editOut}
                              onChange={(event) =>
                                setEditOut(event.target.value)
                              }
                            />

                            <button
                              type="button"
                              className="primary"
                              disabled={busy}
                              onClick={() =>
                                saveEdit(selection)
                              }
                            >
                              Save
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              disabled={busy}
                              onClick={() =>
                                setEditingId(null)
                              }
                            >
                              Cancel Edit
                            </button>

                          </>
                        ) : (
                          <>

                            <button
                              type="button"
                              className="button secondary"
                              disabled={busy}
                              onClick={() =>
                                startEdit(selection)
                              }
                            >
                              Edit Dates
                            </button>

                            <button
                              type="button"
                              className="button secondary danger"
                              disabled={busy}
                              onClick={() =>
                                openCancelConfirmation(
                                  selection
                                )
                              }
                            >
                              Cancel Booking
                            </button>

                          </>
                        )}

                      </div>
                    )}

                  </div>

                  <CostBreakdown
                    selection={selection}
                  />

                </div>
              ))}

              <div className="card plan-total">

                <h3>
                  Group accommodation total:{' '}
                  <strong>
                    {formatInr(
                      plan.total_accommodation
                    )}
                  </strong>
                </h3>

                <p className="hint">
                  Each member's share is based on
                  their actual overlapping nights.
                </p>

              </div>

            </>
          )}

        </section>

        {/* -----------------------------
            AVAILABLE HOTELS
        ----------------------------- */}

        <section>

          <h2>
            {isOwner
              ? 'Book Hotels for a Date Range'
              : 'Available Hotels'}
          </h2>

          <p className="hint">
            {isOwner
              ? 'Choose a date range, compare hotels and confirm an accommodation arrangement for your group.'
              : 'Browse the hotels and estimated accommodation costs for your group.'}
          </p>

          <div className="hotel-range">

            <label>
              Check-in

              <input
                type="date"
                value={browseIn}
                min={group.check_in}
                max={group.check_out}
                onChange={(event) =>
                  setBrowseIn(event.target.value)
                }
              />
            </label>

            <label>
              Check-out

              <input
                type="date"
                value={browseOut}
                min={browseIn || group.check_in}
                max={group.check_out}
                onChange={(event) =>
                  setBrowseOut(event.target.value)
                }
              />
            </label>

          </div>

          {optionsLoading || options === null ? (
            <div className="status">
              Loading hotels…
            </div>
          ) : options.length === 0 ? (
            <div className="card empty-state">

              <p>
                No hotels available for the
                selected date range.
              </p>

            </div>
          ) : (
            <div className="hotel-grid">

              {options.map((option) => (
                <HotelOptionCard
                  key={`${option.hotel_id}-${option.room_id}`}
                  option={option}
                  isOwner={isOwner}
                  busy={busy}
                  onBook={openBookingConfirmation}
                />
              ))}

            </div>
          )}

        </section>

      </div>

      {/* BOOKING CONFIRMATION POPUP */}
      {bookingOption && bookingRange && (
        <BookingConfirmationModal
          option={bookingOption}
          checkIn={bookingRange.check_in}
          checkOut={bookingRange.check_out}
          busy={busy}
          onClose={closeBookingConfirmation}
          onConfirm={confirmBooking}
        />
      )}

      {/* CANCEL BOOKING POPUP */}
      {cancellingSelection && (
        <CancelBookingModal
          selection={cancellingSelection}
          busy={busy}
          onClose={closeCancelConfirmation}
          onConfirm={confirmCancellation}
        />
      )}


      {confirmedBooking && (
        <BookingSuccessModal
          booking={confirmedBooking}
          onClose={() => setConfirmedBooking(null)}
          onViewBooking={() => {
            setConfirmedBooking(null);

            <section id="our-hotel-plan">
              <h2>Our Hotel Plan</h2>
              {/* Existing hotel plan code */}
            </section>

            document
              .getElementById('our-hotel-plan')
              ?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
          }}
        />
      )}


    </Layout>
  );
}
