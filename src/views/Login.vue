<template>
  <div class="login-container">
    <div class="login-content">
      <div class="welcome-section">
        <div class="logo-container">
          <img src="/gc.svg" alt="Logo" class="logo" />
        </div>
        <h1 class="welcome-title">Welcome to Counselor Booking</h1>
        <p class="welcome-subtitle">
          <span class="poc-badge">Proof of Concept</span>
          <span class="subtitle-text">Sample Website</span>
        </p>
      </div>

      <div class="auth-forms">
        <div class="tabs">
          <button :class="['tab', { active: activeTab === 'login' }]" @click="activeTab = 'login'">
            Sign In
          </button>
          <button
            :class="['tab', { active: activeTab === 'register' }]"
            @click="activeTab = 'register'"
          >
            Sign Up
          </button>
        </div>

        <transition name="slide-up" mode="out-in">
          <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
            <div class="input-group">
              <label for="login-username">Username</label>
              <input
                id="login-username"
                v-model="loginForm.username"
                type="text"
                autocomplete="username"
                required
                :disabled="isLoading"
              />
            </div>

            <div class="input-group">
              <label for="login-password">Password</label>
              <input
                id="login-password"
                v-model="loginForm.password"
                type="password"
                autocomplete="current-password"
                required
                :disabled="isLoading"
              />
            </div>

            <p v-if="loginError" class="error-message">{{ loginError }}</p>

            <button type="submit" class="btn btn-primary btn-full" :disabled="isLoading">
              <span v-if="isLoading" class="loading"></span>
              <span v-else>Sign In</span>
            </button>
          </form>

          <form v-else @submit.prevent="handleRegister" class="auth-form">
            <div class="input-group">
              <label for="register-username">Username</label>
              <input
                id="register-username"
                v-model="registerForm.username"
                type="text"
                autocomplete="username"
                required
                minlength="3"
                maxlength="30"
                :disabled="isLoading"
              />
              <small>3-30 characters</small>
            </div>

            <div class="input-group">
              <label for="register-password">Password</label>
              <input
                id="register-password"
                v-model="registerForm.password"
                type="password"
                autocomplete="new-password"
                required
                minlength="8"
                :disabled="isLoading"
              />
              <small>Minimum 8 characters</small>
            </div>

            <div class="input-group">
              <label for="register-confirm">Confirm Password</label>
              <input
                id="register-confirm"
                v-model="registerForm.confirmPassword"
                type="password"
                autocomplete="new-password"
                required
                :disabled="isLoading"
              />
            </div>

            <p v-if="registerError" class="error-message">{{ registerError }}</p>

            <button type="submit" class="btn btn-primary btn-full" :disabled="isLoading">
              <span v-if="isLoading" class="loading"></span>
              <span v-else>Create Account</span>
            </button>
          </form>
        </transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'login' | 'register'>('login')
const isLoading = ref(false)
const loginError = ref('')
const registerError = ref('')

const loginForm = ref({
  username: '',
  password: '',
})

const registerForm = ref({
  username: '',
  password: '',
  confirmPassword: '',
})

const handleLogin = async () => {
  loginError.value = ''
  isLoading.value = true

  try {
    const result = await authStore.login(loginForm.value.username, loginForm.value.password)

    if (result.success) {
      router.push('/dashboard')
    } else {
      loginError.value = result.message
    }
  } finally {
    isLoading.value = false
  }
}

const handleRegister = async () => {
  registerError.value = ''

  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    registerError.value = 'Passwords do not match'
    return
  }

  if (registerForm.value.password.length < 8) {
    registerError.value = 'Password must be at least 8 characters'
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.register(
      registerForm.value.username,
      registerForm.value.password,
    )

    if (result.success) {
      router.push('/dashboard')
    } else {
      registerError.value = result.message
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1e40af;
  padding: 2rem;
}

.login-content {
  width: 100%;
  max-width: 480px;
}

.welcome-section {
  text-align: center;
  margin-bottom: 3rem;
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.logo {
  width: 100px;
  height: 100px;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
}

.welcome-subtitle {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.poc-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.subtitle-text {
  font-size: 1rem;
  font-weight: 400;
}

.auth-forms {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  padding: 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.tab:hover {
  background-color: rgba(37, 99, 235, 0.05);
}

.tab.active {
  color: var(--primary-color);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: var(--primary-color);
}

.auth-form {
  padding: 2rem;
}

.input-group small {
  display: block;
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.btn-full {
  width: 100%;
  margin-top: 0.5rem;
}
</style>
