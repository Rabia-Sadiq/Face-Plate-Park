'use client'
import { useEffect, useState } from 'react'
import { api, endpoints } from '@/lib/api'
import { Car, Users, CheckCircle2, XCircle, ParkingCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'

interface Stats {
  total_employees: number; active_employees: number; total_logs_today: number
  granted_today: number; denied_today: number; currently_parked: number; recent_logs: any[]
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-surface-1 border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-3xl font-bold text-white font-mono">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  useEffect(() => {
    api.get(endpoints.dashboard).then(r => setStats(r.data)).catch(console.error)
    const i = setInterval(() => api.get(endpoints.dashboard).then(r => setStats(r.data)), 10000)
    return () => clearInterval(i)
  }, [])

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1 font-mono">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users}         label="Total Employees"  value={stats?.total_employees}  color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={ParkingCircle} label="Currently Parked" value={stats?.currently_parked} color="bg-brand/10 text-brand" />
        <StatCard icon={Car}           label="Logs Today"       value={stats?.total_logs_today} color="bg-purple-500/10 text-purple-400" />
        <StatCard icon={CheckCircle2}  label="Access Granted"   value={stats?.granted_today}    color="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={XCircle}       label="Access Denied"    value={stats?.denied_today}     color="bg-red-500/10 text-red-400" />
        <StatCard icon={Users}         label="Active Employees" value={stats?.active_employees} color="bg-amber-500/10 text-amber-400" />
      </div>
      <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Clock size={16} className="text-brand" />
          <h2 className="font-semibold text-white text-sm uppercase tracking-wide">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border">
          {stats?.recent_logs?.length === 0 && (
            <p className="text-center text-gray-600 py-8 text-sm">No activity yet</p>
          )}
          {stats?.recent_logs?.map((log: any) => (
            <div key={log.id} className="px-6 py-3 flex items-center justify-between hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${log.access_granted ? 'bg-brand' : 'bg-red-500'}`} />
                <span className="text-sm text-white">{log.employee_name || 'Unknown'}</span>
                <span className="text-xs text-gray-500 font-mono">{log.license_plate_detected || '—'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${log.entry_type === 'ENTRY' ? 'bg-brand/10 text-brand' : 'bg-gray-700 text-gray-400'}`}>{log.entry_type}</span>
                <span className="text-xs text-gray-600 font-mono">{format(new Date(log.timestamp), 'HH:mm')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}