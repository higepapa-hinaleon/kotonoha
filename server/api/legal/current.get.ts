import { ensureLegalDocumentsSeeded, getCurrentLegalDocument } from "~~/server/utils/legal";
import { getAdminFirestore } from "~~/server/utils/firebase-admin";

/**
 * 現在有効な利用規約・プライバシーポリシーのバージョン情報を返す（認証不要）
 */
export default defineEventHandler(async () => {
  const db = getAdminFirestore();

  // 初回アクセス時にシード（冪等）
  await ensureLegalDocumentsSeeded(db);

  const [terms, privacy] = await Promise.all([
    getCurrentLegalDocument("terms", db),
    getCurrentLegalDocument("privacy", db),
  ]);

  return {
    terms: terms
      ? { version: terms.version, title: terms.title, effectiveDate: terms.effectiveDate }
      : null,
    privacy: privacy
      ? { version: privacy.version, title: privacy.title, effectiveDate: privacy.effectiveDate }
      : null,
  };
});
