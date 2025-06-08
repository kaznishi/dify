# CostChart調査レポート

## 概要

Dify の `/app/[app_id]/overview` ページに表示されるCostChartコンポーネントについて、以下の観点から詳細調査を実施しました：

1. コンポーネントの実装場所の特定
2. SWRライブラリの理解
3. WebとAPIの処理フロー分析
4. Messagesテーブル構造の確認
5. LLMモデル別トークン使用量表示機能の存在確認

## 調査結果

### 1. CostChartコンポーネントの実装場所

#### メインファイル
- **ページコンポーネント**: `/web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/page.tsx`
- **チャートビューコンポーネント**: `/web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx`
- **チャート実装**: `/web/app/components/app/overview/appChart.tsx`

#### 表示条件
```typescript
// 通常のアプリの場合 (chartView.tsx:84行目)
{!isWorkflow && (
  <div className='mb-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2'>
    <UserSatisfactionRate period={period} id={appId} />
    <CostChart period={period} id={appId} />  // ← ここで表示
  </div>
)}

// ワークフローアプリの場合 (chartView.tsx:100行目)
{isWorkflow && (
  <div className='mb-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2'>
    <WorkflowCostChart period={period} id={appId} />  // ← ワークフロー専用
    <AvgUserInteractions period={period} id={appId} />
  </div>
)}
```

### 2. SWRライブラリについて

**SWR (Stale-While-Revalidate)**は、Vercel社開発のReact向けデータフェッチングライブラリです。

#### 主な特徴
- **キャッシュファースト**: まずキャッシュからデータを返し、バックグラウンドで最新データを取得
- **自動再検証**: フォーカス時、インターバルでの自動データ更新
- **重複リクエスト排除**: 同じキーでの重複リクエストを防ぐ
- **エラーハンドリング**: 組み込まれたエラー処理とリトライ機能

#### CostChartでの使用例
```typescript
// appChart.tsx:377行目
const { data: response } = useSWR(
  { url: `/apps/${id}/statistics/token-costs`, params: period.query }, 
  getAppTokenCosts
)
```

### 3. WebとAPIの処理フロー

#### 全体的なデータフロー
```
[ユーザー画面]
    ↓ (1) CostChartコンポーネントレンダリング
[Web: CostChart]
    ↓ (2) useSWRでデータフェッチ開始
[Web: getAppTokenCosts]
    ↓ (3) GET /apps/{id}/statistics/token-costs
[API: DailyTokenCostStatistic]
    ↓ (4) 権限チェック & パラメータ検証
[API: SQLクエリ実行]
    ↓ (5) messagesテーブルから日次集計
[PostgreSQL Database]
    ↓ (6) 集計結果を返却
[API → Web]
    ↓ (7) JSONレスポンス
[Web: CostChart]
    ↓ (8) EChartsでグラフ描画
[ユーザー画面]
```

#### APIエンドポイント詳細

**ファイル**: `/api/controllers/console/app/statistic.py`

**エンドポイント**: 
- 通常アプリ: `GET /apps/<uuid:app_id>/statistics/token-costs`
- ワークフロー: `GET /apps/<uuid:app_id>/workflow/statistics/token-costs`

**認証・権限**:
```python
@login_required
@account_initialization_required
@get_app_model
def get(self, app_model):
```

**SQLクエリ（概要）**:
```sql
SELECT 
    DATE(created_at) as date,
    SUM(message_tokens + answer_tokens) as token_count,
    SUM(total_price) as total_price
FROM messages
WHERE app_id = :app_id
  AND created_at >= :start_datetime
  AND created_at < :end_datetime
GROUP BY DATE(created_at)
ORDER BY date
```

**レスポンス形式**:
```json
{
  "data": [
    {
      "date": "2025-01-01",
      "token_count": 5432,
      "total_price": 0.1234,
      "currency": "USD"
    }
  ]
}
```

### 4. Messagesテーブル構造

#### トークン・価格関連の主要カラム

| カラム名 | データ型 | 説明 | デフォルト値 |
|---------|---------|------|-------------|
| **id** | StringUUID | プライマリキー | - |
| **app_id** | StringUUID | アプリケーションID | - |
| **created_at** | DateTime | 作成日時 | - |
| **message_tokens** | Integer | メッセージのトークン数 | 0 |
| **answer_tokens** | Integer | 回答のトークン数 | 0 |
| **total_price** | Numeric(10,7) | 合計価格 | NULL |
| **currency** | String(255) | 通貨 | - |

#### モデル情報カラム（**重要**: 現在統計で未使用）

| カラム名 | データ型 | 説明 |
|---------|---------|------|
| **model_provider** | String(255) | モデルプロバイダー名（OpenAI、Anthropicなど） |
| **model_id** | String(255) | モデルID（gpt-4、claude-3など） |

