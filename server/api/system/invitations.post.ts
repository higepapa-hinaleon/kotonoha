import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifySystemAdmin, isPlatformAdmin } from "~~/server/utils/auth";
import { checkPlanLimit } from "~~/server/utils/plan-limit";
import type { Invitation } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const admin = await verifySystemAdmin(event);

  try {
    const db = getAdminFirestore();

    const body = await readBody<{ email: string; groupId: string; role: "admin" | "member"; organizationId?: string }>(event);

    if (!body.email || !body.groupId || !body.role) {
      throw createError({ statusCode: 400, statusMessage: "email, groupId, role は必須です" });
    }

    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({ statusCode: 400, statusMessage: "有効なメールアドレスを入力してください" });
    }

    // プラットフォーム管理者は組織を指定可能
    const targetOrgId = isPlatformAdmin(admin) && body.organizationId
      ? body.organizationId
      : admin.organizationId;

    // プランのユーザー上限チェック
    await checkPlanLimit(targetOrgId, "users", db);

    if (!["admin", "member"].includes(body.role)) {
      throw createError({
        statusCode: 400,
        statusMessage: "role は admin または member を指定してください",
      });
    }

    // グループが対象組織に属するか確認
    const groupDoc = await db.collection("groups").doc(body.groupId).get();
    if (!groupDoc.exists || groupDoc.data()?.organizationId !== targetOrgId) {
      throw createError({ statusCode: 400, statusMessage: "指定されたグループが見つかりません" });
    }

    // 同一メール・同一グループの pending 招待が既にないか確認
    const existing = await db
      .collection("invitations")
      .where("email", "==", email)
      .where("groupId", "==", body.groupId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existing.empty) {
      throw createError({ statusCode: 409, statusMessage: "この招待は既に存在します" });
    }

    const now = new Date().toISOString();
    const ref = db.collection("invitations").doc();
    const invitation: Omit<Invitation, "id"> = {
      organizationId: targetOrgId,
      email,
      groupId: body.groupId,
      role: body.role,
      invitedBy: admin.id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(invitation);

    return { id: ref.id, ...invitation } as Invitation;
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e) throw e;
    const message = e instanceof Error ? e.message : String(e);
    console.error("[system/invitations/post] Firestore操作エラー:", message);
    throw createError({ statusCode: 500, statusMessage: `招待の作成に失敗しました: ${message}` });
  }
});
