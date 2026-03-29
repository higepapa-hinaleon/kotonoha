# Phase 7: 開発ログ（MVP構築）

## 概要

本ドキュメントはMVP構築フェーズにおける開発の経緯、技術的判断、課題と対応を記録する。

---

## Sprint 0: プロジェクト基盤（1週間）

### 実装内容

- Nuxt 3 プロジェクト初期化（compatibilityVersion: 4）
- TypeScript strict mode 設定
- ESLint (@nuxt/eslint) + Prettier 設定
- Tailwind CSS 導入（@nuxtjs/tailwindcss）
- Firebase プロジェクト初期化（firebase.json、firestore.rules、storage.rules）
- ディレクトリ構成策定（app/, server/, shared/, packages/）
- npm workspaces によるモノレポ構成（packages/sdk, packages/widget）
- CI/CD パイプライン構築（Cloud Build + GitHub 連携）

### 技術的判断

- **SSR無効化（ssr: false）:** Firebase Client SDK がブラウザAPIに依存するため、SPA モードを採用。管理画面中心の用途でSSRの恩恵が限定的。
- **npm workspaces 採用:** SDK とウィジェットを独立パッケージとして管理。メインアプリとの依存関係を明確化。

### 発生した課題と対応

- Nuxt 4 compatibilityVersion 設定時の型定義の不整合 → `compatibilityDate: "2025-01-01"` で解決

---

## Sprint 1: 認証 + 共通レイアウト（1週間）

### 実装内容

- Firebase Authentication 統合（firebase.client.ts プラグイン）
- メール/パスワード + Google OAuth ログイン
- useAuth composable（認証状態管理、自動登録）
- 認証ミドルウェア（auth.ts - ルート保護）
- サーバーサイド認証ミドルウェア（Bearer Token 検証）
- AppHeader / AppSidebar コンポーネント
- default / admin レイアウト
- ログイン画面（/login）
- /api/auth/register、/api/auth/me エンドポイント

### 技術的判断

- **自動ユーザー登録:** 初回ログイン時にユーザー + デフォルト組織を自動作成。手動セットアップ手順を排除。
- **全ユーザーをadminロールで登録:** MVP段階では組織内全員が管理機能を使用する想定。

### 発生した課題と対応

- Firebase Auth の User オブジェクトを Vue の reactive state に直接格納するとProxy traverseでエラー → plain object に変換して格納

---

## Sprint 2: ドキュメント管理 + RAG準備（1.5週間）

### 実装内容

- サービス CRUD API（/api/services）
- ドキュメントアップロード API（/api/documents/upload - multipart）
- SHA-256 重複検出
- テキスト抽出（pdf-parse, mammoth, cheerio 対応）
- 親子チャンク分割（800/250 tokens、50 overlap）
- コンテキスト付きリトリーバル（ドキュメント要約 + チャンクプレフィックス）
- Vertex AI 埋め込み生成（text-multilingual-embedding-002、768次元）
- 2層埋め込みキャッシュ（L1: メモリ30分、L2: Firestore 7日）
- ベクトルインデックス定義（firestore.indexes.json）
- サービス管理画面（/admin/services）
- ドキュメント管理画面（/admin/documents）

### 技術的判断

- **親子チャンク構造:** 検索には小チャンク（250tokens）を使用し、コンテキスト構築には親チャンク（800tokens）を使用。検索精度と文脈保持を両立。
- **コンテキスト付きリトリーバル:** Anthropic の手法を参考に、各チャンクにドキュメント内での位置づけを示すプレフィックスを付与。
- **インクリメンタル処理:** contentHash による差分検出で、再処理時に変更のないチャンクをスキップ。

### 発生した課題と対応

- PDF パースで日本語テキストの文字化け → pdf-parse v2 で解決
- Vertex AI Embeddings のバッチサイズ上限（250テキスト）→ バッチ分割処理を実装
- 埋め込み生成コストが高い → 2層キャッシュで大幅削減

---

## Sprint 3: チャットコア（MVP）（1.5週間）

### 実装内容

- RAG パイプライン（/api/chat/send）
- Firestore Vector Search 統合
- Gemini 2.0 Flash による回答生成
- 信頼度スコア抽出（[CONFIDENCE:X.XX] フォーマット）
- 低信頼度時のフォーム誘導 + 改善リクエスト自動作成
- フィードバックチャンクによる学習ループ
- チャットUI（/chat - MessageBubble, MessageInput, FormGuideBanner）
- 会話履歴画面（/chat/history）
- ソース参照表示（ドキュメント名 + 類似度%）
- useApi composable（API クライアント、エラーハンドリング）

### 技術的判断

