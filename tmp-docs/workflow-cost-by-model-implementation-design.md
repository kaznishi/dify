# WorkflowCostByModelChart 完全実装設計

## 1. API側実装設計

### 新しいエンドポイント

**ファイル**: `/api/controllers/console/app/workflow_statistic.py`

```python
class WorkflowTokenCostByModelStatistic(Resource):
    @setup_required
    @login_required
    @account_initialization_required
    @get_app_model(mode=[AppMode.WORKFLOW])
    def get(self, app_model):
        account = current_user

        parser = reqparse.RequestParser()
        parser.add_argument("start", type=DatetimeString("%Y-%m-%d %H:%M"), location="args")
        parser.add_argument("end", type=DatetimeString("%Y-%m-%d %H:%M"), location="args")
        args = parser.parse_args()

        # メッセージテーブルからワークフロー関連のモデル別統計を取得
        sql_query = """SELECT
    DATE(DATE_TRUNC('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE :tz )) AS date,
    model_provider,
    model_id,
    SUM(message_tokens + answer_tokens) AS token_count,
    SUM(total_price) AS total_price,
    'USD' as currency
FROM
    messages
WHERE
    app_id = :app_id
    AND workflow_run_id IS NOT NULL"""

        arg_dict = {
            "tz": account.timezone,
            "app_id": app_model.id,
        }

        timezone = pytz.timezone(account.timezone)
        utc_timezone = pytz.utc

        if args["start"]:
            start_datetime = datetime.strptime(args["start"], "%Y-%m-%d %H:%M")
            start_datetime = start_datetime.replace(second=0)
            start_datetime_timezone = timezone.localize(start_datetime)
            start_datetime_utc = start_datetime_timezone.astimezone(utc_timezone)
            sql_query += " AND created_at >= :start"
            arg_dict["start"] = start_datetime_utc

        if args["end"]:
            end_datetime = datetime.strptime(args["end"], "%Y-%m-%d %H:%M")
            end_datetime = end_datetime.replace(second=0)
            end_datetime_timezone = timezone.localize(end_datetime)
            end_datetime_utc = end_datetime_timezone.astimezone(utc_timezone)
            sql_query += " AND created_at < :end"
            arg_dict["end"] = end_datetime_utc

        sql_query += " GROUP BY date, model_provider, model_id ORDER BY date, model_provider, model_id"

        response_data = []
        with db.engine.begin() as conn:
            rs = conn.execute(db.text(sql_query), arg_dict)
            for i in rs:
                response_data.append({
                    "date": str(i.date),
                    "model_provider": i.model_provider,
                    "model_id": i.model_id,
                    "token_count": i.token_count or 0,
                    "total_price": float(i.total_price or 0),
                    "currency": i.currency
                })

        return jsonify({"data": response_data})
```

**エンドポイントルート追加**:
```python
api.add_resource(WorkflowTokenCostByModelStatistic, "/apps/<uuid:app_id>/workflow/statistics/token-costs-by-model")
```

## 2. TypeScript型定義

**ファイル**: `/web/models/app.ts`

```typescript
// 既存の型に追加
export interface WorkflowTokenCostsByModelResponse {
  data: Array<{
    date: string
    model_provider: string
    model_id: string
    token_count: number
    total_price: number
    currency: string
  }>
}

export interface ModelUsageData {
  modelKey: string  // `${model_provider}/${model_id}`の形式
  model_provider: string
  model_id: string
  color: string
  data: Array<{
    date: string
    token_count: number
    total_price: number
  }>
}
```

## 3. フロントエンド サービス実装

**ファイル**: `/web/service/apps.ts`

```typescript
export const getWorkflowTokenCostsByModel: Fetcher<WorkflowTokenCostsByModelResponse, { url: string; params: Record<string, any> }> = ({ url, params }) => {
  return get<WorkflowTokenCostsByModelResponse>(url, { params })
}
```

## 4. WorkflowCostByModelChart コンポーネント

**ファイル**: `/web/app/components/app/overview/appChart.tsx`

