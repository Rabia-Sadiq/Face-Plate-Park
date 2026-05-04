'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, ShieldCheck, ScrollText, Car, Video } from 'lucide-react'

const links = [
  { href: '/',          icon: LayoutDashboard, label: 'Dashboard'       },
  { href: '/verify',    icon: ShieldCheck,     label: 'Verify Entry'    },
  { href: '/video',     icon: Video,           label: 'Video Detection' },  // ← NEW
  { href: '/employees', icon: Users,           label: 'Employees'       },
  { href: '/logs',      icon: ScrollText,      label: 'Parking Logs'    },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-64 flex-shrink-0 bg-surface-1 border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center">
            <Car size={18} className="text-brand" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">FacePlate</p>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono uppercase tracking-widest">Parking OS</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-brand/10 text-brand border-l-2 border-brand pl-2.5'
                  : 'text-gray-400 hover:text-white hover:bg-surface-2'
              }`}>
              <Icon size={16} />
              {label}
              {href === '/video' && (
                <span className="ml-auto text-[9px] bg-brand/20 text-brand px-1.5 py-0.5 rounded font-mono">NEW</span>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-[10px] text-gray-600 font-mono text-center">FacePlate v2.0</p>
      </div>
    </aside>
  )
}