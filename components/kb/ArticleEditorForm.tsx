'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import DslEditor from '@/components/assessment/DslEditor'
import AudienceScopingPanel from '@/components/kb/AudienceScopingPanel'
import AudienceTargetingPanel, { type AudienceKind } from '@/components/kb/AudienceTargetingPanel'

interface KBCategory {
  id: string
  name: string
  slug: string
}

type ArticleType = 'standard' | 'policy' | 'training'

export interface ArticleInitial {
  id: string
  title: string
  slug: string
  summary: string | null
  content: string
  category_id: string | null
  visibility: string
  status: 'draft' | 'published' | 'review'
  tags: string[] | null
  article_type: ArticleType | string
  assessment_dsl: string | null
  passing_score: number | string | null
  visible_to_roles: string[] | null
  visible_to_companies: string[] | null
  visible_to_locations: string[] | null
  visible_to_departments: string[] | null
  visible_to_job_titles: string[] | null
  visible_to_employment_types: string[] | null
  required_for_audience_kind: AudienceKind | string | null
  required_for_roles: string[] | null
  required_for_companies: string[] | null
  required_for_locations: string[] | null
  required_for_departments: string[] | null
  required_for_job_titles: string[] | null
  required_for_employment_types: string[] | null
  required_for_contact_groups: string[] | null
}

interface Props {
  mode: 'create' | 'edit'
  initial?: ArticleInitial
  /** Slug used to navigate back to the detail page on save (edit mode only). */
  detailSlug?: string
}

/**
 * Shared form for creating + editing KB articles.
 *
 * Spec: openspec/changes/kb-quiz/proposal.md (D36) — single form for new + edit.
 * The mode prop drives endpoint selection (POST vs PUT), heading text, and the
 * D38 quiz-edit warning banner that appears when the assessment is dirty.
 */
