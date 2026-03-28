# アーキテクチャ設計書

> **フェーズ:** Phase 5 - 設計ドキュメント生成
> **更新日:** 2026-03-24

---

## 1. システムアーキテクチャ

### 1.1 全体構成図

```mermaid
graph TB
    subgraph Client["クライアント (ブラウザ)"]
        NuxtSPA["Nuxt 3 SPA"]
        FirebaseSDK["Firebase Auth SDK"]
    end

    subgraph CloudRun["Cloud Run"]
        NitroServer["Nitro Server"]
        APIRoutes["API Routes (/api/*)"]
        SSR["SSR / SPA Fallback"]
    end

    subgraph GoogleCloud["Google Cloud Platform"]
        Firestore["Cloud Firestore"]
        CloudStorage["Cloud Storage"]
        VertexAI["Vertex AI (Gemini)"]
        EmbeddingAPI["Embedding API (768dim)"]
    end

    subgraph Firebase["Firebase"]
        FirebaseAuth["Firebase Authentication"]
        FirebaseHosting["Firebase Hosting (リバースプロキシ)"]
    end

    NuxtSPA -->|Bearer Token| FirebaseHosting
    FirebaseHosting -->|プロキシ| CloudRun
    NuxtSPA --> FirebaseSDK
    FirebaseSDK --> FirebaseAuth
    NitroServer --> APIRoutes
    APIRoutes -->|読み書き| Firestore
    APIRoutes -->|ファイル操作| CloudStorage
    APIRoutes -->|生成AI| VertexAI
    APIRoutes -->|ベクトル生成| EmbeddingAPI
    FirebaseAuth -.->|トークン検証| NitroServer
```

### 1.2 コンポーネントアーキテクチャ

```mermaid
graph LR
    subgraph Frontend["フロントエンド (Nuxt 3)"]
        Pages["Pages"]
        Components["Components"]
        Composables["Composables"]
        Plugins["Plugins"]
        Middleware["Middleware"]
        Stores["State (useState)"]
    end

    subgraph Backend["バックエンド (Nitro Server)"]
        ServerAPI["server/api/"]
        ServerMiddleware["server/middleware/"]
        ServerUtils["server/utils/"]
        ServerServices["server/services/"]
    end

    Pages --> Components
    Pages --> Composables
    Composables --> Stores
    Plugins --> FirebaseInit["Firebase 初期化 (.client.ts)"]
    Middleware --> AuthCheck["認証チェック"]
    Pages -->|fetch / useFetch| ServerAPI
    ServerAPI --> ServerMiddleware
    ServerAPI --> ServerUtils
    ServerAPI --> ServerServices
```

---

## 2. サイトマップ

```
/ (リダイレクト → /chat)
├── /login (ログイン画面)
├── /chat
│   ├── /chat (チャット画面)
│   └── /chat/history (会話履歴)
├── /admin
│   ├── /admin (ダッシュボード)
│   ├── /admin/services (サービス管理)
│   ├── /admin/documents (ドキュメント管理)
│   ├── /admin/documents/[id] (ドキュメント詳細)
│   ├── /admin/conversations (会話一覧)
│   ├── /admin/conversations/[id] (会話詳細)
│   ├── /admin/improvements (改善管理)
│   ├── /admin/faqs (FAQ管理)
│   ├── /admin/reports (レポート)
│   ├── /admin/settings (設定)
│   └── /admin/rag-test (RAG診断)
```

### ルーティング構成図

```mermaid
graph TD
    Root["/"] -->|リダイレクト| Chat["/chat"]
    Login["/login"]

    subgraph UserPages["エンドユーザー画面"]
        Chat
        ChatHistory["/chat/history"]
    end

    subgraph AdminPages["管理者画面"]
        AdminDash["/admin"]
        AdminServices["/admin/services"]
        AdminDocs["/admin/documents"]
        AdminDocDetail["/admin/documents/[id]"]
        AdminConv["/admin/conversations"]
        AdminConvDetail["/admin/conversations/[id]"]
        AdminImprovements["/admin/improvements"]
        AdminFaqs["/admin/faqs"]
        AdminReports["/admin/reports"]
        AdminSettings["/admin/settings"]
        AdminRagTest["/admin/rag-test"]
    end

    AdminDocs --> AdminDocDetail
    AdminConv --> AdminConvDetail
```

---

## 3. データフロー

### 3.1 ドキュメント登録フロー

