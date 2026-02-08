import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import http from 'http'
import https from 'https'
import fs from 'fs'
import crypto from 'crypto'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import Database from 'better-sqlite3'
import argon2 from 'argon2'
import sanitizeHtml from 'sanitize-html'
import cors from 'cors'

// Load environment variables
dotenv.config()

// ES modules __dirname alternative
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'
const app = express()
const PORT = process.env.PORT || 3000

// Trust proxy for secure cookies (nginx proxy on EC2)
app.set('trust proxy', ['127.0.0.1', '::1', 'loopback'])

// CORS configuration
app.use(
  cors({
    origin: isDev ? ['https://localhost:3000', 'http://localhost:5173'] : process.env.FRONTEND_URL,
    credentials: true,
  }),
)

// Middleware
app.use(cookieParser())

// Session secret validation
if (!process.env.SESSION_SECRET && !isDev) {
  throw new Error('SESSION_SECRET must be set in production')
}

// User-Agent hashing for session validation
function hashUA(req) {
  return crypto
    .createHash('sha256')
    .update(req.headers['user-agent'] || '')
    .digest('hex')
}

// Session configuration - 30 minutes with rolling expiration
app.use(
  session({
    name: 'counselor.sid',
    genid: () => crypto.randomUUID(),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production-PLEASE',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: !isDev,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 30, // 30 minutes
    },
  }),
)

// Session validation middleware - check User-Agent match
app.use((req, res, next) => {
  if (req.session && req.session.ua) {
    const currentUA = hashUA(req)

    if (req.session.ua !== currentUA) {
      console.warn('Session UA mismatch - destroying session')
      return req.session.destroy(() => {
        res.clearCookie('counselor.sid')
        return res.status(401).json({
          error: 'SESSION_INVALID',
          message: 'Session expired or invalidated',
        })
      })
    }
  }
  next()
})

// Force HTTPS redirect in development
// Force HTTPS in production
if (!isDev) {
  app.use((req, res, next) => {
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`)
    }
    next()
  })
}

// Security middleware - Helmet with CSP
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"], // Vue may need inline styles
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
}

// Force HTTPS in production
if (!isDev) {
  app.use((req, res, next) => {
    if (!req.secure && req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`)
    }
    next()
  })
}

// Helmet security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    crossOriginEmbedderPolicy: false,
  }),
)

app.use(
  helmet.hsts({
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  }),
)

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

app.use(limiter)

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
})

// Booking submission rate limit
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many booking requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Serve static files (production only)
if (!isDev) {
  app.use(express.static(path.join(__dirname, 'dist')))
}

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please sign in again.',
    })
  }
  next()
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

const db = new Database(path.join(__dirname, 'database.db'), {
  fileMustExist: false,
})

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// USERS TABLE
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    signup_ip TEXT NOT NULL
  )
`,
).run()

// COUNSELORS TABLE
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS counselors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    specialty TEXT NOT NULL,
    bio TEXT,
    avatar_color TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`,
).run()

// BOOKINGS TABLE
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    counselor_id INTEGER NOT NULL,
    booking_date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (counselor_id) REFERENCES counselors(id) ON DELETE CASCADE,
    UNIQUE(counselor_id, booking_date, time_slot)
  )
`,
).run()

// Create index for faster booking lookups
db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_bookings_counselor_date
  ON bookings(counselor_id, booking_date, time_slot)
`,
).run()

db.prepare(
  `
  CREATE INDEX IF NOT EXISTS idx_bookings_user
  ON bookings(user_id)
`,
).run()

