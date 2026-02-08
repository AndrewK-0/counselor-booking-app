import { defineStore } from 'pinia';
import type { User, SessionResponse, AuthResponse, ErrorResponse } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  }),

  actions: {
    async checkSession(): Promise<boolean> {
      this.isLoading = true;
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
        });

        if (response.ok) {
          const data: SessionResponse = await response.json();
          if (data.authenticated && data.user) {
            this.user = data.user;
            this.isAuthenticated = true;
            return true;
          }
        }

        this.user = null;
        this.isAuthenticated = false;
        return false;
      } catch (error) {
        console.error('Session check error:', error);
        this.user = null;
        this.isAuthenticated = false;
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    async login(username: string, password: string): Promise<{ success: boolean; message: string }> {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
        });

        const data: AuthResponse | ErrorResponse = await response.json();

        if (response.ok && 'success' in data) {
          await this.checkSession();
          return { success: true, message: data.message };
        } else {
          return { success: false, message: 'error' in data ? data.error : 'Login failed' };
        }
      } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Network error. Please try again.' };
      }
    },

    async register(username: string, password: string): Promise<{ success: boolean; message: string }> {
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ username, password }),
        });

        const data: AuthResponse | ErrorResponse = await response.json();

        if (response.ok && 'success' in data) {
          await this.checkSession();
          return { success: true, message: data.message };
        } else {
          return { success: false, message: 'error' in data ? data.error : 'Registration failed' };
        }
      } catch (error) {
        console.error('Registration error:', error);
        return { success: false, message: 'Network error. Please try again.' };
      }
    },

    async logout(): Promise<void> {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        this.user = null;
        this.isAuthenticated = false;
      }
    },

    clearAuth(): void {
      this.user = null;
      this.isAuthenticated = false;
    },
  },
});
