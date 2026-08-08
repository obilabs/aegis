/**
 * Assessment DSL Parser
 *
 * Parses a YAML-frontmatter + markdown format into structured question data.
 * Supports SINGLE_CHOICE, MULTIPLE_SELECT, and TRUE_FALSE question types.
 *
 * DSL Format:
 * ---
 * type: SINGLE_CHOICE
 * difficulty: MEDIUM
 * explanation: |
 *   Why the correct answer is correct.
 * ---
 * # Question
 * What is the question text?
 *
 * ## Choices
 * A. First option
 * B. Second option *[CORRECT]*
 * C. Third option
 *
 * Questions are separated by `---` (horizontal rule).
 */

export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_SELECT' | 'TRUE_FALSE'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface ParsedChoice {
  letter: string
  text: string
  is_correct: boolean
}

export interface ParsedQuestion {
  type: QuestionType
  question_text: string
  difficulty: Difficulty
  explanation: string
  choices: ParsedChoice[]
  correct_count: number
}

export interface ParsedAssessment {
  questions: ParsedQuestion[]
  passing_score: number
}

export interface ParseError {
  line?: number
  question?: number
  message: string
}

export interface ParseResult {
  success: boolean
  data?: ParsedAssessment
  errors: ParseError[]
  warnings: string[]
}

/**
 * Parse assessment DSL text into structured data.
 */
export function parseAssessmentDSL(dsl: string, defaultPassingScore: number = 80): ParseResult {
  const errors: ParseError[] = []
  const warnings: string[] = []

  if (!dsl || !dsl.trim()) {
    return { success: false, errors: [{ message: 'Assessment DSL is empty' }], warnings }
  }

  // Split into question blocks by --- separator
  // First, normalize line endings
  const normalized = dsl.replace(/\r\n/g, '\n').trim()

  // Split by --- that appears on its own line (not inside frontmatter)
  const blocks = splitQuestionBlocks(normalized)

  if (blocks.length === 0) {
    return { success: false, errors: [{ message: 'No questions found in assessment' }], warnings }
  }

  const questions: ParsedQuestion[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim()
    if (!block) continue

    const result = parseQuestionBlock(block, i + 1)
    if (result.errors.length > 0) {
      errors.push(...result.errors)
    }
    if (result.warnings.length > 0) {
      warnings.push(...result.warnings)
    }
    if (result.question) {
      questions.push(result.question)
    }
  }

  if (questions.length === 0) {
    errors.push({ message: 'No valid questions parsed from assessment' })
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings }
  }

  return {
    success: true,
    data: {
      questions,
      passing_score: defaultPassingScore,
    },
    errors: [],
    warnings,
  }
}

function splitQuestionBlocks(text: string): string[] {
  // The first --- pair is frontmatter for the first question.
  // Subsequent --- are question separators.
  // Strategy: parse through looking for --- on its own line
  const lines = text.split('\n')
  const blocks: string[] = []
  let currentBlock: string[] = []
  let inFrontmatter = false
  let frontmatterSeen = false

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === '---') {
      if (!frontmatterSeen) {
        // Start of frontmatter
        inFrontmatter = true
        frontmatterSeen = true
        currentBlock.push(line)
      } else if (inFrontmatter) {
        // End of frontmatter
        inFrontmatter = false
        currentBlock.push(line)
      } else {
        // Question separator
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'))
        }
        currentBlock = []
        frontmatterSeen = false
      }
    } else {
      currentBlock.push(line)
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'))
  }

  return blocks
}

interface QuestionParseResult {
  question: ParsedQuestion | null
  errors: ParseError[]
  warnings: string[]
}

