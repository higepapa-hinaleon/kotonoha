# API設計書

> **Phase 5 成果物** — 実装コードに基づくAPI設計ドキュメント

## 概要

本システムはNuxt 3のサーバールート（`server/api/`）で実装されたRESTful APIを提供する。全35エンドポイントで構成され、認証にはFirebase ID Tokenを使用する。

---

## 認証方式

### Bearer Token認証

- **方式:** `Authorization: Bearer <Firebase ID Token>`
- **検証:** サーバーミドルウェア（`server/middleware/auth.ts`）がFirebase Admin SDKでトークンを検証
- **認証レベル:**
  - **Required** — 有効なFirebase ID Tokenが必須。未認証リクエストは `401 Unauthorized` を返却
  - **Admin** — Required に加え、`users`コレクションの`role`フィールドが`admin`であることを検証。非管理者は `403 Forbidden` を返却
  - **Optional** — トークンがあれば検証するが、未認証でもアクセス可能（ウィジェット等のゲスト利用向け）

### 公開パス（認証不要）

以下のパスはミドルウェアで認証チェックをスキップする:

- `/api/auth/register`
- `/api/services`
- `/api/settings/form-url`
- `/api/chat/send`

---

## CORS設定

CORSミドルウェア（`server/middleware/0.cors.ts`）が以下の公開パスに対してCORSヘッダーを付与する。

**対象パス:**
- `/embed/*`
- `/api/chat/send`
- `/api/services`
- `/api/settings/form-url`

**ヘッダー:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

OPTIONSプリフライトリクエストには `204 No Content` を返却する。

---

## エラーレスポンス

全APIで統一されたエラーレスポンス形式を使用する。

```json
{
  "statusCode": 400,
  "statusMessage": "エラーメッセージ"
}
```

| ステータスコード | 意味 |
|----------------|------|
| 400 | リクエスト不正（必須パラメータ欠如等） |
| 401 | 認証が必要 |
| 403 | アクセス権がない |
| 404 | リソースが見つからない |
| 500 | サーバー内部エラー |

---

## API一覧

### 認証 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| POST | `/api/auth/register` | ユーザー登録（初回ログイン時自動） | Required |
| GET | `/api/auth/me` | ログインユーザー情報取得 | Required |

### サービス API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/services` | サービス一覧取得（`?groupId=xxx` で未認証フィルタ） | Optional |
| POST | `/api/services` | サービス作成 | Admin |
| PUT | `/api/services/:id` | サービス更新 | Admin |
| DELETE | `/api/services/:id` | サービス削除 | Admin |

### ドキュメント API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/documents` | ドキュメント一覧取得 | Required |
| POST | `/api/documents/upload` | ドキュメントアップロード（multipart） | Admin |
| POST | `/api/documents/:id/process` | ドキュメント処理（チャンク化・埋め込み生成） | Admin |
| PUT | `/api/documents/:id/update` | ドキュメント更新（新バージョンアップロード） | Admin |
| DELETE | `/api/documents/:id` | ドキュメント削除 | Admin |
| GET | `/api/documents/:id/chunks` | チャンク一覧取得 | Required |
| GET | `/api/documents/:id/versions` | バージョン履歴取得 | Required |
| POST | `/api/documents/:id/rollback` | 指定バージョンへロールバック | Admin |

### チャット API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| POST | `/api/chat/send` | メッセージ送信・AI回答取得 | Optional |

### 会話 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/conversations` | 自分の会話一覧 | Required |
| GET | `/api/conversations/:id` | 会話詳細（メッセージ含む） | Required |
| GET | `/api/conversations/admin` | 管理者用会話一覧（全組織） | Admin |

### 改善リクエスト API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/improvements` | 改善リクエスト一覧 | Admin |
| POST | `/api/improvements` | 改善リクエスト作成 | Admin |
| PUT | `/api/improvements/:id` | ステータス・回答更新 | Admin |
| POST | `/api/improvements/categorize` | AIカテゴリ自動分類 | Admin |

### FAQ API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/faqs` | FAQ一覧取得 | Admin |
| POST | `/api/faqs` | FAQ作成（埋め込みベクトル生成含む） | Admin |
| PUT | `/api/faqs/:id` | FAQ更新 | Admin |
| DELETE | `/api/faqs/:id` | FAQ削除 | Admin |
| POST | `/api/faqs/generate` | FAQ自動生成（AI） | Admin |

### レポート API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/reports` | レポート一覧取得 | Admin |
| GET | `/api/reports/:id` | レポート詳細取得 | Admin |
| POST | `/api/reports/generate` | レポート生成（AI） | Admin |

### ダッシュボード API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/dashboard/summary` | ダッシュボードサマリー取得 | Admin |

### 設定 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/settings` | 設定取得 | Admin |
| PUT | `/api/settings` | 設定更新 | Admin |
| GET | `/api/settings/form-url` | フォームURL取得（公開） | Optional |

### 診断 API

| Method | Path | 概要 | 認証 |
|--------|------|------|------|
| GET | `/api/admin/rag-diagnostics` | RAG診断情報取得 | Admin |

---

## 主要エンドポイント詳細

### POST `/api/chat/send` — メッセージ送信・AI回答取得

ユーザーの質問をRAG（Retrieval-Augmented Generation）パイプラインで処理し、AI回答を返却する。ウィジェットからのゲスト利用に対応。

#### リクエスト

