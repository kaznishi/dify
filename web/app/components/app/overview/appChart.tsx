'use client'
import type { FC } from 'react'
import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import useSWR from 'swr'
import dayjs from 'dayjs'
import { get } from 'lodash-es'
import Decimal from 'decimal.js'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'
import Basic from '@/app/components/app-sidebar/basic'
import Loading from '@/app/components/base/loading'
import type { AppDailyConversationsResponse, AppDailyEndUsersResponse, AppDailyMessagesResponse, AppTokenCostsResponse, ModelUsageData, WorkflowTokenCostsByModelResponse } from '@/models/app'
import { getAppDailyConversations, getAppDailyEndUsers, getAppDailyMessages, getAppStatistics, getAppTokenCosts, getWorkflowDailyConversations, getWorkflowTokenCostsByModel } from '@/service/apps'
const valueFormatter = (v: string | number) => v

const COLOR_TYPE_MAP = {
  green: {
    lineColor: 'rgba(6, 148, 162, 1)',
    bgColor: ['rgba(6, 148, 162, 0.2)', 'rgba(67, 174, 185, 0.08)'],
  },
  orange: {
    lineColor: 'rgba(255, 138, 76, 1)',
    bgColor: ['rgba(254, 145, 87, 0.2)', 'rgba(255, 138, 76, 0.1)'],
  },
  blue: {
    lineColor: 'rgba(28, 100, 242, 1)',
    bgColor: ['rgba(28, 100, 242, 0.3)', 'rgba(28, 100, 242, 0.1)'],
  },
}

const COMMON_COLOR_MAP = {
  label: '#9CA3AF',
  splitLineLight: '#F3F4F6',
  splitLineDark: '#E5E7EB',
}

type IColorType = 'green' | 'orange' | 'blue'
type IChartType = 'messages' | 'conversations' | 'endUsers' | 'costs' | 'workflowCosts'
type IChartConfigType = { colorType: IColorType; showTokens?: boolean }

const commonDateFormat = 'MMM D, YYYY'

const CHART_TYPE_CONFIG: Record<string, IChartConfigType> = {
  messages: {
    colorType: 'green',
  },
  conversations: {
    colorType: 'green',
  },
  endUsers: {
    colorType: 'orange',
  },
  costs: {
    colorType: 'blue',
    showTokens: true,
  },
  workflowCosts: {
    colorType: 'blue',
  },
}

const sum = (arr: Decimal.Value[]): number => {
  return Decimal.sum(...arr).toNumber()
}

const defaultPeriod = {
  start: dayjs().subtract(7, 'day').format(commonDateFormat),
  end: dayjs().format(commonDateFormat),
}

export type PeriodParams = {
  name: string
  query?: {
    start: string
    end: string
  }
}

export type IBizChartProps = {
  period: PeriodParams
  id: string
}

export type IChartProps = {
  className?: string
  basicInfo: { title: string; explanation: string; timePeriod: string }
  valueKey?: string
  isAvg?: boolean
  unit?: string
  yMax?: number
  chartType: IChartType
  chartData: AppDailyMessagesResponse | AppDailyConversationsResponse | AppDailyEndUsersResponse | AppTokenCostsResponse | { data: Array<{ date: string; count: number }> }
}

