/**
 * ============================================================================
 * REPORT FORM COMPONENT
 * ============================================================================
 * 
 * PURPOSE: Form component for submitting report generation requests
 * 
 * DESCRIPTION:
 * Provides a form interface for selecting date range to generate reports
 * from the backend API. Uses default values for organization and user.
 * 
 * ============================================================================
 */

'use client'

import { useState, FormEvent } from 'react'

interface ReportFormProps {
  onSubmit: (data: {
    users: Array<{ name: string; id: number }>
    org: string
    orgId: number
    startDate: string
    endDate: string
  }) => void
}

export default function ReportForm({ onSubmit }: ReportFormProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (!startDate || !endDate) {
      alert('Please fill in both date fields')
      return
    }

    // Use default values matching collector defaults
    onSubmit({
      users: [{ name: 'Local', id: 0 }],
      org: 'Local',
      orgId: 0,
      startDate,
      endDate,
    })
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200 p-10">
      <h1 className="text-3xl font-semibold text-gray-900 mb-2">Generate a report</h1>
      <p className="text-sm text-gray-600 mb-8">
        Select the date range to generate a comprehensive activity report.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">Start Date:</label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">End Date:</label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Generate Report
          </button>
        </div>
      </form>
    </div>
  )
}
