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
 * プラットフォーム管理者かどうかを判定する（owner / system_admin）
 * 全組織を横断的に管理できるロール
 */
export function isPlatformAdmin(user: User): boolean {
  return user.role === "owner" || user.role === "system_admin";
}

/**
 * システム管理者権限を検証する（owner も許可）
 */
export async function verifySystemAdmin(event: H3Event): Promise<User> {
  const user = await verifyAuth(event);

  if (user.role !== "system_admin" && user.role !== "owner") {
    throw createError({ statusCode: 403, statusMessage: "システム管理者権限が必要です" });
  }

  return user;
}

/**
 * オーナー権限を検証する
 */
export async function verifyOwner(event: H3Event): Promise<User> {
  const user = await verifyAuth(event);

  if (user.role !== "owner") {
    throw createError({ statusCode: 403, statusMessage: "オーナー権限が必要です" });
  }

  return user;
}

/**
 * 組織管理者以上の権限を検証する（org_admin, system_admin, owner）
 */
export async function verifyOrgAdmin(event: H3Event): Promise<User> {
  const user = await verifyAuth(event);

  if (user.role !== "org_admin" && user.role !== "system_admin" && user.role !== "owner") {
    throw createError({ statusCode: 403, statusMessage: "組織管理者権限が必要です" });
  }

  return user;
}

/**
 * ウィジェット経由のゲストユーザー識別情報をヘッダーから取得する
 */
export function resolveExternalUser(event: H3Event): {
  externalUserName?: string;
  externalUserId?: string;
  guestUserId: string;
} {
  const externalUserName =
    (getHeader(event, "x-kotonoha-user-name") || "")
      .replace(/[\r\n\0<>]/g, "")
      .trim()
      .slice(0, 200) || undefined;
  const externalUserId =
    (getHeader(event, "x-kotonoha-user-id") || "")
      .replace(/[\r\n\0<>]/g, "")
      .trim()
      .slice(0, 200) || undefined;
  const guestUserId = externalUserId ? `ext:${externalUserId}` : "guest";
  return { externalUserName, externalUserId, guestUserId };
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

  // owner / system_admin は全組織の全グループにアクセス可能
  if (user.role === "owner" || user.role === "system_admin") return groupId;

  // org_admin は同一組織内の全グループにアクセス可能
  if (user.role === "org_admin") {
    const db = getAdminFirestore();
    const groupDoc = await db.collection("groups").doc(groupId).get();
    if (groupDoc.exists && groupDoc.data()?.organizationId === user.organizationId) {
      return groupId;
    }
    throw createError({ statusCode: 403, statusMessage: "このグループへのアクセス権がありません" });
  }

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
export async function verifyGroupMember(event: H3Event): Promise<{ user: User; groupId: string }> {
  const user = await verifyAuth(event);
  // resolveGroupId 内でメンバーシップ検証済み（system_admin はバイパス）
  const groupId = await resolveGroupId(event, user);

  return { user, groupId };
}

/**
 * グループ管理者権限を検証する（system_admin はバイパス）
 * ユーザーとグループIDを返す
 */
export async function verifyGroupAdmin(event: H3Event): Promise<{ user: User; groupId: string }> {
  const user = await verifyAuth(event);
  const groupId = await resolveGroupId(event, user);

  // owner / system_admin は全グループにアクセス可能、org_admin は resolveGroupId で組織チェック済み
  if (user.role === "owner" || user.role === "system_admin" || user.role === "org_admin") {
    return { user, groupId };
  }

  const isAdmin = await checkGroupAdmin(user.id, groupId);
  if (!isAdmin) {
    throw createError({ statusCode: 403, statusMessage: "グループ管理者権限が必要です" });
  }

  return { user, groupId };
}

/**
 * ユーザーの組織が有効な契約（active）を持っていることを検証する
 * プラットフォーム管理者・組織未所属ユーザー（ゲスト等）はスキップ
 */
export async function verifyActiveContract(user: User): Promise<void> {
  // プラットフォーム管理者は常にアクセス可
  if (isPlatformAdmin(user)) return;

  // 組織未所属（ゲストアクセス等）はスキップ
  if (!user.organizationId) return;

  const db = getAdminFirestore();
  const snapshot = await db
    .collection("contracts")
    .where("organizationId", "==", user.organizationId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw createError({ statusCode: 403, statusMessage: "有効な契約がありません" });
  }

  const contract = snapshot.docs[0].data();
  if (contract.status === "active") return;

  const messages: Record<string, string> = {
    pending_payment: "ご入金の確認待ちです。入金完了後にサービスが有効化されます。",
    suspended: "契約が一時停止中です。お支払い状況をご確認ください。",
    cancelled: "契約が解約されています。",
    expired: "契約の有効期限が切れています。",
  };

  throw createError({
    statusCode: 403,
    statusMessage: messages[contract.status] || "有効な契約がありません",
  });
}
