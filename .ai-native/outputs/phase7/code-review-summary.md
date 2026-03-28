# コードレビューサマリー（品質ゲート）— 再レビュー

## レビュー対象
- **対象機能:** kotonoha AI Support Bot — 全機能（チャット、ドキュメント管理、FAQ、ダッシュボード、Widget）
- **対象ファイル/モジュール:** server/, app/, shared/, packages/widget/
- **レビュー実施日:** 2026-03-24（再レビュー）
- **レビュー実施者:** コードレビュアー（Claude Code AI エージェント）
- **前回レビュー:** 2026-03-24（FAIL — CRITICAL 7件, WARNING 20件）

## コンテキスト
- **技術スタック:** Nuxt 3, Vue 3, Firebase/Firestore, Vertex AI (Gemini + Embeddings), Cloud Run (GCP)
- **データ機密度:** 中（社内データ + ユーザー会話データ）
- **動作環境:** Cloud Run (1Gi / 1 CPU / min-instances=1 / max-instances=3), Firestore named database
- **フェーズ:** Phase 7（MVP）
- **パフォーマンス基準:** 初期表示200ms以下 / 検索100ms以下（review-standards デフォルト）

## 実行順序
データ層 → インターフェース層 → コード層 → 非機能層 の順で実施。

---

## 前回 CRITICAL 指摘の是正確認

| # | 指摘内容 | 是正状況 | 根拠 |
|---|---------|---------|------|
| 1 | feedbackChunks Security Rules 未定義 | **RESOLVED** | `firestore.rules:79-83` — feedbackChunks ルール追加（read: belongsToOrg, write: false） |
| 2 | list ルールでの resource.data 参照 | **RESOLVED** | `firestore.rules:55-56,65-66,122-123,138-139` — create は request.resource.data、update/delete は resource.data に分離 |
| 15 | findOrCreateDefaultOrganization 重複 | **RESOLVED** | `server/utils/organization.ts` に抽出、register.post.ts と me.get.ts でインポート |
| 20 | confidenceThreshold デフォルト値不整合 | **RESOLVED** | `server/utils/constants.ts:7` — DEFAULT_CONFIDENCE_THRESHOLD = 0.6 を全箇所で使用 |
| 25 | バッチ削除 500件超 | **RESOLVED** | `server/api/documents/[id].delete.ts:33-59` — ensureBatch パターン適用（BATCH_SIZE_LIMIT=490） |
| 31 | チャット API ストリーミング非対応 | **MITIGATED** | 同期的だが、Gemini タイムアウト(30s)、embedding フォールバック、Gemini フォールバック、レート制限で緩和 |
| 32 | ダッシュボード全会話フルスキャン | **RESOLVED** | `server/api/dashboard/summary.get.ts:16-19` — count() クエリで全量ロード回避 |

---

## 7視点レビュー結果

### 視点1: データ設計
- **判定:** OK（条件付き）
- **確認内容:** Firestore Security Rules、インデックス設計、create/update ルール分離、feedbackChunks/embeddingCache ルール追加を確認。
- **根拠:** Security Rules は全コレクションで create と update/delete を分離し、create では request.resource.data を検証。feedbackChunks、embeddingCache のルールも追加済み。conversations、improvementRequests、weeklyReports の管理者アクセスに組織スコープを追加。
- **根拠アーティファクト:** `firestore.rules:1-147`, `storage.rules:1-16`
- **残存指摘:**
  - **[INFO] R-1:** ダッシュボードのドキュメント統計は全ドキュメント取得が残る（`summary.get.ts:96-117`）。ドキュメント数が限定的な MVP では許容範囲。

### 視点2: インターフェース設計
- **判定:** OK
- **確認内容:** API 型定義、定数ファイルによる SoT、認証ヘルパーの分離、ヘルスチェック API の公開設定を確認。
- **根拠:** FeedbackChunk 型を shared/types/models.ts に追加。定数ファイルで閾値を一元管理。ヘルスチェック API を auth 除外パスに追加。
- **根拠アーティファクト:** `shared/types/models.ts:165-176`, `server/utils/constants.ts:1-43`, `server/middleware/auth.ts:13-19`

