import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await verifySystemAdmin(event);

  const db = getAdminFirestore();
  const snapshot = await db.collection("organizations").orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
});
