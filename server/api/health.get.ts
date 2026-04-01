import { getAdminFirestore } from "~~/server/utils/firebase-admin";

export default defineEventHandler(async () => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Firestore 接続確認
  try {
    const db = getAdminFirestore();
    await db.collection("organizations").limit(1).get();
    checks.firestore = "ok";
  } catch (err) {
    console.error("[health] Firestore check failed:", err);
    checks.firestore = "error";
    healthy = false;
  }

  return {
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  };
});
