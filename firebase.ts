import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkCt-xkCQwyUMrwXhZ1HYc1MiKwc9iM3Y",
  authDomain: "jtrade-3496c.firebaseapp.com",
  projectId: "jtrade-3496c",
  storageBucket: "jtrade-3496c.firebasestorage.app",
  messagingSenderId: "78300828445",
  appId: "1:78300828445:web:67d504c3904cae114a87f4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
