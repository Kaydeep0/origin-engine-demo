// Origin Engine as-of state logic. Imported by the app and by the integration tests,
// so a leak in the UI fails the test run.
//
// Only the dates in meta.supported_as_of_dates have been evaluated. Nothing here
// interpolates, extrapolates or infers a state for any other date.

export function supportedDates(data) {
  return data.meta.supported_as_of_dates.slice();
}

/** True only when this thought was actually re-run at the given date. */
export function wasReassessedAt(data, thoughtId, asOf) {
  if (asOf === data.meta.supported_as_of_dates[0]) return true;   // baseline: all thoughts
  return data.meta.reassessed_at_later_date.includes(thoughtId);
}

/** The thought-history state recorded for a date, or null if none was recorded. */
export function stateAt(history, asOf) {
  return history.states.find((s) => s.as_of === asOf) || null;
}

/**
 * Evidence admissible at an as-of date. A record is admissible only when it was
 * publicly available on or before that date. Records that exist but fall outside
 * are returned separately so they can be shown as excluded rather than hidden.
 */
export function partitionEvidence(items, asOf) {
  const admissible = [];
  const excluded = [];
  for (const it of items) {
    if (it.date && it.date <= asOf) admissible.push(it);
    else excluded.push(it);
  }
  return { admissible, excluded };
}

/** A matrix is NOT_COMPUTABLE when its coverage falls below the floor. */
export function matrixState(coverage, floor) {
  return coverage >= floor ? 'computable' : 'NOT_COMPUTABLE';
}

export const GATE_MEANING = {
  ADVANCE: 'All mandatory conditions met at this gate.',
  MONITOR: 'Eligible, but a condition is unmet or evidence is insufficient. Not a rejection.',
  INVESTIGATE: 'Evidence conflicts, or a specific question needs review.',
  STOP: 'A predefined disqualifying condition is supported by evidence.',
  NOT_REACHED: 'An earlier gate did not return ADVANCE, so this gate was not evaluated.',
};
