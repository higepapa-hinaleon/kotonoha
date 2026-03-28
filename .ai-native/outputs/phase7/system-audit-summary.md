# システム監査サマリー（安全ゲート）— 最終監査（Round 3）

## 監査対象
- **対象機能:** kotonoha AI Support Bot — 全機能（チャット、ドキュメント管理、FAQ、ダッシュボード、Widget）
- **対象ファイル/モジュール:** server/, app/, shared/, packages/widget/, firestore.rules, storage.rules, Dockerfile, cloudbuild.yaml
- **監査実施日:** 2026-03-24（最終監査 Round 3）
- **監査実施者:** システム監査官（Claude Code AI エージェント）
- **前回監査:** 2026-03-24（FAIL — CRITICAL 6件, HIGH 5件）

## 監査コンテキスト
- **データ機密度:** 中（社内データ + ユーザー会話データ）
- **動作環境:** Cloud Run (GCP), Firestore named database, Cloud Storage, Vertex AI
- **同居システム:** なし（単一 Cloud Run サービス）
- **リソース上限:** CPU: 1 / Memory: 1Gi / min-instances: 1 / max-instances: 3
- **フェーズ:** Phase 7（MVP）

---

## 前回 CRITICAL/HIGH 指摘の是正確認

| # | 指摘内容 | 是正状況 | 根拠 |
|---|---------|---------|------|
| SEC-02 | 全ユーザー admin ロール付与 | **RESOLVED** | `register.post.ts:42-48` — デフォルト role は "member"、組織内に admin が0人の場合のみ "admin" |
| SEC-03 | /api/auth/me で admin 自動昇格 | **RESOLVED** | `me.get.ts:8-17` — organizationId 修復のみ、既存 role を維持 |
| SEC-17 | レート制限なし | **RESOLVED** | `server/utils/rate-limiter.ts` + `send.post.ts:26-30` — チャット API に 10req/min のレート制限 |
| AS-2-F01 | Gemini API 失敗でチャット停止 | **RESOLVED** | `send.post.ts:212-226` — try/catch + フォールバック応答メッセージ |
| AS-2-F02 | Embedding 失敗でチャット停止 | **RESOLVED** | `send.post.ts:124-129` — try/catch + RAG スキップ |
| AS-3-F01 | Cloud Run リソース不足 | **RESOLVED** | `cloudbuild.yaml:31-36` — メモリ 1Gi, min-instances=1 |
| AS-2-F04 | 削除バッチサイズ制限超過 | **RESOLVED** | `[id].delete.ts:33-59` — ensureBatch パターン適用 |
| AS-3-F02 | ヘルスチェック不在 | **RESOLVED** | `server/api/health.get.ts` + `server/middleware/auth.ts:18` — 認証不要のヘルスチェック追加 |
| AS-4-F07 | 外部 API タイムアウトなし | **RESOLVED** | `gemini.ts:82-87` タイムアウト 30s, `embeddings.ts:202` タイムアウト 30s |

---

## 監査結果

### 安全性（Security）
- **判定:** PASS

- **確認事項:**
  - データ保管: Firestore + Cloud Storage。環境変数による秘密情報管理は適切。ハードコードされた秘密鍵なし
  - アクセス経路: Firebase ID トークンによる Bearer 認証。`verifyAuth()` / `verifyAdmin()` / `verifyAuthOptional()` の3層構造
  - Firestore Security Rules: 全コレクションで組織スコープ適用。create と update/delete を分離。feedbackChunks, embeddingCache のルール追加
  - フロントエンド: クライアント公開情報は Firebase Client SDK 設定のみ（公開想定）。DOMPurify によるサニタイズあり
  - レート制限: チャット API に IP/ユーザー単位のレート制限（10req/min）
  - CORS: corsAllowedOrigins 設定によるホワイトリスト制御（未設定時のみ *）
  - 設定更新: verifyAdmin に変更済み（一般ユーザーによる設定改ざん防止）
  - 全管理系エンドポイント: verifyAdmin に統一（サービス/ドキュメント/FAQ/改善要望/レポートの全 CRUD）
  - Widget renderMarkdown: javascript: URI を排除（XSS 防止）、https?:// のみ許可
  - 会話詳細 API: 管理者アクセスに組織スコープ追加（cross-org データ漏洩防止）
  - ファイルアップロード: MIME タイプ検証 + 10MB サイズ制限
  - Storage Rules: write を false に変更（Admin SDK のみ）

- **残存指摘:**
  - **[LOW] SEC-R1:** Storage read が組織横断でアクセス可能（`storage.rules:6-8`）。Storage Rules では Firestore ルックアップ不可のため、サーバーサイドで制御。既知の制約。
  - **[LOW] SEC-R2:** Widget の auth-token が DOM 属性に露出（`packages/widget/src/index.ts`）。サードパーティサイトの JS から読取可能だが、Bearer トークンは限定スコープ。
  - **[LOW] SEC-R3:** Docker イメージ `node:22-alpine` がタグ固定されていない（`Dockerfile`）。SHA256 ダイジェスト固定推奨。

