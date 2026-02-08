<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="header-content">
        <div class="header-title">
          <h1>Booking System</h1>
          <span class="poc-badge-small">Proof of Concept</span>
        </div>
        <div class="header-actions">
          <span class="user-info">{{ authStore.user?.username }}</span>
          <button @click="showBookings = !showBookings" class="btn btn-secondary">
            {{ showBookings ? 'Back to Booking' : 'My Bookings' }}
          </button>
          <button @click="handleLogout" class="btn btn-secondary">Sign Out</button>
        </div>
      </div>
    </header>

    <main class="dashboard-content">
      <transition name="fade" mode="out-in">
        <div v-if="showBookings" class="bookings-view">
          <BookingsList @booking-cancelled="handleBookingCancelled" />
        </div>

        <div v-else class="booking-interface">
          <aside class="counselors-sidebar">
            <h2>Select a Counselor</h2>
            <div v-if="loadingCounselors" class="loading-state">
              <div class="loading"></div>
              <p>Loading counselors...</p>
            </div>
            <div v-else class="counselors-list">
              <button
                v-for="counselor in counselors"
                :key="counselor.id"
                :class="['counselor-card', { selected: selectedCounselor?.id === counselor.id }]"
                @click="selectCounselor(counselor)"
              >
                <div class="counselor-avatar" :style="{ backgroundColor: counselor.avatar_color }">
                  {{ getInitials(counselor.name) }}
                </div>
                <div class="counselor-info">
                  <h3>{{ counselor.name }}</h3>
                  <p class="counselor-title">{{ counselor.title }}</p>
                  <p class="counselor-specialty">{{ counselor.specialty }}</p>
                </div>
              </button>
            </div>
          </aside>

          <section class="booking-panel">
            <div v-if="!selectedCounselor" class="empty-state">
              <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <h3>Select a Counselor</h3>
              <p>
                Choose a counselor from the list to view their availability and book an appointment
              </p>
            </div>

            <div v-else class="booking-form-container">
              <div class="counselor-header">
                <div
                  class="counselor-avatar-large"
                  :style="{ backgroundColor: selectedCounselor.avatar_color }"
                >
                  {{ getInitials(selectedCounselor.name) }}
                </div>
                <div>
                  <h2>{{ selectedCounselor.name }}</h2>
                  <p class="text-secondary">{{ selectedCounselor.title }}</p>
                  <p class="specialty-badge">{{ selectedCounselor.specialty }}</p>
                  <p class="counselor-bio">{{ selectedCounselor.bio }}</p>
                </div>
              </div>

              <div class="booking-form">
                <h3>Book an Appointment</h3>

                <div class="date-selector">
                  <h4>Select a Date</h4>
                  <div class="week-navigation">
                    <button
                      @click="previousWeek"
                      class="btn btn-secondary week-nav-btn"
                      :disabled="isCurrentWeek"
                    >
                      ← Previous
                    </button>
                    <div class="month-display">
                      {{ currentMonthDisplay }}
                    </div>
                    <button @click="nextWeek" class="btn btn-secondary week-nav-btn">Next →</button>
                  </div>
                  <div class="date-grid">
                    <button
                      v-for="day in weekDays"
                      :key="day.date"
                      :class="['date-button', { selected: selectedDate === day.date }]"
                      @click="selectDate(day.date)"
                      :disabled="!day.available"
                    >
                      <span class="day-name">{{ day.dayName }}</span>
                      <span class="date-num">{{ day.dateNum }}</span>
                    </button>
                  </div>
                </div>

                <div v-if="selectedDate" class="time-selector">
                  <h4>Select a Time</h4>
                  <div v-if="loadingAvailability" class="loading-state">
                    <div class="loading"></div>
                    <p>Checking availability...</p>
                  </div>
                  <div v-else class="time-grid">
                    <button
                      v-for="slot in timeSlots"
                      :key="slot.time"
                      :class="['time-button', { selected: selectedTime === slot.time }]"
                      @click="selectTime(slot.time)"
                      :disabled="!slot.available"
                    >
                      {{ slot.label }}
                    </button>
                  </div>
                </div>

                <div v-if="selectedTime" class="reason-input">
                  <div class="input-group">
                    <label for="reason">Reason for Meeting (Optional)</label>
                    <textarea
                      id="reason"
                      v-model="bookingReason"
                      placeholder="Describe what you'd like to discuss..."
                      maxlength="4000"
                      :disabled="submitting"
                    ></textarea>
                    <small>{{ bookingReason.length }} / 4000 characters</small>
                  </div>
                </div>

                <div v-if="bookingError" class="error-message">
                  {{ bookingError }}
                </div>

                <div v-if="bookingSuccess" class="success-message">
                  {{ bookingSuccess }}
                </div>

                <button
                  v-if="selectedDate && selectedTime"
                  @click="submitBooking"
                  class="btn btn-primary btn-full"
                  :disabled="submitting"
                >
                  <span v-if="submitting" class="loading"></span>
                  <span v-else>Confirm Booking</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </transition>

      <!-- Session Expiry Modal -->
      <Teleport to="body">
        <div v-if="showSessionModal" class="modal-overlay" @click="closeSessionModal">
          <div class="modal-content" @click.stop>
            <h3>Session Expired</h3>
            <p>Your session has expired. Please sign in again to continue.</p>
            <p class="text-secondary">Your booking information has been saved.</p>

            <form @submit.prevent="handleReauth" class="reauth-form">
              <div class="input-group">
                <label for="reauth-username">Username</label>
                <input
                  id="reauth-username"
                  v-model="reauthForm.username"
                  type="text"
                  autocomplete="username"
                  required
                />
              </div>

              <div class="input-group">
                <label for="reauth-password">Password</label>
                <input
                  id="reauth-password"
                  v-model="reauthForm.password"
                  type="password"
                  autocomplete="current-password"
                  required
                />
              </div>

              <p v-if="reauthError" class="error-message">{{ reauthError }}</p>

              <div class="modal-actions">
                <button type="button" @click="cancelReauth" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary" :disabled="reauthLoading">
                  <span v-if="reauthLoading" class="loading"></span>
                  <span v-else>Sign In</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Teleport>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { Counselor, TimeSlot, DaySlot, AvailabilityResponse } from '@/types'
