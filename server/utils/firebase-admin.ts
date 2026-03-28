import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  const config = useRuntimeConfig();

  const requiredKeys = {
    firebaseProjectId: "NUXT_FIREBASE_PROJECT_ID",
    firebaseClientEmail: "NUXT_FIREBASE_CLIENT_EMAIL",
    firebasePrivateKey: "NUXT_FIREBASE_PRIVATE_KEY",
  } as const;

  const missing = Object.entries(requiredKeys)
    .filter(([k]) => !config[k as keyof typeof config])
    .map(([, envName]) => envName);

  if (missing.length > 0) {
    throw createError({
      statusCode: 503,
      statusMessage: `Firebase Admin 未設定: ${missing.join(", ")} を .env に設定してください`,
    });
  }

  if (getApps().length === 0) {
    const serviceAccount: ServiceAccount = {
      projectId: config.firebaseProjectId,
      clientEmail: config.firebaseClientEmail,
      privateKey: config.firebasePrivateKey?.replace(/\\n/g, "\n"),
    };

    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: config.firebaseStorageBucket,
    });
  }

  initialized = true;
}

export function getAdminFirestore() {
  ensureInitialized();
  const config = useRuntimeConfig();
  const databaseId = config.firebaseDatabaseId;
  return databaseId ? getFirestore(databaseId) : getFirestore();
}

export function getAdminAuth() {
  ensureInitialized();
  return getAuth();
}

export function getAdminStorage() {
  ensureInitialized();
  return getStorage();
}
