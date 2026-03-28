import type { H3Event } from "h3";
import { getAdminAuth, getAdminFirestore } from "./firebase-admin";
import { isGroupMember, isGroupAdmin as checkGroupAdmin } from "./group";
import type { User } from "~~/shared/types/models";

/**
 * リクエストからFirebase IDトークンを検証し、ユーザー情報を返す
 */
export async function verifyAuth(event: H3Event): Promise<User> {
  const authorization = getHeader(event, "authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw createError({ statusCode: 401, statusMessage: "認証が必要です" });
  }

  const idToken = authorization.slice(7);

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const db = getAdminFirestore();
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      throw createError({ statusCode: 403, statusMessage: "ユーザーが登録されていません" });
    }

    return { id: userDoc.id, ...userDoc.data() } as User;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({ statusCode: 401, statusMessage: "無効なトークンです" });
  }
}

/**
 * 認証がある場合はユーザーを返し、ない場合は null を返す（ゲスト対応）
 */
export async function verifyAuthOptional(event: H3Event): Promise<User | null> {
  const authorization = getHeader(event, "authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    return await verifyAuth(event);
  } catch {
    return null;
  }
}

/**
 * システム管理者権限を検証する
 */
export async function verifySystemAdmin(event: H3Event): Promise<User> {
  const user = await verifyAuth(event);

  if (user.role !== "system_admin") {
    throw createError({ statusCode: 403, statusMessage: "システム管理者権限が必要です" });
  }

  return user;
}

/**
 * リクエストからアクティブなグループIDを解決する
 * 優先順: X-Group-Id ヘッダー → ?groupId クエリ → user.activeGroupId
 * メンバーシップを検証し、所属していないグループへのアクセスを拒否する
 */
export async function resolveGroupId(event: H3Event, user: User): Promise<string> {
  const headerGroupId = getHeader(event, "x-group-id");
  const query = getQuery(event);
  const queryGroupId = typeof query.groupId === "string" ? query.groupId : undefined;
  const groupId = headerGroupId || queryGroupId || user.activeGroupId;

  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: "グループが指定されていません" });
  }

  // system_admin は全グループにアクセス可能
  if (user.role === "system_admin") return groupId;

  // メンバーシップ検証
  const isMember = await isGroupMember(user.id, groupId);
  if (!isMember) {
    throw createError({ statusCode: 403, statusMessage: "このグループへのアクセス権がありません" });
  }

  return groupId;
}

/**
 * グループメンバー権限を検証する（system_admin はバイパス）
 * ユーザーとグループIDを返す
 */
export async function verifyGroupMember(
  event: H3Event,
): Promise<{ user: User; groupId: string }> {
  const user = await verifyAuth(event);
  // resolveGroupId 内でメンバーシップ検証済み（system_admin はバイパス）
  const groupId = await resolveGroupId(event, user);

  return { user, groupId };
}

/**
 * グループ管理者権限を検証する（system_admin はバイパス）
 * ユーザーとグループIDを返す
 */
export async function verifyGroupAdmin(
  event: H3Event,
): Promise<{ user: User; groupId: string }> {
  const user = await verifyAuth(event);
  const groupId = await resolveGroupId(event, user);

  // system_admin は全グループにアクセス可能
  if (user.role === "system_admin") {
    return { user, groupId };
  }

  const isAdmin = await checkGroupAdmin(user.id, groupId);
  if (!isAdmin) {
    throw createError({ statusCode: 403, statusMessage: "グループ管理者権限が必要です" });
  }

  return { user, groupId };
}