import BookingsList from '@/components/BookingsList.vue'

const router = useRouter()
const authStore = useAuthStore()

const counselors = ref<Counselor[]>([])
const selectedCounselor = ref<Counselor | null>(null)
const loadingCounselors = ref(true)
const showBookings = ref(false)

// Booking form state
const currentWeekOffset = ref(0)
const selectedDate = ref('')
const selectedTime = ref('')
const bookingReason = ref('')
const submitting = ref(false)
const bookingError = ref('')
const bookingSuccess = ref('')
const loadingAvailability = ref(false)
const bookedSlots = ref<Set<string>>(new Set())

// Session expiry state
const showSessionModal = ref(false)
const savedBookingData = ref<any>(null)
const reauthForm = ref({ username: '', password: '' })
const reauthError = ref('')
const reauthLoading = ref(false)

const isCurrentWeek = computed(() => currentWeekOffset.value === 0)

const currentMonthDisplay = computed(() => {
  if (weekDays.value.length === 0) return ''

  const firstDay = new Date(weekDays.value[0].date)
  const lastDay = new Date(weekDays.value[weekDays.value.length - 1].date)

  const firstMonth = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const lastMonth = lastDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // If week spans two months, show both
  if (firstMonth !== lastMonth) {
    return `${firstDay.toLocaleDateString('en-US', { month: 'short' })} - ${lastMonth}`
  }

  return firstMonth
})

const weekDays = computed<DaySlot[]>(() => {
  const days: DaySlot[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() + currentWeekOffset.value * 7)

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)

    const dateStr = date.toISOString().split('T')[0]
    const isPast = date < today

    days.push({
      date: dateStr,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dateNum: date.getDate(),
      available: !isPast,
    })
  }

  return days
})

const timeSlots = computed<TimeSlot[]>(() => {
  if (!selectedDate.value) return []

  const slots: TimeSlot[] = []
  const times = ['09:00', '11:00', '13:00', '15:00', '17:00']

  times.forEach((time) => {
    const slotKey = `${selectedDate.value}:${time}`
    slots.push({
      time,
      label: formatTimeSlot(time),
      available: !bookedSlots.value.has(slotKey),
    })
  })

  return slots
})

