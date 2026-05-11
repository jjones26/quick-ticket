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
  apiKey:            '',
  authDomain:        '',
  projectId:         '',
  storageBucket:     '',
  messagingSenderId: '',
  appId:             '',
};

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
