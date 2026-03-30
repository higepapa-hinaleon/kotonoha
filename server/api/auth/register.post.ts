import { getAdminFirestore, getAdminAuth } from "~~/server/utils/firebase-admin";
import { findOrCreateDefaultOrganization } from "~~/server/utils/organization";
import {
  findOrCreateDefaultGroup,
  addUserToGroup,
  getUserGroupMemberships,
} from "~~/server/utils/group";
import { checkPlanLimit } from "~~/server/utils/plan-limit";
import type { User } from "~~/shared/types/models";

export default defineEventHandler(async (event) => {
  const authorization = getHeader(event, "authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "認証が必要です" });
  }

  const idToken = authorization.slice(7);

  const decodedToken = await getAdminAuth().verifyIdToken(idToken);
  const db = getAdminFirestore();

  // 既存ユーザー確認
  const existingUser = await db.collection("users").doc(decodedToken.uid).get();
  if (existingUser.exists) {
    const userData = existingUser.data() as Omit<User, "id">;
    const user = { id: existingUser.id, ...userData } as User;
    const memberships = await getUserGroupMemberships(user.id, db);
    return { ...user, groupMemberships: memberships };
  }

  // リクエストボディの取得（組織名・グループ名・同意情報）
  let consentVersion: string | undefined;
  let groupName: string | undefined;
  let organizationName: string | undefined;
  try {
    const body = await readBody(event);
    consentVersion = body?.consentVersion;
    const rawGroupName = typeof body?.groupName === "string" ? body.groupName.trim() : undefined;
    groupName = rawGroupName && rawGroupName.length <= 100 ? rawGroupName : undefined;
    const rawOrgName = typeof body?.organizationName === "string" ? body.organizationName.trim() : undefined;
    organizationName = rawOrgName && rawOrgName.length <= 100 ? rawOrgName : undefined;
  } catch {
    // ボディなしの場合は無視
  }

  // デフォルト組織を取得 or 作成
  const orgId = await findOrCreateDefaultOrganization(db, organizationName);

  // 新規ユーザー作成: 組織内にユーザーがいなければ初回のみ owner
  const existingUsers = await db
    .collection("users")
    .where("organizationId", "==", orgId)
    .limit(1)
    .get();
  const isFirstUser = existingUsers.empty;

  const now = new Date().toISOString();

  // 2人目以降: pending 招待を先に確認
  let pendingInvitations: FirebaseFirestore.QuerySnapshot | undefined;
  if (!isFirstUser) {
    const email = (decodedToken.email || "").toLowerCase();
    if (email) {
      pendingInvitations = await db
        .collection("invitations")
        .where("email", "==", email)
        .where("status", "==", "pending")
        .get();
    }
  }

  const hasPendingInvitation = pendingInvitations && !pendingInvitations.empty;

  if (isFirstUser) {
    // 初回ユーザー: owner + デフォルト組織 + デフォルトグループ
    const displayName = decodedToken.name || decodedToken.email || "";
    const defaultGroupName = groupName || (displayName ? `${displayName}の組織` : "デフォルトグループ");
    const defaultGroupId = await findOrCreateDefaultGroup(orgId, db, defaultGroupName);

    const newUser: Omit<User, "id"> = {
      organizationId: orgId,
      email: decodedToken.email || "",
      displayName: decodedToken.name || decodedToken.email || "",
      role: "owner",
      activeGroupId: defaultGroupId,
      ...(consentVersion ? { consentAcceptedAt: now, consentVersion } : {}),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("users").doc(decodedToken.uid).set(newUser);
    await addUserToGroup(decodedToken.uid, defaultGroupId, orgId, "admin", db);

    const user = { id: decodedToken.uid, ...newUser } as User;
    const memberships = await getUserGroupMemberships(user.id, db);
    return { ...user, groupMemberships: memberships };
  }

  if (hasPendingInvitation) {
    // 2人目以降 + 招待あり: 招待元の組織に参加
    const firstInv = pendingInvitations!.docs[0].data();
    const invOrgId = firstInv.organizationId;

    await checkPlanLimit(invOrgId, "users", db);

    const newUser: Omit<User, "id"> = {
      organizationId: invOrgId,
      email: decodedToken.email || "",
      displayName: decodedToken.name || decodedToken.email || "",
      role: "user",
      ...(consentVersion ? { consentAcceptedAt: now, consentVersion } : {}),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("users").doc(decodedToken.uid).set(newUser);

    let firstGroupId: string | undefined;
    for (const invDoc of pendingInvitations!.docs) {
      const inv = invDoc.data();
      try {
        await addUserToGroup(decodedToken.uid, inv.groupId, inv.organizationId, inv.role, db);
        if (!firstGroupId) firstGroupId = inv.groupId;
        await invDoc.ref.update({ status: "accepted", updatedAt: now });
      } catch (e) {
        console.error(`招待処理失敗 (invitationId=${invDoc.id}):`, e);
      }
    }

    // 招待でグループに追加された場合、activeGroupId を設定
    if (firstGroupId) {
      try {
        await db.collection("users").doc(decodedToken.uid).update({
          activeGroupId: firstGroupId,
          updatedAt: now,
        });
        newUser.activeGroupId = firstGroupId;
      } catch (e) {
        console.error(`activeGroupId 更新失敗 (uid=${decodedToken.uid}):`, e);
      }
    }

    const user = { id: decodedToken.uid, ...newUser } as User;
    const memberships = await getUserGroupMemberships(user.id, db);
    return { ...user, groupMemberships: memberships };
  }

  // 2人目以降 + 招待なし: 未所属ユーザーとして作成
  const newUser: Omit<User, "id"> = {
    organizationId: "",
    email: decodedToken.email || "",
    displayName: decodedToken.name || decodedToken.email || "",
    role: "user",
    ...(consentVersion ? { consentAcceptedAt: now, consentVersion } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("users").doc(decodedToken.uid).set(newUser);

  const user = { id: decodedToken.uid, ...newUser } as User;
  const memberships = await getUserGroupMemberships(user.id, db);
  return { ...user, groupMemberships: memberships };
});
