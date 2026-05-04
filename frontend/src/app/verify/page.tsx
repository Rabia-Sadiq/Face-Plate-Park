'use client'
import { useRef, useState, useCallback } from 'react'
import { api, endpoints } from '@/lib/api'
import { Camera, CheckCircle2, XCircle, ScanLine, RotateCcw, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

interface VerifyResult {
  access_granted: boolean; employee_name: string | null; employee_id: string | null
  license_plate_detected: string | null; face_match_score: number | null
  plate_match: boolean; face_detected: boolean; message: string; log_id: number
}

export default function VerifyPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [entryType, setEntryType] = useState<'ENTRY' | 'EXIT'>('ENTRY')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(false)

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); setStreaming(true) }
  }

  const sendImage = async (blob: Blob) => {
    setLoading(true); setResult(null)
    const fd = new FormData()
    fd.append('image', blob, 'snapshot.jpg')
    fd.append('entry_type', entryType)
    try {
      const r = await api.post(endpoints.verify, fd)
      setResult(r.data)
      toast[r.data.access_granted ? 'success' : 'error'](r.data.message)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Verification failed')
    } finally { setLoading(false) }
  }

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)
    canvasRef.current.toBlob(blob => blob && sendImage(blob), 'image/jpeg', 0.9)
  }, [entryType])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Verify Entry</h1>
        <p className="text-gray-500 text-sm mt-1">Capture vehicle for face + plate verification</p>
      </div>
      <div className="flex gap-2">
        {(['ENTRY', 'EXIT'] as const).map(t => (
          <button key={t} onClick={() => setEntryType(t)}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              entryType === t
                ? t === 'ENTRY' ? 'bg-brand text-black' : 'bg-red-500 text-white'
                : 'bg-surface-2 text-gray-400 hover:text-white'
            }`}>{t}</button>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          <div className="relative bg-black aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Camera size={40} className="text-gray-600" />
                <p className="text-gray-600 text-sm">Camera not started</p>
              </div>
            )}
            {streaming && <div className="absolute inset-0 border-2 border-brand/40 scan-line pointer-events-none" />}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="p-4 flex gap-2">
            {!streaming ? (
              <button onClick={startCamera}
                className="flex-1 flex items-center justify-center gap-2 bg-brand/10 border border-brand/40 text-brand py-2.5 rounded-lg text-sm font-semibold hover:bg-brand/20 transition-all">
                <Camera size={16} /> Start Camera
              </button>
            ) : (
              <button onClick={capture} disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-brand text-black py-2.5 rounded-lg text-sm font-bold hover:bg-brand/90 transition-all disabled:opacity-50">
                <ScanLine size={16} /> {loading ? 'Verifying...' : 'Capture & Verify'}
              </button>
            )}
            <label className="flex items-center justify-center px-4 bg-surface-2 border border-border text-gray-400 rounded-lg cursor-pointer hover:text-white transition-all">
              <Upload size={15} />
              <input type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && sendImage(e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className={`bg-surface-1 border rounded-xl p-6 transition-all ${
          result ? result.access_granted ? 'border-brand/50' : 'border-red-500/50' : 'border-border'
        }`}>
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
              <ScanLine size={40} className="text-gray-600" />
              <p className="text-gray-600 text-sm">Awaiting verification…</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className={`flex items-center gap-3 p-4 rounded-xl ${result.access_granted ? 'bg-brand/10 border border-brand/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                {result.access_granted ? <CheckCircle2 size={28} className="text-brand" /> : <XCircle size={28} className="text-red-400" />}
                <div>
                  <p className={`font-bold text-lg ${result.access_granted ? 'text-brand' : 'text-red-400'}`}>
                    {result.access_granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                  </p>
                  <p className="text-xs text-gray-400">{result.message}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ['Employee',      result.employee_name || 'Unknown'],
                  ['Plate',         result.license_plate_detected || '—'],
                  ['Plate Match',   result.plate_match ? '✅ Yes' : '❌ No'],
                  ['Face Detected', result.face_detected ? '✅ Yes' : '❌ No'],
                  ['Face Score',    result.face_match_score != null ? `${(result.face_match_score*100).toFixed(1)}%` : '—'],
                  ['Log ID',        `#${result.log_id}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-border/50">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-mono text-xs text-white">{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setResult(null)}
                className="w-full flex items-center justify-center gap-2 bg-surface-2 text-gray-400 py-2 rounded-lg text-sm hover:text-white">
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}