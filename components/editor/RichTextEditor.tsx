'use client'

import { toSafeHtml } from '@/lib/article-render'
import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, Quote, Code, Link2, Image,
  Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Sparkles, Loader2, ChevronDown,
  Wand2, FileText, MessageSquare, CheckCircle
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  maxHeight?: string
  className?: string
  disabled?: boolean
  showAI?: boolean
  aiContext?: string // Additional context for AI (e.g., ticket details)
}

interface AIAction {
  id: string
  label: string
  icon: React.ReactNode
  prompt: string
}

const AI_ACTIONS: AIAction[] = [
  {
    id: 'improve',
    label: 'Improve Writing',
    icon: <Wand2 className="h-4 w-4" />,
    prompt: 'Improve the following text to be more professional, clear, and concise while maintaining the original meaning:'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: <FileText className="h-4 w-4" />,
    prompt: 'Summarize the following text in a clear and concise manner:'
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: <MessageSquare className="h-4 w-4" />,
    prompt: 'Expand on the following text with more detail and explanation:'
  },
  {
    id: 'fix_grammar',
    label: 'Fix Grammar',
    icon: <CheckCircle className="h-4 w-4" />,
    prompt: 'Fix any grammar, spelling, and punctuation errors in the following text:'
  },
  {
    id: 'make_formal',
    label: 'Make Formal',
    icon: <FileText className="h-4 w-4" />,
    prompt: 'Rewrite the following text in a more formal, professional tone:'
  },
  {
    id: 'make_friendly',
    label: 'Make Friendly',
    icon: <MessageSquare className="h-4 w-4" />,
    prompt: 'Rewrite the following text in a friendly, approachable tone while maintaining professionalism:'
  },
]

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  minHeight = '200px',
  maxHeight = '500px',
  className = '',
  disabled = false,
  showAI = true,
  aiContext = '',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showAIMenu, setShowAIMenu] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedText, setSelectedText] = useState('')

  // Sync value to editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = toSafeHtml(value)
    }
  }, [value])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }, [handleInput])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault()
      execCommand('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;')
    }
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          execCommand('bold')
          break
        case 'i':
          e.preventDefault()
          execCommand('italic')
          break
        case 'u':
          e.preventDefault()
          execCommand('underline')
          break
      }
    }
  }, [execCommand])

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString())
    }
  }, [])

  const handleAIAction = async (action: AIAction) => {
    const textToProcess = selectedText || editorRef.current?.innerText || ''
    if (!textToProcess.trim()) {
      setShowAIMenu(false)
      return
    }

    setAiLoading(true)
    setShowAIMenu(false)

    try {
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action.id,
          text: textToProcess,
          prompt: action.prompt,
          context: aiContext,
        }),
      })

      if (!response.ok) throw new Error('AI request failed')

      const data = await response.json()
      
      if (data.result) {
        // If text was selected, replace selection; otherwise replace all content
        if (selectedText) {
          execCommand('insertHTML', toSafeHtml(data.result))
        } else if (editorRef.current) {
          editorRef.current.innerHTML = toSafeHtml(data.result)
          handleInput()
        }
      }
    } catch (error) {
      console.error('AI processing error:', error)
      // Could show a toast notification here
    } finally {
      setAiLoading(false)
      setSelectedText('')
    }
  }

  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:')
    if (url) {
      execCommand('createLink', url)
    }
  }, [execCommand])

  const insertImage = useCallback(() => {
    const url = prompt('Enter image URL:')
    if (url) {
      execCommand('insertImage', url)
    }
  }, [execCommand])

  const ToolbarButton = ({ 
    onClick, 
    icon, 
    title,
    active = false 
  }: { 
    onClick: () => void
    icon: React.ReactNode
    title: string
    active?: boolean
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${
        active ? 'bg-slate-700 text-brand-400' : 'text-slate-400 hover:text-slate-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon}
    </button>
  )

  const ToolbarDivider = () => (
    <div className="w-px h-6 bg-slate-700 mx-1" />
  )

  return (
    <div className={`border border-slate-700 rounded-lg overflow-hidden bg-slate-800 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-slate-700 bg-slate-850">
        {/* History */}
        <ToolbarButton onClick={() => execCommand('undo')} icon={<Undo className="h-4 w-4" />} title="Undo (Ctrl+Z)" />
        <ToolbarButton onClick={() => execCommand('redo')} icon={<Redo className="h-4 w-4" />} title="Redo (Ctrl+Y)" />
        
        <ToolbarDivider />
        
        {/* Text formatting */}
        <ToolbarButton onClick={() => execCommand('bold')} icon={<Bold className="h-4 w-4" />} title="Bold (Ctrl+B)" />
        <ToolbarButton onClick={() => execCommand('italic')} icon={<Italic className="h-4 w-4" />} title="Italic (Ctrl+I)" />
        <ToolbarButton onClick={() => execCommand('underline')} icon={<Underline className="h-4 w-4" />} title="Underline (Ctrl+U)" />
        <ToolbarButton onClick={() => execCommand('strikeThrough')} icon={<Strikethrough className="h-4 w-4" />} title="Strikethrough" />
        
        <ToolbarDivider />
        
        {/* Headings */}
        <ToolbarButton onClick={() => execCommand('formatBlock', 'h1')} icon={<Heading1 className="h-4 w-4" />} title="Heading 1" />
        <ToolbarButton onClick={() => execCommand('formatBlock', 'h2')} icon={<Heading2 className="h-4 w-4" />} title="Heading 2" />
        <ToolbarButton onClick={() => execCommand('formatBlock', 'h3')} icon={<Heading3 className="h-4 w-4" />} title="Heading 3" />
        
        <ToolbarDivider />
        
        {/* Lists */}
        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} icon={<List className="h-4 w-4" />} title="Bullet List" />
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} icon={<ListOrdered className="h-4 w-4" />} title="Numbered List" />
        <ToolbarButton onClick={() => execCommand('formatBlock', 'blockquote')} icon={<Quote className="h-4 w-4" />} title="Quote" />
        <ToolbarButton onClick={() => execCommand('formatBlock', 'pre')} icon={<Code className="h-4 w-4" />} title="Code Block" />
        
        <ToolbarDivider />
        
        {/* Alignment */}
        <ToolbarButton onClick={() => execCommand('justifyLeft')} icon={<AlignLeft className="h-4 w-4" />} title="Align Left" />
        <ToolbarButton onClick={() => execCommand('justifyCenter')} icon={<AlignCenter className="h-4 w-4" />} title="Align Center" />
        <ToolbarButton onClick={() => execCommand('justifyRight')} icon={<AlignRight className="h-4 w-4" />} title="Align Right" />
        
        <ToolbarDivider />
        
        {/* Insert */}
        <ToolbarButton onClick={insertLink} icon={<Link2 className="h-4 w-4" />} title="Insert Link" />
        <ToolbarButton onClick={insertImage} icon={<Image className="h-4 w-4" />} title="Insert Image" />
        
        {/* AI Actions */}
        {showAI && (
          <>
            <ToolbarDivider />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAIMenu(!showAIMenu)}
                disabled={disabled || aiLoading}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                AI
                <ChevronDown className="h-3 w-3" />
              </button>
              
              {showAIMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                  <div className="p-1">
                    {AI_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleAIAction(action)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded transition-colors"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-700 p-2">
                    <p className="text-xs text-slate-500">
                      {selectedText ? 'Will process selected text' : 'Will process all content'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        data-placeholder={placeholder}
        className={`
          p-4 outline-none text-slate-200 overflow-y-auto
          prose prose-invert prose-sm max-w-none
          prose-headings:text-slate-100 prose-headings:font-semibold
          prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
          prose-p:text-slate-300 prose-p:leading-relaxed
          prose-a:text-brand-400 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-slate-100
          prose-code:text-brand-400 prose-code:bg-slate-900 prose-code:px-1 prose-code:rounded
          prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700
          prose-blockquote:border-l-brand-500 prose-blockquote:text-slate-400
          prose-ul:text-slate-300 prose-ol:text-slate-300
          prose-li:marker:text-brand-500
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{ minHeight, maxHeight }}
      />
      
      {/* Click outside to close AI menu */}
      {showAIMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAIMenu(false)} 
        />
      )}
    </div>
  )
}

export default RichTextEditor
