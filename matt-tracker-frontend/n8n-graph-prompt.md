# Graph Data Formatting Instructions for n8n Bot

## Overview
When your response contains data that would benefit from visual representation (trends, comparisons, distributions, time series, etc.), you should format it using special graph tags that will be automatically rendered as interactive charts in the chat interface.

## Graph Tag Format

Wrap graph data in XML-style tags with the following structure:

```
<graph type="[chart_type]">
{
  "title": "Chart Title",
  "labels": ["Label1", "Label2", "Label3"],
  "datasets": [
    {
      "label": "Dataset Name",
      "data": [10, 20, 30],
      "color": "#3b82f6"
    }
  ],
  "options": {
    "xAxisLabel": "X Axis Label",
    "yAxisLabel": "Y Axis Label"
  }
}
</graph>
```

**Note on Chart Type:**
- The `type` can be specified in the tag attribute: `<graph type="line">`
- OR in the JSON data: `{ "type": "line", ... }`
- If both are provided, the JSON `type` takes precedence
- If neither is provided, it defaults to `"line"`

## Supported Chart Types

### 1. Line Chart (`type="line"`)
Use for time series, trends, or continuous data over time.

**Example:**
```
Here's the activity trend over the past week:

<graph type="line">
{
  "title": "Daily Active Time (Hours)",
  "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "datasets": [
    {
      "label": "Active Hours",
      "data": [6.5, 7.2, 5.8, 8.1, 7.5, 4.2, 3.1],
      "color": "#3b82f6"
    }
  ],
  "options": {
    "xAxisLabel": "Day of Week",
    "yAxisLabel": "Hours"
  }
}
</graph>
```

### 2. Bar Chart (`type="bar"`)
Use for comparing discrete categories or values.

**Example:**
```
User activity comparison:

<graph type="bar">
{
  "title": "Total Active Hours by User",
  "labels": ["Alice", "Bob", "Charlie", "Diana"],
  "datasets": [
    {
      "label": "Active Hours",
      "data": [45.2, 38.7, 52.1, 41.3],
      "color": "#10b981"
    }
  ],
  "options": {
    "xAxisLabel": "User",
    "yAxisLabel": "Hours"
  }
}
</graph>
```

### 3. Pie Chart (`type="pie"`)
Use for showing proportions or percentages of a whole.

**Example:**
```
Time distribution breakdown:

<graph type="pie">
{
  "title": "Time Distribution",
  "labels": ["Active", "AFK", "Offline"],
  "datasets": [
    {
      "label": "Time",
      "data": [45, 30, 25],
      "colors": ["#10b981", "#f59e0b", "#ef4444"]
    }
  ]
}
</graph>
```

### 4. Area Chart (`type="area"`)
Use for cumulative data or stacked trends.

**Example:**
```
<graph type="area">
{
  "title": "Cumulative Activity Over Time",
  "labels": ["Week 1", "Week 2", "Week 3", "Week 4"],
  "datasets": [
    {
      "label": "Cumulative Hours",
      "data": [20, 45, 75, 110],
      "color": "#8b5cf6"
    }
  ],
  "options": {
    "xAxisLabel": "Week",
    "yAxisLabel": "Total Hours"
  }
}
</graph>
```

## Data Structure Requirements

### Required Fields:
- **title**: Chart title (string)
- **labels**: Array of strings for X-axis categories or pie segments
- **datasets**: Array of dataset objects

### Optional Fields:
- **type**: Chart type (`line`, `bar`, `pie`, `area`) - Can be in tag attribute or JSON. Defaults to `"line"` if not specified
- **options**: Object containing axis labels and other chart options

### Dataset Object:
- **label**: Name of the dataset (string)
- **data**: Array of numbers corresponding to labels
- **color**: Single color for line/bar/area charts (hex color code)
- **colors**: Array of colors for pie charts (one per segment)

