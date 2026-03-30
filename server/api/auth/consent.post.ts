import { getAdminFirestore } from "~~/server/utils/firebase-admin";
import { verifyAuth } from "~~/server/utils/auth";

const CURRENT_CONSENT_VERSION = "1.0";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);
  const body = await readBody(event);

  const consentVersion = body?.consentVersion;
  if (!consentVersion || typeof consentVersion !== "string") {
    throw createError({ statusCode: 400, statusMessage: "consentVersion は必須です" });
  }

  if (consentVersion !== CURRENT_CONSENT_VERSION) {
    throw createError({
      statusCode: 400,
      statusMessage: `最新の規約バージョン（${CURRENT_CONSENT_VERSION}）に同意してください`,
    });
  }

  const db = getAdminFirestore();
  const now = new Date().toISOString();

  await db.collection("users").doc(user.id).update({
    consentAcceptedAt: now,
    consentVersion,
    updatedAt: now,
  });

  return { success: true, consentAcceptedAt: now, consentVersion };
});
