# 基本設計書

> **文書ID:** BD-001
> **対象システム:** Kotonoha — マルチテナント AI チャットボットプラットフォーム
> **作成日:** 2026-03-29
> **ステータス:** 正式版

---

## 1. システム概要

### 1.1 システムの位置づけ

Kotonoha は、組織のナレッジベースを AI チャットボットとして提供するマルチテナント SaaS プラットフォームである。Nuxt 3 フルスタックアプリケーションとして構築し、Google Cloud Platform 上で稼働する。

### 1.2 設計方針

| 方針                   | 説明                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| フルスタック Nuxt 3    | フロントエンド（SPA）とバックエンド（Nitro Server）を単一プロジェクトで管理 |
| サーバーレスファースト | Cloud Run による自動スケーリング。インフラ管理を最小化                      |
| マルチテナント分離     | organizationId + groupId による論理分離                                     |
| AI ネイティブ          | RAG パイプライン、フィードバック学習ループを中核に設計                      |
| 段階的スケーリング     | 初期は Firestore Vector Search、大規模化時に Vertex AI Vector Search へ移行 |

---

## 2. システムアーキテクチャ

### 2.1 全体構成図

```mermaid
graph TB
    subgraph Client["クライアント層"]
        Browser["ブラウザ (Nuxt 3 SPA)"]
        Widget["Web Component ウィジェット"]
        FirebaseSDK["Firebase Auth SDK"]
    end

    subgraph Edge["エッジ層"]
        FirebaseHosting["Firebase Hosting<br/>(CDN + リバースプロキシ)"]
    end

    subgraph Compute["コンピューティング層"]
        CloudRun["Cloud Run<br/>(Nitro Server)"]
        subgraph AppLayer["アプリケーション"]
            APIRoutes["API Routes (/api/*)"]
            AuthMiddleware["認証ミドルウェア"]
            CORSMiddleware["CORS ミドルウェア"]
            RateLimiter["レート制限"]
        end
    end

    subgraph Data["データ層"]
        Firestore["Cloud Firestore<br/>(ドキュメント DB + ベクトル検索)"]
        CloudStorage["Cloud Storage<br/>(ファイル原本)"]
    end

    subgraph AI["AI サービス層"]
        Gemini["Vertex AI Gemini 2.0 Flash<br/>(回答生成・分類・要約)"]
        EmbeddingAPI["Vertex AI Embedding API<br/>(768次元ベクトル生成)"]
    end

    subgraph Auth["認証基盤"]
        FirebaseAuth["Firebase Authentication"]
    end

    Browser -->|HTTPS| FirebaseHosting
    Widget -->|HTTPS| FirebaseHosting
    FirebaseHosting -->|プロキシ| CloudRun
    Browser --> FirebaseSDK
    FirebaseSDK --> FirebaseAuth
    CloudRun --> Firestore
    CloudRun --> CloudStorage
    CloudRun --> Gemini
    CloudRun --> EmbeddingAPI
    FirebaseAuth -.->|トークン検証| CloudRun
```

### 2.2 コンポーネントアーキテクチャ

```mermaid
graph LR
    subgraph Frontend["フロントエンド (Nuxt 3 SPA)"]
        Pages["pages/"]
        Components["components/"]
        Composables["composables/"]
        Plugins["plugins/<br/>(.client.ts)"]
        Middleware["middleware/"]
        Layouts["layouts/"]
    end

    subgraph Backend["バックエンド (Nitro Server)"]
        ServerAPI["server/api/"]
        ServerMiddleware["server/middleware/"]
        ServerUtils["server/utils/"]
        ServerServices["server/services/"]
    end

    subgraph Shared["共有層"]
        SharedTypes["shared/types/"]
        SharedModels["models.ts"]
        SharedAPITypes["api.ts"]
    end

    Pages --> Components
    Pages --> Composables
    Plugins --> FirebaseInit["Firebase 初期化"]
    Middleware --> AuthCheck["認証・認可チェック"]
    Pages -->|useFetch / $fetch| ServerAPI
    ServerAPI --> ServerMiddleware
    ServerAPI --> ServerServices
    ServerServices --> ServerUtils
    Frontend --> SharedTypes
    Backend --> SharedTypes
```

---

## 3. 技術スタック

### 3.1 技術選定一覧

