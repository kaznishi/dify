# 作業メモ: モデルごとトークン使用量グラフの実装

## 1. 目的

`/app/[app_id]/overview` の画面で、ワークフローの場合にモデルごとのトークン使用量を表示する新しいグラフ「WorkflowCostByModelChart」を実装する。

## 2. 事前調査

### 2.1. 関連コンポーネントの特定

-   `overview` ページの実装は `web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/` ディレクトリ配下にあることを特定。
-   グラフ関連の主要ロジックは `web/app/components/app/overview/appChart.tsx` に集約されていることを確認。

### 2.2. 既存のトークンコストAPIの調査

-   既存のワークフローコスト表示 (`WorkflowCostChart`) は、`/apps/{appId}/workflow/statistics/token-costs` APIを呼び出していることを確認。
-   このAPIは `api/controllers/console/app/workflow_statistic.py` の `WorkflowDailyTokenCostStatistic` クラスで実装されており、`workflow_runs` テーブルの `total_tokens` を日毎に集計していることを特定。

### 2.3. モデルごとのトークン使用量データの調査

-   ワークフローの各ステップ（ノード）の実行ログは `workflow_node_executions` テーブルに保存されていることを確認。
-   LLMモデル名やトークン使用量などの詳細情報は、このテーブルの `execution_metadata` カラムにJSON形式で格納されていることを特定。

## 3. 設計

調査結果に基づき、以下の設計を策定した。

### 3.1. バックエンド (API)

-   **新規APIエンドポイント**: `/apps/{appId}/workflow/statistics/token-costs-by-model` を作成。
-   **ロジック**: `workflow_node_executions` テーブルを対象に、`node_type = 'llm'` のレコードに絞り込み、`execution_metadata` から `model_name` でグループ化して `total_tokens` を集計する。
-   **実装ファイル**: `api/controllers/console/app/workflow_statistic.py` に `WorkflowTokenCostByModelStatistic` クラスを新設。

### 3.2. フロントエンド (Web)

-   **データ取得層**: `web/service/apps.ts` に、新規APIを呼び出す `getWorkflowTokenCostsByModel` 関数を追加。
-   **コンポーネント層**: `web/app/components/app/overview/appChart.tsx` に、モデルごとのトークン量を棒グラフで表示する `WorkflowCostByModelChart` コンポーネントを新設。
-   **UI層**: `web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx` を編集し、`isWorkflow` が `true` の場合に `WorkflowCostByModelChart` を表示するよう変更。

## 4. 実装

-   **2025/06/26**: 上記設計に基づき、以下の順で実装を完了。
    1.  バックエンドAPI (`workflow_statistic.py`) の実装。
    2.  フロントエンドのサービス関数 (`apps.ts`) の追加。
    3.  フロントエンドのグラフコンポーネント (`appChart.tsx`) の実装。
    4.  `overview` ページ (`chartView.tsx`) への組み込み。