// Seed counselors if table is empty
const counselorCount = db.prepare('SELECT COUNT(*) as count FROM counselors').get()
if (counselorCount.count === 0) {
  const counselors = [
    {
      name: 'Dr. Sarah Johnson',
      title: 'Licensed Clinical Psychologist',
      specialty: 'Anxiety & Stress Management',
      bio: 'Specializing in cognitive behavioral therapy with over 15 years of experience helping clients manage anxiety and stress.',
      avatar_color: '#4A90E2',
    },
    {
      name: 'Michael Chen',
      title: 'Career Counselor',
      specialty: 'Career Development & Planning',
      bio: 'Dedicated to helping professionals navigate career transitions and achieve their professional goals.',
      avatar_color: '#7B68EE',
    },
    {
      name: 'Dr. Emily Rodriguez',
      title: 'Family Therapist',
      specialty: 'Family & Relationship Counseling',
      bio: 'Experienced in family systems therapy and relationship counseling with a focus on communication and conflict resolution.',
      avatar_color: '#50C878',
    },
    {
      name: 'James Patterson',
      title: 'Academic Counselor',
      specialty: 'Academic Success & Study Skills',
      bio: 'Helping students develop effective study strategies and overcome academic challenges for over 10 years.',
      avatar_color: '#FF6B6B',
    },
    {
      name: 'Dr. Lisa Anderson',
      title: 'Mental Health Counselor',
      specialty: 'Depression & Life Transitions',
      bio: 'Compassionate support for individuals dealing with depression, grief, and major life changes.',
      avatar_color: '#FFA500',
    },
    {
      name: 'Robert Kim',
      title: 'Substance Abuse Counselor',
      specialty: 'Addiction & Recovery',
      bio: 'Certified addiction counselor specializing in evidence-based treatment for substance use disorders.',
      avatar_color: '#9370DB',
    },
  ]

  const insertCounselor = db.prepare(`
    INSERT INTO counselors (name, title, specialty, bio, avatar_color)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((counselors) => {
    for (const c of counselors) {
      insertCounselor.run(c.name, c.title, c.specialty, c.bio, c.avatar_color)
    }
  })

  insertMany(counselors)
  console.log('Seeded counselors table with sample data')
}

// Prepared Statements
const createUser = db.prepare(`
  INSERT INTO users (username, password_hash, signup_ip)
  VALUES (?, ?, ?)
`)

const getUserByUsername = db.prepare(`
  SELECT * FROM users WHERE username = ? COLLATE NOCASE
`)

const countUsersByIP = db.prepare(`
  SELECT COUNT(*) as count FROM users WHERE signup_ip = ?
`)

const getAllCounselors = db.prepare(`
  SELECT * FROM counselors ORDER BY name ASC
`)

const getCounselorById = db.prepare(`
  SELECT * FROM counselors WHERE id = ?
`)

const createBooking = db.prepare(`
  INSERT INTO bookings (user_id, counselor_id, booking_date, time_slot, reason)
  VALUES (?, ?, ?, ?, ?)
`)

const getBookingsByUser = db.prepare(`
  SELECT
    b.id,
    b.booking_date,
    b.time_slot,
    b.reason,
    b.created_at,
    c.name as counselor_name,
    c.title as counselor_title,
    c.avatar_color
  FROM bookings b
  JOIN counselors c ON b.counselor_id = c.id
  WHERE b.user_id = ?
  ORDER BY b.booking_date ASC, b.time_slot ASC
`)

const getBookingsByCounselor = db.prepare(`
  SELECT booking_date, time_slot
  FROM bookings
  WHERE counselor_id = ?
`)

const checkBookingExists = db.prepare(`
  SELECT id FROM bookings
  WHERE counselor_id = ? AND booking_date = ? AND time_slot = ?
`)

const deleteBooking = db.prepare(`
  DELETE FROM bookings WHERE id = ? AND user_id = ?
`)

// ============================================================================
// API ENDPOINTS - Authentication
// ============================================================================

// REGISTER
app.post('/api/auth/register', authLimiter, async (req, res) => {
  let { username, password } = req.body
  const ip = req.ip

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length < 3 ||
    username.length > 30 ||
    password.length < 8
  ) {
    return res.status(400).json({
      error:
        'Invalid username or password. Username must be 3-30 characters, password must be at least 8 characters.',
    })
  }

  username = username.toLowerCase().trim()

  // Limit accounts per IP
  if (countUsersByIP.get(ip).count >= 3) {
    return res.status(403).json({ error: 'Account limit reached for this IP address' })
  }

  try {
    // Hash password with Argon2id (most secure variant)
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    })

    const result = createUser.run(username, hash, ip)

    req.session.user = {
      id: result.lastInsertRowid,
      username,
    }

    req.session.ua = hashUA(req)

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
    })
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: 'Username already exists' })
    } else {
      console.error('Registration error:', err)
      res.status(500).json({ error: 'Registration failed' })
    }
  }
})

// LOGIN
app.post('/api/auth/login', authLimiter, async (req, res) => {
  let { username, password } = req.body

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid credentials' })
  }

  username = username.toLowerCase().trim()

  const user = getUserByUsername.get(username)
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  try {
    const valid = await argon2.verify(user.password_hash, password)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    req.session.user = {
      id: user.id,
      username: user.username,
    }
    req.session.ua = hashUA(req)

    res.json({
      success: true,
      message: 'Signed in successfully',
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// LOGOUT
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('counselor.sid')
    res.json({ success: true })
  })
})

// CHECK SESSION
app.get('/api/auth/session', (req, res) => {
  if (req.session.user) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.user.id,
        username: req.session.user.username,
      },
    })
  } else {
    res.json({ authenticated: false })
  }
})

// ============================================================================
// API ENDPOINTS - Counselors
// ============================================================================

// GET ALL COUNSELORS (public)
app.get('/api/counselors', (req, res) => {
  try {
    const counselors = getAllCounselors.all()
    res.json(counselors)
  } catch (err) {
    console.error('Error fetching counselors:', err)
    res.status(500).json({ error: 'Failed to fetch counselors' })
  }
})

// GET COUNSELOR AVAILABILITY
app.get('/api/counselors/:id/availability', requireAuth, (req, res) => {
  const counselorId = parseInt(req.params.id)

  if (isNaN(counselorId)) {
    return res.status(400).json({ error: 'Invalid counselor ID' })
  }

  const counselor = getCounselorById.get(counselorId)
  if (!counselor) {
    return res.status(404).json({ error: 'Counselor not found' })
  }

  try {
    const bookings = getBookingsByCounselor.all(counselorId)
    const bookedSlots = bookings.map((b) => ({
      date: b.booking_date,
      time: b.time_slot,
    }))

    res.json({ bookedSlots })
  } catch (err) {
    console.error('Error fetching availability:', err)
    res.status(500).json({ error: 'Failed to fetch availability' })
  }
})

// ============================================================================
// API ENDPOINTS - Bookings
// ============================================================================

// CREATE BOOKING
app.post('/api/bookings', requireAuth, bookingLimiter, (req, res) => {
  const { counselorId, date, timeSlot, reason } = req.body
  const userId = req.session.user.id

  // Validate input
  if (!counselorId || !date || !timeSlot) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (typeof counselorId !== 'number' || isNaN(counselorId)) {
    return res.status(400).json({ error: 'Invalid counselor ID' })
  }

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' })
  }

  if (typeof timeSlot !== 'string') {
    return res.status(400).json({ error: 'Invalid time slot' })
  }

  // Validate reason length
  if (reason && (typeof reason !== 'string' || reason.length > 4000)) {
    return res.status(400).json({ error: 'Reason must be 4000 characters or less' })
  }

  // Verify counselor exists
  const counselor = getCounselorById.get(counselorId)
  if (!counselor) {
    return res.status(404).json({ error: 'Counselor not found' })
  }

  // Sanitize reason
  const cleanReason = reason
    ? sanitizeHtml(reason.trim(), {
        allowedTags: [],
        allowedAttributes: {},
      })
    : null

  try {
    // Check if slot is already booked
    const existing = checkBookingExists.get(counselorId, date, timeSlot)
    if (existing) {
      return res.status(409).json({
        error: 'This time slot is already booked. Please select another time.',
      })
    }

    // Create booking
    const result = createBooking.run(userId, counselorId, date, timeSlot, cleanReason)

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      bookingId: result.lastInsertRowid,
    })
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({
        error: 'This time slot was just booked by another user. Please select another time.',
      })
    }
    console.error('Booking error:', err)
    res.status(500).json({ error: 'Failed to create booking' })
  }
})

// GET USER'S BOOKINGS
app.get('/api/bookings', requireAuth, (req, res) => {
  const userId = req.session.user.id

  try {
    const bookings = getBookingsByUser.all(userId)
    res.json(bookings)
  } catch (err) {
    console.error('Error fetching bookings:', err)
    res.status(500).json({ error: 'Failed to fetch bookings' })
  }
})

// DELETE BOOKING
app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  const bookingId = parseInt(req.params.id)
  const userId = req.session.user.id

  if (isNaN(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking ID' })
  }

  try {
    const result = deleteBooking.run(bookingId, userId)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Booking not found or not authorized' })
    }

    res.json({ success: true, message: 'Booking cancelled successfully' })
  } catch (err) {
    console.error('Delete booking error:', err)
    res.status(500).json({ error: 'Failed to cancel booking' })
  }
})

// ============================================================================
// SPA SUPPORT & ERROR HANDLING
// ============================================================================

// Handle 404 for API routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' })
  }
  next()
})

// Serve index.html for all other routes (SPA support) - production only
if (!isDev) {
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack)
  res.status(500).json({
    error: 'Something went wrong!',
    message: isDev ? err.message : undefined,
  })
})

// ============================================================================
// SERVER STARTUP
// ============================================================================

console.log('🚀 Initializing server...')
console.log(`Environment: ${isDev ? 'development' : 'production'}`)

// Start server
if (isDev) {
  // Development: HTTPS with self-signed certificate
  try {
    const sslOptions = {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem'),
    }

    https.createServer(sslOptions, app).listen(PORT, () => {
      console.log(`✓ HTTPS dev server running at https://localhost:${PORT}`)
    })
  } catch (err) {
    console.warn('⚠️  SSL certificates not found, falling back to HTTP')
    console.warn('   Run: npm install -g mkcert && mkcert localhost')
    http.createServer(app).listen(PORT, () => {
      console.log(`✓ HTTP dev server running at http://localhost:${PORT}`)
    })
  }
} else {
  // Production: HTTP only (nginx handles HTTPS)
  http.createServer(app).listen(PORT, () => {
    console.log(`✓ HTTP server running on port ${PORT}`)
    console.log('  Expecting nginx to handle HTTPS termination')
  })
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database...')
  db.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, closing database...')
  db.close()
  process.exit(0)
})