| カテゴリ           | 技術                       | バージョン | 選定理由                                              |
| ------------------ | -------------------------- | ---------- | ----------------------------------------------------- |
| フレームワーク     | Nuxt 3                     | 3.x        | フルスタック構成、Nitro サーバー内蔵、TypeScript 標準 |
| UI                 | Vue 3                      | 3.x        | Nuxt 3 標準、Composition API によるリアクティブ設計   |
| 言語               | TypeScript                 | 5.x        | 型安全性、フロント・バック共通の型定義                |
| ランタイム         | Node.js                    | 20.x       | Cloud Run 対応、Nitro ランタイム                      |
| 認証               | Firebase Authentication    | -          | マルチプロバイダ対応、ID Token ベース                 |
| データベース       | Cloud Firestore            | -          | スキーマレス、ベクトル検索内蔵、セキュリティルール    |
| ストレージ         | Cloud Storage              | -          | ドキュメント原本の安全な保管                          |
| 生成 AI            | Vertex AI Gemini 2.0 Flash | -          | 高速・低コスト、日本語対応、構造化出力                |
| 埋め込み           | Vertex AI Embedding API    | -          | 768 次元、日本語対応                                  |
| ホスティング       | Cloud Run                  | -          | コンテナベース、自動スケーリング                      |
| CDN                | Firebase Hosting           | -          | CDN + リバースプロキシ                                |
| CI/CD              | Cloud Build                | -          | GCP ネイティブ、Docker ビルド                         |
| コンテナレジストリ | Artifact Registry          | -          | GCP ネイティブ                                        |

### 3.2 主要ライブラリ

| ライブラリ                | 用途                                  |
| ------------------------- | ------------------------------------- |
| firebase / firebase-admin | クライアント SDK / サーバー Admin SDK |
| @google-cloud/vertexai    | Gemini API クライアント               |
| @google-cloud/storage     | Cloud Storage 操作                    |
| pdf-parse                 | PDF テキスト抽出                      |
| mammoth                   | DOCX テキスト抽出                     |
| marked                    | Markdown レンダリング                 |

---

## 4. コンポーネント設計

### 4.1 フロントエンド構成

#### レイアウト

| レイアウト | 説明                                   | 適用画面                     |
| ---------- | -------------------------------------- | ---------------------------- |
| default    | ヘッダー + コンテンツ領域              | ログイン、チャット、会話履歴 |
| admin      | ヘッダー + サイドバー + コンテンツ領域 | 全管理者画面                 |

#### 主要コンポーザブル

| コンポーザブル | 責務                                                     |
| -------------- | -------------------------------------------------------- |
| useAuth        | Firebase Authentication の初期化・状態管理・トークン取得 |
| useChat        | チャット送受信・会話管理                                 |
| useServices    | サービス一覧取得・選択状態管理                           |
| useToast       | 通知トースト表示                                         |

#### プラグイン

| プラグイン         | 実行環境         | 責務                |
| ------------------ | ---------------- | ------------------- |
| firebase.client.ts | クライアントのみ | Firebase SDK 初期化 |

#### ミドルウェア

| ミドルウェア | 責務                                     |
| ------------ | ---------------------------------------- |
| auth         | 認証状態チェック、未認証時のリダイレクト |
| admin        | admin ロール検証、非管理者のリダイレクト |

### 4.2 バックエンド構成

#### サーバーミドルウェア

| ミドルウェア | ファイル  | 責務                                              |
| ------------ | --------- | ------------------------------------------------- |
| CORS         | 0.cors.ts | 公開パスへの CORS ヘッダー付与                    |
| 認証         | auth.ts   | Bearer Token 検証、ユーザー情報のコンテキスト注入 |

#### サービス層

| サービス                    | 責務                                                       |
| --------------------------- | ---------------------------------------------------------- |
| RAG Service                 | ベクトル検索、コンテキスト構築、回答生成                   |
| Embedding Service           | テキストの埋め込みベクトル生成、キャッシュ管理             |
| Document Processing Service | テキスト抽出、チャンク分割、コンテキストプレフィックス生成 |
| Report Service              | 統計集計、AI インサイト生成                                |

#### ユーティリティ

| ユーティリティ | 責務                             |
| -------------- | -------------------------------- |
| constants.ts   | 全定数の一元管理（SoT）          |
| firebase.ts    | Firebase Admin SDK 初期化        |
| firestore.ts   | Firestore クライアント初期化     |
| storage.ts     | Cloud Storage クライアント初期化 |

---

## 5. 外部インターフェース

### 5.1 外部システム連携

```mermaid
graph LR
    subgraph Kotonoha["Kotonoha"]
        API["API Server"]
    end

    subgraph Google["Google Cloud"]
        FBAuth["Firebase Auth"]
        VertexAI["Vertex AI"]
        GCS["Cloud Storage"]
        FS["Firestore"]
    end

    subgraph External["外部連携"]
        GoogleForm["Google Forms"]
        EmbedSite["埋め込みサイト"]
    end

    API -->|認証検証| FBAuth
    API -->|生成AI / 埋め込み| VertexAI
    API -->|ファイル保管| GCS
    API -->|データ永続化| FS
    API -.->|フォーム誘導 URL| GoogleForm
    EmbedSite -->|Web Component| API
```

