
# 設計案：モデルごとトークン使用量グラフの実装

`isWorkflow = true` の場合にモデルごとのトークン使用量を表示する `WorkflowCostByModelChart` を実装するための設計案です。

---

### 1. バックエンド (API) 設計

新しいAPIエンドポイント `/apps/{appId}/workflow/statistics/token-costs-by-model` を作成します。

#### 1.1. APIエンドポイント定義

-   **URL**: `/apps/<uuid:app_id>/workflow/statistics/token-costs-by-model`
-   **メソッド**: `GET`
-   **ファイル**: `api/controllers/console/app/workflow_statistic.py` に新しいリソースクラスを追加します。
-   **クラス名**: `WorkflowTokenCostByModelStatistic`

#### 1.2. 処理内容

このエンドポイントは、指定されたアプリケーションと期間において、成功したLLMノードの実行ログを集計します。

1.  **データベースクエリ**:
    *   **対象テーブル**: `workflow_node_executions`
    *   **集計ロジック**:
        *   `app_id` と期間 (`start`, `end`) でレコードをフィルタリングします。
        *   `node_type` が `'llm'` (LLMノード) で、`status` が `'succeeded'` のレコードのみを対象とします。
        *   `execution_metadata` JSONカラムから `model_name` を抽出します。
        *   `model_name` でグループ化し、各モデルの `total_tokens` を合計します。
        *   結果をトークン使用量の降順でソートします。

    **SQLクエリ (PostgreSQL) の例:**
    ```sql
    SELECT
        jsonb_extract_path_text(execution_metadata, 'model_name') AS model_name,
        SUM(CAST(jsonb_extract_path_text(execution_metadata, 'total_tokens') AS integer)) AS total_tokens
    FROM
        workflow_node_executions
    WHERE
        app_id = :app_id
        AND created_at >= :start
        AND created_at < :end
        AND node_type = 'llm'
        AND status = 'succeeded'
    GROUP BY
        model_name
    ORDER BY
        total_tokens DESC;
    ```

2.  **レスポンス形式**:
    *   以下の形式のJSONを返します。
    ```json
    {
      "data": [
        { "model_name": "gpt-4", "total_tokens": 10520 },
        { "model_name": "claude-3-opus", "total_tokens": 8765 },
        ...
      ]
    }
    ```

#### 1.3. 実装ファイル

`api/controllers/console/app/workflow_statistic.py` に、`WorkflowDailyTokenCostStatistic` を参考に新しいクラスを追加し、`api.add_resource(...)` でURLとクラスを紐付けます。

---

### 2. フロントエンド (Web) 設計

新しいグラフコンポーネント `WorkflowCostByModelChart` を作成し、`overview` ページに組み込みます。

#### 2.1. データ取得関数の追加

-   **ファイル**: `web/service/apps.ts`
-   **関数**: `getWorkflowTokenCostsByModel` という名前の新しい関数を追加します。この関数は、上記で設計したバックエンドAPIを呼び出します。

#### 2.2. 新規グラフコンポーネントの実装

-   **ファイル**: `web/app/components/app/overview/appChart.tsx`
-   **コンポーネント名**: `WorkflowCostByModelChart`
-   **処理内容**:
    1.  **データ取得**: `useSWR` を使い、新しく作成した `getWorkflowTokenCostsByModel` サービス関数を呼び出してデータを取得します。
    2.  **グラフ描画**:
        *   取得したデータを元に、`ReactECharts` を使って**棒グラフ**を描画するのが最適です。
        *   **x軸**: モデル名 (`model_name`)
        *   **y軸**: トークン使用量 (`total_tokens`)
        *   ツールチップで、各モデルの正確なトークン数を表示します。
    3.  **UI**:
        *   他のチャートコンポーネント (`WorkflowCostChart` など) と同様に、`Basic` コンポーネントを使ってタイトルや説明を表示し、UIの一貫性を保ちます。

#### 2.3. `overview` ページへの組み込み

-   **ファイル**: `web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx`
-   **処理内容**:
    1.  `appChart.tsx` から `WorkflowCostByModelChart` をインポートします。
    2.  `isWorkflow` が `true` の場合に表示されるJSXブロック内に、新しいコンポーネントを配置します。`WorkflowCostChart` の隣に配置するのが良いでしょう。

    ```tsx
    // web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx

    {isWorkflow && (
      <div className='mb-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2'>
        <WorkflowCostChart period={period} id={appId} />
        {/* ここに新しいコンポーネントを追加 */}
        <WorkflowCostByModelChart period={period} id={appId} />
      </div>
    )}
    ```