export default function ArticleEditorForm({ mode, initial, detailSlug }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initial values: prefer the loaded article in edit mode; fall back to URL params for create.
  const initialArticleType = (initial?.article_type as ArticleType)
    || (searchParams.get('type') as ArticleType)
    || 'standard'

  const [title, setTitle] = useState(initial?.title || searchParams.get('title') || '')
  const [slug, setSlug] = useState(initial?.slug || '')
  const [summary, setSummary] = useState(initial?.summary || searchParams.get('summary') || '')
  const [content, setContent] = useState(initial?.content || searchParams.get('content') || '')
  const [categoryId, setCategoryId] = useState(initial?.category_id || '')
  const [visibility, setVisibility] = useState(initial?.visibility || 'internal')
  const [tags, setTags] = useState(
    initial?.tags?.join(', ') ?? searchParams.get('tags') ?? ''
  )
  const [articleType, setArticleType] = useState<ArticleType>(initialArticleType)
  const [assessmentDsl, setAssessmentDsl] = useState(initial?.assessment_dsl || '')
  const [passingScore, setPassingScore] = useState(
    typeof initial?.passing_score === 'number' ? initial.passing_score
      : typeof initial?.passing_score === 'string' ? Number(initial.passing_score)
      : 80
  )
  const [categories, setCategories] = useState<KBCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Audience scoping (read-visibility)
  const [visibleToRoles, setVisibleToRoles] = useState<string[]>(initial?.visible_to_roles || [])
  const [visibleToCompanies, setVisibleToCompanies] = useState<string[]>(initial?.visible_to_companies || [])
  const [visibleToLocations, setVisibleToLocations] = useState<string[]>(initial?.visible_to_locations || [])
  const [visibleToDepartments, setVisibleToDepartments] = useState<string[]>(initial?.visible_to_departments || [])
  const [visibleToJobTitles, setVisibleToJobTitles] = useState<string[]>(initial?.visible_to_job_titles || [])
  const [visibleToEmploymentTypes, setVisibleToEmploymentTypes] = useState<string[]>(initial?.visible_to_employment_types || [])
  const [audienceError, setAudienceError] = useState<string | null>(null)

  // Acknowledgment audience targeting (policy-audience migration 081)
  const ackTargetingApplies = articleType === 'policy' || articleType === 'training'
  const initialAudienceKind = (initial?.required_for_audience_kind as AudienceKind) || 'internal'
  const [audienceKind, setAudienceKind] = useState<AudienceKind>(initialAudienceKind)
  const [requiredForRoles, setRequiredForRoles] = useState<string[]>(initial?.required_for_roles || [])
  const [requiredForCompanies, setRequiredForCompanies] = useState<string[]>(initial?.required_for_companies || [])
  const [requiredForLocations, setRequiredForLocations] = useState<string[]>(initial?.required_for_locations || [])
  const [requiredForDepartments, setRequiredForDepartments] = useState<string[]>(initial?.required_for_departments || [])
  const [requiredForJobTitles, setRequiredForJobTitles] = useState<string[]>(initial?.required_for_job_titles || [])
  const [requiredForEmploymentTypes, setRequiredForEmploymentTypes] = useState<string[]>(initial?.required_for_employment_types || [])
  const [requiredForContactGroups, setRequiredForContactGroups] = useState<string[]>(initial?.required_for_contact_groups || [])
  const [targetingError, setTargetingError] = useState<string | null>(null)

  // D38: warn when the quiz DSL has been changed in edit mode. Prior pass
  // states will silently invalidate via assessment_hash mismatch on save.
  const initialDsl = initial?.assessment_dsl || ''
  const assessmentDirty = useMemo(
    () => mode === 'edit' && articleType === 'training' && assessmentDsl !== initialDsl,
    [mode, articleType, assessmentDsl, initialDsl]
  )

  // Auto-generate slug from title when creating; leave alone when editing.
  useEffect(() => {
    if (mode !== 'create') return
    const generated = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)
    setSlug(generated)
  }, [title, mode])

  // Categories
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/portal/kb')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.categories || [])

          // Create-mode only: auto-select category from query param
          if (mode === 'create') {
            const catParam = searchParams.get('category')
            if (catParam && data.categories?.length > 0) {
              const match = data.categories.find((c: KBCategory) =>
                c.name.toLowerCase() === catParam.toLowerCase() ||
                c.slug === catParam.toLowerCase()
              )
              if (match) setCategoryId(match.id)
            }
          }
        }
      } catch {
        // Categories are optional
      }
    }
    fetchCategories()
  }, [searchParams, mode])

  const handleSave = async (status: 'draft' | 'published') => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required')
      return
    }

    if (visibility === 'private') {
      const totalAudience =
        visibleToRoles.length + visibleToCompanies.length + visibleToLocations.length +
        visibleToDepartments.length + visibleToJobTitles.length + visibleToEmploymentTypes.length
      if (totalAudience === 0) {
        setAudienceError('Private articles must have at least one audience rule')
        setError('Private articles must have at least one audience rule')
        return
      }
    }

    if (ackTargetingApplies && audienceKind === 'targeted') {
      const totalTargets =
        requiredForRoles.length + requiredForCompanies.length + requiredForLocations.length +
        requiredForDepartments.length + requiredForJobTitles.length +
        requiredForEmploymentTypes.length + requiredForContactGroups.length
      if (totalTargets === 0) {
        setTargetingError('Targeted audience requires at least one axis')
        setError('Targeted audience requires at least one axis')
        return
      }
    }

    setAudienceError(null)
    setTargetingError(null)
    setSaving(true)
    setError('')

    const payload = {
      title: title.trim(),
      slug,
      summary: summary.trim(),
      content,
      category_id: categoryId || null,
      visibility,
      status,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      article_type: articleType,
      assessment_dsl: articleType === 'training' ? assessmentDsl : null,
      passing_score: articleType === 'training' ? passingScore : undefined,
      visible_to_roles: visibility === 'private' ? visibleToRoles : [],
      visible_to_companies: visibility === 'private' ? visibleToCompanies : [],
      visible_to_locations: visibility === 'private' ? visibleToLocations : [],
      visible_to_departments: visibility === 'private' ? visibleToDepartments : [],
      visible_to_job_titles: visibility === 'private' ? visibleToJobTitles : [],
      visible_to_employment_types: visibility === 'private' ? visibleToEmploymentTypes : [],
      required_for_audience_kind: ackTargetingApplies ? audienceKind : undefined,
      required_for_roles: audienceKind === 'targeted' ? requiredForRoles : [],
      required_for_companies: audienceKind === 'targeted' ? requiredForCompanies : [],
      required_for_locations: audienceKind === 'targeted' ? requiredForLocations : [],
      required_for_departments: audienceKind === 'targeted' ? requiredForDepartments : [],
      required_for_job_titles: audienceKind === 'targeted' ? requiredForJobTitles : [],
      required_for_employment_types: audienceKind === 'targeted' ? requiredForEmploymentTypes : [],
      required_for_contact_groups: audienceKind === 'targeted' ? requiredForContactGroups : [],
    }

    const url = mode === 'edit' && initial?.id
      ? `/api/portal/kb/articles/${initial.id}`
      : '/api/portal/kb/articles'
    const method = mode === 'edit' ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save article')
      }

      // Edit mode → back to the detail page; create mode → KB index.
      if (mode === 'edit' && detailSlug) {
        router.push(`/portal/kb/${detailSlug}/${slug}`)
      } else {
        router.push('/portal/kb')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (mode !== 'edit' || !initial?.id) return
    if (!confirm('Delete this article? This is reversible — the article is soft-deleted.')) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/portal/kb/articles/${initial.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete article')
      }
      router.push('/portal/kb')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
    }
  }

  const heading = mode === 'edit' ? 'Edit KB Article' : 'New KB Article'
  const subheading = mode === 'edit'
    ? 'Update knowledge base article'
    : 'Create or edit a knowledge base article'
  const backHref = mode === 'edit' && detailSlug ? `/portal/kb/${detailSlug}/${slug}` : '/portal/kb'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={backHref} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{heading}</h1>
            <p className="text-slate-400 mt-1">{subheading}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="px-4 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-medium transition-colors border border-red-500/30 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          <button
            onClick={() => handleSave('draft')}
            disabled={saving || deleting}
            className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors border border-slate-700 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving || deleting}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : (mode === 'edit' ? 'Save & Publish' : 'Publish')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {assessmentDirty && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <p className="text-sm text-amber-300">
            <strong>Heads up:</strong> the quiz has changed. Saving will reset every prior pass for
            this article — anyone who previously passed will need to retake it. Prose-only edits do
            not trigger this; only changes to the assessment do.
          </p>
        </div>
      )}

      {/* Title & Slug */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-2">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title"
            className="w-full px-4 py-3 text-lg bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
          />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-slate-300 mb-2">URL Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">/portal/kb/.../</span>
            <input
              type="text"
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        </div>
        <div>
          <label htmlFor="summary" className="block text-sm font-medium text-slate-300 mb-2">Summary</label>
          <textarea
            id="summary"
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief summary of the article"
            className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <label htmlFor="content" className="block text-sm font-medium text-slate-300 mb-2">
          Content <span className="text-red-400">*</span>
        </label>
        <textarea
          id="content"
          rows={20}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your article content here (Markdown supported)..."
          className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-y font-mono"
        />
        <p className="text-xs text-slate-500 mt-2">Supports Markdown formatting</p>
      </div>

      {/* Article Type */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Article Type</label>
          <div className="flex gap-3">
            {(['standard', 'policy', 'training'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setArticleType(t)}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  articleType === t
                    ? 'bg-brand-500/10 border-brand-500/50 text-brand-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {t === 'standard' ? 'Standard Article' : t === 'policy' ? 'Policy' : 'Training'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {articleType === 'standard' && 'Standard knowledge base article.'}
            {articleType === 'policy' && 'Policy articles require user acknowledgment.'}
            {articleType === 'training' && 'Training articles can include an inline assessment quiz.'}
          </p>
        </div>

        {articleType === 'training' && (
          <DslEditor
            value={assessmentDsl}
            onChange={setAssessmentDsl}
            passingScore={passingScore}
            onPassingScoreChange={setPassingScore}
          />
        )}
      </div>

      {/* Metadata */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="visibility" className="block text-sm font-medium text-slate-300 mb-2">Visibility</label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value)
                if (e.target.value !== 'private') setAudienceError(null)
              }}
              className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            >
              <option value="public">Public - Visible to everyone</option>
              <option value="authenticated">Authenticated - Logged in users</option>
              <option value="internal">Internal - Staff only</option>
              <option value="private">Private - Specific audiences only</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tag1, tag2, tag3"
            className="w-full px-4 py-3 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
          <p className="text-xs text-slate-500 mt-1">Comma-separated tags</p>
        </div>
      </div>

      <AudienceScopingPanel
        visibility={visibility}
        visibleToRoles={visibleToRoles}
        visibleToCompanies={visibleToCompanies}
        visibleToLocations={visibleToLocations}
        visibleToDepartments={visibleToDepartments}
        visibleToJobTitles={visibleToJobTitles}
        visibleToEmploymentTypes={visibleToEmploymentTypes}
        onVisibleToRolesChange={setVisibleToRoles}
        onVisibleToCompaniesChange={setVisibleToCompanies}
        onVisibleToLocationsChange={setVisibleToLocations}
        onVisibleToDepartmentsChange={setVisibleToDepartments}
        onVisibleToJobTitlesChange={setVisibleToJobTitles}
        onVisibleToEmploymentTypesChange={setVisibleToEmploymentTypes}
        validationError={audienceError}
      />

      {ackTargetingApplies && (
        <AudienceTargetingPanel
          audienceKind={audienceKind}
          requiredForRoles={requiredForRoles}
          requiredForCompanies={requiredForCompanies}
          requiredForLocations={requiredForLocations}
          requiredForDepartments={requiredForDepartments}
          requiredForJobTitles={requiredForJobTitles}
          requiredForEmploymentTypes={requiredForEmploymentTypes}
          requiredForContactGroups={requiredForContactGroups}
          onAudienceKindChange={setAudienceKind}
          onRequiredForRolesChange={setRequiredForRoles}
          onRequiredForCompaniesChange={setRequiredForCompanies}
          onRequiredForLocationsChange={setRequiredForLocations}
          onRequiredForDepartmentsChange={setRequiredForDepartments}
          onRequiredForJobTitlesChange={setRequiredForJobTitles}
          onRequiredForEmploymentTypesChange={setRequiredForEmploymentTypes}
          onRequiredForContactGroupsChange={setRequiredForContactGroups}
          validationError={targetingError}
        />
      )}
    </div>
  )
}
