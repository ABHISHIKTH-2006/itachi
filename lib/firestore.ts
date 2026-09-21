import { collection } from "firebase/firestore";
import { db } from "./firebase";

export const commitmentsRef = collection(db, "commitments");
export const capturesRef = collection(db, "captures");
export const evidenceRef = collection(db, "evidence");
export const projectsRef = collection(db, "projects");
export const usersRef = collection(db, "users");