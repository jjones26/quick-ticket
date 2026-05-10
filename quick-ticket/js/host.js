// ============================================================
// host.js — teacher's projector view (Phase 1)
// Subscribes to session + responses, renders live bar charts.
// ============================================================

import { db } from './firebase-config.js';
import {
  doc, onSnapshot, collection, query, orderBy, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { tallyOptions, pluralize, getHostToken } from './utils.js';

/**
 * Subscribe to a session and its responses in real-time.
 * @param {string} code
 * @param {{ onSession, onResponses, onError }} handlers
 * @returns {() => void} unsubscribe
 */
export function subscribeToSession(code, handlers) {
  const sessionRef = doc(db, 'sessions', code);
  const responsesRef = collection(db, 'sessions', code, 'responses');

  const unsubSession = onSnapshot(sessionRef, (snap) => {
    if (!snap.exists()) {
      handlers.onError(new Error('Session not found.'));
      return;
    }
    const data = snap.data();
    // Check expiry
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
      handlers.onError(new Error('This session has expired.'));
      return;
    }
    handlers.onSession({ code, ...data });
  }, (err) => handlers.onError(err));

  const unsubResponses = onSnapshot(
    query(responsesRef, orderBy('ts')),
    (snap) => {
      const responses = snap.docs.map((d) => d.data());
      handlers.onResponses(responses);
    },
    (err) => handlers.onError(err),
  );

  return () => { unsubSession(); unsubResponses(); };
}

/**
 * Close a session (host only).
 */
export async function closeSession(code) {
  const token = getHostToken(code);
  if (!token) throw new Error('Not the host of this session.');
  await updateDoc(doc(db, 'sessions', code), {
    status: 'closed',
    hostToken: token, // must include for security rules
  });
}

// ---- Rendering -------------------------------------------

const TYPE_LABELS = {
  poll: '📊 Poll',
  emoji: '😀 Reactions',
  quiz: '✅ Quiz',
  short: '✏️ Short Answer',
};

/**
 * Render session metadata into the host page.
 */
export function renderSessionInfo(session) {
  const label = document.getElementById('activity-label');
  const question = document.getElementById('question-text');
  const statusBadge = document.getElementById('status-badge');

  label.textContent = TYPE_LABELS[session.type] || session.type;
  question.textContent = session.question;

  if (session.status === 'closed') {
    statusBadge.textContent = 'Closed';
    statusBadge.className = 'badge badge--gray';
  }
}

// Track whether the host has revealed the correct answer
let quizAnswerRevealed = false;

/**
 * Render poll/quiz bar chart into the results container.
 */
