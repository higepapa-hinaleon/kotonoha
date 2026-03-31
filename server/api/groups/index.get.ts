import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuth, isPlatformAdmin } from "~~/server/utils/auth";
import { getUserGroupMemberships } from "~~/server/utils/group";
import type { Group } from "~~/shared/types/models";
import type { GroupWithOrg } from "~~/shared/types/api";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);

  const db = getAdminFirestore();

  // プラットフォーム管理者はクエリで組織を指定可能（未指定時は全グループ）
  if (isPlatformAdmin(user)) {
    const query = getQuery(event);
    const targetOrgId = typeof query.organizationId === "string" ? query.organizationId : null;

    let ref: FirebaseFirestore.Query = db.collection("groups");
    if (targetOrgId) {
      ref = ref.where("organizationId", "==", targetOrgId);
    }
    const snapshot = await ref.orderBy("createdAt", "desc").get();
    const groups = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Group);

    // 組織名を付加
    const orgIds = [...new Set(groups.map((g) => g.organizationId).filter(Boolean))];
    const orgNameMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const orgRefs = orgIds.map((oid) => db.collection("organizations").doc(oid));
      const orgDocs = await db.getAll(...orgRefs);
      for (const doc of orgDocs) {
        if (doc.exists) {
          orgNameMap.set(doc.id, (doc.data()?.name as string) || "");
        }
      }
    }

    return groups.map((g) => ({
      ...g,
      organizationName: orgNameMap.get(g.organizationId) || "",
    })) as GroupWithOrg[];
  }

  if (!user.organizationId) {
    throw createError({ statusCode: 400, statusMessage: "ユーザーに組織が割り当てられていません" });
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
