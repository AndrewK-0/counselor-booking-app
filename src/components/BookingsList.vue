<template>
  <div class="bookings-list">
    <h2>My Bookings</h2>

    <div v-if="loading" class="loading-state">
      <div class="loading"></div>
      <p>Loading bookings...</p>
    </div>

    <div v-else-if="bookings.length === 0" class="empty-state">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <h3>No Bookings Yet</h3>
      <p>You haven't made any bookings. Start by selecting a counselor!</p>
    </div>

    <div v-else class="bookings-grid">
      <div v-for="booking in sortedBookings" :key="booking.id" class="booking-card">
        <div class="booking-header">
          <div class="counselor-info">
            <div class="counselor-avatar-small" :style="{ backgroundColor: booking.avatar_color }">
              {{ getInitials(booking.counselor_name) }}
            </div>
            <div>
              <h3>{{ booking.counselor_name }}</h3>
              <p class="counselor-title">{{ booking.counselor_title }}</p>
            </div>
          </div>
          <button
            @click="confirmCancel(booking.id)"
            class="btn-cancel"
            :disabled="cancelling === booking.id"
          >
            {{ cancelling === booking.id ? 'Cancelling...' : 'Cancel' }}
          </button>
        </div>

        <div class="booking-details">
          <div class="detail-item">
            <svg class="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <div>
              <span class="detail-label">Date</span>
              <span class="detail-value">{{ formatDate(booking.booking_date) }}</span>
            </div>
          </div>

          <div class="detail-item">
            <svg class="detail-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <span class="detail-label">Time</span>
              <span class="detail-value">{{ formatTime(booking.time_slot) }}</span>
            </div>
          </div>
        </div>

        <div v-if="booking.reason" class="booking-reason">
          <span class="reason-label">Reason:</span>
          <p>{{ booking.reason }}</p>
        </div>

        <div class="booking-footer">
          <span class="booked-date"> Booked on {{ formatDateTime(booking.created_at) }} </span>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Booking } from '@/types'

const emit = defineEmits<{
  bookingCancelled: []
}>()

const bookings = ref<Booking[]>([])
const loading = ref(true)
const error = ref('')
const cancelling = ref<number | null>(null)

const sortedBookings = computed(() => {
  return [...bookings.value].sort((a, b) => {
    const dateA = new Date(`${a.booking_date}T${a.time_slot}`)
    const dateB = new Date(`${b.booking_date}T${b.time_slot}`)
    return dateA.getTime() - dateB.getTime()
  })
})

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const fetchBookings = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch('/api/bookings', {
      credentials: 'include',
    })

    if (response.ok) {
      bookings.value = await response.json()
    } else {
      error.value = 'Failed to load bookings'
    }
  } catch (err) {
    console.error('Error fetching bookings:', err)
    error.value = 'Network error. Please try again.'
  } finally {
    loading.value = false
  }
}

const confirmCancel = async (bookingId: number) => {
  if (!confirm('Are you sure you want to cancel this booking?')) {
    return
  }

  await cancelBooking(bookingId)
}

const cancelBooking = async (bookingId: number) => {
  cancelling.value = bookingId
  error.value = ''

  try {
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (response.ok) {
      bookings.value = bookings.value.filter((b) => b.id !== bookingId)
      emit('bookingCancelled')
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to cancel booking'
    }
  } catch (err) {
    console.error('Error cancelling booking:', err)
    error.value = 'Network error. Please try again.'
  } finally {
    cancelling.value = null
  }
}

onMounted(() => {
  fetchBookings()
})
</script>

<style scoped>
.bookings-list {
  padding: 2rem;
}

.bookings-list h2 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 2rem;
  color: var(--text-primary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem;
  color: var(--text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.bookings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.booking-card {
  background-color: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.booking-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.booking-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.counselor-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.counselor-avatar-small {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.counselor-info h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.counselor-title {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--error-color);
  border: 1px solid var(--error-color);
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover:not(:disabled) {
  background-color: var(--error-color);
  color: white;
}

.btn-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.booking-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.detail-item {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.detail-icon {
  width: 24px;
  height: 24px;
  color: var(--primary-color);
  flex-shrink: 0;
}

.detail-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  display: block;
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.booking-reason {
  margin-top: 1rem;
  padding: 1rem;
  background-color: var(--background);
  border-radius: var(--border-radius);
}

.reason-label {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  letter-spacing: 0.5px;
}

.booking-reason p {
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.booking-footer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.booked-date {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .bookings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
