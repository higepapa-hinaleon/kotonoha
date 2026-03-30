import { verifySystemAdmin } from "~~/server/utils/auth";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import type { Application } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  await verifySystemAdmin(event);

  const query = getQuery(event);
  const status = typeof query.status === "string" ? query.status : undefined;

  const db = getAdminFirestore();
  let ref: FirebaseFirestore.Query = db
    .collection("applications")
    .orderBy("createdAt", "desc");

  if (status) {
    // ステータスが有効な値かバリデーション
    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `無効なステータスです: ${status}`,
      });
    }
    ref = ref.where("status", "==", status);
  }

  const snapshot = await ref.get();
  const applications: Application[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Application[];

  return { applications };
});
