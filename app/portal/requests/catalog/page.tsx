'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CatalogItem {
  id: string
  name: string
  slug: string
  short_description: string | null
  icon: string | null
  requires_approval: boolean
  estimated_fulfillment_days: number | null
  has_cost: boolean
  cost_amount: number | null
  category_id: string | null
  category_name: string | null
}

interface Category {
  id: string
  name: string
  icon: string | null
}

const ICONS: Record<string, string> = {
  key: 'M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z',
  'computer-desktop': 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25',
  window: 'M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6ZM7.5 6h.008v.008H7.5V6Zm2.25 0h.008v.008H9.75V6Z',
  'user-plus': 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z',
  'user-minus': 'M22 10.5h-6m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z',
  'ellipsis-horizontal': 'M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z',
}

function CatalogIcon({ name }: { name: string | null }) {
  const path = ICONS[name || ''] || ICONS['ellipsis-horizontal']
  return (
    <svg className="h-8 w-8 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

export default function CatalogBrowsePage() {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await fetch('/api/portal/catalog')
        if (res.ok) {
          const data = await res.json()
          setItems(data.items || [])
          setCategories(data.categories || [])
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchCatalog()
  }, [])

  const filtered = items.filter(item => {
    if (activeCategory && item.category_id !== activeCategory) return false
    if (search) {
      const q = search.toLowerCase()
      return (item.name.toLowerCase().includes(q) ||
              item.short_description?.toLowerCase().includes(q))
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Service Catalog</h1>
        <p className="text-slate-400 mt-1">Browse available services and submit a request</p>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search catalog..."
          className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            !activeCategory
              ? 'bg-brand-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              activeCategory === cat.id
                ? 'bg-brand-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {search ? 'No items match your search' : 'No catalog items available'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={`/portal/requests/new/${item.slug}`}
              className="bg-slate-800 rounded-lg border border-slate-700 p-5 hover:border-brand-500/50 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-brand-500/10">
                  <CatalogIcon name={item.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-100 group-hover:text-brand-400">
                    {item.name}
                  </h3>
                  {item.category_name && (
                    <p className="text-xs text-slate-500 mt-0.5">{item.category_name}</p>
                  )}
                </div>
              </div>

              {item.short_description && (
                <p className="text-sm text-slate-400 mt-3 line-clamp-2">
                  {item.short_description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-4 text-xs text-slate-500">
                {item.estimated_fulfillment_days && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    ~{item.estimated_fulfillment_days}d
                  </span>
                )}
                {item.requires_approval && (
                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                    Requires Approval
                  </span>
                )}
                {item.has_cost && item.cost_amount && (
                  <span className="text-slate-400">${item.cost_amount}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
