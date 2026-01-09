/**
 * ============================================================================
 * GRAPH DISPLAY COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Renders interactive charts from graph data
 * 
 * DESCRIPTION:
 * This component renders various chart types (line, bar, pie, area) using
 * the recharts library. It handles different chart configurations and
 * provides responsive, accessible chart displays.
 * 
 * DEPENDENCIES:
 * - recharts: Charting library for React
 * - /lib/graphParser.ts: GraphData type definitions
 * 
 * ============================================================================
 */

'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { GraphData } from '@/lib/graphParser'

interface GraphDisplayProps {
  graphData: GraphData
}

/**
 * Generates a color palette for charts
 * 
 * INPUTS:
 * - index: number - Index of the dataset
 * - total: number - Total number of datasets
 * - defaultColor: string - Default color if provided
 * 
 * OUTPUTS:
 * - string - Hex color code
 */
function getColor(index: number, total: number, defaultColor?: string): string {
  if (defaultColor) {
    return defaultColor
  }

  // Default color palette
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#ec4899', // pink
  ]

  return colors[index % colors.length]
}

/**
 * Renders a line chart
 */
function renderLineChart(graphData: GraphData) {
  const chartData = graphData.labels.map((label, index) => {
    const dataPoint: any = { name: label }
    graphData.datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index]
    })
    return dataPoint
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={
            graphData.options?.xAxisLabel
              ? { value: graphData.options.xAxisLabel, position: 'insideBottom', offset: -5, style: { fontSize: '12px', fill: '#6b7280' } }
              : undefined
          }
        />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={
            graphData.options?.yAxisLabel
              ? { value: graphData.options.yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: '#6b7280' } }
              : undefined
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {graphData.datasets.map((dataset, index) => (
          <Line
            key={dataset.label}
            type="monotone"
            dataKey={dataset.label}
            stroke={getColor(index, graphData.datasets.length, dataset.color)}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * Renders a bar chart
 */
function renderBarChart(graphData: GraphData) {
  const chartData = graphData.labels.map((label, index) => {
    const dataPoint: any = { name: label }
    graphData.datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index]
    })
    return dataPoint
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={
            graphData.options?.xAxisLabel
              ? { value: graphData.options.xAxisLabel, position: 'insideBottom', offset: -5, style: { fontSize: '12px', fill: '#6b7280' } }
              : undefined
          }
        />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={
            graphData.options?.yAxisLabel
              ? { value: graphData.options.yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: '#6b7280' } }
              : undefined
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {graphData.datasets.map((dataset, index) => (
          <Bar
            key={dataset.label}
            dataKey={dataset.label}
            fill={getColor(index, graphData.datasets.length, dataset.color)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Renders a pie chart
 */
function renderPieChart(graphData: GraphData) {
  // Pie charts use the first dataset
  const dataset = graphData.datasets[0]
  const chartData = graphData.labels.map((label, index) => ({
    name: label,
    value: dataset.data[index],
  }))

  const colors = dataset.colors || graphData.labels.map((_, index) => getColor(index, graphData.labels.length))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/**
 * Renders an area chart
 */
function renderAreaChart(graphData: GraphData) {
  const chartData = graphData.labels.map((label, index) => {
    const dataPoint: any = { name: label }
    graphData.datasets.forEach((dataset) => {
      dataPoint[dataset.label] = dataset.data[index]
    })
    return dataPoint
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          {graphData.datasets.map((dataset, index) => {
            const color = getColor(index, graphData.datasets.length, dataset.color)
            return (
              <linearGradient key={dataset.label} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                <stop offset="95%" stopColor={color} stopOpacity={0.1} />
              </linearGradient>
            )
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={
            graphData.options?.xAxisLabel
              ? { value: graphData.options.xAxisLabel, position: 'insideBottom', offset: -5, style: { fontSize: '12px', fill: '#6b7280' } }
              : undefined
          }
        />
        <YAxis
          stroke="#6b7280"
          style={{ fontSize: '12px' }}
          label={
            graphData.options?.yAxisLabel
              ? { value: graphData.options.yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: '#6b7280' } }
              : undefined
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {graphData.datasets.map((dataset, index) => (
          <Area
            key={dataset.label}
            type="monotone"
            dataKey={dataset.label}
            stroke={getColor(index, graphData.datasets.length, dataset.color)}
            fill={`url(#color${index})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

/**
 * Main GraphDisplay component
 * 
 * INPUTS:
 * - graphData: GraphData - The graph data to render
 * 
 * OUTPUTS:
 * - JSX.Element - Rendered chart component
 */
export default function GraphDisplay({ graphData }: GraphDisplayProps) {
  let chartContent: JSX.Element

  switch (graphData.type) {
    case 'line':
      chartContent = renderLineChart(graphData)
      break
    case 'bar':
      chartContent = renderBarChart(graphData)
      break
    case 'pie':
      chartContent = renderPieChart(graphData)
      break
    case 'area':
      chartContent = renderAreaChart(graphData)
      break
    default:
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">Unsupported chart type: {graphData.type}</p>
        </div>
      )
  }

  return (
    <div className="w-full p-4 bg-white border border-gray-200 rounded-lg">
      <h4 className="text-lg font-semibold text-gray-900 mb-4">{graphData.title}</h4>
      <div className="w-full">{chartContent}</div>
    </div>
  )
}

