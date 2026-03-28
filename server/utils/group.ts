import { getAdminFirestore } from "./firebase-admin";
import type { Group, UserGroupMembership } from "~~/shared/types/models";

/**
 * デフォルトグループを取得、存在しなければ作成する
 */
export async function findOrCreateDefaultGroup(
  organizationId: string,
  db?: FirebaseFirestore.Firestore,
): Promise<string> {
  const firestore = db ?? getAdminFirestore();

  // 既存グループを確認
  const groupsSnapshot = await firestore
    .collection("groups")
    .where("organizationId", "==", organizationId)
    .limit(1)
    .get();

  if (!groupsSnapshot.empty) {
    return groupsSnapshot.docs[0].id;
  }

  const now = new Date().toISOString();
  const groupRef = firestore.collection("groups").doc();
  await groupRef.set({
    organizationId,
    name: "デフォルトグループ",
    description: "自動作成されたデフォルトグループ",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  return groupRef.id;
}

/**
 * ユーザーの所属グループ一覧を取得
 */
export async function getUserGroupMemberships(
  userId: string,
  db?: FirebaseFirestore.Firestore,
): Promise<UserGroupMembership[]> {
  const firestore = db ?? getAdminFirestore();
  const snapshot = await firestore
    .collection("userGroupMemberships")
    .where("userId", "==", userId)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserGroupMembership[];
}

/**
 * ユーザーの所属グループ一覧（Groupエンティティ付き）を取得
 */
export async function getUserGroups(
  userId: string,
  db?: FirebaseFirestore.Firestore,
): Promise<{ group: Group; membership: UserGroupMembership }[]> {
  const firestore = db ?? getAdminFirestore();
  const memberships = await getUserGroupMemberships(userId, firestore);

  if (memberships.length === 0) return [];

  // グループドキュメントを並列取得（N+1 回避）
  const groupDocs = await Promise.all(
    memberships.map((m) => firestore.collection("groups").doc(m.groupId).get()),
  );

  const results: { group: Group; membership: UserGroupMembership }[] = [];
  groupDocs.forEach((groupDoc, i) => {
    if (groupDoc.exists) {
      results.push({
        group: { id: groupDoc.id, ...groupDoc.data() } as Group,
        membership: memberships[i],
      });
    }
  });

  return results;
}

/**
 * ユーザーが指定グループに所属しているか確認
 */
export async function isGroupMember(
  userId: string,
  groupId: string,
  db?: FirebaseFirestore.Firestore,
): Promise<boolean> {
  const firestore = db ?? getAdminFirestore();
  const membershipId = `${userId}_${groupId}`;
  const doc = await firestore.collection("userGroupMemberships").doc(membershipId).get();
  return doc.exists;
}

/**
 * ユーザーが指定グループの管理者か確認
 */
export async function isGroupAdmin(
  userId: string,
  groupId: string,
  db?: FirebaseFirestore.Firestore,
): Promise<boolean> {
  const firestore = db ?? getAdminFirestore();
  const membershipId = `${userId}_${groupId}`;
  const doc = await firestore.collection("userGroupMemberships").doc(membershipId).get();
  if (!doc.exists) return false;
  return doc.data()?.role === "admin";
}

/**
 * ユーザーをグループに追加（冪等: 既存メンバーは role のみ更新）
 * organizationId がグループの所属組織と一致することを検証する
 */
export async function addUserToGroup(
  userId: string,
  groupId: string,
  organizationId: string,
  role: "admin" | "member",
  db?: FirebaseFirestore.Firestore,
): Promise<void> {
  const firestore = db ?? getAdminFirestore();

  // グループの組織を検証
  const groupDoc = await firestore.collection("groups").doc(groupId).get();
  if (!groupDoc.exists || groupDoc.data()?.organizationId !== organizationId) {
    throw new Error("グループが存在しないか、組織が一致しません");
  }

  const membershipId = `${userId}_${groupId}`;
  const now = new Date().toISOString();
  const existing = await firestore.collection("userGroupMemberships").doc(membershipId).get();

  if (existing.exists) {
    // 既存メンバー: role のみ更新（createdAt は保護）
    await firestore.collection("userGroupMemberships").doc(membershipId).update({
      role,
      updatedAt: now,
    });
  } else {
    await firestore.collection("userGroupMemberships").doc(membershipId).set({
      userId,
      groupId,
      organizationId,
      role,
      createdAt: now,
      updatedAt: now,
    });
  }
}