- **信頼度スコア方式:** Gemini 出力に [CONFIDENCE:X.XX] を含める指示をシステムプロンプトに追加。正規表現でパース。
- **動的 topK:** ベクトル検索結果の類似度分布に応じて取得件数を動的に調整。
- **フィードバック学習:** 改善リクエストに管理者が正解を登録 → feedbackChunks としてベクトル化 → 次回検索時に参照。

### 発生した課題と対応

- ベクトル検索の精度が低い場合がある → 類似度閾値によるフィルタリング + 親チャンクの重複排除を実装
- 会話の文脈が途切れる → 会話履歴（直近メッセージ）をGeminiに渡す設計に変更

---

## Sprint 4: 管理画面 Phase 1（1週間）

### 実装内容

- 管理者用会話一覧（/admin/conversations）
- 会話詳細表示（/admin/conversations/[id]）
- 改善リクエスト管理（/admin/improvements）
- AI カテゴリ自動分類
- フィードバック埋め込み登録
- DataTable / SearchFilter / Pagination 共通コンポーネント
- StatusBadge / ConfirmDialog 共通コンポーネント

### 技術的判断

- **共通コンポーネント化:** DataTable / SearchFilter / Pagination を汎用コンポーネントとして設計。全管理画面で再利用。
- **カテゴリ自動分類:** Gemini による構造化JSON出力で分類。手動分類の負担を軽減。

---

## Sprint 5: 高度機能 + 自動化（1週間）

### 実装内容

- FAQ 自動生成（/api/faqs/generate）
- FAQ 手動作成・編集・公開切替（/admin/faqs）
- 週次レポート生成（/api/reports/generate）
- レポート閲覧画面（/admin/reports）
- ダッシュボード（/admin - KPIカード、7日間トレンド、サービス分布）
- 設定画面（/admin/settings）
- RAG 診断画面（/admin/rag-test）
- useNotification composable（トースト通知）

### 技術的判断

- **FAQ自動生成:** 会話データからGeminiが質問-回答ペアを抽出。管理者が確認後に公開する2段階フロー。
- **ダッシュボードKPI:** サーバーサイドで集計し、1つのAPIで返却。クライアント側での重い集計処理を回避。

---

## Sprint 6: ウィジェット + テスト + デプロイ（1週間）

### 実装内容

- Web Component（kotonoha-chat-widget）開発
- チャットSDK（@kotonoha/chat-sdk）開発
- Shadow DOM によるスタイル隔離
- CSS Variables によるテーマカスタマイズ
- CORS ミドルウェア実装
- Vitest ユニットテスト（chunker, gemini, ai-generator）
- Playwright E2E テスト（auth, chat, admin）
- Firestore Security Rules 整備
- Cloud Build + Cloud Run デプロイ設定
- Firebase Hosting リバースプロキシ設定

### 技術的判断

- **Web Component方式:** Shadow DOM によるスタイル隔離で、埋め込み先サイトのCSSと干渉しない。iframe方式より柔軟。
- **SDK分離:** ウィジェットとSDKを分離し、SDKのみを使った独自UI構築も可能にする。

---

## 技術的意思決定ログ

| ID    | 決定事項                      | 背景・理由                                                   | 代替案                   | 日付     |
| ----- | ----------------------------- | ------------------------------------------------------------ | ------------------------ | -------- |
| TD-01 | SSR無効化（ssr: false）       | Firebase Client SDK のブラウザAPI依存、管理画面中心でSSR不要 | SSR有効 + .client.ts分離 | Sprint 0 |
| TD-02 | 親子チャンク構造              | 検索精度（小チャンク）と文脈保持（親チャンク）の両立         | 固定サイズチャンク       | Sprint 2 |
| TD-03 | コンテキスト付きリトリーバル  | チャンクの文脈喪失防止、検索精度向上                         | チャンクのみ             | Sprint 2 |
| TD-04 | 2層埋め込みキャッシュ         | API コスト削減（L1: メモリ30分TTL、L2: Firestore 7日TTL）    | キャッシュなし           | Sprint 2 |
| TD-05 | Web Component方式ウィジェット | Shadow DOM隔離、外部依存なし、CSS Variables テーマ           | iframe                   | Sprint 6 |
| TD-06 | Firestore named database      | 環境分離（kotonoha）                                         | デフォルトDB             | Sprint 0 |
| TD-07 | Cloud Run + Firebase Hosting  | リバースプロキシ構成、カスタムドメイン対応                   | Cloud Run単体            | Sprint 6 |
| TD-08 | 自動ユーザー登録              | 手動セットアップ排除、初回ログインで完結                     | 招待制                   | Sprint 1 |
| TD-09 | 信頼度スコア方式              | LLM出力に[CONFIDENCE]タグを含める                            | 別途分類器               | Sprint 3 |
| TD-10 | フィードバック学習ループ      | 管理者の正解フィードバックをベクトル化して検索に反映         | ドキュメント追加のみ     | Sprint 3 |
