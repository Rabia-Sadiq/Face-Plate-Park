import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/ui/Sidebar'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'FacePlate Parking',
  description: 'Office Parking Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-surface">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#161B22', color: '#E6EDF3', border: '1px solid #30363D' }
        }} />
      </body>
    </html>
  )
}