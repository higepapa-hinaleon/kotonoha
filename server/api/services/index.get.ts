import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuthOptional, verifyGroupMember } from "~~/server/utils/auth";
import type { Service } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const user = await verifyAuthOptional(event);
  const db = getAdminFirestore();
  const queryParams = getQuery(event);

  let query: FirebaseFirestore.Query = db.collection("services").orderBy("createdAt", "desc");

  if (user) {
    // 認証済み: グループのサービスを全て返す
    const { groupId } = await verifyGroupMember(event);
    query = query.where("groupId", "==", groupId);
  } else if (queryParams.groupId) {
    // 未認証（Widget 等）: 指定グループのアクティブサービスのみ返す
    query = query
      .where("groupId", "==", queryParams.groupId)
      .where("isActive", "==", true);
  } else if (queryParams.organizationId) {
    // 未認証・organizationId指定（後方互換）: 指定組織のアクティブサービスのみ返す
    query = query
      .where("organizationId", "==", queryParams.organizationId)
      .where("isActive", "==", true);
  } else {
    // グループ・組織指定なし・未認証 → 空配列を返す（全組織のサービス漏洩を防止）
    return [];
  }

  const snapshot = await query.get();

  const services: Service[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Service[];

  return services;
});
