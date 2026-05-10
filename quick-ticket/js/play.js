// ============================================================
// play.js — student's vote view (Phase 1)
// Loads session, renders vote UI by type, submits to Firestore.
// ============================================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, addDoc, collection, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { recordVote, hasVotedInRoom } from './utils.js';

const TYPE_LABELS = {
  poll: '📊 Poll',
  emoji: '😀 Reactions',
  quiz: '✅ Quiz',
  short: '✏️ Short Answer',
};

const EMOJIS = ['👍', '👎', '❤️', '😕', '🤔', '🎉'];

/**
 * Load a session doc by room code.
 * @returns {object|null} session data or null if invalid/expired/closed.
 */
export async function loadSession(code) {
  const snap = await getDoc(doc(db, 'sessions', code));
  if (!snap.exists()) return null;

  const data = snap.data();
  if (data.status === 'closed') return null;
  if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return null;

  return { code, ...data };
}

/**
 * Submit a poll/quiz vote.
 */
export async function submitVote(code, optionIndex) {
  if (hasVotedInRoom(code)) throw new Error('Already voted.');
  await addDoc(collection(db, 'sessions', code, 'responses'), {
    optionIndex,
    ts: serverTimestamp(),
  });
  recordVote(code, optionIndex);
}

/**
 * Submit an emoji reaction (no lockout).
 */
export async function submitEmoji(code, emoji) {
  await addDoc(collection(db, 'sessions', code, 'responses'), {
    emoji,
    ts: serverTimestamp(),
  });
}

/**
 * Submit a short answer response. One per browser.
 */
export async function submitShortAnswer(code, text) {
  if (hasVotedInRoom(code)) throw new Error('Already responded.');
  await addDoc(collection(db, 'sessions', code, 'responses'), {
    text: text.slice(0, 200),
    ts: serverTimestamp(),
  });
  recordVote(code, 'short');
}

/**
 * Render the vote UI into the given container based on session type.
 * @param {HTMLElement} container - the #vote-area element
 * @param {object} session - session data
 * @param {{ onVoted: () => void }} callbacks
 */
export function renderVoteUI(container, session, callbacks) {
  // Label + question
  const labelEl = document.getElementById('activity-label');
  const questionEl = document.getElementById('question-text');
  if (labelEl) labelEl.textContent = TYPE_LABELS[session.type] || session.type;
  if (questionEl) questionEl.textContent = session.question;

  if (session.type === 'poll' || session.type === 'quiz') {
    renderOptionButtons(container, session, callbacks);
  } else if (session.type === 'emoji') {
    renderEmojiPad(container, session, callbacks);
  } else if (session.type === 'short') {
    renderShortAnswerInput(container, session, callbacks);
  }
}

// ---- Poll / Quiz option buttons --------------------------

function renderOptionButtons(container, session, callbacks) {
  let html = '<div class="stack">';
  session.options.forEach((label, i) => {
    html += `<button class="btn--option vote-option-reveal" data-index="${i}">${escapeHTML(label)}</button>`;
  });
  html += '</div>';
  container.innerHTML = html;

  let selected = null;
  const buttons = container.querySelectorAll('.btn--option');

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index, 10);

      // If not yet submitted, select and submit immediately
      if (selected !== null) return;
      selected = idx;

      // Visual feedback
      btn.classList.add('selected');
      buttons.forEach((b) => {
        if (b !== btn) {
          b.style.opacity = '0.5';
          b.style.pointerEvents = 'none';
        }
      });

      try {
        await submitVote(session.code, idx);

        // For quiz, reveal correctness
        if (session.type === 'quiz' && session.correctIndex !== null) {
          setTimeout(() => {
            buttons.forEach((b, i) => {
              b.style.opacity = '1';
              if (i === session.correctIndex) {
                b.style.borderColor = 'var(--green)';
                b.style.background = 'var(--surface-alt)';
                b.innerHTML = '✓ ' + b.innerHTML;
              } else if (i === idx && idx !== session.correctIndex) {
                b.style.borderColor = 'var(--red)';
                b.style.background = 'var(--red-light)';
                b.innerHTML = '✗ ' + b.innerHTML;
              }
            });
          }, 300);
        }

        // Show confirmation after a short delay
        setTimeout(() => {
          if (callbacks.onVoted) callbacks.onVoted();
        }, session.type === 'quiz' ? 2000 : 600);

      } catch (err) {
        console.error('Vote failed:', err);
        btn.classList.remove('selected');
        btn.textContent = 'Error — try again';
        selected = null;
        buttons.forEach((b) => {
          b.style.opacity = '1';
          b.style.pointerEvents = 'auto';
        });
      }
    });
  });
}

// ---- Emoji pad -------------------------------------------

function renderEmojiPad(container, session, callbacks) {
  let html = '<div class="emoji-pad">';
  EMOJIS.forEach((emoji) => {
    html += `<button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`;
  });
  html += '</div>';
  html += '<p class="caption center" style="margin-top: var(--s-3);">Tap as many times as you want!</p>';
  container.innerHTML = html;

  container.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const emoji = btn.dataset.emoji;
      // Quick bounce animation
      btn.style.transform = 'scale(0.85)';
      setTimeout(() => (btn.style.transform = ''), 150);

      try {
        await submitEmoji(session.code, emoji);
      } catch (err) {
        console.error('Emoji submit failed:', err);
      }
    });
  });
}

// ---- Short answer input ----------------------------------

function renderShortAnswerInput(container, session, callbacks) {
  const MAX_CHARS = 200;
  container.innerHTML = `
    <div class="short-answer-area vote-option-reveal">
      <textarea
        id="short-input"
        class="short-answer-input"
        placeholder="Type your response here…"
        maxlength="${MAX_CHARS}"
      ></textarea>
      <span class="char-count" id="char-count">${MAX_CHARS}</span>
    </div>
    <button class="btn btn--primary btn--block btn--lg vote-option-reveal" id="submit-short" type="button" style="margin-top: var(--s-4);">
      Submit →
    </button>
  `;

  const input = document.getElementById('short-input');
  const charCount = document.getElementById('char-count');
  const submitBtn = document.getElementById('submit-short');

  input.addEventListener('input', () => {
    const remaining = MAX_CHARS - input.value.length;
    charCount.textContent = remaining;
    charCount.classList.toggle('char-count--warn', remaining <= 20);
  });

  submitBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      await submitShortAnswer(session.code, text);
      setTimeout(() => {
        if (callbacks.onVoted) callbacks.onVoted();
      }, 600);
    } catch (err) {
      console.error('Submit failed:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Error — try again';
    }
  });
}

// ---- Helpers ---------------------------------------------

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
