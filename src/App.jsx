import { useCallback, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const ACCEPTED = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.txt', '.csv', '.json']

const STEPS = [
  { key: 'idle', label: 'Input' },
  { key: 'converting', label: 'Convert' },
  { key: 'done', label: 'Export' },
]

function stepIndex(status) {
  if (status === 'done') return 2
  if (status === 'converting') return 1
  return 0
}

function FileIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('file') // 'file' | 'url'
  const [file, setFile] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle')
  const [markdown, setMarkdown] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isYoutubeError, setIsYoutubeError] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)

  const pickFile = useCallback((f) => {
    if (!f) return
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setErrorMsg(`Unsupported file type: ${ext}`)
      setStatus('error')
      return
    }
    setFile(f)
    setStatus('idle')
    setMarkdown('')
    setErrorMsg('')
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (activeTab === 'file') {
      pickFile(e.dataTransfer.files?.[0])
    }
  }

  const isYoutubeUrl = (u) => /youtube\.com|youtu\.be/i.test(u)

  const convert = async () => {
    if (activeTab === 'file' && !file) return
    if (activeTab === 'url' && !urlInput.trim()) return

    setStatus('converting')
    setErrorMsg('')
    setIsYoutubeError(false)
    try {
      let res
      if (activeTab === 'file') {
        const form = new FormData()
        form.append('file', file)
        res = await fetch(`${API_URL}/convert`, { method: 'POST', body: form })
      } else {
        res = await fetch(`${API_URL}/convert-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput.trim() }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        const msg = data.detail || 'Conversion failed'
        if (activeTab === 'url' && isYoutubeUrl(urlInput) && res.status === 429) {
          setIsYoutubeError(true)
        }
        throw new Error(msg)
      }
      setMarkdown(data.markdown)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  const reset = () => {
    setFile(null)
    setUrlInput('')
    setStatus('idle')
    setMarkdown('')
    setErrorMsg('')
    setIsYoutubeError(false)
  }

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab === 'file' 
      ? `${file.name.replace(/\.[^/.]+$/, '')}.md` 
      : 'video-transcript.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const active = stepIndex(status === 'error' ? 'idle' : status)

  return (
    <div className="min-h-screen bg-[#0B0F17] font-body text-slate-100 flex flex-col items-center px-4 py-12 sm:py-16">
      <header className="text-center mb-8 max-w-lg">
        <div className="inline-flex items-center gap-2 text-teal-400 text-xs font-medium tracking-wide uppercase mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          ScribeDoc Engine
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Turn any media into clean Markdown</h1>
        <p className="text-slate-400 mt-3 text-sm sm:text-base">
          Drop files or paste YouTube URLs to convert content into structured Markdown text.
        </p>
      </header>

      {/* Step tracker */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${i === active ? 'bg-teal-400/10 text-teal-300 border border-teal-400/30' : i < active ? 'text-slate-500' : 'text-slate-600'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${i <= active ? 'bg-teal-400 text-[#0B0F17]' : 'bg-slate-800 text-slate-500'}`}>
                {i + 1}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-slate-800" />}
          </div>
        ))}
      </div>

      {/* Main card */}
      <div className="w-full max-w-xl bg-[#121826] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
        
        {/* Input Mode Tabs */}
        <div className="flex border-b border-slate-800 mb-6 gap-4">
          <button 
            onClick={() => { setActiveTab('file'); reset(); }}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'file' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-500 hover:text-slate-400'}`}
          >
            📁 Upload Document
          </button>
          <button 
            onClick={() => { setActiveTab('url'); reset(); }}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'url' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-500 hover:text-slate-400'}`}
          >
            🔗 YouTube / Web URL
          </button>
        </div>

        {/* Tab 1: File Upload */}
        {activeTab === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center text-center cursor-pointer transition-colors ${dragging ? 'border-teal-400 bg-teal-400/5' : 'border-slate-700 hover:border-slate-600'}`}
          >
            <input ref={inputRef} type="file" className="hidden" accept={ACCEPTED.join(',')} onChange={(e) => pickFile(e.target.files?.[0])} />
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 ${file ? 'bg-teal-400/10 text-teal-300' : 'bg-slate-800 text-slate-500'}`}>
              <FileIcon className="w-5 h-5" />
            </div>
            {file ? (
              <>
                <p className="font-mono text-sm text-slate-200 truncate max-w-full">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300 font-medium">Drag a file here, or click to browse</p>
                <p className="text-xs text-slate-500 mt-1">{ACCEPTED.join(' · ')}</p>
              </>
            )}
          </div>
        )}

        {/* Tab 2: URL Link Input */}
        {activeTab === 'url' && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Paste Link</label>
            <input 
              type="text" 
              placeholder="https://www.youtube.com/watch?v=..." 
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-4 py-3 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400 transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1">
              Supports full video transcripts or standard web pages. YouTube transcripts occasionally fail
              due to platform-side restrictions outside our control — if that happens, waiting a bit or
              trying a different video usually works.
            </p>
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={convert}
            disabled={(activeTab === 'file' ? !file : !urlInput.trim()) || status === 'converting'}
            className="flex-1 rounded-lg bg-teal-400 text-[#0B0F17] font-semibold text-sm py-2.5 hover:bg-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'converting' ? 'Converting…' : 'Convert to Markdown'}
          </button>
          {(file || urlInput) && (
            <button onClick={reset} className="rounded-lg border border-slate-700 text-slate-400 text-sm px-4 hover:border-slate-600 hover:text-slate-300 transition-colors">
              Clear
            </button>
          )}
        </div>

        {status === 'error' && (
          <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 p-3">
            <p className="text-red-400 text-sm">{errorMsg}</p>
            {isYoutubeError && (
              <p className="text-slate-400 text-xs mt-2">
                This is a YouTube-side restriction on this video right now, not a bug in your file — it can
                clear up on its own, and doesn't affect file uploads or regular web pages.
              </p>
            )}
          </div>
        )}

        {/* Output Section */}
        {status === 'done' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">Result</p>
              <div className="flex gap-2">
                <button onClick={copy} className="text-xs px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors">
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                <button onClick={download} className="text-xs px-3 py-1.5 rounded-md bg-teal-400 text-[#0B0F17] font-medium hover:bg-teal-300 transition-colors">
                  Download .md
                </button>
              </div>
            </div>
            <pre className="h-[320px] overflow-y-auto rounded-lg bg-[#0B0F17] border border-slate-800 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {markdown}
            </pre>
          </div>
        )}
      </div>

      <footer className="mt-10 text-slate-600 text-xs text-center">
        Built on Microsoft's MarkItDown · FastAPI + React
      </footer>
    </div>
  )
}