import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuthOptional } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await verifyAuthOptional(event);
  const db = getAdminFirestore();

  // 認証済み: user.organizationId から取得、ゲスト: serviceId から organizationId/groupId を導出
  let organizationId = user?.organizationId;
  let groupId: string | undefined;
  const queryParams = getQuery(event);
  const serviceId = queryParams.serviceId as string | undefined;

  // サービス情報を取得し、organizationId/groupId を導出
  let serviceFormUrl: string | undefined;
  if (serviceId) {
    const serviceDoc = await db.collection("services").doc(serviceId).get();
    if (serviceDoc.exists) {
      const serviceData = serviceDoc.data();
      if (!organizationId) {
        organizationId = serviceData?.organizationId;
      }
      groupId = serviceData?.groupId;
      serviceFormUrl = serviceData?.googleFormUrl;
    }
  }

  // サービスの googleFormUrl を優先的に返す
  if (serviceFormUrl) {
    return { formUrl: serviceFormUrl };
  }

  // groupId/organizationId はサービスから導出したもののみ使用（クエリパラメータ直接指定は無視）
  if (!organizationId && !groupId) {
    return { formUrl: "" };
  }

  // サービスに未設定の場合はグループ（またはorg）設定のデフォルトURLにフォールバック
  const settingsQuery = db.collection("settings");
  let snapshot;
  if (groupId) {
    snapshot = await settingsQuery.where("groupId", "==", groupId).limit(1).get();
  }
  if (!snapshot || snapshot.empty) {
    // groupId で見つからない場合は organizationId でフォールバック
    if (organizationId) {
      snapshot = await settingsQuery.where("organizationId", "==", organizationId).limit(1).get();
    }
  }
  if (!snapshot) {
    return { formUrl: "" };
  }

  const settings = snapshot.docs[0]?.data();

  return {
    formUrl: settings?.googleFormUrl || "",
  };
});
