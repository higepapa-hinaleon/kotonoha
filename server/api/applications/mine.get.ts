import { verifyAuth } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import type { Application } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);

  const db = getAdminFirestore();
  const snapshot = await db
    .collection("applications")
    .where("applicantUserId", "==", user.id)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { application: null };
  }

  const doc = snapshot.docs[0];
  const application = { id: doc.id, ...doc.data() } as Application;

  return { application };
});