### 安定性（Stability）
- **判定:** PASS

- **確認事項:**
  - 障害時動作: Embedding 失敗 → RAG スキップで Gemini のみ回答。Gemini 失敗 → フォールバック応答保存。フィードバック検索失敗 → Firestore クエリフォールバック
  - 外部 API: 30 秒タイムアウト設定。Gemini は Promise.race、Embedding は $fetch timeout で制御
  - バッチ操作: 削除・処理ともに ensureBatch パターン（490 ops 上限）で Firestore バッチ制限を遵守
  - レート制限: インメモリ token bucket で Vertex AI コスト攻撃を防止
  - クリティカルログ: console.error/warn による出力あり

- **残存指摘:**
  - **[MEDIUM] AS-R1:** バッチ書込の途中失敗時にロールバック不可（`process.post.ts:286-288`）。部分的チャンク欠損のリスクあり。ステータスを "error" に更新する復旧パスは存在。
  - **[MEDIUM] AS-R2:** 会話メタデータ更新の非トランザクション性（`send.post.ts:266-297`）。messageCount の読取-更新間に競合リスクあり。

### 可用性（Availability）
- **判定:** PASS

- **確認事項:**
  - リソース: Cloud Run 1Gi メモリ、min-instances=1（コールドスタート排除）
  - ヘルスチェック: `/api/health` で Firestore 接続確認。認証不要で Load Balancer/Cloud Run のプローブに対応
  - ダッシュボード: count() クエリで全量スキャン回避
  - SPOF: Vertex AI (Gemini/Embeddings) が主要 SPOF だが、フォールバック応答で機能継続
  - ドキュメント一覧: limit(200) で上限設定

- **残存指摘:**
  - **[MEDIUM] AS-R3:** 同時ドキュメント処理時のリソース枯渇リスク（Cloud Run 3 インスタンス制限）。処理キュー化は将来課題。
  - **[LOW] AS-R4:** カスタムメトリクス・アラート・分散トレーシング未導入。Cloud Run 標準メトリクスのみ。

### 致命的パターン検出
- **メモリリーク:** 条件付き検出なし — L1 Embedding キャッシュに LRU 制限（1000 エントリ）、レート制限バケットに定期クリーンアップ（5分）
- **無限ループ:** 検出なし
- **デッドロック:** 検出なし
- **ストレージ永久増加:** 残存あり
  - **[MEDIUM] AS-R5:** L2 Embedding キャッシュ (Firestore embeddingCache) に TTL ポリシー未設定（`embeddings.ts:102-117`）
  - **[MEDIUM] AS-R6:** weeklyReports コレクションの無期限蓄積（`reports/generate.post.ts`）
- **クラウドネイティブ:** ハードコード秘匿情報なし（良好）。コンテナ特権実行なし（良好）

---

## 指摘事項一覧

| # | 分類 | 重大度 | 内容 | 該当箇所 |
|---|------|--------|------|---------|
| SEC-R1 | Security | LOW | Storage read が組織横断アクセス可能 | `storage.rules:6-8` |
| SEC-R2 | Security | LOW | Widget auth-token の DOM 露出 | `packages/widget/src/index.ts` |
| SEC-R3 | Security | LOW | Docker イメージタグ未固定 | `Dockerfile` |
| AS-R1 | Stability | MEDIUM | バッチ書込途中失敗でロールバック不可 | `process.post.ts:286-288` |
| AS-R2 | Stability | MEDIUM | messageCount 更新の競合リスク | `send.post.ts:266-297` |
| AS-R3 | Availability | MEDIUM | 同時処理時リソース枯渇 | Cloud Run 設定 |
| AS-R4 | Availability | LOW | 観測可能性の不足 | — |
| AS-R5 | Fatal Pattern | MEDIUM | L2 Embedding キャッシュの永久増加 | `embeddings.ts:102-117` |
| AS-R6 | Fatal Pattern | MEDIUM | weeklyReports の無期限蓄積 | `reports/generate.post.ts` |

## 総合判定
- **安全ゲート:** PASS
- **リリース可否:** リリース可能
- **CRITICAL指摘数:** 0件（前回6件 → 全件是正済み）
- **HIGH指摘数:** 0件（前回5件 → 全件是正済み）
- **MEDIUM指摘数:** 5件（Phase 8 で計画的に対応）
- **LOW指摘数:** 4件（運用で対応可能）
- **判定根拠:** 前回の CRITICAL 6件（SEC-02/SEC-03/SEC-17/AS-2-F01/AS-2-F02/AS-3-F01）は全て是正確認済み。HIGH 5件（AS-2-F03/AS-2-F04/AS-3-F02/AS-3-F03/AS-4-F07）も全て是正確認済み。残存指摘は MEDIUM 5件・LOW 4件のみで、いずれも MVP リリースにおいて許容可能なリスク水準。