```typescript
export const WorkflowCostByModelChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()

  const { data: response } = useSWR(
    { url: `/apps/${id}/workflow/statistics/token-costs-by-model`, params: period.query },
    getWorkflowTokenCostsByModel
  )

  if (!response)
    return <Loading />

  const noDataFlag = !response.data || response.data.length === 0

  // データをモデル別に整理
  const processModelData = (data: WorkflowTokenCostsByModelResponse['data']): ModelUsageData[] => {
    const modelMap = new Map<string, ModelUsageData>()
    const colors = ['#FF8A4C', '#1C64F2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']
    let colorIndex = 0

    data.forEach((item) => {
      const modelKey = `${item.model_provider}/${item.model_id}`

      if (!modelMap.has(modelKey)) {
        modelMap.set(modelKey, {
          modelKey,
          model_provider: item.model_provider,
          model_id: item.model_id,
          color: colors[colorIndex % colors.length],
          data: []
        })
        colorIndex++
      }

      modelMap.get(modelKey)!.data.push({
        date: item.date,
        token_count: item.token_count,
        total_price: item.total_price
      })
    })

    return Array.from(modelMap.values())
  }

  const modelData = processModelData(response.data)

  // EChartsオプション（スタック型エリアチャート）
  const chartOptions = useMemo(() => {
    const allDates = [...new Set(response.data.map(item => item.date))].sort()

    return {
      dataset: {
        source: response.data
      },
      grid: { top: 40, right: 36, bottom: 60, left: 60, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          let content = `<div style='color:#6B7280;font-size:12px;margin-bottom:4px'>${params[0].name}</div>`

          let totalTokens = 0
          let totalPrice = 0

          params.forEach((param: any) => {
            const tokenCount = param.data.token_count || 0
            const price = param.data.total_price || 0
            totalTokens += tokenCount
            totalPrice += price

            content += `
              <div style='margin-bottom:2px'>
                <span style='display:inline-block;width:10px;height:10px;background:${param.color};margin-right:8px'></span>
                <span style='color:#1F2A37'>${param.seriesName}</span>
                <span style='float:right;margin-left:20px;color:#1F2A37'>${tokenCount.toLocaleString()} tokens</span>
              </div>
            `
          })

          content += `
            <div style='border-top:1px solid #E5E7EB;margin-top:8px;padding-top:4px'>
              <span style='color:#1F2A37;font-weight:500'>Total: ${totalTokens.toLocaleString()} tokens (~$${totalPrice.toFixed(4)})</span>
            </div>
          `

          return content
        }
      },
      legend: {
        data: modelData.map(model => `${model.model_provider}/${model.model_id}`),
        bottom: 0,
        type: 'scroll'
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          color: COMMON_COLOR_MAP.label,
          formatter: (value: string) => dayjs(value).format('MMM D')
        },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: COMMON_COLOR_MAP.label,
          formatter: (value: number) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value.toString()
        },
        splitLine: {
          lineStyle: { color: COMMON_COLOR_MAP.splitLineLight }
        }
      },
      series: modelData.map((model) => ({
        name: `${model.model_provider}/${model.model_id}`,
        type: 'line',
        stack: 'tokens',
        areaStyle: { opacity: 0.6 },
        lineStyle: { width: 2, color: model.color },
        itemStyle: { color: model.color },
        data: allDates.map(date => {
          const item = model.data.find(d => d.date === date)
          return item ? item.token_count : 0
        })
      }))
    }
  }, [response.data, modelData])

  // 合計統計の計算
  const totalTokens = response.data.reduce((sum, item) => sum + item.token_count, 0)
  const totalPrice = response.data.reduce((sum, item) => sum + item.total_price, 0)

  if (noDataFlag) {
    return <Chart
      basicInfo={{
        title: t('appOverview.analysis.tokenUsageByModel.title'),
        explanation: t('appOverview.analysis.tokenUsageByModel.explanation'),
        timePeriod: period.name
      }}
      chartData={{ data: getDefaultChartData(period.query ?? defaultPeriod) }}
      chartType='workflowCosts'
      yMax={100}
    />
  }

  return (
    <div className="flex w-full flex-col rounded-xl bg-components-chart-bg px-6 py-4 shadow-xs">
      <div className='mb-3'>
        <Basic
          name={t('appOverview.analysis.tokenUsageByModel.title')}
          type={period.name}
          hoverTip={t('appOverview.analysis.tokenUsageByModel.explanation')}
        />
      </div>

      <div className='mb-4 flex-1'>
        <Basic
          name={`${totalTokens.toLocaleString()} tokens`}
          type={
            <span>
              <span className='ml-1 text-text-tertiary'>(</span>
              <span className='text-orange-400'>~${totalPrice.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 4
              })}</span>
              <span className='text-text-tertiary'>)</span>
            </span>
          }
          textStyle={{ main: `!text-3xl !font-normal ${totalTokens === 0 ? '!text-text-quaternary' : ''}` }}
        />
      </div>

      <ReactECharts option={chartOptions} style={{ height: 200 }} />

      {/* モデル別サマリー */}
      <div className="mt-4 space-y-2">
        {modelData.slice(0, 5).map((model) => {
          const modelTotal = model.data.reduce((sum, item) => sum + item.token_count, 0)
          const modelPrice = model.data.reduce((sum, item) => sum + item.total_price, 0)
          const percentage = totalTokens > 0 ? (modelTotal / totalTokens * 100).toFixed(1) : '0'

          return (
            <div key={model.modelKey} className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded mr-2"
                  style={{ backgroundColor: model.color }}
                />
                <span className="text-text-secondary">{model.model_id}</span>
              </div>
              <div className="text-text-primary">
                {modelTotal.toLocaleString()} tokens ({percentage}%)
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

## 5. チャートビューへの統合

**ファイル**: `/web/app/(commonLayout)/app/(appDetailLayout)/[appId]/overview/chartView.tsx`

```typescript
// インポートに追加
import { WorkflowCostByModelChart } from '@/app/components/app/overview/appChart'

