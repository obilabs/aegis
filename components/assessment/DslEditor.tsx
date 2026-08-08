'use client'

import { useState, useCallback } from 'react'
import { parseAssessmentDSL, ParseResult } from '@/lib/assessment-parser'
import QuestionCard from './QuestionCard'

interface DslEditorProps {
  value: string
  onChange: (value: string) => void
  passingScore: number
  onPassingScoreChange: (score: number) => void
}

const SAMPLE_DSL = `---
type: SINGLE_CHOICE
difficulty: EASY
explanation: |
  Phishing emails often use urgency and suspicious links to trick users.
---
# Question
What should you do if you receive a suspicious email asking you to click a link?

## Choices
A. Click the link to see what it is
B. Forward it to a colleague
C. Report it to IT and delete it *[CORRECT]*
D. Reply asking who sent it`

export default function DslEditor({ value, onChange, passingScore, onPassingScoreChange }: DslEditorProps) {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleValidate = useCallback(() => {
    const result = parseAssessmentDSL(value, passingScore)
    setParseResult(result)
  }, [value, passingScore])

  const handleInsertSample = () => {
    onChange(value ? value + '\n---\n' + SAMPLE_DSL : SAMPLE_DSL)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-300">Assessment DSL</label>
          <span className="text-xs text-slate-500">(one question per block, separated by ---)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInsertSample}
            className="px-2 py-1 text-xs bg-slate-800 text-slate-400 rounded hover:text-white transition-colors border border-slate-700"
          >
            Insert Sample
          </button>
          <button
            type="button"
            onClick={handleValidate}
            className="px-2 py-1 text-xs bg-slate-800 text-brand-400 rounded hover:bg-brand-500/20 transition-colors border border-slate-700"
          >
            Validate
          </button>
          {parseResult?.success && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-2 py-1 text-xs bg-slate-800 text-blue-400 rounded hover:bg-blue-500/20 transition-colors border border-slate-700"
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
          )}
        </div>
      </div>

      {/* Passing score */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400">Passing score:</label>
        <input
          type="number"
          min={0}
          max={100}
          value={passingScore}
          onChange={(e) => onPassingScoreChange(parseInt(e.target.value, 10) || 80)}
          className="w-16 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300 text-center"
        />
        <span className="text-xs text-slate-500">%</span>
      </div>

      {/* Editor textarea */}
      <textarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setParseResult(null) // Clear validation on edit
        }}
        rows={16}
        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 font-mono resize-y focus:outline-none focus:border-brand-500/50"
        placeholder={`Paste your assessment DSL here, or click "Insert Sample" to get started...`}
        spellCheck={false}
      />

      {/* Validation results */}
      {parseResult && (
        <div className={`p-3 rounded-lg border text-sm ${
          parseResult.success
            ? 'bg-brand-500/10 border-brand-500/20 text-brand-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {parseResult.success ? (
            <p>{parseResult.data!.questions.length} question(s) parsed successfully</p>
          ) : (
            <div className="space-y-1">
              {parseResult.errors.map((err, i) => (
                <p key={i}>{err.message}</p>
              ))}
            </div>
          )}
          {parseResult.warnings.length > 0 && (
            <div className="mt-2 space-y-1 text-amber-400">
              {parseResult.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {showPreview && parseResult?.success && parseResult.data && (
        <div className="border border-slate-700 rounded-lg p-4 space-y-6">
          <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Preview</h4>
          {parseResult.data.questions.map((q, idx) => (
            <QuestionCard
              key={idx}
              questionNumber={idx + 1}
              totalQuestions={parseResult.data!.questions.length}
              type={q.type}
              questionText={q.question_text}
              choices={q.choices}
              selectedAnswers={[]}
              onSelect={() => {}}
              submitted={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