```mermaid
sequenceDiagram
    participant Admin as 管理者
    participant App as Nuxt SPA
    participant API as Nitro Server
    participant Storage as Cloud Storage
    participant AI as Vertex AI
    participant DB as Firestore

    Admin->>App: ファイルアップロード
    App->>API: POST /api/documents
    API->>Storage: ファイル保存
    API->>DB: ドキュメントメタデータ作成 (status: processing)
    API->>API: テキスト抽出 (PDF/DOCX/etc.)
    API->>API: チャンク分割 (parent-child構造)
    API->>API: コンテキストプレフィックス付与
    API->>AI: Embedding生成 (768次元)
    API->>DB: チャンク + ベクトル保存
    API->>DB: ステータス更新 (status: completed)
    API-->>App: 処理完了通知
```

**処理詳細:**
1. **Upload:** 管理者がファイルをアップロード（単一 / 一括対応）
2. **Storage:** Cloud Storage にファイル原本を保存
3. **Extract:** ファイル形式に応じたテキスト抽出
4. **Chunk:** 親子構造のチャンク分割（文脈を保持）
5. **Context prefix:** 各チャンクにコンテキスト情報を付与
6. **Embed:** Vertex AI Embedding API で768次元ベクトルを生成
7. **Firestore:** チャンクデータとベクトルを保存

### 3.2 チャットフロー

```mermaid
sequenceDiagram
    participant User as エンドユーザー
    participant App as Nuxt SPA
    participant API as Nitro Server
    participant AI as Vertex AI
    participant DB as Firestore

    User->>App: 質問入力
    App->>API: POST /api/chat
    API->>AI: クエリのEmbedding生成
    API->>DB: ベクトル検索 (ドキュメントチャンク)
    API->>DB: ベクトル検索 (フィードバック/FAQ)
    API->>API: コンテキスト構築 (検索結果統合)
    API->>AI: Gemini に生成リクエスト
    AI-->>API: 回答生成
    API->>API: 信頼度スコア算出
    alt 信頼度が低い
        API-->>App: 回答 + フォーム誘導バナー
    else 信頼度が十分
        API-->>App: 回答 + ソース情報 (類似度%)
    end
    API->>DB: 会話ログ保存
    App-->>User: 回答表示
```

**処理詳細:**
1. **Query → Embed:** ユーザーの質問をベクトル化
2. **Vector Search:** ドキュメントチャンク + フィードバックデータの両方を検索
3. **Context build:** 検索結果を統合してコンテキストを構築
4. **Gemini:** コンテキスト付きプロンプトで回答生成
5. **Confidence check:** 信頼度スコアを算出
6. **Response:** ソース情報（類似度%）付きで回答を返却。低信頼度時はフォーム誘導

### 3.3 フィードバック・学習ループ

```mermaid
sequenceDiagram
    participant User as エンドユーザー
    participant App as Nuxt SPA
    participant API as Nitro Server
    participant AI as Vertex AI
    participant DB as Firestore

    Note over User,App: 信頼度が低い場合
    App->>User: フォーム誘導バナー表示
    User->>App: 改善リクエスト入力
    App->>API: POST /api/improvements
    API->>DB: 改善リクエスト保存
    API->>AI: フィードバックのEmbedding生成
    API->>DB: フィードバックベクトル保存

    Note over API,DB: 管理者による処理
    API->>DB: ステータス更新・カテゴリ分類
    Note over DB: 次回の検索で<br/>フィードバックが<br/>検索対象に含まれる
```

**学習ループの仕組み:**
1. **Low confidence:** 信頼度が閾値を下回ると、フォーム誘導バナーを表示
2. **Form guidance:** ユーザーが改善リクエストを入力
3. **Improvement request:** リクエストをFirestoreに保存
4. **Feedback embedding:** フィードバック内容をベクトル化して保存
5. **Learning loop:** 次回以降のベクトル検索でフィードバックも検索対象となり、回答精度が向上

---

## 4. セキュリティアーキテクチャ

### 4.1 認証・認可フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as Nuxt SPA
    participant FBAuth as Firebase Auth
    participant Hosting as Firebase Hosting
    participant Server as Cloud Run (Nitro)
    participant DB as Firestore

    User->>App: ログイン (Email/Password or Google OAuth)
    App->>FBAuth: 認証リクエスト
    FBAuth-->>App: ID Token (JWT)
    App->>Hosting: API リクエスト + Bearer Token
    Hosting->>Server: プロキシ転送
    Server->>Server: server/middleware で Token 検証
    Server->>FBAuth: Token 検証 (Admin SDK)
    FBAuth-->>Server: ユーザー情報 + カスタムクレーム
    Server->>DB: 組織ベースのデータアクセス
    DB-->>Server: データ返却
    Server-->>App: レスポンス
