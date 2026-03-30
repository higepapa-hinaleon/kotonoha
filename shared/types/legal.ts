// ==================================================
// 利用規約・プライバシーポリシーのバージョン管理型定義
// ==================================================

/** 法的文書の種別 */
export type LegalDocumentType = "terms" | "privacy";

/** 法的文書バージョン（Firestore: legalDocuments コレクション） */
export interface LegalDocumentVersion {
  id: string;
  /** 文書種別 */
  type: LegalDocumentType;
  /** バージョン番号（例: "1.0"） */
  version: string;
  /** 文書タイトル */
  title: string;
  /** 施行日 (ISO 8601) */
  effectiveDate: string;
  /** 文書本文（HTML） */
  content: string;
  createdAt: string;
  updatedAt: string;
}