function parseQuestionBlock(block: string, questionNumber: number): QuestionParseResult {
  const errors: ParseError[] = []
  const warnings: string[] = []

  // Extract frontmatter
  const frontmatter = extractFrontmatter(block)
  const body = frontmatter.body

  // Parse type
  const type = parseQuestionType(frontmatter.data.type)
  if (!type) {
    errors.push({
      question: questionNumber,
      message: `Question ${questionNumber}: Invalid or missing type "${frontmatter.data.type}". Must be SINGLE_CHOICE, MULTIPLE_SELECT, or TRUE_FALSE.`,
    })
    return { question: null, errors, warnings }
  }

  // Parse difficulty
  const difficulty = parseDifficulty(frontmatter.data.difficulty)
  if (!difficulty) {
    warnings.push(`Question ${questionNumber}: Unknown difficulty "${frontmatter.data.difficulty}", defaulting to MEDIUM`)
  }

  // Parse explanation
  const explanation = (frontmatter.data.explanation || '').trim()

  // Extract question text and choices from body
  const questionText = extractQuestionText(body)
  if (!questionText) {
    errors.push({
      question: questionNumber,
      message: `Question ${questionNumber}: Missing question text. Use "# Question" heading followed by question text.`,
    })
    return { question: null, errors, warnings }
  }

  const choices = extractChoices(body, type)
  if (choices.length === 0) {
    errors.push({
      question: questionNumber,
      message: `Question ${questionNumber}: No choices found. Use "## Choices" heading followed by lettered options.`,
    })
    return { question: null, errors, warnings }
  }

  // Validate correct answer count
  const correctCount = choices.filter(c => c.is_correct).length
  const validationError = validateCorrectCount(type, correctCount, questionNumber)
  if (validationError) {
    errors.push(validationError)
    return { question: null, errors, warnings }
  }

  return {
    question: {
      type,
      question_text: questionText,
      difficulty: difficulty || 'MEDIUM',
      explanation,
      choices,
      correct_count: correctCount,
    },
    errors,
    warnings,
  }
}

function extractFrontmatter(block: string): { data: Record<string, string>; body: string } {
  const data: Record<string, string> = {}
  const lines = block.split('\n')

  let inFrontmatter = false
  let frontmatterEnd = 0
  let currentKey = ''
  let currentValue = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '---') {
      if (!inFrontmatter) {
        inFrontmatter = true
        continue
      } else {
        // Save last key
        if (currentKey) {
          data[currentKey] = currentValue.trim()
        }
        frontmatterEnd = i + 1
        break
      }
    }

    if (inFrontmatter) {
      // Check for key: value
      const kvMatch = line.match(/^(\w+):\s*(.*)$/)
      if (kvMatch) {
        // Save previous key
        if (currentKey) {
          data[currentKey] = currentValue.trim()
        }
        currentKey = kvMatch[1]
        const val = kvMatch[2].trim()
        // Check if multiline (ends with |)
        if (val === '|') {
          currentValue = ''
        } else {
          currentValue = val
        }
      } else if (currentKey && line.startsWith('  ')) {
        // Continuation of multiline value
        currentValue += (currentValue ? '\n' : '') + line.trim()
      }
    }
  }

  // If frontmatter never closed, treat whole block as body
  if (inFrontmatter && frontmatterEnd === 0) {
    return { data: {}, body: block }
  }

  return { data, body: lines.slice(frontmatterEnd).join('\n') }
}

function parseQuestionType(value: string | undefined): QuestionType | null {
  if (!value) return null
  const upper = value.toUpperCase().trim()
  if (upper === 'SINGLE_CHOICE' || upper === 'SINGLE') return 'SINGLE_CHOICE'
  if (upper === 'MULTIPLE_SELECT' || upper === 'MULTIPLE' || upper === 'MULTI') return 'MULTIPLE_SELECT'
  if (upper === 'TRUE_FALSE' || upper === 'TF' || upper === 'TRUEFALSE') return 'TRUE_FALSE'
  return null
}

function parseDifficulty(value: string | undefined): Difficulty | null {
  if (!value) return null
  const upper = value.toUpperCase().trim()
  if (upper === 'EASY') return 'EASY'
  if (upper === 'MEDIUM') return 'MEDIUM'
  if (upper === 'HARD') return 'HARD'
  return null
}

