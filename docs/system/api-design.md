# API設計書

> **文書ID:** API-001
> **対象システム:** Kotonoha — マルチテナント AI チャットボットプラットフォーム
> **作成日:** 2026-03-29
> **ステータス:** 正式版

---

## 1. 概要

本システムは Nuxt 3 のサーバールート（`server/api/`）で実装された RESTful API を提供する。全52エンドポイントで構成され、認証には Firebase ID Token を使用する。

### 1.1 ベース URL

```
https://{domain}/api/
```

### 1.2 共通ヘッダー

| ヘッダー | 値 | 説明 |
|---------|-----|------|
| Content-Type | application/json | リクエスト/レスポンスの MIME タイプ（multipart を除く） |
| Authorization | Bearer {Firebase ID Token} | 認証トークン |

---

## 2. 認証方式

### 2.1 Bearer Token 認証

- **方式:** `Authorization: Bearer <Firebase ID Token>`
- **検証:** サーバーミドルウェア（`server/middleware/auth.ts`）が Firebase Admin SDK でトークンを検証
- **コンテキスト注入:** 検証済みユーザー情報を `event.context.auth` に設定

### 2.2 認証レベル

| レベル | 説明 | 失敗時 |
|--------|------|--------|
| Required | 有効な Firebase ID Token が必須 | 401 Unauthorized |
| Admin | Required + `role` が `admin` または `system_admin` | 403 Forbidden |
| SystemAdmin | Required + `role` が `system_admin` | 403 Forbidden |
| Optional | トークンがあれば検証するが、未認証でもアクセス可能 | - |

### 2.3 公開パス（認証スキップ）

以下のパスはミドルウェアで認証チェックをスキップする:

- `POST /api/auth/register`
- `GET /api/services`
- `GET /api/settings/form-url`
- `POST /api/chat/send`
- `GET /api/health`

---

## 3. CORS 設定

CORS ミドルウェア（`server/middleware/0.cors.ts`）が以下の公開パスに対して CORS ヘッダーを付与する。

**対象パス:**
- `/embed/*`
- `/api/chat/send`
- `/api/services`
- `/api/settings/form-url`

**レスポンスヘッダー:**

| ヘッダー | 値 |
|---------|-----|
| Access-Control-Allow-Origin | * |
| Access-Control-Allow-Methods | GET, POST, OPTIONS |
| Access-Control-Allow-Headers | Content-Type, Authorization |
| Access-Control-Max-Age | 86400 |

OPTIONS プリフライトリクエストには `204 No Content` を返却する。

---

## 4. エラーレスポンス

### 4.1 共通エラー形式

```json
{
  "statusCode": 400,
  "statusMessage": "エラーメッセージ"
}
```

### 4.2 ステータスコード一覧

| コード | 意味 | 発生条件 |
|--------|------|---------|
| 400 | Bad Request | リクエストパラメータ不正、必須パラメータ欠如 |
| 401 | Unauthorized | 認証トークン未設定・無効・期限切れ |
| 403 | Forbidden | ロール不足、組織/グループ外データへのアクセス |
| 404 | Not Found | 対象リソースが存在しない |
| 409 | Conflict | 重複リソース（ドキュメントハッシュ重複等） |
| 429 | Too Many Requests | レート制限超過 |
| 500 | Internal Server Error | サーバー内部エラー |

---

## 5. ページネーション

一覧系 API は以下のクエリパラメータでページネーションをサポートする。

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| page | number | 1 | ページ番号 |
| limit | number | 20 | 1ページあたりの件数 |

**レスポンス形式:**

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

## 6. レート制限

| API 種別 | 上限 | ウィンドウ |
|----------|------|-----------|
| POST /api/chat/send | 10 リクエスト | 60 秒 |
| その他全 API | 60 リクエスト | 60 秒 |

超過時は `429 Too Many Requests` を返却する。

---

## 7. API エンドポイント一覧

### 7.1 ヘルスチェック API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/health` | システム稼働状態確認 | 不要 |

