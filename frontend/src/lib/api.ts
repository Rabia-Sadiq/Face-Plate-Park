import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
})

export const endpoints = {
  dashboard: '/api/dashboard/stats',
  employees: '/api/employees/',
  employee: (id: string) => `/api/employees/${id}`,
  verify: '/api/verify/',
  logs: '/api/logs/',
}