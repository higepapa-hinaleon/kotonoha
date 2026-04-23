import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import type { Contract } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const user = await verifySystemAdmin(event);

  try {
    const db = getAdminFirestore();

    // 契約情報をorgIdごとに最適な1件にまとめる
    async function buildContractMap(orgIds: string[]): Promise<Map<string, Contract>> {
      if (orgIds.length === 0) return new Map();
      const contractsSnap = await db.collection("contracts").get();
      const map = new Map<string, Contract>();
      for (const cdoc of contractsSnap.docs) {
        const c = { id: cdoc.id, ...cdoc.data() } as Contract;
        if (!orgIds.includes(c.organizationId)) continue;
        const existing = map.get(c.organizationId);
        // active を優先、既にactiveなら上書きしない、それ以外はstartDateが新しい方を採用
        if (
          !existing ||
          (c.status === "active" && existing.status !== "active") ||
          (existing.status !== "active" && c.startDate > existing.startDate)
        ) {
          map.set(c.organizationId, c);
        }
      }
      return map;
    }

    // プラットフォーム管理者は全組織を表示
    if (isPlatformAdmin(user)) {
      const snapshot = await db.collection("organizations").orderBy("createdAt", "desc").get();
      const orgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const contractMap = await buildContractMap(orgs.map((o) => o.id));
      return orgs.map((org) => ({ ...org, contract: contractMap.get(org.id) || null }));
    }

    // それ以外は自組織のみ
    if (!user.organizationId) {
      return [];
    }
    const orgDoc = await db.collection("organizations").doc(user.organizationId).get();
    if (!orgDoc.exists) {
      return [];
    }
    const org = { id: orgDoc.id, ...orgDoc.data() };
    const contractMap = await buildContractMap([org.id]);
    return [{ ...org, contract: contractMap.get(org.id) || null }];
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/organizations/list] Firestore操作エラー:", message);
    throw createError({
      statusCode: 500,
      statusMessage: `組織一覧の取得に失敗しました: ${message}`,
    });
  }
});
