/**
 * ============================================================================
 * GRAPH PARSER UTILITIES
 * ============================================================================
 * 
 * PURPOSE: Parse graph tags from message content and extract graph data
 * 
 * DESCRIPTION:
 * This module provides utilities to extract and parse graph data from
 * message content. It handles XML-style graph tags with JSON data inside,
 * validates the structure, and returns parsed graph objects ready for rendering.
 * 
 * DEPENDENCIES:
 * - None (pure utility functions)
 * 
 * ============================================================================
 */

/**
 * Graph data structure interface
 */
export interface GraphData {
  type: 'line' | 'bar' | 'pie' | 'area'
  title: string
  labels: string[]
  datasets: GraphDataset[]
  options?: {
    xAxisLabel?: string
    yAxisLabel?: string
  }
}

/**
 * Graph dataset structure interface
 */
export interface GraphDataset {
  label: string
  data: number[]
  color?: string
  colors?: string[]
}

/**
 * Parsed message segment - either text or graph data
 */
export interface MessageSegment {
  type: 'text' | 'graph'
  content?: string
  graphData?: GraphData
}

/**
 * Extracted graph tag information
 */
interface ExtractedGraphTag {
  content: string
  typeFromTag?: string
}

/**
 * Extracts graph tags from message content
 * 
 * INPUTS:
 * - content: string - The message content containing potential graph tags
 * 
 * OUTPUTS:
 * - ExtractedGraphTag[] - Array of graph tag contents and type attributes
 * 
 * DESCRIPTION:
 * Uses regex to find all <graph>...</graph> tags and extracts the content
 * between them along with any type attribute. Handles multiline content and whitespace.
 */
