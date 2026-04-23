import { getAdminFirestore } from "./firebase-admin";
import type { LegalDocumentVersion } from "~~/shared/types/legal";

/** v1.0 利用規約 HTML */
const TERMS_V1_CONTENT = `<h1>利用規約</h1>
<p class="text-sm text-gray-500">最終更新日: 2026年3月30日 / バージョン: 1.0</p>

<h2>第1条（適用）</h2>
<p>
  本利用規約（以下「本規約」）は、kotonoha AI Support（以下「本サービス」）の利用に関する条件を定めるものです。
  ユーザーは本サービスを利用することにより、本規約に同意したものとみなされます。
</p>

<h2>第2条（定義）</h2>
<ul>
  <li>「ユーザー」とは、本サービスにアカウント登録した個人または法人を指します。</li>
  <li>「組織」とは、ユーザーが所属するグループ単位を指します。</li>
  <li>「コンテンツ」とは、ユーザーが本サービスにアップロードまたは入力したデータを指します。</li>
</ul>

<h2>第3条（アカウント登録）</h2>
<p>
  ユーザーは正確かつ最新の情報を提供してアカウントを登録するものとします。
  アカウント情報の管理はユーザーの責任とし、第三者への譲渡・貸与は禁止します。
</p>

<h2>第4条（サービスの利用）</h2>
<p>
  ユーザーは、選択したプランに応じた範囲内で本サービスを利用できます。
  プランごとの利用制限（グループ数、サービス数、ドキュメント数、月間チャット数等）を超過する場合は、
  プランのアップグレードが必要です。
</p>

<h2>第5条（禁止事項）</h2>
<p>ユーザーは以下の行為を行ってはなりません：</p>
<ul>
  <li>法令または公序良俗に違反する行為</li>
  <li>本サービスの運営を妨害する行為</li>
  <li>他のユーザーの利用を妨害する行為</li>
  <li>不正アクセスまたはそれを試みる行為</li>
  <li>本サービスを利用した違法なデータの保存・送信</li>
  <li>リバースエンジニアリング、逆コンパイル等の行為</li>
</ul>

<h2>第6条（知的財産権）</h2>
<p>
  本サービスに関する知的財産権は運営者に帰属します。
  ユーザーがアップロードしたコンテンツの知的財産権はユーザーに帰属しますが、
  サービス提供に必要な範囲で運営者に利用を許諾するものとします。
</p>

<h2>第7条（サービスの変更・停止）</h2>
<p>
  運営者は、事前の通知なく本サービスの内容を変更、または提供を停止・中断することができます。
  これによりユーザーに生じた損害について、運営者は責任を負いません。
</p>

<h2>第8条（免責事項）</h2>
<p>
  本サービスのAI応答は参考情報であり、正確性・完全性を保証するものではありません。
  ユーザーは自己の責任において本サービスを利用するものとします。
</p>

<h2>第9条（規約の変更）</h2>
<p>
  運営者は本規約を変更する場合、変更内容を本サービス上で通知します。
  変更後も本サービスを継続して利用する場合、変更後の規約に同意したものとみなされます。
</p>

<h2>第10条（準拠法・管轄）</h2>
<p>
  本規約は日本法に準拠し、本規約に関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。
</p>`;

