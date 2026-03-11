import { db } from "@/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

// READ user data
export async function getUserData(uid: string) {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}

// UPDATE watchlist
export async function updateWatchlist(uid: string, watchlist: string[]) {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { watchlist });
}

// UPDATE portfolio
export async function updatePortfolio(uid: string, portfolio: object[]) {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { portfolio });
}

// UPDATE preferences
export async function updatePreferences(uid: string, preferences: object) {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, { preferences });
}