function extractGraphTags(content: string): ExtractedGraphTag[] {
  const graphTagRegex = /<graph(?:\s+type=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/graph>/gi
  const matches: ExtractedGraphTag[] = []
  let match

  while ((match = graphTagRegex.exec(content)) !== null) {
    if (match[2]) {
      matches.push({
        content: match[2].trim(),
        typeFromTag: match[1] || undefined,
      })
    }
  }

  return matches
}

/**
 * Removes graph tags from message content, leaving only text
 * 
 * INPUTS:
 * - content: string - The message content with graph tags
 * 
 * OUTPUTS:
 * - string - Content with graph tags removed
 */
function removeGraphTags(content: string): string {
  return content.replace(/<graph[^>]*>[\s\S]*?<\/graph>/gi, '').trim()
}

/**
 * Parses a JSON string into GraphData object with validation
 * 
 * INPUTS:
 * - jsonString: string - JSON string containing graph data
 * - typeFromTag: string | undefined - Type extracted from graph tag attribute
 * 
 * OUTPUTS:
 * - GraphData | null - Parsed graph data or null if invalid
 * 
 * ERROR HANDLING:
 * - Returns null if JSON parsing fails
 * - Returns null if required fields are missing
 * - Validates data structure and types
 * - Uses type from tag attribute if JSON doesn't have type field
 * - Defaults to 'line' if no type is provided
 */
function parseGraphData(jsonString: string, typeFromTag?: string): GraphData | null {
  try {
    const data = JSON.parse(jsonString)

    // Determine chart type: prefer JSON type, then tag attribute, then default to 'line'
    let chartType = data.type || typeFromTag || 'line'
    
    // Validate chart type
    if (!['line', 'bar', 'pie', 'area'].includes(chartType)) {
      console.warn('Graph data has invalid type:', chartType, '- defaulting to line')
      chartType = 'line'
    }

    if (!data.title || typeof data.title !== 'string') {
      console.warn('Graph data missing or invalid title')
      return null
    }

    if (!Array.isArray(data.labels) || data.labels.length === 0) {
      console.warn('Graph data missing or invalid labels array')
      return null
    }

    if (!Array.isArray(data.datasets) || data.datasets.length === 0) {
      console.warn('Graph data missing or invalid datasets array')
      return null
    }

    // Validate datasets
    for (const dataset of data.datasets) {
      if (!dataset.label || typeof dataset.label !== 'string') {
        console.warn('Dataset missing or invalid label')
        return null
      }

      if (!Array.isArray(dataset.data) || dataset.data.length === 0) {
        console.warn('Dataset missing or invalid data array')
        return null
      }

      // Validate data array contains only numbers
      if (!dataset.data.every((val: any) => typeof val === 'number')) {
        console.warn('Dataset data array contains non-numeric values')
        return null
      }

      // Validate data length matches labels length
      if (dataset.data.length !== data.labels.length) {
        console.warn(
          `Dataset data length (${dataset.data.length}) doesn't match labels length (${data.labels.length})`
        )
        return null
      }

      // Validate colors for pie charts
      if (chartType === 'pie') {
        if (!dataset.colors || !Array.isArray(dataset.colors)) {
          console.warn('Pie chart missing colors array')
          return null
        }
        if (dataset.colors.length !== data.labels.length) {
          console.warn(
            `Pie chart colors length (${dataset.colors.length}) doesn't match labels length (${data.labels.length})`
          )
          return null
        }
      } else {
        // For non-pie charts, color is optional but should be a string if provided
        if (dataset.color && typeof dataset.color !== 'string') {
          console.warn('Dataset color must be a string')
          return null
        }
      }
    }

    return {
      type: chartType as 'line' | 'bar' | 'pie' | 'area',
      title: data.title,
      labels: data.labels,
      datasets: data.datasets,
      options: data.options || {},
    } as GraphData
  } catch (error) {
    console.error('Failed to parse graph data JSON:', error)
    return null
  }
}

/**
 * Parses message content into segments (text and graphs)
 * 
 * INPUTS:
 * - content: string - The message content
 * 
 * OUTPUTS:
 * - MessageSegment[] - Array of message segments (text and/or graph data)
 * 
 * DESCRIPTION:
 * Extracts graph tags from content, parses them, and returns an array
 * of segments alternating between text and graphs. Text segments contain
 * the content between graphs, and graph segments contain parsed graph data.
 * 
 * EXAMPLE:
 * Input: "Here's a chart: <graph>...</graph> and more text"
 * Output: [
 *   { type: 'text', content: "Here's a chart: " },
 *   { type: 'graph', graphData: {...} },
 *   { type: 'text', content: ' and more text' }
 * ]
 */
export function parseMessageContent(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  const graphTags = extractGraphTags(content)

  if (graphTags.length === 0) {
    // No graphs found, return entire content as text
    if (content.trim()) {
      segments.push({ type: 'text', content })
    }
    return segments
  }

  // Split content by graph tags to get text segments
  const textParts = content.split(/<graph[^>]*>[\s\S]*?<\/graph>/gi)

  // Process each graph tag and its preceding text
  for (let i = 0; i < graphTags.length; i++) {
    // Add text before this graph
    const textBefore = textParts[i]?.trim()
    if (textBefore) {
      segments.push({ type: 'text', content: textBefore })
    }

    // Parse and add graph data
    const graphTag = graphTags[i]
    const graphData = parseGraphData(graphTag.content, graphTag.typeFromTag)
    if (graphData) {
      segments.push({ type: 'graph', graphData })
    } else {
      // If parsing failed, include the raw tag as text
      segments.push({
        type: 'text',
        content: `<graph${graphTag.typeFromTag ? ` type="${graphTag.typeFromTag}"` : ''}>${graphTag.content}</graph>`,
      })
    }
  }

  // Add any remaining text after the last graph
  const textAfter = textParts[graphTags.length]?.trim()
  if (textAfter) {
    segments.push({ type: 'text', content: textAfter })
  }

  return segments
}

/**
 * Checks if message content contains graph tags
 * 
 * INPUTS:
 * - content: string - The message content
 * 
 * OUTPUTS:
 * - boolean - True if content contains graph tags
 */
export function hasGraphTags(content: string): boolean {
  return /<graph[^>]*>[\s\S]*?<\/graph>/gi.test(content)
}

