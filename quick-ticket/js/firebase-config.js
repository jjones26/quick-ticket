// ============================================================
// Firebase initialization
// ------------------------------------------------------------
// PHASE 1 TODO: paste your Firebase web app config below.
// Get it from: console.firebase.google.com
//   → Project settings → Your apps → Web app → SDK setup → Config
//
// These keys are public-by-design; security comes from Firestore
// rules (see firestore.rules), not from hiding the config.
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBvfHj5_BbcIzYRBoL07AeUFRxlxsVjcO8',
  authDomain:        'quick-ticket-1217.firebaseapp.com',
  projectId:         'quick-ticket-1217',
  storageBucket:     'quick-ticket-1217.firebasestorage.app',
  messagingSenderId: '46166506712',
  appId:             '1:46166506712:web:135bfc129e9df326a2ebad',
};

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