#### その他の関連カラム
- `message_unit_price`: Numeric(10,4) - メッセージの単価
- `message_price_unit`: Numeric(10,7) - メッセージの価格単位（デフォルト: 0.001）
- `answer_unit_price`: Numeric(10,4) - 回答の単価  
- `answer_price_unit`: Numeric(10,7) - 回答の価格単位（デフォルト: 0.001）

#### 重要なインデックス
- `message_app_id_idx`: (app_id, created_at)
- `message_created_at_idx`: (created_at)
- その他会話、ユーザー、ワークフロー関連のインデックス

### 5. LLMモデル別トークン使用量表示機能の調査結果

#### **結論: 現在実装されていない**

#### 調査範囲
1. **APIエンドポイント**: 全統計エンドポイントを確認
2. **データベーススキーマ**: Messagesテーブルの詳細分析
3. **フロントエンドUI**: 全チャートコンポーネントを調査
4. **ビジネスロジック**: 統計処理の実装確認

#### 現在の実装状況

**✅ データは保存されている**:
- `messages.model_provider` (VARCHAR(255))
- `messages.model_id` (VARCHAR(255))

**❌ 統計機能は未実装**:
- モデルプロバイダー別のトークン使用量統計
- モデルID別のトークン使用量統計
- モデル別のコスト分析
- モデル別の使用量ランキング
- モデル別のパフォーマンス比較

#### 確認した統計エンドポイント（すべてモデル別集計なし）

1. `DailyTokenCostStatistic` - 日次トークンコスト
2. `WorkflowDailyTokenCostStatistic` - ワークフロー日次トークンコスト
3. `DailyMessageStatistic` - 日次メッセージ数
4. `DailyConversationStatistic` - 日次会話数
5. `DailyTerminalsStatistic` - 日次ターミナル数
6. `AverageSessionInteractionStatistic` - 平均セッションインタラクション
7. `UserSatisfactionRateStatistic` - ユーザー満足度

**すべてのエンドポイントで `model_provider` や `model_id` による集計は実装されていません。**

#### 現在のSQLクエリ例
```sql
-- 現在の実装（モデル別集計なし）
SELECT 
    DATE(created_at) as date,
    SUM(message_tokens + answer_tokens) as token_count,
    SUM(total_price) as total_price
FROM messages 
WHERE app_id = :app_id
GROUP BY DATE(created_at)

-- もしモデル別集計を実装する場合の例
SELECT 
    DATE(created_at) as date,
    model_provider,
    model_id,
    SUM(message_tokens + answer_tokens) as token_count,
    SUM(total_price) as total_price
FROM messages 
WHERE app_id = :app_id
GROUP BY DATE(created_at), model_provider, model_id
```

#### フロントエンド実装状況

**現在のデータ型**:
```typescript
AppTokenCostsResponse = {
  data: Array<{ 
    date: string; 
    token_count: number; 
    total_price: number; 
    currency: string 
  }>
}
```

**モデル別表示に必要なデータ型（未実装）**:
```typescript
ModelSpecificTokenCostsResponse = {
  data: Array<{ 
    date: string;
    model_provider: string;
    model_id: string;
    token_count: number; 
    total_price: number; 
    currency: string 
  }>
}
```

## 技術的な実装の詳細

### チャートライブラリ
- **ECharts**: `echarts-for-react`を使用
- **グラフタイプ**: 折れ線グラフ + 面グラフ
- **色設定**: 青色系（`COLOR_TYPE_MAP.blue`）

### パフォーマンス最適化
- **SWR**: キャッシュによる高速レスポンス
- **データベースインデックス**: 効率的なクエリ実行
- **日次集計**: リアルタイム計算ではなく日次での事前集計

### 国際化対応
- **多言語対応**: i18nによる翻訳機能
- **タイムゾーン対応**: ユーザーのタイムゾーンに基づく日付集計

## 推奨される今後の改善点

### 1. モデル別統計機能の実装

#### APIエンドポイント拡張
```python
# 新しいエンドポイント例
@api.route('/apps/<uuid:app_id>/statistics/token-costs-by-model')
class ModelSpecificTokenCostStatistic(Resource):
    def get(self, app_model):
        # model_provider, model_id別の集計実装
        pass
```

#### フロントエンド拡張
- モデル選択UI
- スタック型チャート
- モデル別比較ビュー

### 2. 詳細分析機能
- 時間別使用量分析
- コスト効率分析
- 使用量予測機能

### 3. アラート機能
- 使用量しきい値アラート
- コスト予算アラート
- 異常使用量検知

## まとめ

この調査により、DifyのCostChartコンポーネントの実装が詳細に明らかになりました。現在の実装は堅牢で効率的ですが、LLMモデル別の詳細分析機能は実装されておらず、今後の機能拡張の余地が大きいことが確認されました。

データベースにはモデル情報が保存されているため、適切なAPIエンドポイントとフロントエンドUIの追加により、モデル別統計機能を実装することが可能です。

---

**調査実施日**: 2025年6月8日  
**調査者**: Claude Code  
**調査対象**: Dify v1.4.1 (from-1.4.1ブランチ)