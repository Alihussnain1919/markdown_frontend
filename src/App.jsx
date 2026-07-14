import { useCallback, useRef, useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DOC_EXT = ['.pdf', '.docx', '.pptx', '.xlsx', '.html', '.txt', '.csv', '.json']
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif', '.gif']
const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.opus', '.webm', '.flac']

const OCR_MAX_BYTES = 1 * 1024 * 1024
const DOC_MAX_BYTES = 10 * 1024 * 1024 // 
const BATCH_MAX_BYTES = 40 * 1024 * 1024 //

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

function computeStats(text) {
  const characters = text.length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const approx_tokens = Math.max(0, Math.round(characters / 4))
  return { characters, words, approx_tokens }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
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

function AudioIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3v10m0 0a3 3 0 1 1-6 0m6 0a3 3 0 1 0 6 0M12 21V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

function StarIcon({ className, filled }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8-6.1-3.6-6.1 3.6 1.5-6.8-5.2-4.7 6.9-.7L12 2.5Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ className, open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShieldIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2.5l7.5 3v5.2c0 5-3.2 8.9-7.5 10.8-4.3-1.9-7.5-5.8-7.5-10.8V5.5l7.5-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TABS = [
  { key: 'file', label: '📁 Documents' },
  { key: 'image', label: '🖼️ Image (OCR)' },
  { key: 'audio', label: '🎙️ Audio' },
  { key: 'url', label: '🔗 YouTube / Web' },
]

const FAQ_ITEMS = [
  {
    q: 'Do you store my files or their content?',
    a: "No. Uploaded files are written to a temporary location only for the seconds it takes to convert them, then deleted immediately afterward — nothing about your document's content is kept. We do keep a couple of small, non-content things: an anonymous daily/monthly count of OCR requests (just a number, to track the free quota), and whatever you choose to submit in the reviews section.",
  },
  {
    q: 'Is any of this used to train AI models?',
    a: "No. Your files pass through OCR.space (for images) or Hugging Face's Whisper (for audio) purely to extract text — those are one-off API calls for conversion, not training pipelines we control or feed into.",
  },
  {
    q: 'Why do images have a 1MB limit?',
    a: 'The OCR engine we use has a free tier capped at 1MB per image. Compressing or cropping a screenshot before uploading almost always gets it under that.',
  },
  {
    q: 'Why does converting sometimes take up to 90 seconds?',
    a: "This runs on a free hosting tier that goes to sleep after inactivity to save resources. The first request after a quiet period has to wake the server up — after that, conversions are fast again.",
  },
  {
    q: 'Why does YouTube transcript fetching sometimes fail?',
    a: "YouTube blocks transcript requests from many cloud server IP addresses, including free hosting providers — this is on YouTube's side, not a bug here. When it happens, you can paste a transcript you copied yourself from the video's \"Show transcript\" button instead.",
  },
  {
    q: 'Is this actually free to use?',
    a: 'Yes — no account, no payment, no hidden limits beyond the free-tier caps mentioned above (1MB images, daily OCR quota).',
  },
]

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <ShieldIcon className="w-4 h-4 text-teal-400" />
        <h2 className="text-sm font-semibold text-slate-200">Frequently Asked Questions</h2>
      </div>
      <div className="flex flex-col gap-2">
        {FAQ_ITEMS.map((item, i) => {
          const open = openIndex === i
          return (
            <div key={i} className="bg-[#121826] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
              <button
                onClick={() => setOpenIndex(open ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none"
              >
                <span className="text-sm text-slate-200 font-medium">{item.q}</span>
                <ChevronIcon className="w-4 h-4 text-slate-500 shrink-0" open={open} />
              </button>
              {open && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/40 pt-2 bg-[#0B0F17]/30">
                  {item.a}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReviewsSection() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_URL}/reviews`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews || [])
      }
    } catch (err) {
      console.error('Failed to load reviews', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const submitReview = async () => {
    if (!name.trim() || !comment.trim() || rating === 0) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), rating, comment: comment.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Could not submit review')

      setReviews((prev) => [data.review, ...prev])
      setName('')
      setRating(0)
      setComment('')
      setSubmitted(true)
      setTimeout(() => setSubmitted(false), 2500)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-teal-400">💬</span>
        <h2 className="text-sm font-semibold text-slate-200">Community Feedback</h2>
      </div>

      {/* Submission form */}
      <div className="bg-[#121826] border border-slate-800 rounded-xl p-4 mb-4 hover:border-slate-700 transition-colors">
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="flex-1 bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400 transition-colors"
          />
          <div className="flex items-center gap-1 px-1 justify-center sm:justify-start">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="text-amber-400 focus:outline-none"
              >
                <StarIcon className="w-5 h-5 animate-pulse-slow" filled={n <= (hoverRating || rating)} />
              </button>
            ))}
          </div>
        </div>
        <textarea
          placeholder="What did you think of the converter?"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400 transition-colors resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          {submitError ? (
            <p className="text-xs text-red-400">{submitError}</p>
          ) : submitted ? (
            <p className="text-xs text-teal-400">Thanks for the feedback! ✓</p>
          ) : (
            <span />
          )}
          <button
            onClick={submitReview}
            disabled={!name.trim() || !comment.trim() || rating === 0 || submitting}
            className="text-xs px-4 py-2 rounded-md bg-teal-400 text-[#0B0F17] font-medium hover:bg-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>

      {/* Reviews list - Constrained Height with Scrollbar */}
      <div className="flex-1 max-h-[340px] overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {loading ? (
          <p className="text-xs text-slate-500 italic">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No reviews yet — be the first!</p>
        ) : (
          reviews.slice(0, 20).map((r, i) => (
            <div key={i} className="bg-[#121826] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-200">{r.name}</span>
                <div className="flex gap-0.5 text-amber-400">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <StarIcon key={n} className="w-3 h-3" filled={n <= r.rating} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed break-words">{r.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('file')
  const [files, setFiles] = useState([])
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle')
  const [markdown, setMarkdown] = useState('')
  const [batchResults, setBatchResults] = useState([])
  const [errorMsg, setErrorMsg] = useState('')
  const [isYoutubeError, setIsYoutubeError] = useState(false)
  const [copied, setCopied] = useState(false)

  const [stats, setStats] = useState(null)

  const [asZip, setAsZip] = useState(false)
  const [isZipResponse, setIsZipResponse] = useState(false)

  const [oversizedInfo, setOversizedInfo] = useState(null)
  const [isServerSleeping, setIsServerSleeping] = useState(false)
  const [countdown, setCountdown] = useState(90)
  const [ocrUsage, setOcrUsage] = useState(null)

  const [manualTranscript, setManualTranscript] = useState('')

  const inputRef = useRef(null)

  const fetchOcrUsage = async () => {
    try {
      const res = await fetch(`${API_URL}/usage`)
      if (res.ok) {
        const data = await res.json()
        setOcrUsage(data)
      }
    } catch (err) {
      console.error('Failed to fetch OCR usage metrics', err)
    }
  }

  useEffect(() => {
    fetchOcrUsage()
  }, [activeTab])

  useEffect(() => {
    let timer
    if (isServerSleeping && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [isServerSleeping, countdown])

  const pickFiles = useCallback((fileList, kind) => {
    if (!fileList || fileList.length === 0) return

    let allowed = DOC_EXT
    if (kind === 'image') allowed = IMAGE_EXT
    if (kind === 'audio') allowed = AUDIO_EXT

    const incomingFiles = Array.from(fileList)

    // 1. Check if the user selected more than 4 files at once
    if (kind === 'file' && incomingFiles.length > 4) {
      setErrorMsg("You can only upload a maximum of 4 files at a time.")
      setStatus('error')
      return
    }

    // 2. Check collective batch size limit (40MB total)
    if (kind === 'file' && incomingFiles.length > 1) {
      const totalBatchSize = incomingFiles.reduce((sum, f) => sum + f.size, 0)
      if (totalBatchSize > BATCH_MAX_BYTES) {
        setErrorMsg(`The total size of your files (${formatBytes(totalBatchSize)}) exceeds the 40 MB batch limit.`)
        setStatus('error')
        return
      }
    }

    // 3. Loop through individual files to check file types and individual size limits
    for (const f of incomingFiles) {
      const ext = '.' + f.name.split('.').pop().toLowerCase()

      // Check if file type is allowed
      if (!allowed.includes(ext)) {
        setErrorMsg(`Unsupported file type: ${ext}`)
        setStatus('error')
        return
      }

      // Check single document size (max 10MB)
      if (kind === 'file' && f.size > DOC_MAX_BYTES) {
        setErrorMsg(`File "${f.name}" is too heavy. Maximum size per file is 10 MB.`)
        setStatus('error')
        return
      }

      // Check single image size (max 1MB)
      if (kind === 'image' && f.size > OCR_MAX_BYTES) {
        setOversizedInfo({ name: f.name, size: f.size })
        return
      }
    }

    // 4. Everything is clean, set the state!
    setOversizedInfo(null)
    setFiles(kind === 'file' ? incomingFiles.slice(0, 4) : [incomingFiles[0]])
    setStatus('idle')
    setMarkdown('')
    setBatchResults([])
    setErrorMsg('')
    setStats(null)
    setIsZipResponse(false)
    setManualTranscript('')
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (['file', 'image', 'audio'].includes(activeTab)) {
      pickFiles(e.dataTransfer.files, activeTab)
    }
  }

  const isYoutubeUrl = (u) => /youtube.com|youtu.be/i.test(u)

  const convert = async () => {
    if (['file', 'image', 'audio'].includes(activeTab) && files.length === 0) return
    if (activeTab === 'url' && !urlInput.trim()) return

    setStatus('converting')
    setErrorMsg('')
    setIsYoutubeError(false)
    setIsServerSleeping(false)
    setCountdown(90)
    setStats(null)
    setIsZipResponse(false)
    setManualTranscript('')

    const sleepCheckTimer = setTimeout(() => {
      setIsServerSleeping(true)
    }, 4000)

    try {
      let res
      if (['file', 'image', 'audio'].includes(activeTab)) {
        const form = new FormData()

        if (activeTab === 'file' && files.length > 1) {
          files.forEach(f => form.append('files', f))
          res = await fetch(`${API_URL}/convert-batch?as_zip=${asZip}`, { method: 'POST', body: form })
        } else {
          form.append('file', files[0])
          res = await fetch(`${API_URL}/convert`, { method: 'POST', body: form })
        }
      } else {
        res = await fetch(`${API_URL}/convert-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlInput.trim() }),
        })
      }

      clearTimeout(sleepCheckTimer)
      setIsServerSleeping(false)

      if (!res.ok) {
        const data = await res.json()
        const msg = data.detail || 'Conversion failed'
        if (activeTab === 'url' && isYoutubeUrl(urlInput) && res.status === 429) {
          setIsYoutubeError(true)
        }
        throw new Error(msg)
      }

      const contentType = res.headers.get('content-type')
      if (contentType && contentType.includes('application/zip')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'converted-batch.zip'
        a.click()
        URL.revokeObjectURL(url)

        setIsZipResponse(true)
        setMarkdown('# Archive Downloaded\n\nYour converted files are zipped inside `converted-batch.zip`. Check your downloads folder.')
        setStatus('done')
        return
      }

      const data = await res.json()

      if (data.results) {
        setBatchResults(data.results)
        const combinedMarkdown = data.results.map(r => `## ${r.filename}\n\n${r.markdown || r.error}`).join('\n\n')
        setMarkdown(combinedMarkdown)

        const totalTokens = data.results.reduce((acc, curr) => acc + (curr.stats?.approx_tokens || 0), 0)
        const totalWords = data.results.reduce((acc, curr) => acc + (curr.stats?.words || 0), 0)
        const totalChars = data.results.reduce((acc, curr) => acc + (curr.stats?.characters || 0), 0)
        const totalOriginalBytes = data.results.reduce((acc, curr) => acc + (curr.stats?.original_bytes || 0), 0)
        const totalOutputBytes = data.results.reduce((acc, curr) => acc + (curr.stats?.output_bytes || 0), 0)

        setStats({
          approx_tokens: totalTokens,
          words: totalWords,
          characters: totalChars,
          original_bytes: totalOriginalBytes,
          output_bytes: totalOutputBytes,
        })
      } else {
        setMarkdown(data.markdown)
        if (data.stats) setStats(data.stats)
      }

      setStatus('done')
      fetchOcrUsage()
    } catch (err) {
      clearTimeout(sleepCheckTimer)
      setIsServerSleeping(false)
      setErrorMsg(err.message || 'Something went wrong')
      setStatus('error')
    }
  }

  const useManualTranscript = () => {
    if (!manualTranscript.trim()) return
    const markdownOutput = (
      `# YouTube Video Transcript (pasted manually)\n\n**Source URL:** ${urlInput.trim()}\n\n---\n\n${manualTranscript.trim()}`
    )
    setMarkdown(markdownOutput)
    setStats(computeStats(markdownOutput))
    setStatus('done')
    setErrorMsg('')
    setIsYoutubeError(false)
  }

  const reset = () => {
    setFiles([])
    setUrlInput('')
    setStatus('idle')
    setMarkdown('')
    setBatchResults([])
    setErrorMsg('')
    setIsYoutubeError(false)
    setIsServerSleeping(false)
    setOversizedInfo(null)
    setStats(null)
    setIsZipResponse(false)
    setManualTranscript('')
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    reset()
  }

  const download = () => {
    if (isZipResponse) return
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab === 'url'
      ? 'video-transcript.md'
      : files.length > 1 ? 'batch-conversion.md' : `${files[0].name.replace(/\.[^/.]+$/, '')}.md`
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

  const hasSizeComparison = stats && stats.original_bytes > 0 && stats.output_bytes >= 0
  const sizeReductionPct = hasSizeComparison
    ? Math.round((1 - stats.output_bytes / stats.original_bytes) * 100)
    : null

  return (
    <div className="min-h-screen bg-[#0B0F17] font-body text-slate-100 flex flex-col items-center px-4 py-12 sm:py-16">
      <header className="text-center mb-8 max-w-lg">
        <div className="inline-flex items-center gap-2 text-teal-400 text-xs font-medium tracking-wide uppercase mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          ScribeDoc Engine
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Turn any media into clean Markdown</h1>
        <p className="text-slate-400 mt-3 text-sm sm:text-base">
          Documents, images, audio, and YouTube links — converted into clean, structured Markdown.
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
      <div className="w-full max-w-xl bg-[#121826] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] mb-8">

        {/* Input Mode Tabs */}
        <div className="flex border-b border-slate-800 mb-6 gap-4 overflow-x-auto scrollbar-none">
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
          <div className="flex flex-col gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center text-center cursor-pointer transition-colors ${dragging ? 'border-teal-400 bg-teal-400/5' : 'border-slate-700 hover:border-slate-600'}`}
            >
              <input ref={inputRef} type="file" multiple className="hidden" accept={DOC_EXT.join(',')} onChange={(e) => pickFiles(e.target.files, 'file')} />
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 ${files.length > 0 ? 'bg-teal-400/10 text-teal-300' : 'bg-slate-800 text-slate-500'}`}>
                <FileIcon className="w-5 h-5" />
              </div>
              {files.length > 0 ? (
                <>
                  <p className="font-mono text-sm text-slate-200 truncate max-w-full">
                    {files.length === 1 ? files[0].name : `📂 ${files.length} files selected`}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Click to modify file selection</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300 font-medium">Drag files here, or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">Supports up to 4 documents (Max 10MB per file, 40MB total)</p>
                </>
              )}
            </div>

            {files.length > 1 && (
              <label className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={asZip}
                  onChange={(e) => setAsZip(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-teal-400 focus:ring-teal-400/20 focus:ring-offset-0"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-200">Download as a zipped .md bundle</span>
                  <span className="text-[11px] text-slate-500">One .zip file instead of a combined preview</span>
                </div>
              </label>
            )}
          </div>
        )}

        {/* Tab 2: Image Upload */}
        {activeTab === 'image' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center text-center cursor-pointer transition-colors ${dragging ? 'border-teal-400 bg-teal-400/5' : 'border-slate-700 hover:border-slate-600'}`}
            >
              <input ref={inputRef} type="file" className="hidden" accept={IMAGE_EXT.join(',')} onChange={(e) => pickFiles(e.target.files, 'image')} />
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 ${files.length > 0 ? 'bg-teal-400/10 text-teal-300' : 'bg-slate-800 text-slate-500'}`}>
                <ImageIcon className="w-5 h-5" />
              </div>
              {files.length > 0 ? (
                <>
                  <p className="font-mono text-sm text-slate-200 truncate max-w-full">{files[0].name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(files[0].size / 1024).toFixed(1)} KB — click to replace</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-300 font-medium">Drag a screenshot here, or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">Max 1MB per image file</p>
                </>
              )}
            </div>

            {ocrUsage && (
              <div className="mt-4 p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex justify-between items-center text-xs text-slate-400">
                <span>Daily OCR Remaining: <strong className="text-teal-400">{ocrUsage.daily.remaining}</strong> / {ocrUsage.daily.limit}</span>
                <span>Monthly: <strong className="text-slate-300">{ocrUsage.monthly.remaining}</strong> remaining</span>
              </div>
            )}

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
                      <span className="font-semibold text-rose-200">{(oversizedInfo.size / 1024 / 1024).toFixed(2)}MB</span>.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-rose-400 to-orange-400 transition-all duration-500" style={{ width: `${sizeBarPct}%` }} />
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 shrink-0">1MB limit</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 3: Audio Upload */}
        {activeTab === 'audio' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-8 flex flex-col items-center text-center cursor-pointer transition-colors ${dragging ? 'border-teal-400 bg-teal-400/5' : 'border-slate-700 hover:border-slate-600'}`}
          >
            <input ref={inputRef} type="file" className="hidden" accept={AUDIO_EXT.join(',')} onChange={(e) => pickFiles(e.target.files, 'audio')} />
            <div className={`w-11 h-11 rounded-lg flex items-center justify-center mb-3 ${files.length > 0 ? 'bg-teal-400/10 text-teal-300' : 'bg-slate-800 text-slate-500'}`}>
              <AudioIcon className="w-5 h-5" />
            </div>
            {files.length > 0 ? (
              <>
                <p className="font-mono text-sm text-slate-200 truncate max-w-full">{files[0].name}</p>
                <p className="text-xs text-slate-500 mt-1">{(files[0].size / 1024 / 1024).toFixed(2)} MB — click to replace</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300 font-medium">Drag an audio file here, or click to browse</p>
                <p className="text-xs text-slate-500 mt-1">Transcribes voice using Whisper (Hugging Face)</p>
              </>
            )}
          </div>
        )}

        {/* Tab 4: URL Input */}
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
          </div>
        )}

        {/* Action row */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={convert}
            disabled={(activeTab === 'url' ? !urlInput.trim() : files.length === 0) || status === 'converting'}
            className="flex-1 rounded-lg bg-teal-400 text-[#0B0F17] font-semibold text-sm py-2.5 hover:bg-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'converting'
              ? (activeTab === 'image' ? 'Running OCR…' : activeTab === 'audio' ? 'Transcribing…' : 'Converting…')
              : (activeTab === 'file' && files.length > 1 ? `Convert ${files.length} Files` : activeTab === 'image' ? 'Extract Text (OCR)' : activeTab === 'audio' ? 'Transcribe Audio' : 'Convert to Markdown')}
          </button>
          {(files.length > 0 || urlInput) && (
            <button onClick={reset} className="rounded-lg border border-slate-700 text-slate-400 text-sm px-4 hover:border-slate-600 hover:text-slate-300 transition-colors">
              Clear
            </button>
          )}
        </div>

        {/* Server Waking Up Alert */}
        {status === 'converting' && isServerSleeping && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <span className="text-lg">⏳</span>
              <div className="flex-1">
                <h4 className="text-amber-400 font-medium text-sm">Waking up the engine...</h4>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  Free hosting server is sleeping. Waking it up takes up to <span className="text-amber-300 font-semibold">90 seconds</span>.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all duration-1000 ease-linear" style={{ width: `${((90 - countdown) / 90) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-amber-400 font-semibold">{countdown}s</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-red-400 text-sm whitespace-pre-wrap">
            {errorMsg}
          </div>
        )}

        {status === 'error' && isYoutubeError && (
          <div className="mt-3 rounded-xl border border-teal-500/20 bg-teal-950/10 p-4">
            <h4 className="text-teal-300 font-medium text-sm">Paste the transcript manually instead</h4>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              On the video, click the <span className="text-slate-300">···</span> menu below the player →{' '}
              <span className="text-slate-300">Show transcript</span> → copy the text → paste it here.
              This happens in your browser, so YouTube blocking our server doesn't affect it.
            </p>
            <textarea
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
              placeholder="Paste the copied transcript here…"
              rows={5}
              className="w-full mt-3 bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400 transition-colors resize-y"
            />
            <button
              onClick={useManualTranscript}
              disabled={!manualTranscript.trim()}
              className="mt-2 text-xs px-3 py-1.5 rounded-md bg-teal-400 text-[#0B0F17] font-medium hover:bg-teal-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Format as Markdown
            </button>
          </div>
        )}

        {/* Output Section */}
        {status === 'done' && (
          <div className="mt-6">
            {stats && (
              <div className="mb-4 flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#0B0F17] border border-slate-800 p-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Tokens (approx.)</p>
                    <p className="text-base font-semibold text-teal-400 font-mono mt-0.5">{stats.approx_tokens}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Words</p>
                    <p className="text-base font-semibold text-slate-300 font-mono mt-0.5">{stats.words}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Characters</p>
                    <p className="text-base font-semibold text-slate-400 font-mono mt-0.5">{stats.characters}</p>
                  </div>
                </div>

                {hasSizeComparison && sizeReductionPct !== null && sizeReductionPct > 0 && (
                  <div className="p-3 bg-gradient-to-r from-teal-950/30 to-slate-900/40 border border-teal-500/20 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-medium">File Size Reduced</span>
                      <span className="text-[11px] text-slate-500 mt-0.5">
                        Original: <strong className="font-mono text-slate-400">{formatBytes(stats.original_bytes)}</strong> → Extracted text: <strong className="font-mono text-teal-400">{formatBytes(stats.output_bytes)}</strong>
                      </span>
                    </div>
                    <p className="text-teal-300 font-mono font-bold text-sm">-{sizeReductionPct}%</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">
                {isZipResponse ? 'Zip Download' : batchResults.length > 0 ? `Batch Output (${batchResults.length} Files)` : 'Result'}
              </p>
              <div className="flex gap-2">
                {!isZipResponse && (
                  <button onClick={copy} className="text-xs px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:border-slate-600 transition-colors">
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                )}
                <button
                  onClick={download}
                  disabled={isZipResponse}
                  className="text-xs px-3 py-1.5 rounded-md bg-teal-400 text-[#0B0F17] font-medium hover:bg-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isZipResponse ? 'Downloaded ✓' : 'Download Output'}
                </button>
              </div>
            </div>
            <pre className="h-[280px] overflow-y-auto rounded-lg bg-[#0B0F17] border border-slate-800 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {markdown}
            </pre>
          </div>
        )}
      </div>

      {/* Two Column Grid layout for FAQ and Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mt-4">
        <div>
          <FaqSection />
        </div>
        <div>
          <ReviewsSection />
        </div>
      </div>

      <footer className="mt-16 text-slate-600 text-xs text-center border-t border-slate-800/40 w-full max-w-4xl pt-8">
        Built on Microsoft's MarkItDown · FastAPI + React
      </footer>
    </div>
  )
}