// 98-103行目を以下に置換
{isWorkflow && (
  <div className='mb-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2'>
    <WorkflowCostChart period={period} id={appId} />
    <WorkflowCostByModelChart period={period} id={appId} />  {/* 新しいコンポーネント */}
  </div>
)}
{isWorkflow && (
  <div className='mb-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2'>
    <AvgUserInteractions period={period} id={appId} />
  </div>
)}
```

## 6. 国際化対応

**ファイル**: `/web/i18n/ja-JP/app-overview.ts`

```typescript
// analysis セクションに追加
tokenUsageByModel: {
  title: 'モデル別トークン使用量',
  explanation: 'ワークフロー実行時に使用された各LLMモデルのトークン数と費用を表示します。'
}
```

**ファイル**: `/web/i18n/en-US/app-overview.ts`

```typescript
// analysis セクションに追加
tokenUsageByModel: {
  title: 'Token Usage by Model',
  explanation: 'Shows token count and cost for each LLM model used during workflow execution.'
}
```

## 7. 実装のポイント

### データ構造の最適化
- モデル別にデータを整理してスタック型チャートで表示
- 最大5つのモデルをサマリーで表示
- 色分けによる視覚的な区別

### パフォーマンス考慮
- useMemoでチャートオプションをメモ化
- SWRによるキャッシング
- 効率的なSQLクエリ

### ユーザビリティ
- ツールチップで詳細情報表示
- 凡例によるモデル選択
- パーセンテージ表示

この設計により、ワークフローアプリでモデル別のトークン使用量を詳細に分析できる機能が実装できます。

## 実装チェックリスト

- ☑ API側の実装設計を作成
- ☑ フロントエンド側の実装設計を作成
- ☑ データベースクエリの設計
- ☑ TypeScript型定義の設計
- ☑ UIデザインとチャート表示方法の検討

## 実装設計完了

WorkflowCostByModelChartの包括的な実装設計が完成しました。

### 主要な設計決定

1. **データソース**: messagesテーブルを使用
   - workflow_run_id IS NOT NULLでワークフロー関連のメッセージをフィルタ
   - model_providerとmodel_idで詳細なモデル情報を取得

2. **APIエンドポイント**: `/apps/{id}/workflow/statistics/token-costs-by-model`
   - 既存のワークフロー統計パターンに従った実装
   - 日付、モデル別にグループ化されたデータを返却

3. **チャート表示**: スタック型エリアチャート
   - モデル別の色分け表示
   - インタラクティブなツールチップ
   - モデル別使用量サマリー

4. **統合**: chartView.tsxのisWorkflowセクションに追加
   - 既存のWorkflowCostChartと並行表示
   - レスポンシブ対応のグリッドレイアウト

### 実装順序の推奨

1. **API側から開始**: データベーススキーマが既に対応済み
2. **型定義の追加**: フロントエンドとのインターフェース定義
3. **チャートコンポーネント**: 既存パターンを参考に実装
4. **統合とテスト**: chartViewへの組み込み

この設計により、ワークフローアプリでのモデル別トークン使用量分析が実現し、ユーザーは各LLMモデルのコストパフォーマンスを詳細に把握できるようになります。