const Chart: React.FC<IChartProps> = ({
  basicInfo: { title, explanation, timePeriod },
  chartType = 'conversations',
  chartData,
  valueKey,
  isAvg,
  unit = '',
  yMax,
  className,
}) => {
  const { t } = useTranslation()
  const statistics = chartData.data
  const statisticsLen = statistics.length
  const extraDataForMarkLine = new Array(statisticsLen >= 2 ? statisticsLen - 2 : statisticsLen).fill('1')
  extraDataForMarkLine.push('')
  extraDataForMarkLine.unshift('')

  const xData = statistics.map(({ date }) => date)
  const yField = valueKey || Object.keys(statistics[0]).find(name => name.includes('count')) || ''
  const yData = statistics.map((item) => {
    // @ts-expect-error field is valid
    return item[yField] || 0
  })

  const options: EChartsOption = {
    dataset: {
      dimensions: ['date', yField],
      source: statistics,
    },
    grid: { top: 8, right: 36, bottom: 0, left: 0, containLabel: true },
    tooltip: {
      trigger: 'item',
      position: 'top',
      borderWidth: 0,
    },
    xAxis: [{
      type: 'category',
      boundaryGap: false,
      axisLabel: {
        color: COMMON_COLOR_MAP.label,
        hideOverlap: true,
        overflow: 'break',
        formatter(value) {
          return dayjs(value).format(commonDateFormat)
        },
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          color: COMMON_COLOR_MAP.splitLineLight,
          width: 1,
          type: [10, 10],
        },
        interval(index) {
          return index === 0 || index === xData.length - 1
        },
      },
    }, {
      position: 'bottom',
      boundaryGap: false,
      data: extraDataForMarkLine,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        show: true,
        lineStyle: {
          color: COMMON_COLOR_MAP.splitLineDark,
        },
        interval(index, value) {
          return !!value
        },
      },
    }],
    yAxis: {
      max: yMax ?? 'dataMax',
      type: 'value',
      axisLabel: { color: COMMON_COLOR_MAP.label, hideOverlap: true },
      splitLine: {
        lineStyle: {
          color: COMMON_COLOR_MAP.splitLineLight,
        },
      },
    },
    series: [
      {
        type: 'line',
        showSymbol: true,
        // symbol: 'circle',
        // triggerLineEvent: true,
        symbolSize: 4,
        lineStyle: {
          color: COLOR_TYPE_MAP[CHART_TYPE_CONFIG[chartType].colorType].lineColor,
          width: 2,
        },
        itemStyle: {
          color: COLOR_TYPE_MAP[CHART_TYPE_CONFIG[chartType].colorType].lineColor,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: COLOR_TYPE_MAP[CHART_TYPE_CONFIG[chartType].colorType].bgColor[0],
            }, {
              offset: 1, color: COLOR_TYPE_MAP[CHART_TYPE_CONFIG[chartType].colorType].bgColor[1],
            }],
            global: false,
          },
        },
        tooltip: {
          padding: [8, 12, 8, 12],
          formatter(params) {
            return `<div style='color:#6B7280;font-size:12px'>${params.name}</div>
                          <div style='font-size:14px;color:#1F2A37'>${valueFormatter((params.data as any)[yField])}
                              ${!CHART_TYPE_CONFIG[chartType].showTokens
                                ? ''
                                : `<span style='font-size:12px'>
                                  <span style='margin-left:4px;color:#6B7280'>(</span>
                                  <span style='color:#FF8A4C'>~$${get(params.data, 'total_price', 0)}</span>
                                  <span style='color:#6B7280'>)</span>
                              </span>`}
                          </div>`
          },
        },
      },
    ],
  }
  const sumData = isAvg ? (sum(yData) / yData.length) : sum(yData)

  return (
    <div className={`flex w-full flex-col rounded-xl bg-components-chart-bg px-6 py-4 shadow-xs ${className ?? ''}`}>
      <div className='mb-3'>
        <Basic name={title} type={timePeriod} hoverTip={explanation} />
      </div>
      <div className='mb-4 flex-1'>
        <Basic
          isExtraInLine={CHART_TYPE_CONFIG[chartType].showTokens}
          name={chartType !== 'costs' ? (`${sumData.toLocaleString()} ${unit}`) : `${sumData < 1000 ? sumData : (`${formatNumber(Math.round(sumData / 1000))}k`)}`}
          type={!CHART_TYPE_CONFIG[chartType].showTokens
            ? ''
            : <span>{t('appOverview.analysis.tokenUsage.consumed')} Tokens<span className='text-sm'>
              <span className='ml-1 text-text-tertiary'>(</span>
              <span className='text-orange-400'>~{sum(statistics.map(item => Number.parseFloat(get(item, 'total_price', '0')))).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })}</span>
              <span className='text-text-tertiary'>)</span>
            </span></span>}
          textStyle={{ main: `!text-3xl !font-normal ${sumData === 0 ? '!text-text-quaternary' : ''}` }} />
      </div>
      <ReactECharts option={options} style={{ height: 160 }} />
    </div>
  )
}

