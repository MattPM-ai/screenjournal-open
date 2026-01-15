/**
 * ============================================================================
 * WEEKLY REPORT GENERATOR PAGE
 * ============================================================================
 * 
 * PURPOSE: Main page for the weekly backend report generator
 * 
 * DESCRIPTION:
 * This page provides a form interface for generating weekly reports from the
 * backend API. It handles form submission, polling for report status,
 * and displaying formatted weekly reports.
 * 
 * ============================================================================
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import WeeklyReportForm from '@/components/WeeklyReportForm'
import WeeklyReportLoading from '@/components/WeeklyReportLoading'
import WeeklyReportDisplay from '@/components/WeeklyReportDisplay'

export const dynamic = 'force-dynamic'

type PageState = 'form' | 'loading' | 'results'

export default function WeeklyReportsPage() {
  
  const [pageState, setPageState] = useState<PageState>('form')
  const [reportData, setReportData] = useState<any>(null)
  const [formData, setFormData] = useState<{
    accountId: number
    users: Array<{ name: string; id: number }>
    org: string
    orgId: number
    weekStartDate: string
  } | null>(null)

  const handleFormSubmit = async (data: {
    accountId: number
    users: Array<{ name: string; id: number }>
    org: string
    orgId: number
    weekStartDate: string
  }) => {
    setFormData(data)
    setPageState('loading')
  }

  const handleReportComplete = (data: any) => {
    setReportData(data)
    setPageState('results')
  }

  const handleNewReport = () => {
    setReportData(null)
    setPageState('form')
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      {pageState === 'form' && (
        <>
          <WeeklyReportForm onSubmit={handleFormSubmit} />
          <div className="w-full max-w-2xl mt-4 text-center">
            <p className="text-sm text-gray-600 mb-3">Looking to generate a general productivity report?</p>
            <Link 
              href="/reports"
              className="inline-block px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
            >
              Generate Productivity Report
            </Link>
          </div>
        </>
      )}
      {pageState === 'loading' && formData && (
        <WeeklyReportLoading 
          formData={formData}
          onComplete={handleReportComplete} 
          onError={(error) => {
            setReportData({ error: true, message: error })
            setPageState('results')
          }} 
        />
      )}
      {pageState === 'results' && (
        <WeeklyReportDisplay reportData={reportData} onNewReport={handleNewReport} />
      )}
    </main>
  )
}