/** v1.0 プライバシーポリシー HTML */
const PRIVACY_V1_CONTENT = `<h1>プライバシーポリシー</h1>
<p class="text-sm text-gray-500">最終更新日: 2026年3月30日 / バージョン: 1.0</p>

<h2>1. 収集する情報</h2>
<p>本サービスでは、以下の情報を収集します：</p>
<ul>
  <li><strong>アカウント情報：</strong>メールアドレス、表示名、認証プロバイダ情報</li>
  <li><strong>利用データ：</strong>チャット履歴、アップロードされたドキュメント、サービス利用状況</li>
  <li><strong>技術情報：</strong>IPアドレス、ブラウザ情報、アクセスログ</li>
  <li><strong>同意記録：</strong>利用規約・プライバシーポリシーへの同意日時およびバージョン</li>
</ul>

<h2>2. 情報の利用目的</h2>
<p>収集した情報は以下の目的で利用します：</p>
<ul>
  <li>本サービスの提供・運営・改善</li>
  <li>AI応答の品質向上（ドキュメントの解析・ベクトル化）</li>
  <li>ユーザーサポートの提供</li>
  <li>利用状況の分析・レポート作成</li>
  <li>不正利用の防止</li>
  <li>法令に基づく対応</li>
</ul>

<h2>3. 情報の共有</h2>
<p>
  ユーザーの個人情報は、以下の場合を除き第三者に提供しません：
</p>
<ul>
  <li>ユーザーの同意がある場合</li>
  <li>法令に基づく場合</li>
  <li>サービス提供に必要な業務委託先への提供（適切な安全管理措置を講じた上で）</li>
</ul>

<h2>4. データの保管</h2>
<p>
  ユーザーデータはGoogle Cloud Platform上に保管され、適切なセキュリティ対策を施しています。
  データの保管場所はアジア太平洋リージョンを基本とします。
</p>

<h2>5. AI処理について</h2>
<p>
  アップロードされたドキュメントはAI（Google Vertex AI）により解析・ベクトル化されます。
  チャットの質問に対する回答生成にもAIが使用されます。
  AI処理の結果は参考情報であり、最終的な判断はユーザーの責任で行ってください。
</p>

<h2>6. ユーザーの権利</h2>
<p>ユーザーは以下の権利を有します：</p>
<ul>
  <li>自身の個人情報の開示請求</li>
  <li>個人情報の訂正・削除の請求</li>
  <li>アカウントの削除</li>
</ul>
<p>これらの請求は、サービス内の設定画面または運営者への連絡により行うことができます。</p>

<h2>7. Cookieの使用</h2>
<p>
  本サービスでは認証状態の管理にCookieおよびローカルストレージを使用します。
  これらはサービスの正常な動作に必要なものです。
</p>

<h2>8. ポリシーの変更</h2>
<p>
  本ポリシーは必要に応じて変更することがあります。
  重要な変更がある場合は、本サービス上で通知します。
</p>

<h2>9. お問い合わせ</h2>
<p>
  個人情報の取り扱いに関するお問い合わせは、本サービスのサポート窓口までご連絡ください。
</p>`;

interface SeedDoc {
  type: "terms" | "privacy";
  version: string;
  title: string;
  effectiveDate: string;
  content: string;
}

const SEED_DOCS: SeedDoc[] = [
  {
    type: "terms",
    version: "1.0",
    title: "利用規約",
    effectiveDate: "2026-03-30T00:00:00.000Z",
    content: TERMS_V1_CONTENT,
  },
  {
    type: "privacy",
    version: "1.0",
    title: "プライバシーポリシー",
    effectiveDate: "2026-03-30T00:00:00.000Z",
    content: PRIVACY_V1_CONTENT,
  },
];

/**
 * legalDocuments コレクションが空の場合に v1.0 をシードする（冪等）
 */
export async function ensureLegalDocumentsSeeded(db?: FirebaseFirestore.Firestore): Promise<void> {
  const firestore = db ?? getAdminFirestore();
  const snapshot = await firestore.collection("legalDocuments").limit(1).get();
  if (!snapshot.empty) return;

  const now = new Date().toISOString();
  const batch = firestore.batch();
  for (const doc of SEED_DOCS) {
    const ref = firestore.collection("legalDocuments").doc(`${doc.type}_v${doc.version}`);
    batch.set(ref, {
      type: doc.type,
      version: doc.version,
      title: doc.title,
      effectiveDate: doc.effectiveDate,
      content: doc.content,
      createdAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
}

/**
 * 指定種別の最新バージョンを取得
 */
export async function getCurrentLegalDocument(
  type: "terms" | "privacy",
  db?: FirebaseFirestore.Firestore,
): Promise<LegalDocumentVersion | null> {
  const firestore = db ?? getAdminFirestore();
  const snapshot = await firestore
    .collection("legalDocuments")
    .where("type", "==", type)
    .orderBy("effectiveDate", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as LegalDocumentVersion;
}

/**
 * 指定種別・バージョンの文書を取得
 */
export async function getLegalDocument(
  type: "terms" | "privacy",
  version: string,
  db?: FirebaseFirestore.Firestore,
): Promise<LegalDocumentVersion | null> {
  const firestore = db ?? getAdminFirestore();

  // まず規約的 ID で取得を試みる
  const docRef = firestore.collection("legalDocuments").doc(`${type}_v${version}`);
  const doc = await docRef.get();
  if (doc.exists) {
    return { id: doc.id, ...doc.data() } as LegalDocumentVersion;
  }

  // フォールバック: クエリで検索
  const snapshot = await firestore
    .collection("legalDocuments")
    .where("type", "==", type)
    .where("version", "==", version)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const found = snapshot.docs[0];
  return { id: found.id, ...found.data() } as LegalDocumentVersion;
}