const getDefaultChartData = ({ start, end, key = 'count' }: { start: string; end: string; key?: string }) => {
  const diffDays = dayjs(end).diff(dayjs(start), 'day')
  return Array.from({ length: diffDays || 1 }, () => ({ date: '', [key]: 0 })).map((item, index) => {
    item.date = dayjs(start).add(index, 'day').format(commonDateFormat)
    return item
  })
}

export const MessagesChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/statistics/daily-messages`, params: period.query }, getAppDailyMessages)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.totalMessages.title'), explanation: t('appOverview.analysis.totalMessages.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData(period.query ?? defaultPeriod) }}
    chartType='messages'
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const ConversationsChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/statistics/daily-conversations`, params: period.query }, getAppDailyConversations)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.totalConversations.title'), explanation: t('appOverview.analysis.totalConversations.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData(period.query ?? defaultPeriod) }}
    chartType='conversations'
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const EndUsersChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()

  const { data: response } = useSWR({ url: `/apps/${id}/statistics/daily-end-users`, id, params: period.query }, getAppDailyEndUsers)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.activeUsers.title'), explanation: t('appOverview.analysis.activeUsers.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData(period.query ?? defaultPeriod) }}
    chartType='endUsers'
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const AvgSessionInteractions: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/statistics/average-session-interactions`, params: period.query }, getAppStatistics)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.avgSessionInteractions.title'), explanation: t('appOverview.analysis.avgSessionInteractions.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData({ ...(period.query ?? defaultPeriod), key: 'interactions' }) } as any}
    chartType='conversations'
    valueKey='interactions'
    isAvg
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const AvgResponseTime: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/statistics/average-response-time`, params: period.query }, getAppStatistics)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.avgResponseTime.title'), explanation: t('appOverview.analysis.avgResponseTime.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData({ ...(period.query ?? defaultPeriod), key: 'latency' }) } as any}
    valueKey='latency'
    chartType='conversations'
    isAvg
    unit={t('appOverview.analysis.ms') as string}
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const TokenPerSecond: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/statistics/tokens-per-second`, params: period.query }, getAppStatistics)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.tps.title'), explanation: t('appOverview.analysis.tps.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData({ ...(period.query ?? defaultPeriod), key: 'tps' }) } as any}
    valueKey='tps'
    chartType='conversations'
    isAvg
    unit={t('appOverview.analysis.tokenPS') as string}
    {...(noDataFlag && { yMax: 100 })}
    className="min-w-0"
  />
}

export const UserSatisfactionRate: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/statistics/user-satisfaction-rate`, params: period.query }, getAppStatistics)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.userSatisfactionRate.title'), explanation: t('appOverview.analysis.userSatisfactionRate.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData({ ...(period.query ?? defaultPeriod), key: 'rate' }) } as any}
    valueKey='rate'
    chartType='endUsers'
    isAvg
    {...(noDataFlag && { yMax: 1000 })}
    className='h-full'
  />
}

export const CostChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()

  const { data: response } = useSWR({ url: `/apps/${id}/statistics/token-costs`, params: period.query }, getAppTokenCosts)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.tokenUsage.title'), explanation: t('appOverview.analysis.tokenUsage.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData(period.query ?? defaultPeriod) }}
    chartType='costs'
    {...(noDataFlag && { yMax: 100 })}
  />
}

