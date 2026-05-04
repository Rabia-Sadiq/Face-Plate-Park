'use client'
import { useEffect, useState } from 'react'
import { api, endpoints } from '@/lib/api'
import { UserPlus, Search, User, Car, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Employee {
  id: number; name: string; employee_id: string; department: string
  email: string; phone: string; license_plate: string
  face_image_path: string | null; is_active: boolean; created_at: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetch = () => api.get(endpoints.employees).then(r => setEmployees(r.data))
  useEffect(() => { fetch() }, [])

  const filtered = employees.filter(e =>
    [e.name, e.employee_id, e.license_plate].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoading(true)
    const fd = new FormData(e.currentTarget)
    try {
      await api.post(endpoints.employees, fd)
      toast.success('Employee added!'); setShowForm(false); fetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed')
    } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete employee?')) return
    await api.delete(endpoints.employee(id)); toast.success('Removed'); fetch()
  }

  const F = ({ label, name, type = 'text', required = false, placeholder = '' }: any) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}{required && ' *'}</label>
      <input name={name} type={type} required={required} placeholder={placeholder}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/60" />
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Employees</h1>
          <p className="text-gray-500 text-sm mt-1">{employees.length} registered</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand text-black px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-brand/90">
          <UserPlus size={16} /> {showForm ? 'Cancel' : 'Add Employee'}
        </button>
      </div>
      {showForm && (
        <div className="bg-surface-1 border border-border rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-5">Register New Employee</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <F label="Full Name"    name="name"          required placeholder="Ali Hassan" />
              <F label="Employee ID"  name="employee_id"   required placeholder="EMP001" />
              <F label="Department"   name="department"    placeholder="Engineering" />
              <F label="License Plate" name="license_plate" required placeholder="ABC-1234" />
              <F label="Email"        name="email"         type="email" placeholder="ali@co.com" />
              <F label="Phone"        name="phone"         placeholder="+92-300-0000000" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wide">Face Photo</label>
              <input name="face_image" type="file" accept="image/*"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-gray-400 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-brand/10 file:text-brand" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-brand text-black py-2.5 rounded-lg text-sm font-bold hover:bg-brand/90 disabled:opacity-50">
              {loading ? 'Saving...' : 'Register Employee'}
            </button>
          </form>
        </div>
      )}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID or plate…"
          className="w-full bg-surface-1 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/60" />
      </div>
      <div className="grid gap-3">
        {filtered.map(emp => (
          <div key={emp.id} className="bg-surface-1 border border-border rounded-xl p-5 flex items-center gap-4 hover:border-brand/30 transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center overflow-hidden">
              {emp.face_image_path
                ? <img src={`http://localhost:8000/${emp.face_image_path}`} alt={emp.name} className="w-full h-full object-cover" />
                : <User size={20} className="text-gray-500" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white">{emp.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${emp.is_active ? 'bg-brand/10 text-brand' : 'bg-gray-700 text-gray-500'}`}>
                  {emp.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">{emp.employee_id} · {emp.department || '—'}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-lg">
              <Car size={13} className="text-brand" />
              <span className="font-mono text-sm text-white">{emp.license_plate}</span>
            </div>
            <button onClick={() => handleDelete(emp.employee_id)}
              className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-400 transition-all">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}