### 5.2 インターフェース一覧

| 連携先                  | プロトコル        | 方向   | 用途                                             |
| ----------------------- | ----------------- | ------ | ------------------------------------------------ |
| Firebase Authentication | HTTPS / gRPC      | 双方向 | 認証・トークン検証                               |
| Vertex AI Gemini        | HTTPS             | 送信   | 回答生成、FAQ 生成、レポート生成、カテゴリ分類   |
| Vertex AI Embedding     | HTTPS             | 送信   | ベクトル埋め込み生成                             |
| Cloud Storage           | HTTPS             | 双方向 | ドキュメントファイルのアップロード・ダウンロード |
| Cloud Firestore         | gRPC              | 双方向 | データ永続化・ベクトル検索                       |
| Google Forms            | HTTP リダイレクト | 誘導   | エスカレーション時のフォーム誘導                 |

---

## 6. デプロイメントアーキテクチャ

### 6.1 デプロイメントパイプライン

```mermaid
graph LR
    subgraph Dev["開発"]
        Developer["開発者"]
        GitHub["GitHub"]
    end

    subgraph CICD["CI/CD"]
        CloudBuild["Cloud Build"]
        ArtifactReg["Artifact Registry"]
    end

    subgraph Prod["本番環境 (asia-northeast1)"]
        FBHosting["Firebase Hosting<br/>(CDN)"]
        CR["Cloud Run<br/>(Nitro Server)"]
    end

    Developer -->|git push| GitHub
    GitHub -->|トリガー| CloudBuild
    CloudBuild -->|Docker イメージ| ArtifactReg
    ArtifactReg -->|デプロイ| CR
    CloudBuild -->|デプロイ| FBHosting
    FBHosting -->|リバースプロキシ| CR
```

### 6.2 インフラ構成

```mermaid
graph TB
    subgraph Internet["インターネット"]
        Browser["ブラウザ / ウィジェット"]
    end

    subgraph GCP["Google Cloud Platform (asia-northeast1)"]
        subgraph Edge["エッジ"]
            CDN["Firebase Hosting<br/>(CDN + リバースプロキシ)"]
        end

        subgraph Compute["コンピューティング"]
            CloudRun["Cloud Run<br/>(Nitro Server)<br/>自動スケーリング"]
        end

        subgraph Data["データストア"]
            Firestore["Cloud Firestore<br/>(ドキュメント DB<br/>+ ベクトル検索)"]
            Storage["Cloud Storage<br/>(ファイル原本)"]
        end

        subgraph AI["AI サービス"]
            Gemini["Vertex AI Gemini<br/>2.0 Flash"]
            Embedding["Embedding API<br/>(768次元)"]
        end

        subgraph Auth["認証"]
            FBAuth["Firebase<br/>Authentication"]
        end

        subgraph Build["ビルド"]
            CB["Cloud Build"]
            AR["Artifact Registry"]
        end
    end

    Browser --> CDN
    CDN --> CloudRun
    CloudRun --> Firestore
    CloudRun --> Storage
    CloudRun --> Gemini
    CloudRun --> Embedding
    CloudRun -.-> FBAuth
```

### 6.3 環境構成

| 項目                   | 設定                                         |
| ---------------------- | -------------------------------------------- |
| リージョン             | asia-northeast1（東京）                      |
| ランタイム             | Node.js (Cloud Run コンテナ)                 |
| フレームワーク         | Nuxt 3 (Nitro)                               |
| コンテナレジストリ     | Artifact Registry                            |
| CDN                    | Firebase Hosting                             |
| データベース           | Cloud Firestore                              |
| オブジェクトストレージ | Cloud Storage                                |
| 認証                   | Firebase Authentication                      |
| AI                     | Vertex AI (Gemini 2.0 Flash + Embedding API) |
| CI/CD                  | Cloud Build                                  |

---

## 7. データフロー設計

