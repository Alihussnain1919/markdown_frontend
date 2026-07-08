import { useCallback, useRef, useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DOC_EXT = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.txt', '.csv', '.json']
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif', '.gif']

// OCR.space free tier caps uploads at 1MB — enforce it client-side so users
// get an instant, clear message instead of a server round-trip + error.
const OCR_MAX_BYTES = 1 * 1024 * 1024

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

function ImageIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 15l-5-5-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function ScaleWarnIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3v3M12 21v-3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1M3 12h3M18 12h3"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

const TABS = [
  { key: 'file', label: '📁 Document' },
  { key: 'image', label: '🖼️ Image (OCR)' },
  { key: 'url', label: '🔗 YouTube / Web' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('file') // 'file' | 'image' | 'url'
  const [file, setFile] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle')
  const [markdown, setMarkdown] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isYoutubeError, setIsYoutubeError] = useState(false)
  const [copied, setCopied] = useState(false)

  // Dedicated state for the "file too big" case so it gets its own nicer UI
  // instead of the generic red error box.
  const [oversizedInfo, setOversizedInfo] = useState(null) // { name, size } | null

  // Server Sleeping Alert
  const [isServerSleeping, setIsServerSleeping] = useState(false)
  const [countdown, setCountdown] = useState(90)

  const inputRef = useRef(null)

  useEffect(() => {
    let timer
    if (isServerSleeping && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isServerSleeping, countdown])

  const pickFile = useCallback((f, kind) => {
    if (!f) return
    const ext = '.' + f.name.split('.').pop().toLowerCase()
    const allowed = kind === 'image' ? IMAGE_EXT : DOC_EXT

    if (!allowed.includes(ext)) {
      setErrorMsg(
        kind === 'image'
          ? `Unsupported image type: ${ext}. Try PNG, JPG, WEBP, BMP, TIFF, or GIF.`
          : `Unsupported file type: ${ext}`
      )
      setStatus('error')
      setOversizedInfo(null)
      return
    }

    if (kind === 'image' && f.size > OCR_MAX_BYTES) {
      setOversizedInfo({ name: f.name, size: f.size })
      setFile(null)
      setStatus('idle')
      setErrorMsg('')
      return
    }

    setOversizedInfo(null)
    setFile(f)
    setStatus('idle')
    setMarkdown('')
    setErrorMsg('')
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (activeTab === 'file' || activeTab === 'image') {
      pickFile(e.dataTransfer.files?.[0], activeTab)
    }
  }

  const isYoutubeUrl = (u) => /youtube.com|youtu.be/i.test(u)

  const convert = async () => {
    if ((activeTab === 'file' || activeTab === 'image') && !file) return
    if (activeTab === 'url' && !urlInput.trim()) return

    setStatus('converting')
    setErrorMsg('')
    setIsYoutubeError(false)
    setIsServerSleeping(false)
    setCountdown(90)

    const sleepCheckTimer = setTimeout(() => {
      setIsServerSleeping(true)
    }, 4000)

    try {
      let res
      if (activeTab === 'file' || activeTab === 'image') {
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

      clearTimeout(sleepCheckTimer)
      setIsServerSleeping(false)

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
      clearTimeout(sleepCheckTimer)
      setIsServerSleeping(false)
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
    setIsServerSleeping(false)
    setOversizedInfo(null)
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    reset()
  }

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab === 'url'
      ? 'video-transcript.md'
      : `${file.name.replace(/\.[^/.]+$/, '')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const active = stepIndex(status === 'error' ? 'idle' : status)
  const sizeRatio = oversizedInfo ? Math.min(oversizedInfo.size / OCR_MAX_BYTES, 2.4) : 0
  const sizeBarPct = Math.min((sizeRatio / 2.4) * 100, 100)

  return (
    <div className="min-h-screen bg-[#0B0F17] font-body text-slate-100 flex flex-col items-center px-4 py-12 sm:py-16">
      <header className="text-center mb-8 max-w-lg">
        <div className="inline-flex items-center gap-2 text-teal-400 text-xs font-medium tracking-wide uppercase mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          ScribeDoc Engine
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Turn any media into clean Markdown</h1>
        <p className="text-slate-400 mt-3 text-sm sm:text-base">
          Documents, images, and YouTube links — all converted into clean, structured Markdown.
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
        <div className="flex border-b border-slate-800 mb-6 gap-4 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`pb-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === t.key ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-500 hover:text-slate-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Document Upload */}
        {activeTab === 'file' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center text-center cursor-pointer transition-colors ${dragging ? 'border-teal-400 bg-teal-400/5' : 'border-slate-700 hover:border-slate-600'}`}
          >
            <input ref={inputRef} type="file" className="hidden" accept={DOC_EXT.join(',')} onChange={(e) => pickFile(e.target.files?.[0], 'file')} />
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
                <p className="text-xs text-slate-500 mt-1">{DOC_EXT.join(' · ')}</p>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Image Upload (OCR) */}
        {activeTab === 'image' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center text-center cursor-pointer transition-colors ${dragging ? 'border-teal-400 bg-teal-400/5' : 'border-slate-700 hover:border-slate-600'}`}
            >
              <input ref={inputRef} type="file" className="hidden" accept={IMAGE_EXT.join(',')} onChange={(e) => pickFile(e.target.files?.[0], 'image')} />
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 ${file ? 'bg-teal-400/10 text-teal-300' : 'bg-slate-800 text-slate-500'}`}>
                <ImageIcon className="w-5 h-5" />
              </div>
              {file ? (
                <>
                  <p className="font-mono text-sm text-slate-200 truncate max-w-full">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB — click to replace</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300 font-medium">Drag a screenshot or photo here, or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">{IMAGE_EXT.join(' · ')}</p>
                  <p className="text-xs text-slate-600 mt-1">Max 1MB per image (free OCR tier)</p>
                </>
              )}
            </div>

            {/* Beautiful oversized-file card */}
            {oversizedInfo && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 to-orange-950/20 p-4 overflow-hidden relative">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                    <ScaleWarnIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-rose-300 font-medium text-sm">That image is a bit too heavy</h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      <span className="font-mono text-rose-200">{oversizedInfo.name}</span> is{' '}
                      <span className="font-semibold text-rose-200">{(oversizedInfo.size / 1024 / 1024).toFixed(2)}MB</span>,
                      the free OCR tier tops out at <span className="font-semibold text-slate-300">1MB</span>.
                      Try compressing or cropping it, then drop it back in.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-rose-400 to-orange-400 transition-all duration-500"
                          style={{ width: `${sizeBarPct}%` }}
                        />
                        <div className="absolute top-0 h-1.5 w-px bg-slate-500" style={{ left: `${100 / 2.4}%` }} />
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">1MB limit</span>
                    </div>
                    <button
                      onClick={() => setOversizedInfo(null)}
                      className="mt-3 text-xs text-rose-300 hover:text-rose-200 underline underline-offset-2"
                    >
                      Got it, let me pick another
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 3: URL Link Input */}
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
            disabled={(activeTab === 'url' ? !urlInput.trim() : !file) || status === 'converting'}
            className="flex-1 rounded-lg bg-teal-400 text-[#0B0F17] font-semibold text-sm py-2.5 hover:bg-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'converting'
              ? (activeTab === 'image' ? 'Running OCR…' : 'Converting…')
              : (activeTab === 'image' ? 'Extract Text (OCR)' : 'Convert to Markdown')}
          </button>
          {(file || urlInput) && (
            <button onClick={reset} className="rounded-lg border border-slate-700 text-slate-400 text-sm px-4 hover:border-slate-600 hover:text-slate-300 transition-colors">
              Clear
            </button>
          )}
        </div>

        {/* Server Waking Up Message */}
        {status === 'converting' && isServerSleeping && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <span className="text-lg">⏳</span>
              <div className="flex-1">
                <h4 className="text-amber-400 font-medium text-sm">Waking up the engine...</h4>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  We are using a free hosting server. Because it hasn't been used recently, it takes up to <span className="text-amber-300 font-semibold">90 seconds</span> to turn back on. Please hold on; once awake, your file will convert instantly!
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
                      style={{ width: `${((90 - countdown) / 90) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-amber-400 font-semibold">{countdown}s</span>
                </div>
              </div>
            </div>
          </div>
        )}

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