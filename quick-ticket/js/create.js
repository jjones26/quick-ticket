// ============================================================
// create.js — session creation (Phase 1)
// Writes a session doc to Firestore, stores hostToken, redirects.
// ============================================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, serverTimestamp, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { generateRoomCode, issueHostToken } from './utils.js';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const MAX_RETRIES = 5;

/**
 * Create a new session in Firestore.
 * @param {{
 *   type: 'poll' | 'emoji' | 'quiz',
 *   question: string,
 *   options?: string[],
 *   correctIndex?: number,
 * }} config
 * @returns {Promise<{ code: string, hostToken: string }>}
 */
export async function createSession(config) {
  // Generate a unique room code, retry on collision
  let code;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    code = generateRoomCode();
    const existing = await getDoc(doc(db, 'sessions', code));
    if (!existing.exists()) break;
    attempts++;
    if (attempts >= MAX_RETRIES) {
      throw new Error('Could not generate a unique room code. Try again.');
    }
  }

  const hostToken = issueHostToken(code);
  const expiresAt = Timestamp.fromMillis(Date.now() + FOUR_HOURS_MS);

  await setDoc(doc(db, 'sessions', code), {
    type: config.type,
    question: config.question,
    options: config.options ?? [],
    correctIndex: config.correctIndex ?? null,
    createdAt: serverTimestamp(),
    expiresAt,
    status: 'open',
    hostToken,
  });

  return { code, hostToken };
}