### 7.1 ドキュメント登録フロー

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant App as Nuxt SPA
    participant API as Nitro Server
    participant Storage as Cloud Storage
    participant AI as Vertex AI
    participant DB as Firestore

    Admin->>App: ファイル選択・アップロード
    App->>API: POST /api/documents/upload (multipart)
    API->>API: SHA-256 ハッシュ生成
    API->>DB: 重複チェック (contentHash)
    alt 重複あり
        API-->>App: 重複警告レスポンス
    end
    API->>Storage: ファイル保存
    API->>DB: documents 作成 (status: uploading)
    API-->>App: アップロード完了

    Admin->>App: 処理開始
    App->>API: POST /api/documents/:id/process
    API->>DB: status → processing
    API->>Storage: ファイルダウンロード
    API->>API: テキスト抽出 (PDF/DOCX/HTML 等)
    API->>AI: ドキュメント要約生成 (Gemini)
    API->>API: 親子チャンク分割 (800/250 tokens)
    API->>AI: コンテキストプレフィックス生成 (バッチ)
    API->>AI: ベクトル埋め込み生成 (768次元, バッチ)
    API->>DB: documentChunks 一括保存 (490件/バッチ)
    API->>DB: status → ready, chunkCount 更新
    API-->>App: 処理完了
```

### 7.2 チャット応答フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as Nuxt SPA / ウィジェット
    participant API as Nitro Server
    participant AI as Vertex AI
    participant DB as Firestore

    User->>App: 質問入力・送信
    App->>API: POST /api/chat/send
    API->>API: レート制限チェック
    API->>DB: サービス情報・設定取得
    API->>DB: 会話セッション取得/新規作成
    API->>DB: ユーザーメッセージ保存
    API->>DB: 会話履歴取得 (直近10件)

    par ベクトル検索
        API->>AI: クエリ埋め込み生成
        API->>DB: documentChunks ベクトル検索 (Top-K)
        API->>DB: feedbackChunks ベクトル検索
    end

    API->>API: コンテキスト構築 (検索結果統合)
    API->>AI: Gemini 回答生成
    AI-->>API: 回答テキスト + [CONFIDENCE:X.XX]
    API->>API: 信頼度パース

    alt 信頼度 < 閾値
        API->>DB: 改善リクエスト自動作成
        API->>DB: 会話ステータス → escalated
    end

    API->>DB: アシスタントメッセージ保存 (sources, confidence)
    API->>DB: referenceCount 更新
    API-->>App: 回答 (テキスト + ソース + 信頼度 + formUrl?)
    App-->>User: 回答表示
```

### 7.3 フィードバック学習ループ

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant API as Nitro Server
    participant AI as Vertex AI
    participant DB as Firestore

    Note over Admin: 改善リクエストの確認・対応
    Admin->>API: PUT /api/improvements/:id (correctedAnswer)
    API->>DB: 改善リクエスト更新 (status: resolved)
    API->>AI: 正解回答のベクトル生成 (768次元)
    API->>DB: feedbackChunks 保存

    Note over DB: 次回のチャット応答時
    Note over DB: feedbackChunks も<br/>ベクトル検索対象に含まれる
    Note over DB: → 回答精度が向上
```

---

## 8. セキュリティアーキテクチャ

### 8.1 認証・認可フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as Nuxt SPA
    participant FBAuth as Firebase Auth
    participant Hosting as Firebase Hosting
    participant Server as Cloud Run (Nitro)
    participant DB as Firestore

    User->>App: ログイン (Email/Password or Google)
    App->>FBAuth: 認証リクエスト
    FBAuth-->>App: ID Token (JWT)
    App->>Hosting: API リクエスト + Bearer Token
    Hosting->>Server: プロキシ転送
    Server->>Server: CORS ミドルウェア
    Server->>Server: 認証ミドルウェア (Token 検証)
    Server->>FBAuth: Token 検証 (Admin SDK)
    FBAuth-->>Server: UID + カスタムクレーム
    Server->>DB: ユーザー情報取得 (ロール・組織・グループ)
    Server->>Server: 認可チェック (ロール・組織・グループ)
    Server->>DB: データアクセス (organizationId + groupId スコープ)
    DB-->>Server: データ返却
    Server-->>App: レスポンス
```

### 8.2 セキュリティレイヤー

| レイヤー       | 実装                         | 説明                                 |
| -------------- | ---------------------------- | ------------------------------------ |
| ネットワーク   | HTTPS                        | Cloud Run 標準の TLS 終端            |
| エッジ         | Firebase Hosting             | CDN キャッシュ + リバースプロキシ    |
| CORS           | サーバーミドルウェア         | 公開パスのみ許可、その他は制限       |
| 認証           | Firebase Auth + ミドルウェア | ID Token 検証                        |
| 認可           | API ミドルウェア             | ロールベースアクセス制御             |
| データ分離     | Firestore Security Rules     | 組織・グループ単位のアイソレーション |
| ストレージ分離 | Storage Rules                | 管理者のみアップロード可             |
| レート制限     | サーバーミドルウェア         | API 種別ごとの制限                   |

