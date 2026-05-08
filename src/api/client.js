const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787/api'

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token')

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
    throw new Error(error.error || error.message)
  }

  return response.status === 204 ? null : response.json()
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' })
}