### 7.2 認証 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| POST | `/api/auth/register` | ユーザー登録（初回ログイン時自動） | Required |
| GET | `/api/auth/me` | ログインユーザー情報取得 | Required |

### 7.3 グループ API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/groups` | グループ一覧取得 | Required |
| POST | `/api/groups` | グループ作成 | Admin |
| PUT | `/api/groups/:id` | グループ更新 | Admin |
| DELETE | `/api/groups/:id` | グループ削除 | Admin |
| GET | `/api/groups/:id/members` | グループメンバー一覧取得 | Required |
| POST | `/api/groups/:id/members` | グループメンバー追加 | Admin |
| PUT | `/api/groups/:id/members/:userId` | メンバーロール変更 | Admin |
| DELETE | `/api/groups/:id/members/:userId` | メンバー削除 | Admin |
| POST | `/api/groups/switch` | アクティブグループ切替 | Required |

### 7.4 サービス API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/services` | サービス一覧取得 | Optional |
| POST | `/api/services` | サービス作成 | Admin |
| PUT | `/api/services/:id` | サービス更新 | Admin |
| DELETE | `/api/services/:id` | サービス削除 | Admin |

### 7.5 ドキュメント API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/documents` | ドキュメント一覧取得 | Required |
| POST | `/api/documents/upload` | ドキュメントアップロード (multipart) | Admin |
| POST | `/api/documents/:id/process` | ドキュメント処理（チャンク化・埋め込み生成） | Admin |
| PUT | `/api/documents/:id/update` | ドキュメント更新（バージョンアップ） | Admin |
| DELETE | `/api/documents/:id` | ドキュメント削除 | Admin |
| GET | `/api/documents/:id/chunks` | チャンク一覧取得 | Required |
| GET | `/api/documents/:id/versions` | バージョン履歴取得 | Required |
| POST | `/api/documents/:id/rollback` | 指定バージョンへロールバック | Admin |

### 7.6 チャット API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| POST | `/api/chat/send` | メッセージ送信・AI 回答取得 | Optional |
| POST | `/api/chat/learn` | チャットからの学習データ登録 | Admin |

### 7.7 会話 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/conversations` | 自分の会話一覧 | Required |
| GET | `/api/conversations/:id` | 会話詳細（メッセージ含む） | Required |
| GET | `/api/conversations/admin` | 管理者用会話一覧（全組織） | Admin |

### 7.8 改善リクエスト API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/improvements` | 改善リクエスト一覧 | Admin |
| POST | `/api/improvements` | 改善リクエスト作成 | Admin |
| PUT | `/api/improvements/:id` | ステータス・回答更新 | Admin |
| POST | `/api/improvements/categorize` | AI カテゴリ自動分類 | Admin |

### 7.9 FAQ API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/faqs` | FAQ 一覧取得 | Admin |
| POST | `/api/faqs` | FAQ 作成（埋め込みベクトル生成含む） | Admin |
| PUT | `/api/faqs/:id` | FAQ 更新 | Admin |
| DELETE | `/api/faqs/:id` | FAQ 削除 | Admin |
| POST | `/api/faqs/generate` | FAQ 自動生成（AI） | Admin |

### 7.10 レポート API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/reports` | レポート一覧取得 | Admin |
| GET | `/api/reports/:id` | レポート詳細取得 | Admin |
| POST | `/api/reports/generate` | レポート生成（AI） | Admin |

### 7.11 ダッシュボード API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/dashboard/summary` | ダッシュボードサマリー取得 | Admin |
| GET | `/api/dashboard/service-summary` | サービス別ダッシュボード取得 | Admin |

### 7.12 設定 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/settings` | 設定取得 | Admin |
| PUT | `/api/settings` | 設定更新 | Admin |
| GET | `/api/settings/form-url` | フォーム URL 取得（公開） | Optional |

### 7.13 診断 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/admin/rag-diagnostics` | RAG 診断情報取得 | Admin |

