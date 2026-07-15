'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Source {
  filename: string
  chunk_index: number
  page_number?: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

interface Document {
  id: string
  filename: string
  created_at: string
}

interface DayEntry {
  date: string
  label: string
  isToday: boolean
}

function DocumentList() {
  const [docs, setDocs] = useState<Document[]>([])
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDocs(data) })
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || docs.length === 0) return null

  return (
    <div className="flex-none border-b border-gray-100 bg-gray-50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="text-xs font-medium text-gray-600">참조 문서</span>
          <span className="text-xs text-gray-400">{docs.length}개</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {docs.map(doc => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 text-xs text-gray-600 rounded-lg"
            >
              <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              {doc.filename}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function SourcesBadge({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false)
  if (!sources || sources.length === 0) return null

  // 같은 문서의 여러 청크는 하나로 묶고, 페이지 번호는 모아서 표시
  const grouped: { filename: string; pages: number[] }[] = []
  for (const s of sources) {
    let entry = grouped.find((g) => g.filename === s.filename)
    if (!entry) {
      entry = { filename: s.filename, pages: [] }
      grouped.push(entry)
    }
    if (s.page_number && s.page_number > 0 && !entry.pages.includes(s.page_number)) {
      entry.pages.push(s.page_number)
    }
  }
  grouped.forEach((g) => g.pages.sort((a, b) => a - b))

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        출처 {grouped.length}개 {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {grouped.map((g, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-md border border-blue-100">
              {g.filename}
              {g.pages.length > 0 && (
                <span className="text-blue-400 ml-1">({g.pages.map((p) => `${p}p`).join(', ')})</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

export default function AiQaPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [days, setDays] = useState<DayEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [todayKey, setTodayKey] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const viewingPast = selectedDate !== null && todayKey !== null && selectedDate !== todayKey

  const refreshDays = useCallback(() => {
    fetch('/api/chat/history/days')
      .then((r) => r.json())
      .then((data: DayEntry[]) => { if (Array.isArray(data)) setDays(data) })
      .catch(() => {})
  }, [])

  const loadDay = useCallback((date?: string) => {
    setHistoryLoading(true)
    const url = date ? `/api/chat/history?date=${date}` : '/api/chat/history'
    fetch(url)
      .then((r) => r.json())
      .then((data: { date: string; isToday: boolean; messages: { id: string; role: 'user' | 'assistant'; content: string; sources: Source[] }[] }) => {
        if (data && Array.isArray(data.messages)) {
          setMessages(data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources ?? [],
          })))
          setSelectedDate(data.date)
          if (data.isToday) setTodayKey(data.date)
        }
      })
      .finally(() => setHistoryLoading(false))
    setSidebarOpen(false)
  }, [])

  // 오늘 대화 로드 (날짜별 대화 목록도 함께)
  useEffect(() => {
    loadDay()
    refreshDays()
  }, [loadDay, refreshDays])

  // 스크롤 하단 고정
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // textarea 자동 높이
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    adjustTextarea()
  }

  const clearHistory = async () => {
    await fetch('/api/chat/history', { method: 'DELETE' })
    setMessages([])
    if (todayKey) setSelectedDate(todayKey)
    refreshDays()
  }

  const sendMessage = async (preset?: string) => {
    const text = (preset ?? input).trim()
    if (!text || loading || viewingPast) return

    if (!preset) {
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text }
    const assistantId = `a-${Date.now()}`
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', sources: [] }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }))

    abortRef.current = new AbortController()

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: abortRef.current.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error('응답 오류')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (currentEvent === 'sources') {
              const sources: Source[] = JSON.parse(data)
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
              )
            } else if (currentEvent === 'text') {
              const chunk: string = JSON.parse(data)
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunk } : m
                )
              )
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: '오류가 발생했습니다. 다시 시도해 주세요.' }
              : m
          )
        )
      }
    } finally {
      setLoading(false)
      refreshDays()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex bg-gray-50" style={{ height: '100dvh' }}>
      {/* 사이드바 오버레이 (평소엔 숨김) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 대화 목록 사이드바 (기본 숨김, 버튼으로 토글) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 md:w-72 flex-none bg-white border-r border-gray-200 flex flex-col transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-none px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">대화 기록</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {days.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">대화 기록이 없습니다</p>
          ) : (
            days.map((d) => (
              <button
                key={d.date}
                onClick={() => loadDay(d.date)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  d.date === selectedDate
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {d.label}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* 헤더 */}
      <div className="flex-none bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-gray-600 p-1 -ml-1"
            aria-label="대화 기록 열기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">AI 질의응답</h1>
            <p className="text-xs text-gray-400 mt-0.5">규정 문서 기반으로 답변합니다</p>
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          새 대화
        </button>
      </div>

      {/* 문서 다운로드 안내 */}
      <div className="flex-none bg-amber-50 border-b border-amber-100 px-4 py-2">
        <p className="text-xs text-amber-800 leading-relaxed">
          규정 문서는 사업 전용 홈페이지(
          <a href="https://edu.kohi.or.kr/mediai" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">https://edu.kohi.or.kr/mediai</a>
          ) 및 국가법령정보센터(
          <a href="https://www.law.go.kr/main.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">https://www.law.go.kr/main.html</a>
          )에서 다운받으실 수 있습니다.
        </p>
      </div>

      {/* 문서 목록 */}
      <DocumentList />

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">
        {historyLoading ? (
          <div className="flex items-center justify-center py-10">
            <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">무엇이 궁금하신가요?</p>
            <p className="text-xs text-gray-400 mb-6">등록된 규정 문서를 바탕으로 답변드립니다.</p>
            <div className="w-full max-w-sm flex flex-col gap-2">
              {[
                '교육 이수 기준과 필수 이수 시간은 어떻게 되나요?',
                '직급별 필수 교육 과정에는 어떤 것들이 있나요?',
                '사업비 집행 기준과 절차는 어떻게 되나요?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
              )}
              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'assistant' && msg.content === '' && loading ? (
                    <TypingDots />
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === 'assistant' && msg.content !== '' && (
                  <SourcesBadge sources={msg.sources ?? []} />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="flex-none bg-white border-t border-gray-200 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {viewingPast ? (
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
            <span className="text-xs text-gray-500">지난 대화 기록입니다. 확인만 가능합니다.</span>
            <button
              onClick={() => loadDay()}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex-none"
            >
              오늘 대화로 이동
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요... (Shift+Enter 줄바꿈)"
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none leading-relaxed"
              style={{ maxHeight: '120px' }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="flex-none w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 flex items-center justify-center transition-colors"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
