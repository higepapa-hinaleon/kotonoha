import { getAdminFirestore, getAdminAuth } from "~~/server/utils/firebase-admin";
import { findOrCreateDefaultOrganization } from "~~/server/utils/organization";
import { findOrCreateDefaultGroup, addUserToGroup, getUserGroupMemberships } from "~~/server/utils/group";
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

    // organizationId が未設定の既存ユーザーを修復
    if (!userData.organizationId) {
      const orgId = await findOrCreateDefaultOrganization(db);
      await db.collection("users").doc(decodedToken.uid).update({
        organizationId: orgId,
        updatedAt: new Date().toISOString(),
      });
      userData.organizationId = orgId;
    }

    const user = { id: existingUser.id, ...userData } as User;
    const memberships = await getUserGroupMemberships(user.id, db);
    return { ...user, groupMemberships: memberships };
  }

  // デフォルト組織を取得 or 作成
  const orgId = await findOrCreateDefaultOrganization(db);

  // 新規ユーザー作成: 組織内にユーザーがいなければ初回のみ system_admin
  const existingUsers = await db
    .collection("users")
    .where("organizationId", "==", orgId)
    .limit(1)
    .get();
  const isFirstUser = existingUsers.empty;
  const role = isFirstUser ? "system_admin" : "member";

  // デフォルトグループを取得 or 作成
  const defaultGroupId = await findOrCreateDefaultGroup(orgId, db);

  const now = new Date().toISOString();
  const newUser: Omit<User, "id"> = {
    organizationId: orgId,
    email: decodedToken.email || "",
    displayName: decodedToken.name || decodedToken.email || "",
    role,
    ...(isFirstUser ? { activeGroupId: defaultGroupId } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("users").doc(decodedToken.uid).set(newUser);

  // 初回ユーザーはデフォルトグループに admin として追加
  if (isFirstUser) {
    await addUserToGroup(decodedToken.uid, defaultGroupId, orgId, "admin", db);
  }

  // 2人目以降: pending 招待があれば自動でグループに割当
  if (!isFirstUser) {
    const email = (decodedToken.email || "").toLowerCase();
    if (email) {
      const pendingInvitations = await db
        .collection("invitations")
        .where("email", "==", email)
        .where("status", "==", "pending")
        .where("organizationId", "==", orgId)
        .get();

      let firstGroupId: string | undefined;
      for (const invDoc of pendingInvitations.docs) {
        const inv = invDoc.data();
        try {
          await addUserToGroup(decodedToken.uid, inv.groupId, orgId, inv.role, db);
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
    }
  }

  const user = { id: decodedToken.uid, ...newUser } as User;
  const memberships = await getUserGroupMemberships(user.id, db);
  return { ...user, groupMemberships: memberships };
});