```json
{
  "serviceId": "string (必須)",
  "message": "string (必須)",
  "conversationId": "string (任意、既存会話への追加時)"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|----|----|------|
| serviceId | string | 必須 | 対象サービスID |
| message | string | 必須 | ユーザーの質問テキスト |
| conversationId | string | 任意 | 既存会話を継続する場合に指定。未指定時は新規会話を自動作成 |

#### レスポンス

```json
{
  "conversationId": "string",
  "message": {
    "content": "AIの回答テキスト",
    "sources": [
      {
        "documentId": "string",
        "documentTitle": "ドキュメント名",
        "chunkId": "string",
        "chunkContent": "参照チャンクの先頭200文字",
        "similarity": 0.85
      }
    ],
    "confidence": 0.78
  },
  "formUrl": "https://forms.google.com/..."
}
```

| フィールド | 型 | 説明 |
|-----------|----|----|
| conversationId | string | 会話ID（新規作成時は自動採番されたID） |
| message.content | string | AIが生成した回答テキスト |
| message.sources | MessageSource[] | 回答の根拠となったドキュメントチャンク一覧 |
| message.confidence | number | 回答の確信度（0.0〜1.0） |
| formUrl | string? | 確信度が閾値未満の場合のみ返却。Googleフォームへの問い合わせURL |

#### 処理フロー

1. サービス情報と組織設定を並列取得
2. 会話セッションの取得または新規作成
3. ユーザーメッセージをFirestoreに保存
4. 過去の会話履歴（直近10件）を取得
5. Embedding生成 → RAG検索 + フィードバック検索を並列実行
6. Gemini APIで回答を生成
7. アシスタントメッセージをFirestoreに保存
8. 確信度が閾値未満の場合、会話ステータスを`escalated`に変更し、改善リクエストを自動作成

---

### POST `/api/documents/upload` — ドキュメントアップロード

multipart/form-dataでドキュメントファイルをアップロードし、Cloud Storageに保存、Firestoreにメタデータを記録する。

#### リクエスト（multipart/form-data）

| フィールド | 型 | 必須 | 説明 |
|-----------|----|----|------|
| file | File | 必須 | アップロードファイル |
| serviceId | string | 必須 | 対象サービスID |
| title | string | 必須 | ドキュメントタイトル |
| type | string | 任意 | `"business"` または `"system"`。デフォルト: `"business"` |
| tags | string | 任意 | JSON配列文字列またはカンマ区切り文字列 |
| skipDuplicateCheck | string | 任意 | `"true"` で重複チェックをスキップ |

**対応ファイル形式:**
- `application/pdf` (PDF)
- `text/plain` (テキスト)
- `text/markdown` (Markdown)
- `text/html` (HTML)
- `text/csv` (CSV)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)

#### レスポンス（正常時）

```json
{
  "id": "string",
  "organizationId": "string",
  "serviceId": "string",
  "title": "string",
  "type": "business",
  "tags": ["tag1", "tag2"],
  "storagePath": "documents/org-id/timestamp_filename.pdf",
  "mimeType": "application/pdf",
  "fileSize": 12345,
  "fileHash": "sha256-hash",
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
  "fileHash": "sha256-hash"
}
```

---

### POST `/api/documents/:id/process` — ドキュメント処理

アップロード済みドキュメントをチャンク分割し、Contextual Retrievalのためのコンテキストプレフィックスを生成、ベクトル埋め込みを生成してFirestoreに保存する。

#### パスパラメータ

| パラメータ | 型 | 説明 |
|-----------|----|----|
| id | string | ドキュメントID |

#### クエリパラメータ

| パラメータ | 型 | 説明 |
|-----------|----|----|
| incremental | string | `"true"` でインクリメンタルモード（変更チャンクのみ再処理） |

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

1. Cloud Storageからファイルをダウンロード
2. テキスト抽出（PDF/DOCX/HTML/CSV/TXT対応）
3. 親子チャンク分割（親: 最大800トークン、子: 最大250トークン、オーバーラップ: 50トークン）
4. インクリメンタルモード時: コンテンツハッシュで変更分を特定
5. Contextual Retrieval: ドキュメント要約生成 → チャンクごとのコンテキストプレフィックス生成
6. ベクトル埋め込み生成（768次元、変更チャンクのみ）
7. Firestoreにバッチ書き込み（490オペレーション/バッチで分割）
8. ドキュメントステータスを`ready`に更新

---

### PUT `/api/documents/:id/update` — ドキュメント更新

既存ドキュメントに新しいファイルをアップロードし、バージョンを更新する。旧バージョンはサブコレクション`versions`にアーカイブされる。

#### リクエスト（multipart/form-data）

| フィールド | 型 | 必須 | 説明 |
|-----------|----|----|------|
| file | File | 必須 | 新しいファイル |
| title | string | 任意 | 新しいタイトル（未指定時は既存タイトルを維持） |
| tags | string | 任意 | JSON配列文字列またはカンマ区切り文字列 |

#### レスポンス

更新後のDocumentオブジェクトに `previousVersion` フィールドを追加したオブジェクトを返却する。

---

### POST `/api/documents/:id/rollback` — バージョンロールバック

指定バージョンのドキュメント情報を復元する。現在のバージョンはアーカイブに保存した上で、新しいバージョン番号を採番してロールバックする。

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

## ページネーション

一覧系APIはクエリパラメータでページネーションとフィルタリングをサポートする。

```
GET /api/conversations?page=1&limit=20&serviceId=xxx&status=active
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|---------|----|
| page | number | 1 | ページ番号 |
| limit | number | 20 | 1ページあたりの件数 |

会話一覧では追加のフィルタパラメータを使用できる:

| パラメータ | 型 | 説明 |
|-----------|----|----|
| serviceId | string | サービスIDでフィルタ |
| status | string | ステータスでフィルタ |
| startDate | string | 開始日（ISO 8601） |
| endDate | string | 終了日（ISO 8601） |
| keyword | string | キーワード検索 |