function extractQuestionText(body: string): string | null {
  // Look for # Question heading, then capture text until ## Choices or end
  const questionMatch = body.match(/^#\s+(?:Question\s*\n)([\s\S]*?)(?=^##\s|$)/m)
  if (questionMatch) {
    return questionMatch[1].trim()
  }

  // Fallback: try without heading, just take text before ## Choices
  const choicesIdx = body.indexOf('## Choices')
  if (choicesIdx > 0) {
    const beforeChoices = body.substring(0, choicesIdx).trim()
    // Remove any heading markers
    return beforeChoices.replace(/^#+\s*/gm, '').trim() || null
  }

  return null
}

function extractChoices(body: string, type: QuestionType): ParsedChoice[] {
  const choices: ParsedChoice[] = []

  // Find ## Choices section
  const choicesMatch = body.match(/^##\s+Choices\s*\n([\s\S]*)/m)
  if (!choicesMatch) return choices

  const choicesText = choicesMatch[1]

  // TRUE_FALSE shorthand: T. / F. or True / False
  if (type === 'TRUE_FALSE') {
    const tfLines = choicesText.split('\n').filter(l => l.trim())
    for (const line of tfLines) {
      const match = line.match(/^([A-Z])\.\s+(.+?)(\s*\*\[CORRECT\]\*)?$/i)
      if (match) {
        choices.push({
          letter: match[1].toUpperCase(),
          text: match[2].trim(),
          is_correct: !!match[3],
        })
      }
    }
    return choices
  }

  // Standard lettered choices: A. text *[CORRECT]*
  const lines = choicesText.split('\n')
  for (const line of lines) {
    const match = line.match(/^([A-Z])\.\s+(.+?)(\s*\*\[CORRECT\]\*)?$/i)
    if (match) {
      choices.push({
        letter: match[1].toUpperCase(),
        text: match[2].trim(),
        is_correct: !!match[3],
      })
    }
  }

  return choices
}

function validateCorrectCount(type: QuestionType, correctCount: number, questionNumber: number): ParseError | null {
  switch (type) {
    case 'SINGLE_CHOICE':
      if (correctCount !== 1) {
        return {
          question: questionNumber,
          message: `Question ${questionNumber}: SINGLE_CHOICE must have exactly 1 correct answer, found ${correctCount}.`,
        }
      }
      break
    case 'MULTIPLE_SELECT':
      if (correctCount < 2) {
        return {
          question: questionNumber,
          message: `Question ${questionNumber}: MULTIPLE_SELECT must have 2 or more correct answers, found ${correctCount}.`,
        }
      }
      break
    case 'TRUE_FALSE':
      if (correctCount !== 1) {
        return {
          question: questionNumber,
          message: `Question ${questionNumber}: TRUE_FALSE must have exactly 1 correct answer, found ${correctCount}.`,
        }
      }
      break
  }
  return null
}

/**
 * Score a set of user answers against a parsed assessment.
 * Returns per-question results and overall score.
 */
export function scoreAssessment(
  assessment: ParsedAssessment,
  answers: Record<number, string[]> // questionIndex → selected choice letters
): {
  total: number
  correct: number
  score: number
  passed: boolean
  results: { questionIndex: number; correct: boolean; selected: string[]; correctAnswers: string[] }[]
} {
  const results: { questionIndex: number; correct: boolean; selected: string[]; correctAnswers: string[] }[] = []
  let correct = 0

  for (let i = 0; i < assessment.questions.length; i++) {
    const question = assessment.questions[i]
    const selected = (answers[i] || []).map(s => s.toUpperCase())
    const correctAnswers = question.choices.filter(c => c.is_correct).map(c => c.letter)

    // For SINGLE_CHOICE and TRUE_FALSE: check exact match
    // For MULTIPLE_SELECT: all correct must be selected, no incorrect
    const isCorrect =
      selected.length === correctAnswers.length &&
      selected.every(s => correctAnswers.includes(s))

    if (isCorrect) correct++

    results.push({
      questionIndex: i,
      correct: isCorrect,
      selected,
      correctAnswers,
    })
  }

  const total = assessment.questions.length
  const score = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = score >= assessment.passing_score

  return { total, correct, score, passed, results }
}
