'use client'

import { Suspense } from 'react'
import ArticleEditorForm from '@/components/kb/ArticleEditorForm'

export default function NewArticlePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    }>
      <ArticleEditorForm mode="create" />
    </Suspense>
  )
}
