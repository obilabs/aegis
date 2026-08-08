'use client'

import { useState, useRef } from 'react'
import { ParsedAssessment, scoreAssessment } from '@/lib/assessment-parser'
import QuestionCard from './QuestionCard'
import QuizResults from './QuizResults'

interface QuizRendererProps {
  assessment: ParsedAssessment
  articleSlug: string
  onComplete?: (score: number, passed: boolean) => void
}

export default function QuizRenderer({ assessment, articleSlug, onComplete }: QuizRendererProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string[]>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const startTime = useRef(Date.now())

  const question = assessment.questions[currentQuestion]
  const isMultiSelect = question?.type === 'MULTIPLE_SELECT'

  const handleSelect = (letter: string) => {
    setAnswers(prev => {
      const current = prev[currentQuestion] || []
      if (isMultiSelect) {
        // Toggle selection for multi-select
        return {
          ...prev,
          [currentQuestion]: current.includes(letter)
            ? current.filter(l => l !== letter)
            : [...current, letter],
        }
      }
      // Single selection
      return { ...prev, [currentQuestion]: [letter] }
    })
  }

  const handleSubmitAnswer = () => {
    setSubmitted(prev => ({ ...prev, [currentQuestion]: true }))
  }

  const handleNext = () => {
    if (currentQuestion < assessment.questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      // Final question — submit the entire quiz
      handleFinish()
    }
  }

  const handleFinish = async () => {
    const result = scoreAssessment(assessment, answers)
    const timeSpent = Math.round((Date.now() - startTime.current) / 1000)

    setShowResults(true)
    setSaving(true)

    try {
      const res = await fetch(`/api/portal/kb/${encodeURIComponent(articleSlug)}/complete-training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          time_spent_seconds: timeSpent,
        }),
      })

      if (res.ok) {
        onComplete?.(result.score, result.passed)
      }
    } catch (error) {
      console.error('Failed to save training completion:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleRetake = () => {
    setCurrentQuestion(0)
    setAnswers({})
    setSubmitted({})
    setShowResults(false)
    startTime.current = Date.now()
  }

  if (showResults) {
    const result = scoreAssessment(assessment, answers)
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Knowledge Check Results</h3>
        {saving && (
          <p className="text-xs text-slate-500 mb-4">Saving results...</p>
        )}
        <QuizResults
          score={result.score}
          passed={result.passed}
          passingScore={assessment.passing_score}
          totalQuestions={result.total}
          correctAnswers={result.correct}
          results={result.results}
          questions={assessment.questions}
          onRetake={handleRetake}
        />
      </div>
    )
  }

  const hasAnswer = (answers[currentQuestion] || []).length > 0
  const isSubmitted = submitted[currentQuestion] || false
  const correctAnswers = question?.choices.filter(c => c.is_correct).map(c => c.letter)

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-100">Knowledge Check</h3>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          {assessment.questions.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentQuestion
                  ? 'bg-brand-500'
                  : submitted[idx]
                    ? 'bg-brand-500/40'
                    : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      <QuestionCard
        questionNumber={currentQuestion + 1}
        totalQuestions={assessment.questions.length}
        type={question.type}
        questionText={question.question_text}
        choices={question.choices}
        selectedAnswers={answers[currentQuestion] || []}
        onSelect={handleSelect}
        submitted={isSubmitted}
        correctAnswers={isSubmitted ? correctAnswers : undefined}
        explanation={isSubmitted ? question.explanation : undefined}
      />

      {/* Actions */}
      <div className="flex justify-end mt-6 gap-3">
        {!isSubmitted ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={!hasAnswer}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {currentQuestion < assessment.questions.length - 1 ? 'Next Question' : 'See Results'}
          </button>
        )}
      </div>
    </div>
  )
}