### 7.14 システム管理 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/system/users` | ユーザー一覧取得 | SystemAdmin |
| PUT | `/api/system/users/:id/role` | ユーザーロール変更 | SystemAdmin |
| GET | `/api/system/invitations` | 招待一覧取得 | Admin |
| POST | `/api/system/invitations` | 招待作成 | Admin |
| DELETE | `/api/system/invitations/:id` | 招待削除 | Admin |

---

## 8. 主要エンドポイント詳細

### 8.1 POST `/api/auth/register` — ユーザー登録

初回ログイン時に呼び出され、ユーザーレコード・組織・グループを自動作成する。招待が存在する場合は既存組織・グループに参加する。

#### リクエスト

ボディ不要。Authorization ヘッダーの Firebase ID Token からユーザー情報を取得。

#### レスポンス

```json
{
  "id": "firebase-uid",
  "organizationId": "org-id",
  "email": "user@example.com",
  "displayName": "User Name",
  "role": "admin",
  "activeGroupId": "group-id",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

#### 処理フロー

1. Firebase ID Token からユーザー情報を取得
2. 既存ユーザーチェック（存在すれば既存情報を返却）
3. 招待チェック（メールアドレスで pending 招待を検索）
4. 招待あり: 既存組織・グループに参加、招待ステータスを accepted に更新
5. 招待なし: 新規組織・デフォルトグループ・設定を自動作成、admin ロールで登録

---

### 8.2 POST `/api/chat/send` — メッセージ送信・AI 回答取得

RAG パイプラインでユーザーの質問を処理し、AI 回答を返却する。

#### リクエスト

```json
{
  "serviceId": "string (必須)",
  "message": "string (必須、最大10,000文字)",
  "conversationId": "string (任意)"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| serviceId | string | ○ | 対象サービス ID |
| message | string | ○ | ユーザーの質問テキスト |
| conversationId | string | × | 既存会話を継続する場合に指定 |

#### レスポンス

```json
{
  "conversationId": "conv-id",
  "message": {
    "content": "AIの回答テキスト（Markdown形式）",
    "sources": [
      {
        "documentId": "doc-id",
        "documentTitle": "ドキュメント名",
        "chunkId": "chunk-id",
        "chunkContent": "参照チャンクの先頭200文字...",
        "similarity": 0.85
      }
    ],
    "confidence": 0.78
  },
  "formUrl": "https://forms.google.com/..."
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| conversationId | string | 会話 ID |
| message.content | string | AI 生成回答テキスト |
| message.sources | MessageSource[] | 参照元チャンク一覧 |
| message.confidence | number | 信頼度スコア (0.0〜1.0) |
| formUrl | string? | 信頼度が閾値未満の場合のみ返却 |

#### 処理フロー

1. レート制限チェック（10 req/min）
2. サービス情報・組織設定を並列取得
3. エスカレーションキーワード検出
4. 会話セッションの取得または新規作成
5. ユーザーメッセージを Firestore に保存
6. 過去の会話履歴（直近10件）を取得
7. クエリ埋め込み生成 → documentChunks + feedbackChunks のベクトル検索を並列実行
8. コンテキスト構築（検索結果統合）
9. Gemini API で回答生成（システムプロンプト + コンテキスト + 会話履歴）
10. [CONFIDENCE:X.XX] パターンから信頼度を抽出
11. アシスタントメッセージを Firestore に保存
12. 信頼度が閾値未満の場合: 改善リクエスト自動作成 + 会話ステータスを escalated に変更
13. referenceCount を非同期更新（失敗しても主処理をブロックしない）

---

### 8.3 POST `/api/documents/upload` — ドキュメントアップロード

multipart/form-data でドキュメントファイルをアップロードする。

#### リクエスト (multipart/form-data)

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| file | File | ○ | アップロードファイル（最大 10MB） |
| serviceId | string | ○ | 対象サービス ID |
| title | string | ○ | ドキュメントタイトル |
| type | string | × | "business" or "system"（デフォルト: "business"） |
| tags | string | × | JSON 配列文字列またはカンマ区切り |
| skipDuplicateCheck | string | × | "true" で重複チェックスキップ |

**対応ファイル形式:**

| MIME タイプ | 拡張子 |
|-----------|--------|
| application/pdf | .pdf |
| application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx |
| text/plain | .txt |
| text/markdown | .md |
| text/csv | .csv |
| text/html | .html |
| application/json | .json |

#### レスポンス（正常時）

```json
{
  "id": "doc-id",
  "organizationId": "org-id",
  "groupId": "group-id",
  "serviceId": "service-id",
  "title": "ドキュメントタイトル",
  "type": "business",
  "tags": ["tag1", "tag2"],
  "storagePath": "documents/org-id/timestamp_filename.pdf",
  "mimeType": "application/pdf",
  "fileSize": 12345,
  "fileHash": "sha256-hash-value",
  "chunkCount": 0,
  "version": 1,
  "status": "uploading",
  "uploadedBy": "user-id",
  "referenceCount": 0,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

#### レスポンス（重複検出時）

```json
{
  "duplicate": true,
  "existingDocument": {
    "id": "existing-doc-id",
    "title": "既存ドキュメント名",
    "serviceId": "service-id",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  "fileHash": "sha256-hash-value"
}
```

---

### 8.4 POST `/api/documents/:id/process` — ドキュメント処理

アップロード済みドキュメントをチャンク分割し、Contextual Retrieval のためのコンテキストプレフィックス生成、ベクトル埋め込み生成を行う。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| id | string | ドキュメント ID |

#### クエリパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| incremental | string | "true" で変更チャンクのみ再処理 |

#### レスポンス

```json
{
  "success": true,
  "chunkCount": 42,
  "changedChunks": 5,
  "unchangedChunks": 37,
  "documentId": "doc-id"
}
```

#### 処理フロー

1. Cloud Storage からファイルダウンロード
2. テキスト抽出（PDF / DOCX / HTML / CSV / TXT 対応）
3. 親子チャンク分割（親: 最大 800 トークン、子: 最大 250 トークン、オーバーラップ: 50 トークン）
4. インクリメンタルモード時: コンテンツハッシュで変更分を特定
5. ドキュメント要約生成（Gemini）
6. コンテキストプレフィックス生成（15 チャンク/バッチ、200 チャンク超は共通プレフィックス）
7. ベクトル埋め込み生成（768 次元、変更チャンクのみ）
8. Firestore バッチ書き込み（490 オペレーション/バッチ）
9. ドキュメントステータスを `ready` に更新

---

### 8.5 PUT `/api/documents/:id/update` — ドキュメント更新

既存ドキュメントに新しいファイルをアップロードし、バージョンを更新する。

#### リクエスト (multipart/form-data)

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| file | File | ○ | 新しいファイル |
| title | string | × | 新しいタイトル |
| tags | string | × | JSON 配列文字列またはカンマ区切り |

#### レスポンス

更新後の Document オブジェクト + `previousVersion` フィールド。旧バージョンは `documents/:id/versions` サブコレクションにアーカイブ。

---

### 8.6 POST `/api/documents/:id/rollback` — バージョンロールバック

#### リクエスト

```json
{
  "version": 1
}
```

#### レスポンス

```json
{
  "success": true,
  "documentId": "doc-id",
  "restoredFromVersion": 1,
  "newVersion": 3
}
```

---

### 8.7 GET `/api/dashboard/summary` — ダッシュボードサマリー

#### レスポンス

```json
{
  "totalConversations": 150,
  "resolutionRate": 0.72,
  "improvementRequestCount": 23,
  "conversationTrend": [
    { "date": "2026-03-23", "count": 18 },
    { "date": "2026-03-24", "count": 22 }
  ],
  "serviceDistribution": [
    {
      "serviceId": "svc-1",
      "serviceName": "サービスA",
      "count": 80,
      "resolutionRate": 0.75
    }
  ],
  "recentUnresolved": [
    { "id": "conv-1", "title": "質問タイトル", "createdAt": "..." }
  ],
  "topReferencedDocs": [
    { "id": "doc-1", "title": "ドキュメント名", "referenceCount": 45, "serviceId": "svc-1" }
  ],
  "unreferencedDocCount": 3,
  "unreferencedDocs": [
    { "id": "doc-2", "title": "未参照ドキュメント", "serviceId": "svc-1" }
  ]
}
```

---

### 8.8 PUT `/api/improvements/:id` — 改善リクエスト更新

#### リクエスト

```json
{
  "category": "missing_docs",
  "priority": "high",
  "status": "resolved",
  "adminNote": "管理者メモ",
  "correctedAnswer": "正しい回答テキスト"
}
```

全フィールド任意。`correctedAnswer` が指定され `status` が `resolved` の場合、フィードバックチャンクを自動生成（ベクトル埋め込み生成 + feedbackChunks 保存）。

---

### 8.9 POST `/api/faqs/generate` — FAQ 自動生成

会話データから AI が FAQ 候補を自動生成する。

#### リクエスト

```json
{
  "serviceId": "string (必須)"
}
```

#### レスポンス

```json
{
  "faqs": [
    {
      "id": "faq-id",
      "question": "自動生成された質問",
      "answer": "自動生成された回答",
      "frequency": 5,
      "isPublished": false,
      "generatedFrom": "auto"
    }
  ]
}
```

---

### 8.10 POST `/api/reports/generate` — レポート生成

#### リクエスト

```json
{
  "serviceId": "string (任意)"
}
```

#### レスポンス

生成された WeeklyReport オブジェクト。stats（統計データ）、insights（AI インサイト）、recommendations（改善推奨事項）を含む。

---

### 8.11 POST `/api/groups/switch` — アクティブグループ切替

#### リクエスト

```json
{
  "groupId": "string (必須)"
}
```

#### レスポンス

更新後の User オブジェクト（activeGroupId が変更済み）。

---

### 8.12 POST `/api/system/invitations` — 招待作成

#### リクエスト

```json
{
  "email": "user@example.com",
  "groupId": "group-id",
  "role": "member"
}
```

#### レスポンス

作成された Invitation オブジェクト。

---

### 8.13 GET `/api/conversations/admin` — 管理者用会話一覧

#### クエリパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| page | number | ページ番号 |
| limit | number | 1ページあたり件数 |
| serviceId | string | サービス ID フィルタ |
| status | string | ステータスフィルタ |
| startDate | string | 開始日 (ISO 8601) |
| endDate | string | 終了日 (ISO 8601) |
| keyword | string | キーワード検索 |

#### レスポンス

```json
{
  "items": [
    {
      "id": "conv-id",
      "organizationId": "org-id",
      "groupId": "group-id",
      "userId": "user-id",
      "serviceId": "svc-id",
      "title": "会話タイトル",
      "status": "active",
      "messageCount": 5,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

---

### 8.14 PUT `/api/settings` — 設定更新

#### リクエスト

```json
{
  "googleFormUrl": "https://forms.google.com/...",
  "botConfig": {
    "confidenceThreshold": 0.6,
    "ragTopK": 5,
    "ragSimilarityThreshold": 0.4,
    "enableMultiQuery": false,
    "enableHyde": false,
    "systemPrompt": "カスタムプロンプト"
  }
}
```

全フィールド任意。`botConfig` は Partial で部分更新可能。

---

### 8.15 GET `/api/settings/form-url` — フォーム URL 取得

公開 API。ウィジェットからフォーム URL を取得する。

#### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| serviceId | string | ○ | サービス ID |

#### レスポンス

```json
{
  "formUrl": "https://forms.google.com/..."
}
```

サービス固有のフォーム URL が設定されていない場合は、組織のグローバルフォーム URL を返却。

---

## 9. API エンドポイントとファイルの対応

| エンドポイント | 実装ファイル |
|--------------|------------|
| GET /api/health | server/api/health.get.ts |
| POST /api/auth/register | server/api/auth/register.post.ts |
| GET /api/auth/me | server/api/auth/me.get.ts |
| GET /api/groups | server/api/groups/index.get.ts |
| POST /api/groups | server/api/groups/index.post.ts |
| PUT /api/groups/:id | server/api/groups/[id].put.ts |
| DELETE /api/groups/:id | server/api/groups/[id].delete.ts |
| GET /api/groups/:id/members | server/api/groups/[id]/members.get.ts |
| POST /api/groups/:id/members | server/api/groups/[id]/members.post.ts |
| PUT /api/groups/:id/members/:userId | server/api/groups/[id]/members/[userId].put.ts |
| DELETE /api/groups/:id/members/:userId | server/api/groups/[id]/members/[userId].delete.ts |
| POST /api/groups/switch | server/api/groups/switch.post.ts |
| GET /api/services | server/api/services/index.get.ts |
| POST /api/services | server/api/services/index.post.ts |
| PUT /api/services/:id | server/api/services/[id].put.ts |
| DELETE /api/services/:id | server/api/services/[id].delete.ts |
| GET /api/documents | server/api/documents/index.get.ts |
| POST /api/documents/upload | server/api/documents/upload.post.ts |
| POST /api/documents/:id/process | server/api/documents/[id]/process.post.ts |
| PUT /api/documents/:id/update | server/api/documents/[id]/update.put.ts |
| DELETE /api/documents/:id | server/api/documents/[id].delete.ts |
| GET /api/documents/:id/chunks | server/api/documents/[id]/chunks.get.ts |
| GET /api/documents/:id/versions | server/api/documents/[id]/versions.get.ts |
| POST /api/documents/:id/rollback | server/api/documents/[id]/rollback.post.ts |
| POST /api/chat/send | server/api/chat/send.post.ts |
| POST /api/chat/learn | server/api/chat/learn.post.ts |
| GET /api/conversations | server/api/conversations/index.get.ts |
| GET /api/conversations/:id | server/api/conversations/[id].get.ts |
| GET /api/conversations/admin | server/api/conversations/admin.get.ts |
| GET /api/improvements | server/api/improvements/index.get.ts |
| POST /api/improvements | server/api/improvements/index.post.ts |
| PUT /api/improvements/:id | server/api/improvements/[id].put.ts |
| POST /api/improvements/categorize | server/api/improvements/categorize.post.ts |
| GET /api/faqs | server/api/faqs/index.get.ts |
| POST /api/faqs | server/api/faqs/index.post.ts |
| PUT /api/faqs/:id | server/api/faqs/[id].put.ts |
| DELETE /api/faqs/:id | server/api/faqs/[id].delete.ts |
| POST /api/faqs/generate | server/api/faqs/generate.post.ts |
| GET /api/reports | server/api/reports/index.get.ts |
| GET /api/reports/:id | server/api/reports/[id].get.ts |
| POST /api/reports/generate | server/api/reports/generate.post.ts |
| GET /api/dashboard/summary | server/api/dashboard/summary.get.ts |
| GET /api/dashboard/service-summary | server/api/dashboard/service-summary.get.ts |
| GET /api/settings | server/api/settings/index.get.ts |
| PUT /api/settings | server/api/settings/index.put.ts |
| GET /api/settings/form-url | server/api/settings/form-url.get.ts |
| GET /api/admin/rag-diagnostics | server/api/admin/rag-diagnostics.get.ts |
| GET /api/system/users | server/api/system/users.get.ts |
| PUT /api/system/users/:id/role | server/api/system/users/[id]/role.put.ts |
| GET /api/system/invitations | server/api/system/invitations.get.ts |
| POST /api/system/invitations | server/api/system/invitations.post.ts |
| DELETE /api/system/invitations/:id | server/api/system/invitations/[id].delete.ts |
