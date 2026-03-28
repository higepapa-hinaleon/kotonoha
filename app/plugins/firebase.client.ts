import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId,
  };

  const envKeyMap: Record<string, string> = {
    apiKey: "NUXT_PUBLIC_FIREBASE_API_KEY",
    authDomain: "NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    projectId: "NUXT_PUBLIC_FIREBASE_PROJECT_ID",
    storageBucket: "NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    appId: "NUXT_PUBLIC_FIREBASE_APP_ID",
  };

  const missingKeys = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => envKeyMap[k] ?? k);

  if (missingKeys.length > 0) {
    console.error(
      `[Firebase] .env に未設定の項目があります: ${missingKeys.join(", ")}\n` +
        ".env.example を参考に NUXT_PUBLIC_FIREBASE_* を設定してください。",
    );
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  const auth = getAuth(app);
  const databaseId = config.public.firebaseDatabaseId;
  const firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  return {
    provide: {
      firebase: app,
      auth,
      firestore,
    },
  };
});
