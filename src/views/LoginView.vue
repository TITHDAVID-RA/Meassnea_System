<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { setAuth } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

// Hardcoded credentials
const VALID_EMAIL = 'meassnea@gmail.com'
const VALID_PASSWORD = 'meassnea123'

function login() {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'សូមបំពេញអ៊ីមែលនិងពាក្យសម្ងាត់'
    return
  }

  loading.value = true

  // Simulate network delay
  setTimeout(() => {
    if (email.value === VALID_EMAIL && password.value === VALID_PASSWORD) {
      // Store auth token
      setAuth('logged_in')
      router.push('/')
    } else {
      error.value = 'អ៊ីមែលឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ'
    }
    loading.value = false
  }, 500)
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <i class="fas fa-store"></i>
        </div>
        <h1>ចូលប្រើប្រាស់</h1>
        <p>ប្រព័ន្ធគ្រប់គ្រងស្តុក</p>
      </div>

      <form @submit.prevent="login" class="login-form">
        <div v-if="error" class="error-message">
          <i class="fas fa-exclamation-circle"></i>
          {{ error }}
        </div>

        <div class="form-group">
          <label>អ៊ីមែល</label>
          <div class="input-wrapper">
            <i class="fas fa-envelope input-icon"></i>
            <input 
              type="email" 
              v-model="email" 
              placeholder="meassnea@gmail.com"
              required
              :disabled="loading"
            >
          </div>
        </div>

        <div class="form-group">
          <label>ពាក្យសម្ងាត់</label>
          <div class="input-wrapper">
            <i class="fas fa-lock input-icon"></i>
            <input 
              type="password" 
              v-model="password" 
              placeholder="••••••••"
              required
              :disabled="loading"
            >
          </div>
        </div>

        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading">
            <i class="fas fa-spinner fa-spin"></i> កំពុងចូល...
          </span>
          <span v-else>
            <i class="fas fa-sign-in-alt"></i> ចូល
          </span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  padding: 40px 32px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 64px;
  height: 64px;
  background: #3b82f6;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.logo i {
  font-size: 28px;
  color: white;
}

.login-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.login-header p {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 0.9rem;
}

.input-wrapper input {
  width: 100%;
  padding: 12px 14px 12px 42px;
  border: 1.5px solid #d1d5db;
  border-radius: 10px;
  font-size: 0.95rem;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-wrapper input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.btn-login {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 14px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 8px;
}

.btn-login:hover {
  background: #2563eb;
}

.btn-login:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
  }
}
</style>