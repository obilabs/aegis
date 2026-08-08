'use client'

import { ParsedChoice, QuestionType } from '@/lib/assessment-parser'

interface QuestionCardProps {
  questionNumber: number
  totalQuestions: number
  type: QuestionType
  questionText: string
  choices: ParsedChoice[]
  selectedAnswers: string[]
  onSelect: (letter: string) => void
  submitted: boolean
  correctAnswers?: string[]
  explanation?: string
}

export default function QuestionCard({
  questionNumber,
  totalQuestions,
  type,
  questionText,
  choices,
  selectedAnswers,
  onSelect,
  submitted,
  correctAnswers,
  explanation,
}: QuestionCardProps) {
  const isMultiSelect = type === 'MULTIPLE_SELECT'

  return (
    <div className="space-y-4">
      {/* Question header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">
          Question {questionNumber} of {totalQuestions}
        </span>
        <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
          {type === 'TRUE_FALSE' ? 'True/False' : type === 'MULTIPLE_SELECT' ? 'Select all that apply' : 'Single choice'}
        </span>
      </div>

      {/* Question text */}
      <p className="text-slate-200 font-medium leading-relaxed">{questionText}</p>

      {/* Choices */}
      <div className="space-y-2">
        {choices.map((choice) => {
          const isSelected = selectedAnswers.includes(choice.letter)
          const isCorrect = submitted && correctAnswers?.includes(choice.letter)
          const isWrong = submitted && isSelected && !correctAnswers?.includes(choice.letter)

          let borderClass = 'border-slate-700 hover:border-slate-600'
          let bgClass = 'bg-slate-800/50'

          if (submitted) {
            if (isCorrect) {
              borderClass = 'border-brand-500/50'
              bgClass = 'bg-brand-500/10'
            } else if (isWrong) {
              borderClass = 'border-red-500/50'
              bgClass = 'bg-red-500/10'
            } else {
              borderClass = 'border-slate-700/50'
              bgClass = 'bg-slate-800/30'
            }
          } else if (isSelected) {
            borderClass = 'border-brand-500/50'
            bgClass = 'bg-brand-500/10'
          }

          return (
            <button
              key={choice.letter}
              onClick={() => !submitted && onSelect(choice.letter)}
              disabled={submitted}
              className={`w-full text-left p-3 rounded-lg border ${borderClass} ${bgClass} transition-all flex items-start gap-3 disabled:cursor-default`}
            >
              <span className={`flex-shrink-0 w-6 h-6 rounded-${isMultiSelect ? 'md' : 'full'} border-2 flex items-center justify-center text-xs font-medium mt-0.5 ${
                submitted && isCorrect
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : submitted && isWrong
                    ? 'border-red-500 bg-red-500 text-white'
                    : isSelected
                      ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                      : 'border-slate-600 text-slate-500'
              }`}>
                {submitted && isCorrect ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : submitted && isWrong ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                ) : (
                  choice.letter
                )}
              </span>
              <span className={`text-sm ${
                submitted && isCorrect ? 'text-brand-300' : submitted && isWrong ? 'text-red-300' : 'text-slate-300'
              }`}>
                {choice.text}
              </span>
            </button>
          )
        })}
      </div>

      {/* Explanation (shown after answer) */}
      {submitted && explanation && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs font-medium text-blue-400 mb-1">Explanation</p>
          <p className="text-sm text-slate-300">{explanation}</p>
        </div>
      )}
    </div>
  )
}
