# Quick Ticket 🎟️

**Real-time classroom polling, emoji reactions, and exit tickets.** Teachers create a session in 10 seconds, students join with a code. Live results, no accounts, no friction.

Inspired by Kahoot, minus the trivia gameshow energy. Built for serious classroom use: a quick pulse check, an exit ticket, a comprehension quiz.

---

## How to Use

1. Go to https://quick-ticket1.netlify.app/
2. Click "Create a session"
3. Choose activity type
4. Add information as needed, then click create session
5. Students visit https://quick-ticket1.netlify.app/ and join via room code or QR code

## Tech stack

- **Frontend:** Vanilla HTML / CSS / JS (ES modules, no build step)
- **Backend:** Firebase Firestore (real-time database)
- **Hosting:** Netlify (free tier)
- **Cost:** $0 at classroom scale

No bundler. No npm. Open `index.html` in a browser, you're running it.

---

## Activity types (v1)

| Activity | Description | Student interaction |
|---|---|---|
| **Poll** | Multiple choice, 2–6 options, single answer | Tap once, locked in |
| **Emoji reaction** | Live emoji burst — 👍 👎 ❤️ 😕 🤔 🎉 | Tap as many times as you want |
| **Quiz** | Like a poll, but with a correct answer | Tap once, see right/wrong |

---

## URLs

| Path | Purpose |
|---|---|
| `/` (`index.html`) | Landing — Create or Join |
| `/create.html` | Teacher: pick activity, configure, get code |
| `/host.html?code=ABC123` | Teacher: live results / projector view |
| `/play.html?code=ABC123` | Student: vote screen |

---

## Data model (Firestore)

```
sessions/{ROOM_CODE}                 # 6-character A-Z code, e.g. "BRMQXT"
  type:         "poll" | "emoji" | "quiz"
  question:     string
  options:      string[]              # poll/quiz only
  correctIndex: number                # quiz only
  createdAt:    Timestamp
  expiresAt:    Timestamp             # createdAt + 4h
  status:       "open" | "closed"
  hostToken:    string                # random, stored in teacher's localStorage

sessions/{ROOM_CODE}/responses/{auto-id}
  optionIndex:  number                # poll/quiz
  emoji:        string                # emoji only
  ts:           Timestamp
```

### Why subcollection for responses?

Keeps the parent session doc small (Firestore docs are read in full on every snapshot). Responses can grow to hundreds per session without bloating reads.

---

## Lifecycle decisions

- **No accounts.** Teachers are anonymous. Their browser holds a `hostToken` in localStorage that authenticates them as the session host (lets them close the session early).
- **Auto-expire.** Sessions die 4 hours after creation. Client-side check on `expiresAt`. No cleanup job needed for v1 (Firestore handles dead docs fine; we can add a scheduled function later).
- **Vote-locking.** Polls and quizzes lock students to one vote per browser via `localStorage.setItem('voted_ABC123', optionIndex)`. Bypassable with incognito — that's fine for an exit ticket, not a high-stakes assessment.
- **Reconnection.** If a student refreshes after voting, they see their submitted answer + live results, but can't re-vote.
- **Emoji is unlimited.** No lockout. Tap-spam encouraged. Reactions float/burst on the host view.

---

## Build phases

- [x] **Phase 0** — Scaffold + design system + README (this commit)
- [ ] **Phase 1** — Poll end-to-end (create → host → play → live updates)
- [ ] **Phase 2** — Emoji reactions
- [ ] **Phase 3** — Quiz mode + correctness reveal
- [ ] **Phase 4** — Polish: QR code on host page, transitions, empty states, mobile tightening

---

## Setup (when ready to run)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore (start in test mode for dev; we'll write proper rules before deploy)
3. Copy your config object into `js/firebase-config.js`
4. Open `index.html` in a browser, or run `npx serve` for localhost

### Deploying

- **Netlify:** drag the project folder to netlify.com — done.
- **Firebase Hosting:** `firebase init hosting` → `firebase deploy`

---

## Design language

Vintage movie ticket / theater stub. Cream paper, cherry red accent, condensed display serif + monospace for codes. Dashed tear-lines as the signature motif. Mobile-first; host view scales up dramatically for projection.

Color tokens, type scale, and component patterns live in `css/styles.css` under `:root`.

---

## Project structure

```
quick-ticket/
├── index.html              # Landing
├── create.html             # Teacher: activity setup
├── host.html               # Teacher: live results / projector
├── play.html               # Student: vote screen
├── css/
│   └── styles.css          # Design system + all components
├── js/
│   ├── firebase-config.js  # Firebase init (add your keys)
│   ├── utils.js            # Room code gen, localStorage, helpers
│   ├── create.js           # Activity creation
│   ├── host.js             # Real-time listener + render
│   └── play.js             # Vote submission
├── firestore.rules         # Security rules
└── README.md
```

---

## Future (out of scope for v1)

- Teacher accounts + saved poll templates
- Question banks
- Multi-question quiz sequences
- Export results to CSV
- Timer / countdown mode
- Leaderboards (intentionally avoided — this isn't a game)

Built by Jake Jones · [jacobjones.dev](https://jacobjones.dev)
