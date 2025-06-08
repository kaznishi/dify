# WorkflowCostByModelChart実装 関連ファイル一覧

## 概要

WorkflowCostByModelChart機能の実装に関連するファイルを整理したリストです。実装順序と優先度も含めて記載しています。

## API側（バックエンド）

### 新規作成・修正が必要なファイル

1. **`/api/controllers/console/app/workflow_statistic.py`**
   - 新しいエンドポイント `WorkflowTokenCostByModelStatistic` を追加
   - メッセージテーブルからワークフロー関連のモデル別統計を取得するSQLクエリ実装

### 参照が必要な既存ファイル

2. **`/api/controllers/console/app/__init__.py`**
   - 新しいAPIエンドポイントのルート登録のため

3. **`/api/models/model.py`**
   - Messageモデルの構造確認（token数、価格、model_provider、model_id等）

4. **`/api/models/workflow.py`**
   - Workflowモデルの構造確認（workflow_run_id関連）

## フロントエンド（Web）

### 新規作成・修正が必要なファイル

5. **`/web/models/app.ts`**
   - `WorkflowTokenCostsByModelResponse` インターフェースを追加
   - `ModelUsageData` インターフェースを追加

6. **`/web/service/apps.ts`**
   - `getWorkflowTokenCostsByModel` APIクライアント関数を追加

7. **`/web/app/components/app/overview/appChart.tsx`**
   - `WorkflowCostByModelChart` コンポーネントを追加
   - スタック型エリアチャートの実装
   - モデル別データ処理ロジック

8. **`/web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx`**
   - 新しいチャートコンポーネントをワークフロー統計セクションに統合
   - グリッドレイアウトの調整

## 国際化ファイル

### 修正が必要なファイル

9. **`/web/i18n/ja-JP/app-overview.ts`**
   - `tokenUsageByModel` セクションの日本語翻訳を追加

10. **`/web/i18n/en-US/app-overview.ts`**
    - `tokenUsageByModel` セクションの英語翻訳を追加

## 参照・理解が必要な既存ファイル

### 既存のパターンを理解するための参照ファイル

11. **`/web/app/components/app/overview/appChart.tsx`** (既存)
    - 既存の `WorkflowCostChart` の実装パターンを参照
    - チャートコンポーネントの構造理解

12. **`/web/service/apps.ts`** (既存)
    - 既存のAPI呼び出しパターンを参照
    - SWRを使用したデータフェッチング方法

13. **`/web/app/components/app/overview/chartView.tsx`** (既存)
    - 既存のチャート統合パターンを参照
    - ワークフロー用チャートの配置方法

### 型定義の参照

14. **`/web/models/app.ts`** (既存)
    - 既存の型定義パターンを参照
    - アプリケーション関連のインターフェース構造

15. **`/web/types/app.ts`**
    - アプリ関連の型定義を参照

### 依存関係の確認

16. **`/api/controllers/console/app/__init__.py`** (既存)
    - ルート設定の確認

17. **`/api/libs/helper.py`**
    - ヘルパー関数の利用可能性確認

18. **`/web/context/app-context.tsx`**
    - アプリコンテキストの利用方法確認

19. **`/web/hooks/use-i18n.ts`**
    - 国際化フックの使用方法確認

## ファイル修正の優先順位

### Phase 1: API実装
1. `/api/controllers/console/app/workflow_statistic.py` - 新しいエンドポイント実装
2. `/api/controllers/console/app/__init__.py` - ルート登録

### Phase 2: フロントエンド型定義
3. `/web/models/app.ts` - TypeScript型定義追加
4. `/web/service/apps.ts` - APIクライアント関数追加

### Phase 3: コンポーネント実装
5. `/web/app/components/app/overview/appChart.tsx` - チャートコンポーネント実装

### Phase 4: 統合
6. `/web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx` - チャート統合

### Phase 5: 国際化
7. `/web/i18n/ja-JP/app-overview.ts` - 日本語翻訳追加
8. `/web/i18n/en-US/app-overview.ts` - 英語翻訳追加

## 実装時の注意点

### データベース関連
- `messages` テーブルの `workflow_run_id IS NOT NULL` でフィルタリング
- `model_provider` と `model_id` カラムを使用してモデル別統計を取得

### フロントエンド関連
- EChartsを使用したスタック型エリアチャート
- useMemoによるチャートオプションのメモ化
- SWRによるデータキャッシング

### パフォーマンス考慮
- 効率的なSQLクエリの実装
- フロントエンドでのデータ変換最適化
- 適切なローディング状態の表示

## 依存関係

### 外部ライブラリ
- **バックエンド**: Flask, SQLAlchemy, pytz
- **フロントエンド**: React, SWR, ECharts, dayjs

### 内部コンポーネント
- **バックエンド**: 既存の認証・認可デコレータ
- **フロントエンド**: 既存のチャートコンポーネント、ローディングコンポーネント

このリストに従って順次実装を進めることで、WorkflowCostByModelChart機能を効率的に実装できます。