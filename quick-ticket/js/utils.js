// ============================================================
// Quick Ticket — shared utilities
// Pure functions, no Firebase deps. Safe to import anywhere.
// ============================================================

/**
 * Generate a 6-character room code.
 * Uses A-Z + 2-9 (no 0/1/O/I to avoid confusion when read aloud).
 */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Read the ?code= query param and normalize.
 */
export function getRoomCodeFromURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get('code') || '').trim().toUpperCase();
  return raw.replace(/[^A-Z0-9]/g, '') || null;
}

// ---- localStorage helpers ----------------------------------

const VOTE_KEY = (code) => `qt_voted_${code}`;
const HOST_KEY = (code) => `qt_host_${code}`;

/** Has the current browser already voted in this room? */
export function hasVotedInRoom(code) {
  return localStorage.getItem(VOTE_KEY(code)) !== null;
}

/** Record a vote so the user is locked out of re-voting. */
export function recordVote(code, optionIndex) {
  localStorage.setItem(VOTE_KEY(code), String(optionIndex));
}

/** Read back the user's previous vote (returns number or null). */
export function getPreviousVote(code) {
  const v = localStorage.getItem(VOTE_KEY(code));
  return v === null ? null : Number(v);
}

/** Generate + store a host token for a newly-created session. */
export function issueHostToken(code) {
  const token = crypto.randomUUID();
  localStorage.setItem(HOST_KEY(code), token);
  return token;
}

/** Read the host token (null if this browser didn't create the session). */
export function getHostToken(code) {
  return localStorage.getItem(HOST_KEY(code));
}

// ---- Misc --------------------------------------------------

/**
 * Pluralize a count: pluralize(0, 'response') → '0 responses'.
 */
export function pluralize(n, singular, plural = singular + 's') {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Compute totals from an array of response docs.
 * Returns { byOption: number[], total: number }
 */
export function tallyOptions(responses, optionCount) {
  const byOption = new Array(optionCount).fill(0);
  for (const r of responses) {
    if (typeof r.optionIndex === 'number' && r.optionIndex < optionCount) {
      byOption[r.optionIndex]++;
    }
  }
  return { byOption, total: byOption.reduce((a, b) => a + b, 0) };
}
