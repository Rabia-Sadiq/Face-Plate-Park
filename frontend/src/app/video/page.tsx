'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import {
  Video, Upload, Wifi, WifiOff, Play, Square,
  Camera, AlertCircle, CheckCircle2, XCircle,
  ChevronRight, Layers, ScanLine, Car, User
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Detection {
  bbox: [number, number, number, number]
  confidence: number
  class: string
  text: string
  employee?: string
  access?: boolean
}
interface FrameResult {
  frame: string          // base64 annotated image (webcam mode)
  plates: Detection[]
  faces: Detection[]
  timestamp?: string
}
interface VideoResult {
  total_frames: number
  frames_processed: number
  detections_found: number
  results: {
    frame: number
    timestamp_sec: number
    snapshot: string
    plates: Detection[]
    faces: Detection[]
  }[]
}

// ── Sub-components ────────────────────────────────────────────────────────────
function DetectionBadge({ det, type }: { det: Detection; type: 'face' | 'plate' }) {
  const isGranted = det.access === true
  const isUnknown = det.access === false || det.access === undefined
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono ${
      type === 'face'
        ? 'border-[#00FF94]/30 bg-[#00FF94]/5 text-[#00FF94]'
        : isGranted
          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
          : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
    }`}>
      {type === 'face' ? <User size={12} /> : <Car size={12} />}
      <span>{det.text}</span>
      {det.employee && det.employee !== 'Unknown' && (
        <span className="text-gray-400">· {det.employee}</span>
      )}
      <span className="ml-auto opacity-60">{(det.confidence * 100).toFixed(0)}%</span>
    </div>
  )
}

function DetectionPanel({ plates, faces }: { plates: Detection[], faces: Detection[] }) {
  if (!plates.length && !faces.length) return null
  return (
    <div className="space-y-2">
      {faces.map((f, i) => <DetectionBadge key={`f${i}`} det={f} type="face" />)}
      {plates.map((p, i) => <DetectionBadge key={`p${i}`} det={p} type="plate" />)}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VideoDetectionPage() {
  const [mode, setMode] = useState<'webcam' | 'upload'>('webcam')

  // Webcam state
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const overlayRef  = useRef<HTMLCanvasElement>(null)
  const wsRef       = useRef<WebSocket | null>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const intervalRef = useRef<any>(null)
  const [wsActive,  setWsActive]  = useState(false)
  const [liveResult, setLiveResult] = useState<FrameResult | null>(null)

  // Upload state
  const [uploading,    setUploading]    = useState(false)
  const [videoResult,  setVideoResult]  = useState<VideoResult | null>(null)
  const [progress,     setProgress]     = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null)

  // ── Webcam / WebSocket logic ────────────────────────────────────────────────
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      toast.error('Camera access denied')
    }
  }

  const startDetection = useCallback(async () => {
    await startWebcam()
    const ws = new WebSocket('ws://localhost:8000/api/video/ws/stream')
    wsRef.current = ws

    ws.onopen = () => { setWsActive(true); toast.success('Detection started!') }
    ws.onclose = () => { setWsActive(false) }
    ws.onerror = () => { toast.error('WebSocket error — is backend running?'); setWsActive(false) }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.error) return

      // Draw annotated frame on overlay canvas
      if (data.frame && overlayRef.current) {
        const img = new Image()
        img.onload = () => {
          const ctx = overlayRef.current!.getContext('2d')!
          overlayRef.current!.width  = img.width
          overlayRef.current!.height = img.height
          ctx.drawImage(img, 0, 0)
        }
        img.src = data.frame
      }
      setLiveResult(data)
    }

    // Send frames every 200ms (5fps to backend)
    intervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || ws.readyState !== WebSocket.OPEN) return
      const ctx = canvasRef.current.getContext('2d')!
      canvasRef.current.width  = videoRef.current.videoWidth  || 640
      canvasRef.current.height = videoRef.current.videoHeight || 480
      ctx.drawImage(videoRef.current, 0, 0)
      const b64 = canvasRef.current.toDataURL('image/jpeg', 0.7)
      ws.send(JSON.stringify({ frame: b64 }))
    }, 200)
  }, [])

  const stopDetection = useCallback(() => {
    clearInterval(intervalRef.current)
    wsRef.current?.close()
    streamRef.current?.getTracks().forEach(t => t.stop())
    setWsActive(false)
    setLiveResult(null)
    if (overlayRef.current) {
      overlayRef.current.getContext('2d')?.clearRect(0, 0, 9999, 9999)
    }
  }, [])

  useEffect(() => () => stopDetection(), [])

  // ── Video upload logic ──────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setVideoResult(null)
  }

  const handleUploadProcess = async () => {
    if (!selectedFile) return
    setUploading(true)
    setProgress(0)

    const fd = new FormData()
    fd.append('video', selectedFile)
    fd.append('save_detections', 'true')

    try {
      // Fake progress while waiting
      const prog = setInterval(() => setProgress(p => Math.min(p + 3, 90)), 400)
      const r = await api.post('/api/video/process', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      })
      clearInterval(prog)
      setProgress(100)
      setVideoResult(r.data)
      toast.success(`Done! Found ${r.data.detections_found} detection events`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Processing failed')
    } finally {
      setUploading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <Video size={28} className="text-brand" /> Video Detection
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Live webcam stream or upload video — YOLO detects face + license plate
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 bg-surface-2 border border-border p-1 rounded-xl w-fit">
        {([['webcam', Camera, 'Live Webcam'], ['upload', Upload, 'Upload Video']] as const).map(
          ([m, Icon, label]) => (
            <button key={m} onClick={() => { setMode(m as any); stopDetection() }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? 'bg-brand text-black' : 'text-gray-400 hover:text-white'
              }`}>
              <Icon size={15} />{label}
            </button>
          )
        )}
      </div>

      {/* ── WEBCAM MODE ── */}
      {mode === 'webcam' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video feed */}
          <div className="lg:col-span-2 space-y-3">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-border">
              {/* Raw webcam (hidden — used for frame capture) */}
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" muted playsInline />
              {/* Annotated overlay from backend */}
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-contain" />
              {/* Hidden capture canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {!wsActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-surface-1 border border-border flex items-center justify-center">
                    <Camera size={32} className="text-gray-600" />
                  </div>
                  <p className="text-gray-600 text-sm">Press Start to begin detection</p>
                </div>
              )}

              {/* Live indicator */}
              {wsActive && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-white text-xs font-mono font-bold">LIVE</span>
                </div>
              )}

              {/* Detection count */}
              {wsActive && liveResult && (
                <div className="absolute top-3 right-3 flex gap-2">
                  <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-xs font-mono text-[#00FF94]">
                    👤 {liveResult.faces?.length || 0}
                  </div>
                  <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-xs font-mono text-cyan-400">
                    🚗 {liveResult.plates?.length || 0}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              {!wsActive ? (
                <button onClick={startDetection}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand text-black py-3 rounded-xl font-bold hover:bg-brand/90 transition-all">
                  <Play size={18} /> Start Detection
                </button>
              ) : (
                <button onClick={stopDetection}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/40 text-red-400 py-3 rounded-xl font-bold hover:bg-red-500/20 transition-all">
                  <Square size={18} /> Stop Detection
                </button>
              )}
            </div>
          </div>

          {/* Detection sidebar */}
          <div className="space-y-4">
            <div className="bg-surface-1 border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={14} className="text-brand" />
                <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Live Detections</h3>
              </div>

              {!liveResult || (!liveResult.faces?.length && !liveResult.plates?.length) ? (
                <div className="text-center py-8">
                  <ScanLine size={24} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-600 text-xs">No detections yet</p>
                </div>
              ) : (
                <DetectionPanel plates={liveResult.plates || []} faces={liveResult.faces || []} />
              )}
            </div>

            {/* Connection status */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
              wsActive
                ? 'bg-brand/5 border-brand/30 text-brand'
                : 'bg-surface-1 border-border text-gray-500'
            }`}>
              {wsActive ? <Wifi size={16} /> : <WifiOff size={16} />}
              {wsActive ? 'Connected to backend' : 'Not connected'}
            </div>

            {/* Instructions */}
            <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-2 text-xs text-gray-500">
              <p className="text-gray-400 font-semibold">How it works:</p>
              <p>1. Click <span className="text-brand">Start Detection</span></p>
              <p>2. Allow camera access</p>
              <p>3. Point camera at vehicle</p>
              <p>4. YOLO detects face + plate live</p>
              <p>5. Matched employees shown instantly</p>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD MODE ── */}
      {mode === 'upload' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: upload + video preview */}
          <div className="lg:col-span-2 space-y-4">

            {/* Drop zone */}
            <label className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-all ${
              selectedFile ? 'border-brand/40 bg-brand/5' : 'border-border hover:border-brand/30 hover:bg-surface-1'
            }`}>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${selectedFile ? 'bg-brand/20' : 'bg-surface-2'}`}>
                <Video size={28} className={selectedFile ? 'text-brand' : 'text-gray-600'} />
              </div>
              <div className="text-center">
                {selectedFile ? (
                  <>
                    <p className="text-white font-semibold">{selectedFile.name}</p>
                    <p className="text-gray-500 text-xs mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 font-semibold">Drop video here or click to browse</p>
                    <p className="text-gray-600 text-xs mt-1">MP4, AVI, MOV, MKV supported</p>
                  </>
                )}
              </div>
              <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
            </label>

            {/* Video preview */}
            {previewUrl && (
              <div className="rounded-xl overflow-hidden border border-border bg-black">
                <video src={previewUrl} controls className="w-full max-h-[360px] object-contain" />
              </div>
            )}

            {/* Process button */}
            {selectedFile && (
              <button onClick={handleUploadProcess} disabled={uploading}
                className="w-full flex items-center justify-center gap-3 bg-brand text-black py-3.5 rounded-xl font-bold text-sm hover:bg-brand/90 transition-all disabled:opacity-50">
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Processing video… {progress}%
                  </>
                ) : (
                  <><ScanLine size={18} /> Run YOLO Detection</>
                )}
              </button>
            )}

            {/* Progress bar */}
            {uploading && (
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-brand transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {!videoResult ? (
              <div className="bg-surface-1 border border-border rounded-xl p-6 text-center">
                <Upload size={28} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">Upload a video and run detection to see results here</p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="bg-surface-1 border border-border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                    <Layers size={14} className="text-brand" /> Results
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['Frames', videoResult.total_frames],
                      ['Processed', videoResult.frames_processed],
                      ['Events', videoResult.detections_found],
                    ].map(([k, v]) => (
                      <div key={k} className="bg-surface-2 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-white font-mono">{v}</p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wide mt-0.5">{k}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detection events */}
                <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-white">Detection Events</h3>
                  </div>
                  <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                    {videoResult.results.length === 0 && (
                      <p className="text-center text-gray-600 py-8 text-sm">No detections found</p>
                    )}
                    {videoResult.results.map((r, i) => (
                      <div key={i} className="p-4 space-y-2 hover:bg-surface-2 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-gray-500">
                            Frame #{r.frame} · {r.timestamp_sec}s
                          </span>
                          <div className="flex gap-1.5">
                            {r.faces.length > 0 && (
                              <span className="text-[10px] bg-[#00FF94]/10 text-[#00FF94] px-2 py-0.5 rounded-full font-mono">
                                👤 {r.faces.length}
                              </span>
                            )}
                            {r.plates.length > 0 && (
                              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-mono">
                                🚗 {r.plates.length}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Snapshot thumbnail */}
                        {r.snapshot && (
                          <a href={`http://localhost:8000/${r.snapshot}`} target="_blank">
                            <img src={`http://localhost:8000/${r.snapshot}`}
                              className="w-full rounded-lg border border-border hover:border-brand/40 transition-colors"
                              alt={`Frame ${r.frame}`} />
                          </a>
                        )}

                        {/* Detections */}
                        <DetectionPanel plates={r.plates} faces={r.faces} />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}