### 8.3 Firestore Security Rules 設計方針

| コレクション        | 読取権限                              | 書込権限                 |
| ------------------- | ------------------------------------- | ------------------------ |
| organizations       | 所属メンバー                          | admin                    |
| users               | 本人のみ                              | 本人のみ                 |
| services            | 認証済みメンバー（公開 API は別パス） | admin                    |
| documents           | 所属組織メンバー                      | admin                    |
| documentChunks      | 所属組織メンバー                      | admin                    |
| conversations       | 本人 or admin                         | 本人のみ作成             |
| messages            | 親会話のアクセス権に準拠              | 親会話のアクセス権に準拠 |
| improvementRequests | admin                                 | admin                    |
| faqs                | admin                                 | admin                    |
| weeklyReports       | admin                                 | admin                    |
| settings            | admin                                 | admin                    |
| feedbackChunks      | admin                                 | admin                    |

---

## 9. Source of Truth (SoT) 宣言

| データ領域         | SoT                                  | キャッシュ/派生                   | 同期方式                   | 復元可能性                       |
| ------------------ | ------------------------------------ | --------------------------------- | -------------------------- | -------------------------------- |
| ユーザー認証情報   | Firebase Auth                        | Firestore users コレクション      | 認証イベントトリガー       | Auth → users で復元可            |
| ドキュメント原本   | Cloud Storage                        | Firestore documents（メタデータ） | アップロード時に同期       | Storage から再取得可             |
| チャンクテキスト   | Firestore documentChunks             | なし                              | ドキュメント処理時に生成   | 原本から再生成可                 |
| ベクトル埋め込み   | Firestore (documentChunks/faqs)      | L2 Firestore キャッシュ (30日)    | 生成時に保存               | Vertex AI で再生成可             |
| 会話履歴           | Firestore (conversations + messages) | なし                              | リアルタイム書込           | SoT 自体（復元不可）             |
| フィードバック     | Firestore feedbackChunks             | なし                              | 改善リクエスト対応時に生成 | improvementRequests から再生成可 |
| 組織設定           | Firestore settings                   | なし                              | 管理画面から更新           | SoT 自体                         |
| 定数・デフォルト値 | server/utils/constants.ts            | なし                              | コードデプロイ             | ソースコードから復元可           |

---

## 10. マルチテナント設計

### 10.1 テナント分離モデル

```mermaid
graph TD
    subgraph Tenant["テナント構造"]
        Org["Organization<br/>(組織)"]
        Org --> Group1["Group A<br/>(グループ)"]
        Org --> Group2["Group B<br/>(グループ)"]
        Group1 --> Service1["Service 1"]
        Group1 --> Service2["Service 2"]
        Group2 --> Service3["Service 3"]
    end

    subgraph Users["ユーザー"]
        User1["User (admin)<br/>Group A"]
        User2["User (member)<br/>Group A, B"]
    end

    User1 -.-> Group1
    User2 -.-> Group1
    User2 -.-> Group2
```

### 10.2 データ分離方式

- 全コレクションが `organizationId` フィールドを持ち、組織単位でデータを論理分離
- グループ対応コレクションは `groupId` フィールドで更に分離
- ユーザーは `UserGroupMembership` を通じて複数グループに所属可能
- アクティブグループ切替により、操作対象のデータスコープを変更

### 10.3 プラン体系

| プラン   | 説明             |
| -------- | ---------------- |
| free     | 無料プラン       |
| standard | 標準プラン       |
| premium  | プレミアムプラン |

---

## 11. エラーハンドリング方針

### 11.1 エラー分類

| 分類                 | HTTP ステータス | 対応方針                                               |
| -------------------- | --------------- | ------------------------------------------------------ |
| バリデーションエラー | 400             | リクエストパラメータの不正。クライアントに修正を促す   |
| 認証エラー           | 401             | トークン無効/期限切れ。再ログインを促す                |
| 認可エラー           | 403             | 権限不足。アクセス拒否を通知                           |
| リソース未存在       | 404             | 対象リソースが見つからない                             |
| サーバーエラー       | 500             | 内部エラー。ログ出力し、一般的なエラーメッセージを返却 |

### 11.2 グレースフルデグラデーション

- 補助処理（改善リクエスト自動作成、referenceCount 更新等）の失敗は、主要フロー（チャット回答返却）をブロックしない
- AI サービス（Gemini / Embedding）の一時的なエラーは、リトライ後にフォールバックメッセージを返却
- ベクトル検索の失敗時は、Firestore のテキストベースフォールバック検索を試行