export function renderPollResults(container, session, responses) {
  const { byOption, total } = tallyOptions(responses, session.options.length);

  // Update response count
  const countEl = document.getElementById('response-count');
  if (countEl) countEl.textContent = pluralize(total, 'response');

  const isQuiz = session.type === 'quiz' && session.correctIndex !== null;

  // Build bars
  let html = '';
  session.options.forEach((label, i) => {
    const count = byOption[i];
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const isCorrect = i === session.correctIndex;

    let fillClass = 'bar-fill';
    let labelExtra = '';

    if (isQuiz && quizAnswerRevealed) {
      fillClass += isCorrect ? ' bar-fill--correct' : ' bar-fill--wrong';
      labelExtra = isCorrect ? ' <span style="color: var(--green); font-weight: 700;">✓ Correct</span>' : '';
    }

    html += `
      <div class="bar-item">
        <div class="bar-header">
          <span class="bar-label">${escapeHTML(label)}${labelExtra}</span>
          <span class="bar-count">${count} (${pct}%)</span>
        </div>
        <div class="bar-track">
          <div class="${fillClass}" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  });

  // Add reveal button for quizzes
  if (isQuiz) {
    html += `
      <div style="text-align: center; margin-top: var(--s-4);">
        <button class="btn ${quizAnswerRevealed ? 'btn--ghost' : 'btn--primary'}" id="reveal-answer-btn" type="button">
          ${quizAnswerRevealed ? '🔒 Hide answer' : '👁 Show correct answer'}
        </button>
      </div>
    `;
  }

  container.innerHTML = html;

  // Bind reveal toggle
  if (isQuiz) {
    const revealBtn = document.getElementById('reveal-answer-btn');
    if (revealBtn) {
      revealBtn.addEventListener('click', () => {
        quizAnswerRevealed = !quizAnswerRevealed;
        renderPollResults(container, session, responses);
      });
    }
  }
}

/**
 * Render emoji reaction tallies into the results container.
 */
export function renderEmojiResults(container, responses) {
  const EMOJIS = ['👍', '👎', '❤️', '😕', '🤔', '🎉'];
  const counts = {};
  EMOJIS.forEach((e) => (counts[e] = 0));

  for (const r of responses) {
    if (r.emoji && counts[r.emoji] !== undefined) {
      counts[r.emoji]++;
    }
  }

  const total = responses.length;

  // Update response count
  const countEl = document.getElementById('response-count');
  if (countEl) countEl.textContent = pluralize(total, 'reaction');

  let html = '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--s-4); text-align: center;">';
  EMOJIS.forEach((emoji) => {
    html += `
      <div>
        <div style="font-size: 2.5rem; margin-bottom: var(--s-2);">${emoji}</div>
        <div class="mono" style="font-size: 1.25rem; font-weight: 700;">${counts[emoji]}</div>
      </div>
    `;
  });
  html += '</div>';

  container.innerHTML = html;
}

/**
 * Spawn a floating emoji on the host screen.
 */
export function spawnFloatingEmoji(floatLayer, emoji) {
  const el = document.createElement('div');
  el.className = 'emoji-float';
  el.textContent = emoji;
  el.style.left = Math.random() * 80 + 10 + '%';
  el.style.bottom = '0';
  floatLayer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ---- Short answer with reveal mode -----------------------

// Track which responses the host has revealed
const revealedIds = new Set();
let revealAllMode = false;

/**
 * Render short answer responses with reveal mode.
 * Teacher must click each response to show it (moderation).
 */
export function renderShortAnswerResults(container, responses) {
  const textResponses = responses.filter((r) => typeof r.text === 'string');

  const countEl = document.getElementById('response-count');
  if (countEl) countEl.textContent = pluralize(textResponses.length, 'response');

  if (textResponses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📡</div>
        <p>Waiting for the first response…</p>
      </div>
    `;
    return;
  }

  // Build the reveal-all bar
  const hiddenCount = textResponses.filter((_, i) => !revealAllMode && !revealedIds.has(i)).length;
  let html = `
    <div class="reveal-all-bar">
      <p>${textResponses.length} responses · ${hiddenCount} hidden</p>
      <button class="btn btn--ghost" id="reveal-all-btn" type="button">
        ${revealAllMode ? '🔒 Hide all' : '👁 Reveal all'}
      </button>
    </div>
  `;

  html += '<div class="response-feed" id="response-feed">';
  textResponses.forEach((r, i) => {
    const isRevealed = revealAllMode || revealedIds.has(i);
    if (isRevealed) {
      html += `
        <div class="response-card">
          <div class="response-text">${escapeHTML(r.text)}</div>
          <div class="response-meta">#${i + 1}</div>
        </div>
      `;
    } else {
      html += `
        <div class="response-card response-card--hidden" data-reveal-idx="${i}">
          <div class="response-text">${escapeHTML(r.text)}</div>
          <button class="reveal-btn">Click to reveal</button>
        </div>
      `;
    }
  });
  html += '</div>';

  container.innerHTML = html;

  // Reveal-all toggle
  const revealAllBtn = document.getElementById('reveal-all-btn');
  if (revealAllBtn) {
    revealAllBtn.addEventListener('click', () => {
      revealAllMode = !revealAllMode;
      renderShortAnswerResults(container, responses);
    });
  }

  // Individual reveal clicks
  container.querySelectorAll('.response-card--hidden').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.revealIdx, 10);
      revealedIds.add(idx);
      renderShortAnswerResults(container, responses);
    });
  });

  // Auto-scroll to bottom for new responses
  const feed = document.getElementById('response-feed');
  if (feed) feed.scrollTop = feed.scrollHeight;
}

// ---- Helpers ---------------------------------------------

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
