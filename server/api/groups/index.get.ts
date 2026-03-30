import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuth } from "~~/server/utils/auth";
import { getUserGroupMemberships } from "~~/server/utils/group";
import type { Group } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);
  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
  }

  const db = getAdminFirestore();

  // owner / system_admin は全グループを返す
  if (user.role === "owner" || user.role === "system_admin") {
    const snapshot = await db
      .collection("groups")
      .where("organizationId", "==", user.organizationId)
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Group);
  }

  // 一般ユーザーは所属グループのみ
  const memberships = await getUserGroupMemberships(user.id, db);
  if (memberships.length === 0) return [];

  const groups: Group[] = [];
  for (const m of memberships) {
    const groupDoc = await db.collection("groups").doc(m.groupId).get();
    if (groupDoc.exists) {
      groups.push({ id: groupDoc.id, ...groupDoc.data() } as Group);
    }
  }

  return groups;
});
