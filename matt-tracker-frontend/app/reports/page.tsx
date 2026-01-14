/**
 * ============================================================================
 * REPORT GENERATOR PAGE
 * ============================================================================
 * 
 * PURPOSE: Main page for the backend report generator
 * 
 * DESCRIPTION:
 * This page provides a form interface for generating reports from the
 * backend API. It handles form submission, polling for report status,
 * and displaying formatted reports.
 * 
 * ============================================================================
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import ReportForm from '@/components/ReportForm'
import ReportLoading from '@/components/ReportLoading'
import ReportDisplay from '@/components/ReportDisplay'

export const dynamic = 'force-dynamic'

type PageState = 'form' | 'loading' | 'results'

export default function ReportsPage() {
  const [pageState, setPageState] = useState<PageState>('form')
  const [reportData, setReportData] = useState<any>(null)
  const [formData, setFormData] = useState<{
    accountId: number
    users: Array<{ name: string; id: number }>
    org: string
    orgId: number
    startDate: string
    endDate: string
  } | null>(null)

  const handleFormSubmit = async (data: {
    accountId: number
    users: Array<{ name: string; id: number }>
    org: string
    orgId: number
    startDate: string
    endDate: string
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
          <ReportForm onSubmit={handleFormSubmit} />
          <div className="w-full max-w-2xl mt-4 text-center">
            <p className="text-sm text-gray-600 mb-3">Looking to generate a weekly report?</p>
            <Link 
              href="/reports/weekly"
              className="inline-block px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
            >
              Generate Weekly Report
            </Link>
          </div>
        </>
      )}
      {pageState === 'loading' && formData && (
        <ReportLoading 
          formData={formData}
          onComplete={handleReportComplete} 
          onError={(error) => {
            setReportData({ error: true, message: error })
            setPageState('results')
          }} 
        />
      )}
      {pageState === 'results' && (
        <ReportDisplay reportData={reportData} onNewReport={handleNewReport} />
      )}
    </main>
  )
}