```

### 4.2 セキュリティレイヤー

| レイヤー | 実装 | 説明 |
|----------|------|------|
| 認証 | Firebase Authentication | Email/Password + Google OAuth |
| トークン検証 | Server Middleware | Bearer Token をサーバー側で検証 |
| データ分離 | Firestore Security Rules | 組織ベースのアイソレーション |
| ストレージ制御 | Storage Rules | 管理者のみアップロード可能 |
| 通信制御 | CORS Whitelist | 許可オリジンのみアクセス可能 |
| ロール管理 | カスタムクレーム | admin / user ロールの分離 |

### 4.3 Firestore Security Rules の設計方針

- **組織ベース分離:** 全てのデータは `organizationId` でスコープされ、他組織のデータにはアクセス不可
- **list vs get の考慮:** クエリ（list）と単一取得（get）でルール評価が異なることを考慮した設計
- **管理者権限:** ドキュメント管理・設定変更は admin ロールのみ許可

---

## 5. インフラ構成

### 5.1 デプロイメントパイプライン

```mermaid
graph LR
    subgraph Development["開発環境"]
        Dev["開発者"]
        GitHub["GitHub リポジトリ"]
    end

    subgraph CICD["CI/CD"]
        CloudBuild["Cloud Build"]
        ArtifactReg["Artifact Registry"]
    end

    subgraph Production["本番環境"]
        CloudRun["Cloud Run"]
        FirebaseHosting["Firebase Hosting"]
    end

    Dev -->|git push| GitHub
    GitHub -->|トリガー| CloudBuild
    CloudBuild -->|Docker イメージ| ArtifactReg
    ArtifactReg -->|デプロイ| CloudRun
    CloudBuild -->|デプロイ| FirebaseHosting
    FirebaseHosting -->|リバースプロキシ| CloudRun
```

### 5.2 インフラ構成図

```mermaid
graph TB
    subgraph Internet["インターネット"]
        Browser["ブラウザ"]
    end

    subgraph GCP["Google Cloud Platform"]
        subgraph Hosting["Firebase Hosting"]
            CDN["CDN + リバースプロキシ"]
        end

        subgraph Compute["コンピューティング"]
            CloudRun["Cloud Run<br/>(Nitro Server)"]
        end

        subgraph Data["データストア"]
            Firestore["Cloud Firestore<br/>(ドキュメントDB + ベクトル検索)"]
            Storage["Cloud Storage<br/>(ファイル原本)"]
        end

        subgraph AI["AI サービス"]
            Gemini["Vertex AI Gemini<br/>(生成AI)"]
            Embedding["Embedding API<br/>(768次元ベクトル)"]
        end

        subgraph Auth["認証"]
            FirebaseAuth["Firebase Authentication"]
        end

        subgraph Build["ビルド"]
            CloudBuild["Cloud Build"]
            ArtifactRegistry["Artifact Registry"]
        end
    end

    Browser --> CDN
    CDN --> CloudRun
    CloudRun --> Firestore
    CloudRun --> Storage
    CloudRun --> Gemini
    CloudRun --> Embedding
    CloudRun -.-> FirebaseAuth
```

### 5.3 環境構成

| 項目 | 設定 |
|------|------|
| ランタイム | Node.js (Cloud Run) |
| フレームワーク | Nuxt 3 (Nitro) |
| コンテナレジストリ | Artifact Registry |
| CDN | Firebase Hosting |
| データベース | Cloud Firestore |
| オブジェクトストレージ | Cloud Storage |
| 認証 | Firebase Authentication |
| AI | Vertex AI (Gemini + Embedding) |
| CI/CD | Cloud Build |

---

## 6. Source of Truth (SoT) 宣言

| データ領域 | SoT | キャッシュ/派生 | 同期方式 |
|-----------|-----|---------------|---------|
| ユーザー認証情報 | Firebase Authentication | Firestore (ユーザープロファイル) | 認証イベントトリガー |
| ドキュメント原本 | Cloud Storage | Firestore (メタデータ + チャンク) | アップロード時に同期処理 |
| ベクトルデータ | Firestore (Embedding) | - | ドキュメント登録時に生成 |
| 会話ログ | Firestore | - | リアルタイム書込 |
| 改善リクエスト | Firestore | - | リアルタイム書込 |
| 組織設定 | Firestore | - | 管理画面から更新 |