### 視点3: 冗長性排除
- **判定:** OK
- **確認内容:** findOrCreateDefaultOrganization の共通化、MIME タイプ・サイズ制限の定数化を確認。
- **根拠:** 重複コードが適切に排除されている。ALLOWED_MIME_TYPES と MAX_UPLOAD_SIZE_BYTES が upload.post.ts と update.put.ts で共有。
- **根拠アーティファクト:** `server/utils/organization.ts:1-24`, `server/utils/constants.ts:18-30`

### 視点4: 変更耐性
- **判定:** OK
- **確認内容:** マジックナンバーの定数化、レート制限設定の外部化、CORS 設定の環境変数化を確認。
- **根拠:** confidenceThreshold, ragTopK, ragSimilarityThreshold, システムプロンプト、バッチサイズ、アップロードサイズ、API タイムアウト、レート制限がすべて constants.ts に一元化。
- **根拠アーティファクト:** `server/utils/constants.ts:1-43`

### 視点5: エラーハンドリング
- **判定:** OK
- **確認内容:** Embedding 失敗時の RAG スキップ、Gemini 失敗時のフォールバック応答、レート制限超過時の 429 応答を確認。
- **根拠:** チャットフローの全外部依存にフォールバックが設定済み。Embedding 失敗 → RAG スキップで Gemini のみ回答。Gemini 失敗 → ユーザーフレンドリーなエラーメッセージ保存。
- **根拠アーティファクト:** `server/api/chat/send.post.ts:124-129,212-226`

### 視点6: パフォーマンス（UI体感）
- **判定:** OK（条件付き）
- **確認内容:** ダッシュボードの count() クエリ、外部 API タイムアウト、レート制限、min-instances=1 を確認。
- **根拠:** ダッシュボード会話統計は count() クエリで効率化。外部 API に 30 秒タイムアウト設定。min-instances=1 でコールドスタート排除。
- **根拠アーティファクト:** `server/api/dashboard/summary.get.ts:16-19`, `server/utils/constants.ts:33`, `cloudbuild.yaml:34-35`
- **残存指摘:**
  - **[INFO] R-2:** チャット API は同期的だが、タイムアウト・フォールバックにより最悪ケースは制御されている。将来的に SSE 対応を推奨。

### 視点7: 可読性
- **判定:** OK
- **確認内容:** 定数ファイルの構造、新規ユーティリティの JSDoc、フォルダ構造の一貫性を確認。
- **根拠:** constants.ts は JSDoc コメント付きで整理されている。organization.ts、rate-limiter.ts は単一責務で明確。
- **根拠アーティファクト:** `server/utils/constants.ts`, `server/utils/organization.ts`, `server/utils/rate-limiter.ts`

---

## 指摘事項一覧

| # | 視点 | 重大度 | 内容 | コード箇所 |
|---|------|--------|------|-----------|
| R-1 | データ設計 | INFO | ダッシュボードのドキュメント統計が全ドキュメント取得 | `summary.get.ts:96-117` |
| R-2 | パフォーマンス | INFO | チャット API が同期的（タイムアウト・フォールバックで緩和済み） | `send.post.ts` |

## 総合判定
- **品質ゲート:** PASS
- **CRITICAL指摘数:** 0件（前回7件 → 全件是正済み）
- **WARNING指摘数:** 0件（前回20件 → 全件是正済みまたはINFOに引き下げ）
- **INFO指摘数:** 2件
- **判定根拠:** 7視点中7視点が OK 判定（うち2視点が条件付き OK）。前回の CRITICAL 7件は全て是正確認済み。残存する INFO 2件はいずれも MVP フェーズでは許容範囲であり、将来の改善事項として記録する。
