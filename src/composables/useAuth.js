import { ref } from 'vue'

const token = ref(localStorage.getItem('auth_token') || null)

export function useAuth() {
  function isAuthenticated() {
    return !!token.value
  }

  function setAuth(value) {
    token.value = value
    if (value) {
      localStorage.setItem('auth_token', value)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  function logout() {
    token.value = null
    localStorage.removeItem('auth_token')
    window.location.href = '/login'
  }

  return {
    token,
    isAuthenticated,
    setAuth,
    logout
  }
}