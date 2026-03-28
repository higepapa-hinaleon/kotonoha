# 問い合わせ対応業務フロー

## 現状の業務フロー（AS-IS）

### 時系列フロー

```mermaid
sequenceDiagram
    participant User as 問い合わせ者
    participant Channel as 連絡チャネル<br>(メール/チャット/電話)
    participant Staff as 担当者
    participant KB as ナレッジ<br>(マニュアル/Wiki/個人メモ)

    User->>Channel: 質問を送信
    Channel->>Staff: 通知（不定期確認）
    Note over Staff: 確認まで数時間〜翌日
    Staff->>KB: 情報を検索
    Note over KB: 情報が散在・古い場合あり
    alt 回答可能
        Staff->>Channel: 回答を送信
        Channel->>User: 回答受領
    else 回答不明
        Staff->>Staff: 他の担当者に確認
        Note over Staff: さらに時間がかかる
        Staff->>Channel: 回答を送信
    end
```

### 各ステップの入出力

| ステップ | 入力 | 処理 | 出力 | 問題点 |
|---------|------|------|------|--------|
| 質問送信 | テキスト質問 | メール/チャット送信 | 問い合わせ記録 | チャネルが分散、統一管理されない |
| 通知確認 | 通知 | 担当者の手動確認 | 認知 | 確認漏れ・遅延が発生 |
| 情報検索 | 質問内容 | マニュアル・Wiki検索 | 関連情報 | 情報が散在、検索が困難 |
| 回答作成 | 関連情報 | 担当者が文章作成 | 回答テキスト | 品質が担当者に依存 |
| 回答送信 | 回答テキスト | チャネルで返信 | 対応完了 | 回答が記録として蓄積されない |

### 発生している非効率・ミス・ストレス

1. **時間の非効率:** 同じ質問に何度も回答（推定30-50%が既出の質問）
2. **品質のばらつき:** 担当者の知識・経験に依存し、回答の正確性に差がある
3. **知識の消失:** 退職・異動で蓄積された知見が失われる
4. **対応の遅延:** 営業時間外は対応不可。繁忙期はさらに遅延
5. **改善の停滞:** どの質問が多いか、何が問題かのデータがない

---

## 目標の業務フロー（TO-BE）

### 時系列フロー

```mermaid
sequenceDiagram
    participant User as 問い合わせ者
    participant Bot as AIサポートボット
    participant Docs as ドキュメント<br>(RAG)
    participant Admin as 管理者
    participant Form as Google Form

    User->>Bot: 質問を送信
    Bot->>Docs: ベクトル検索
    Docs-->>Bot: 関連ドキュメント
    Bot->>Bot: 回答生成 + 信頼度判定
    alt 信頼度 >= 閾値
        Bot-->>User: 回答（ソース付き）
    else 信頼度 < 閾値
        Bot-->>User: 回答 + フォーム誘導
        Bot->>Admin: 改善リクエスト自動作成
        User->>Form: 詳細問い合わせ
    end
    Admin->>Admin: ダッシュボードで状況確認
    Admin->>Bot: ドキュメント追加・フィードバック登録
    Note over Bot: 学習ループで精度向上
```

### 改善効果

| 現状の問題 | TO-BE での解決 |
|-----------|---------------|
| 回答待ち時間（数時間〜翌日） | 即時回答（3-5秒） |
| 品質のばらつき | ドキュメントベースの一貫した回答 |
| 知識の属人化 | ドキュメントとして組織資産化 |
| 24/7対応不可 | 24時間365日稼働 |
| 改善サイクル欠如 | ダッシュボード・週次レポートによるデータドリブン改善 |