const formatTimeSlot = (startTime: string): string => {
  const [hours, minutes] = startTime.split(':').map(Number)
  const endHours = hours + 2

  // Format start time in 12-hour format
  const startPeriod = hours >= 12 ? 'PM' : 'AM'
  const start12Hour = hours % 12 || 12

  // Format end time in 12-hour format
  const endPeriod = endHours >= 12 ? 'PM' : 'AM'
  const end12Hour = endHours % 12 || 12

  return `${start12Hour}:${minutes.toString().padStart(2, '0')} ${startPeriod} - ${end12Hour}:${minutes.toString().padStart(2, '0')} ${endPeriod}`
}

const getEndTime = (startTime: string): string => {
  const [hours, minutes] = startTime.split(':').map(Number)
  const endHours = hours + 2
  return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const fetchCounselors = async () => {
  loadingCounselors.value = true
  try {
    const response = await fetch('/api/counselors', {
      credentials: 'include',
    })

    if (response.ok) {
      counselors.value = await response.json()
    } else {
      console.error('Failed to fetch counselors')
    }
  } catch (error) {
    console.error('Error fetching counselors:', error)
  } finally {
    loadingCounselors.value = false
  }
}

const selectCounselor = (counselor: Counselor) => {
  selectedCounselor.value = counselor
  selectedDate.value = ''
  selectedTime.value = ''
  bookingReason.value = ''
  bookingError.value = ''
  bookingSuccess.value = ''
  fetchAvailability()
}

const fetchAvailability = async () => {
  if (!selectedCounselor.value) return

  loadingAvailability.value = true
  try {
    const response = await fetch(`/api/counselors/${selectedCounselor.value.id}/availability`, {
      credentials: 'include',
    })

    if (response.ok) {
      const data: AvailabilityResponse = await response.json()
      bookedSlots.value = new Set(data.bookedSlots.map((slot) => `${slot.date}:${slot.time}`))
    }
  } catch (error) {
    console.error('Error fetching availability:', error)
  } finally {
    loadingAvailability.value = false
  }
}

const previousWeek = () => {
  if (currentWeekOffset.value > 0) {
    currentWeekOffset.value--
    selectedDate.value = ''
    selectedTime.value = ''
  }
}

const nextWeek = () => {
  currentWeekOffset.value++
  selectedDate.value = ''
  selectedTime.value = ''
}

const selectDate = (date: string) => {
  selectedDate.value = date
  selectedTime.value = ''
  bookingError.value = ''
  bookingSuccess.value = ''
}

const selectTime = (time: string) => {
  selectedTime.value = time
  bookingError.value = ''
  bookingSuccess.value = ''
}

const submitBooking = async () => {
  if (!selectedCounselor.value || !selectedDate.value || !selectedTime.value) {
    return
  }

  bookingError.value = ''
  bookingSuccess.value = ''
  submitting.value = true

  // Save booking data in case session expires
  savedBookingData.value = {
    counselorId: selectedCounselor.value.id,
    date: selectedDate.value,
    timeSlot: selectedTime.value,
    reason: bookingReason.value,
  }

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        counselorId: selectedCounselor.value.id,
        date: selectedDate.value,
        timeSlot: selectedTime.value,
        reason: bookingReason.value || undefined,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      bookingSuccess.value = 'Booking confirmed successfully!'
      savedBookingData.value = null

      // Refresh availability
      await fetchAvailability()

      // Clear form
      setTimeout(() => {
        selectedDate.value = ''
        selectedTime.value = ''
        bookingReason.value = ''
        bookingSuccess.value = ''
      }, 2000)
    } else if (response.status === 401 && data.error === 'SESSION_EXPIRED') {
      // Session expired - show reauth modal
      reauthForm.value.username = authStore.user?.username || ''
      showSessionModal.value = true
    } else {
      bookingError.value = data.error || 'Failed to create booking'
    }
  } catch (error) {
    console.error('Booking error:', error)
    bookingError.value = 'Network error. Please try again.'
  } finally {
    submitting.value = false
  }
}

