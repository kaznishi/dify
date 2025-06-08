# WorkflowCostByModelChart実装 TODOリスト

## 概要

WorkflowCostByModelChart機能の実装を段階的に進めるためのTODOリストです。各フェーズごとに優先度を設定し、効率的な実装順序を定義しています。

## Phase 1: API実装（バックエンド）

### 🔴 高優先度

- [ ] **API側: WorkflowTokenCostByModelStatistic エンドポイントを /api/controllers/console/app/workflow_statistic.py に実装**
  - 新しいクラス `WorkflowTokenCostByModelStatistic(Resource)` を追加
  - メッセージテーブルからワークフロー関連のモデル別統計を取得するSQLクエリを実装
  - 日付範囲フィルタリング（start/end パラメータ）を実装
  - タイムゾーン対応の日付処理を実装

- [ ] **API側: /api/controllers/console/app/__init__.py にルート登録を追加**
  - `api.add_resource(WorkflowTokenCostByModelStatistic, "/apps/<uuid:app_id>/workflow/statistics/token-costs-by-model")` を追加
  - インポート文の追加

### 🟡 中優先度

- [ ] **API側: /api/models/model.py と /api/models/workflow.py でテーブル構造確認**
  - Message モデルの `model_provider`, `model_id`, `workflow_run_id`, `message_tokens`, `answer_tokens`, `total_price` フィールド確認
  - ワークフロー関連のリレーションシップ確認

## Phase 2: フロントエンド型定義

### 🔴 高優先度

- [ ] **フロントエンド: /web/models/app.ts に WorkflowTokenCostsByModelResponse と ModelUsageData 型定義を追加**
  - `WorkflowTokenCostsByModelResponse` インターフェースを追加
  - `ModelUsageData` インターフェースを追加
  - 既存の型定義との整合性確認

- [ ] **フロントエンド: /web/service/apps.ts に getWorkflowTokenCostsByModel 関数を追加**
  - SWR Fetcher パターンに従った API クライアント関数を実装
  - 型安全性の確保
  - エラーハンドリングの実装

## Phase 3: コンポーネント実装

### 🔴 高優先度

- [ ] **フロントエンド: /web/app/components/app/overview/appChart.tsx に WorkflowCostByModelChart コンポーネントを実装**
  - SWR を使用したデータフェッチング
  - モデル別データ処理ロジック（`processModelData` 関数）
  - ECharts を使用したスタック型エリアチャートの実装
  - チャートオプションの設定（tooltip, legend, xAxis, yAxis, series）
  - モデル別サマリー表示（最大5モデル）
  - NoData 状態の処理

### 🟡 中優先度

- [ ] **フロントエンド: appChart.tsx の依存関係とインポートを確認・調整**
  - 必要なライブラリのインポート（React, useMemo, SWR, ECharts等）
  - 既存のコンポーネント（Loading, Basic, Chart等）の利用確認
  - COMMON_COLOR_MAP などの定数の利用確認
  - dayjs の日付フォーマット確認

## Phase 4: 統合

### 🔴 高優先度

- [ ] **フロントエンド: /web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx に新しいチャートを統合**
  - `WorkflowCostByModelChart` コンポーネントのインポート追加
  - ワークフロー統計セクションへの組み込み
  - グリッドレイアウトの調整（xl:grid-cols-2 での並列表示）
  - 既存の `WorkflowCostChart` との配置調整

## Phase 5: 国際化

### 🟡 中優先度

- [ ] **国際化: /web/i18n/ja-JP/app-overview.ts に tokenUsageByModel セクションを追加**
  - `analysis.tokenUsageByModel.title`: 'モデル別トークン使用量'
  - `analysis.tokenUsageByModel.explanation`: 'ワークフロー実行時に使用された各LLMモデルのトークン数と費用を表示します。'

- [ ] **国際化: /web/i18n/en-US/app-overview.ts に tokenUsageByModel セクションを追加**
  - `analysis.tokenUsageByModel.title`: 'Token Usage by Model'
  - `analysis.tokenUsageByModel.explanation`: 'Shows token count and cost for each LLM model used during workflow execution.'

## テスト・検証フェーズ

### 🟡 中優先度

- [ ] **テスト: API エンドポイントの動作確認とレスポンス形式の検証**
  - 新しいエンドポイントへのHTTPリクエスト送信
  - レスポンス JSON の構造確認
  - 日付フィルタリングの動作確認
  - エラーケースの処理確認

- [ ] **テスト: フロントエンドチャートの表示とデータフローの確認**
  - チャートの正常な表示確認
  - データの正しい可視化確認
  - インタラクティブ要素（tooltip, legend）の動作確認
  - レスポンシブデザインの確認

- [ ] **テスト: エンドツーエンドの統合テストと UI/UX 確認**
  - ワークフローアプリでの統計表示確認
  - 期間選択機能の動作確認
  - 多言語表示の確認
  - パフォーマンステスト

## 実装時の技術的注意事項

### データベース・API関連
- [ ] `messages` テーブルの `workflow_run_id IS NOT NULL` フィルタリングの確認
- [ ] `model_provider` と `model_id` カラムの存在確認
- [ ] SQLクエリのパフォーマンス最適化
- [ ] タイムゾーン処理の正確性確認

### フロントエンド関連
- [ ] ECharts のバージョン互換性確認
- [ ] useMemo による適切なメモ化の実装
- [ ] SWR キャッシュ戦略の確認
- [ ] カラーパレットの一貫性確認

### パフォーマンス考慮
- [ ] 大量データでのチャート描画性能確認
- [ ] API レスポンス時間の最適化
- [ ] フロントエンドでのデータ変換効率化
- [ ] 適切なローディング状態の実装

## 完了基準

各タスクの完了基準を明確に定義：

1. **API実装**: エンドポイントが正常に動作し、期待するJSON形式でデータを返却
2. **型定義**: TypeScriptエラーなく、型安全にデータが扱える
3. **コンポーネント**: チャートが正しく表示され、インタラクティブ機能が動作
4. **統合**: 既存のワークフロー統計ページで新しいチャートが表示される
5. **国際化**: 日本語・英語で適切に翻訳された文字列が表示される
6. **テスト**: 全ての機能が期待通りに動作し、エラーがない

## 推定作業時間

- **Phase 1 (API実装)**: 2-3時間
- **Phase 2 (型定義)**: 1時間
- **Phase 3 (コンポーネント)**: 4-5時間
- **Phase 4 (統合)**: 1時間
- **Phase 5 (国際化)**: 30分
- **テスト・検証**: 2-3時間

**合計推定時間**: 10-13時間

## 次のステップ

1. Phase 1 から順次開始
2. 各フェーズ完了後に動作確認を実施
3. 問題が発生した場合は該当フェーズ内で解決
4. 全フェーズ完了後に総合テストを実施