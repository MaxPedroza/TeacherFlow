import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAZxAcXdAIZRBHEcuaTY9TNSZhPaSp9p7E",
  authDomain: "teacherflow-db0be.firebaseapp.com",
  projectId: "teacherflow-db0be",
  storageBucket: "teacherflow-db0be.firebasestorage.app",
  messagingSenderId: "434966074330",
  appId: "1:434966074330:web:96119c3f6f75c4ede326e3",
  measurementId: "G-KVCKRMY0N3"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, functions, googleProvider };