const handleReauth = async () => {
  reauthError.value = ''
  reauthLoading.value = true

  try {
    const result = await authStore.login(reauthForm.value.username, reauthForm.value.password)

    if (result.success) {
      showSessionModal.value = false
      reauthForm.value = { username: '', password: '' }

      // Retry the booking with saved data
      if (savedBookingData.value) {
        submitting.value = true
        await retryBooking()
      }
    } else {
      reauthError.value = result.message
    }
  } finally {
    reauthLoading.value = false
  }
}

const retryBooking = async () => {
  if (!savedBookingData.value) return

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(savedBookingData.value),
    })

    const data = await response.json()

    if (response.ok) {
      bookingSuccess.value = 'Booking confirmed successfully!'
      savedBookingData.value = null
      await fetchAvailability()

      setTimeout(() => {
        selectedDate.value = ''
        selectedTime.value = ''
        bookingReason.value = ''
        bookingSuccess.value = ''
      }, 2000)
    } else {
      bookingError.value = data.error || 'Failed to create booking'
    }
  } catch (error) {
    bookingError.value = 'Network error. Please try again.'
  } finally {
    submitting.value = false
  }
}

const closeSessionModal = () => {
  showSessionModal.value = false
}

const cancelReauth = () => {
  showSessionModal.value = false
  savedBookingData.value = null
  router.push('/')
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/')
}

const handleBookingCancelled = () => {
  // Refresh availability if a counselor is selected
  if (selectedCounselor.value) {
    fetchAvailability()
  }
}

onMounted(() => {
  fetchCounselors()
})
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  background-color: var(--surface);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dashboard-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.poc-badge-small {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: rgba(37, 99, 235, 0.1);
  border: 1px solid rgba(37, 99, 235, 0.3);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--primary-color);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  color: var(--text-secondary);
  font-weight: 500;
}

.dashboard-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

.booking-interface {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 2rem;
  height: calc(100vh - 120px);
}

.counselors-sidebar {
  background-color: var(--surface);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  overflow-y: auto;
}

.counselors-sidebar h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.counselors-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.counselor-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--background);
  border: 2px solid transparent;
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.counselor-card:hover {
  border-color: var(--primary-light);
  transform: translateX(4px);
}

.counselor-card.selected {
  border-color: var(--primary-color);
  background-color: rgba(37, 99, 235, 0.05);
}

.counselor-avatar {
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

.counselor-info {
  flex: 1;
  min-width: 0;
}

.counselor-info h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.counselor-title {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.counselor-specialty {
  font-size: 0.75rem;
  color: var(--primary-color);
  font-weight: 500;
}

.booking-panel {
  background-color: var(--surface);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
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

.counselor-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.counselor-avatar-large {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.counselor-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.text-secondary {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.specialty-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background-color: rgba(37, 99, 235, 0.1);
  color: var(--primary-color);
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
}

.counselor-bio {
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.booking-form h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.date-selector,
.time-selector,
.reason-input {
  margin-bottom: 1.25rem;
}

.date-selector h4,
.time-selector h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.week-navigation {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.week-nav-btn {
  flex: 1;
  padding: 0.5rem 1rem;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}

.date-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0.25rem;
  background-color: var(--background);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s ease;
}

.date-button:hover:not(:disabled) {
  border-color: var(--primary-color);
}

.date-button.selected {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.date-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.day-name {
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.date-num {
  font-size: 1.25rem;
  font-weight: 700;
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.time-button {
  padding: 0.75rem;
  background-color: var(--background);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.875rem;
}

.time-button:hover:not(:disabled) {
  border-color: var(--primary-color);
}

.time-button.selected {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.time-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  text-decoration: line-through;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem;
  color: var(--text-secondary);
}

.bookings-view {
  max-width: 1000px;
  margin: 0 auto;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content {
  background-color: var(--surface);
  border-radius: var(--border-radius);
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}

.modal-content h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.modal-content p {
  margin-bottom: 1rem;
}

.reauth-form {
  margin-top: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.modal-actions button {
  flex: 1;
}

@media (max-width: 1024px) {
  .booking-interface {
    grid-template-columns: 1fr;
    height: auto;
  }

  .counselors-sidebar {
    height: 300px;
  }
}

.month-display {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  min-width: 200px;
  text-align: center;
}

.week-navigation {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  align-items: center;
}

.week-nav-btn {
  flex: 0 0 auto;
  padding: 0.5rem 1rem;
  min-width: 120px;
}
</style>