### Optional Fields:
- **options**: Object containing:
  - **xAxisLabel**: Label for X-axis (string)
  - **yAxisLabel**: Label for Y-axis (string)

## Multiple Datasets

You can include multiple datasets for comparison charts. Each dataset will be rendered as a separate line/bar with its own color:

```
<graph type="line">
{
  "title": "Active vs AFK Time Comparison",
  "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"],
  "datasets": [
    {
      "label": "Active Time",
      "data": [6.5, 7.2, 5.8, 8.1, 7.5],
      "color": "#10b981"
    },
    {
      "label": "AFK Time",
      "data": [1.5, 0.8, 2.2, 0.9, 0.5],
      "color": "#f59e0b"
    }
  ],
  "options": {
    "xAxisLabel": "Day",
    "yAxisLabel": "Hours"
  }
}
</graph>
```

**Example: Multiple Users on One Graph**

To compare multiple users' data on a single line graph:

```
<graph type="line">
{
  "title": "Daily Active Hours by User",
  "labels": ["2025-11-15", "2025-11-16", "2025-11-17", "2025-11-18", "2025-11-19"],
  "datasets": [
    {
      "label": "Chaz",
      "data": [2.92, 1.95, 8.65, 9.53, 8.47],
      "color": "#3b82f6"
    },
    {
      "label": "Alice",
      "data": [6.5, 7.2, 5.8, 8.1, 7.5],
      "color": "#10b981"
    },
    {
      "label": "Bob",
      "data": [5.2, 4.8, 6.1, 5.9, 6.3],
      "color": "#f59e0b"
    }
  ],
  "options": {
    "xAxisLabel": "Date",
    "yAxisLabel": "Hours"
  }
}
</graph>
```

**Color Handling:**
- If you specify a `color` for each dataset, those colors will be used
- If you omit `color`, the system will automatically assign distinct colors from a palette
- Each dataset must have the same number of data points as there are labels

## Best Practices

1. **Use graphs when data is numerical and benefits from visualization** - Don't use graphs for single values or purely textual information.

2. **Keep labels concise** - Long labels may not display well on charts.

3. **Choose appropriate chart types**:
   - **Line**: Trends over time, continuous data
   - **Bar**: Comparisons between categories
   - **Pie**: Proportions/percentages of a whole
   - **Area**: Cumulative or stacked data

4. **Provide context** - Always include a brief explanation before or after the graph tag explaining what the chart shows.

5. **Use consistent colors** - For multiple datasets, use distinct colors that are easily distinguishable.

6. **Validate data** - Ensure:
   - Labels array length matches data array length
   - All data values are numbers
   - Color codes are valid hex format (#RRGGBB)

## Example Complete Response

```
Based on the activity data, here's a summary of the week:

The team showed increasing productivity throughout the week, with a peak on Thursday.

<graph type="line">
{
  "title": "Daily Active Hours - Team Average",
  "labels": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "datasets": [
    {
      "label": "Average Active Hours",
      "data": [6.2, 6.8, 7.1, 8.3, 7.5],
      "color": "#3b82f6"
    }
  ],
  "options": {
    "xAxisLabel": "Day",
    "yAxisLabel": "Hours"
  }
}
</graph>

The distribution of time across different activities:

<graph type="pie">
{
  "title": "Time Distribution",
  "labels": ["Coding", "Meetings", "Documentation", "Testing", "Other"],
  "datasets": [
    {
      "label": "Hours",
      "data": [25, 10, 8, 5, 2],
      "colors": ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"]
    }
  ]
}
</graph>
```

## Error Handling

If you're unsure about the data format or encounter issues:
- Use plain text tables or lists instead
- The frontend will gracefully handle malformed graph tags by displaying them as text
- When in doubt, provide the data in a clear textual format

## Notes

- Graph tags can appear anywhere in your response
- You can include multiple graphs in a single response
- Text before and after graph tags will be displayed normally
- The graph will be rendered inline with the message content

