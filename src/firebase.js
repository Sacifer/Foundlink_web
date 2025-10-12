import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAbK0yLXOsJ_-ndqpbIqXnqIAQn9mtz-Ek",
  authDomain: "found-link.firebaseapp.com",
  projectId: "found-link",
  storageBucket: "found-link.firebasestorage.app",
  messagingSenderId: "80849480678",
  appId: "1:80849480678:web:b8b580bcf54da1c80e0427",
  measurementId: "G-J1SYCTNHEB"
};

const app = initializeApp(firebaseConfig);

// Named exports
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Default export for app
export default app;