export const WorkflowMessagesChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/workflow/statistics/daily-conversations`, params: period.query }, getWorkflowDailyConversations)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.totalMessages.title'), explanation: t('appOverview.analysis.totalMessages.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData({ ...(period.query ?? defaultPeriod), key: 'runs' }) }}
    chartType='conversations'
    valueKey='runs'
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const WorkflowDailyTerminalsChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()

  const { data: response } = useSWR({ url: `/apps/${id}/workflow/statistics/daily-terminals`, id, params: period.query }, getAppDailyEndUsers)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.activeUsers.title'), explanation: t('appOverview.analysis.activeUsers.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData(period.query ?? defaultPeriod) }}
    chartType='endUsers'
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const WorkflowCostChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()

  const { data: response } = useSWR({ url: `/apps/${id}/workflow/statistics/token-costs`, params: period.query }, getAppTokenCosts)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.tokenUsage.title'), explanation: t('appOverview.analysis.tokenUsage.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData(period.query ?? defaultPeriod) }}
    chartType='workflowCosts'
    {...(noDataFlag && { yMax: 100 })}
  />
}

export const AvgUserInteractions: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()
  const { data: response } = useSWR({ url: `/apps/${id}/workflow/statistics/average-app-interactions`, params: period.query }, getAppStatistics)
  if (!response)
    return <Loading />
  const noDataFlag = !response.data || response.data.length === 0
  return <Chart
    basicInfo={{ title: t('appOverview.analysis.avgUserInteractions.title'), explanation: t('appOverview.analysis.avgUserInteractions.explanation'), timePeriod: period.name }}
    chartData={!noDataFlag ? response : { data: getDefaultChartData({ ...(period.query ?? defaultPeriod), key: 'interactions' }) } as any}
    chartType='conversations'
    valueKey='interactions'
    isAvg
    {...(noDataFlag && { yMax: 500 })}
  />
}

export const WorkflowCostByModelChart: FC<IBizChartProps> = ({ id, period }) => {
  const { t } = useTranslation()

  const { data: response } = useSWR(
    { url: `/apps/${id}/workflow/statistics/token-costs-by-model`, params: period.query },
    getWorkflowTokenCostsByModel,
  )

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
          data: [],
        })
        colorIndex++
      }

      modelMap.get(modelKey)!.data.push({
        date: item.date,
        token_count: item.token_count,
      })
    })

    return Array.from(modelMap.values())
  }

  // EChartsオプション（スタック型エリアチャート）
  const chartOptions = useMemo(() => {
    if (!response?.data) return {}

    const modelData = processModelData(response.data)
    const allDates = [...new Set(response.data.map(item => item.date))].sort()

    return {
      dataset: {
        source: response.data,
      },
      grid: { top: 40, right: 36, bottom: 60, left: 60, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          let content = `<div style='color:#6B7280;font-size:12px;margin-bottom:4px'>${params[0].name}</div>`

          let totalTokens = 0

          params.forEach((param: any) => {
            const tokenCount = param.data.token_count || 0
            totalTokens += tokenCount

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
              <span style='color:#1F2A37;font-weight:500'>Total: ${totalTokens.toLocaleString()} tokens</span>
            </div>
          `

          return content
        },
      },
      legend: {
        data: modelData.map(model => `${model.model_provider}/${model.model_id}`),
        bottom: 0,
        type: 'scroll',
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          color: COMMON_COLOR_MAP.label,
          formatter: (value: string) => dayjs(value).format('MMM D'),
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: COMMON_COLOR_MAP.label,
          formatter: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString(),
        },
        splitLine: {
          lineStyle: { color: COMMON_COLOR_MAP.splitLineLight },
        },
      },
      series: modelData.map(model => ({
        name: `${model.model_provider}/${model.model_id}`,
        type: 'line',
        stack: 'tokens',
        areaStyle: { opacity: 0.6 },
        lineStyle: { width: 2, color: model.color },
        itemStyle: { color: model.color },
        data: allDates.map((date) => {
          const item = model.data.find(d => d.date === date)
          return item ? item.token_count : 0
        }),
      })),
    }
  }, [response])

  if (!response)
    return <Loading />

  const noDataFlag = !response.data || response.data.length === 0

  // 合計統計の計算
  const totalTokens = response.data.reduce((sum, item) => sum + item.token_count, 0)

  if (noDataFlag) {
    return <Chart
      basicInfo={{
        title: t('appOverview.analysis.tokenUsageByModel.title'),
        explanation: t('appOverview.analysis.tokenUsageByModel.explanation'),
        timePeriod: period.name,
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
          type={period.name}
          textStyle={{ main: `!text-3xl !font-normal ${totalTokens === 0 ? '!text-text-quaternary' : ''}` }}
        />
      </div>

      <ReactECharts option={chartOptions} style={{ height: 200 }} />

      {/* モデル別サマリー */}
      <div className="mt-4 space-y-2">
        {processModelData(response.data).slice(0, 5).map((model) => {
          const modelTotal = model.data.reduce((sum, item) => sum + item.token_count, 0)
          const percentage = totalTokens > 0 ? (modelTotal / totalTokens * 100).toFixed(1) : '0'

          return (
            <div key={model.modelKey} className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <div
                  className="mr-2 h-3 w-3 rounded"
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

export default Chart
