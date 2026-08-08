'use client'

import { ParsedQuestion } from '@/lib/assessment-parser'

interface QuizResultsProps {
  score: number
  passed: boolean
  passingScore: number
  totalQuestions: number
  correctAnswers: number
  results: { questionIndex: number; correct: boolean; selected: string[]; correctAnswers: string[] }[]
  questions: ParsedQuestion[]
  onRetake: () => void
}

export default function QuizResults({
  score,
  passed,
  passingScore,
  totalQuestions,
  correctAnswers,
  results,
  questions,
  onRetake,
}: QuizResultsProps) {
  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className={`text-center p-6 rounded-xl border ${
        passed
          ? 'bg-brand-500/10 border-brand-500/20'
          : 'bg-amber-500/10 border-amber-500/20'
      }`}>
        <div className={`text-4xl font-bold ${passed ? 'text-brand-400' : 'text-amber-400'}`}>
          {score}%
        </div>
        <p className={`text-sm font-medium mt-2 ${passed ? 'text-brand-400' : 'text-amber-400'}`}>
          {passed ? 'Passed!' : 'Not quite — try again'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {correctAnswers} of {totalQuestions} correct (need {passingScore}% to pass)
        </p>
      </div>

      {/* Per-question results */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Question Results</h4>
        {results.map((result, idx) => (
          <div key={idx} className="flex items-center gap-3 py-2 px-3 bg-slate-800/50 rounded-lg">
            <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
              result.correct ? 'bg-brand-500/20' : 'bg-red-500/20'
            }`}>
              {result.correct ? (
                <svg className="w-3 h-3 text-brand-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              )}
            </span>
            <span className="text-sm text-slate-300 flex-1 truncate">
              Q{idx + 1}: {questions[idx]?.question_text}
            </span>
            {!result.correct && (
              <span className="text-xs text-slate-500 flex-shrink-0">
                Correct: {result.correctAnswers.join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-center">
        <button
          onClick={onRetake}
          className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {passed ? 'Retake Quiz' : 'Try Again'}
        </button>
      </div>
    </div>
  )
}
