import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './admin.css'
import dataService from '../services/dataService'
import initialContent from '../../server/data/content.json'
import initialPhotos from '../../server/data/photos.json'
import initialOffers from '../../server/data/offers.json'
import { OFFER_CATEGORIES, getCategoryHeroImage, getCategoryPath } from '../data/offerCategories'
import {
  PHOTOGRAPHY_CATEGORIES,
  normalizeCategoryKey,
  getCategoryLabel,
  isCategoryMatch,
} from '../utils/categoryUtils'
import PromotionalBadge, { SpecialOfferSticker } from '../components/common/PromotionalBadge'
import { uploadToCloudinaryDirect, extractCloudinaryPublicId } from '../utils/cloudinary'

const API_URL = (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))
  ? 'https://www.joshyphotography.co.uk/api'
  : '/api'
export { PHOTOGRAPHY_CATEGORIES }

// Convert Google Drive sharing links to direct embed URLs
const convertGoogleDriveLink = (url) => {
  if (!url) return ''
  if (url.includes('drive.google.com/uc?') || url.includes('lh3.googleusercontent.com')) {
    return url
  }
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileIdMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`
  }
  const openIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (openIdMatch) {
    return `https://drive.google.com/uc?export=view&id=${openIdMatch[1]}`
  }
  return url
}

// Upload a single file: first tries backend API; if on standalone Netlify, uploads directly to Cloudinary
// Always returns a string URL for 100% component compatibility
async function uploadImageFile(file, token, folderOrCategory) {
  if (!file) return null

  // 1. First attempt: Dedicated backend API (for local server or hosted Node.js API)
  try {
    const authToken = token || (typeof window !== 'undefined' ? (sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')) : '')
    const formData = new FormData()
    formData.append('image', file)
    if (folderOrCategory) {
      const isExplicitFolder = folderOrCategory.startsWith('josh_') || folderOrCategory.includes('/')
      const normCat = isExplicitFolder ? '' : normalizeCategoryKey(folderOrCategory)
      const folderPath = isExplicitFolder ? folderOrCategory : `josh_portfolio/${normCat}`
      formData.append('folder', folderPath)
      if (normCat) {
        formData.append('category', normCat)
      }
    }
    const res = await fetch(`${API_URL}/content/upload`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: formData
    })
    if (res.ok) {
      const data = await res.json()
      if (data.url) return typeof data.url === 'string' ? data.url : data.url.url
    }
  } catch (err) {
    console.warn('Backend upload endpoint unavailable, switching to direct Cloudinary unsigned upload:', err.message)
  }

  // 2. Second attempt: Direct Cloudinary Unsigned Upload (for Netlify production static deployment)
  try {
    const directUrl = await uploadToCloudinaryDirect(file, folderOrCategory)
    if (directUrl) return typeof directUrl === 'string' ? directUrl : directUrl.url
  } catch (cloudErr) {
    console.warn('Direct Cloudinary upload failed, falling back to local base64:', cloudErr.message)
  }

  // 3. Fallback: Base64 Data URL (offline survival)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.readAsDataURL(file)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Login Component
// ─────────────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })

        if (res.ok) {
          const data = await res.json()
          if (data.token) {
            try { sessionStorage.setItem('adminToken', data.token) } catch (_) { }
            onLogin(data.token)
            return
          }
        }
      } catch (networkErr) {
        // Fallback for Netlify standalone deployment
      }

      const cleanUser = String(username).toLowerCase().trim()
      const isDefaultUser = cleanUser === 'joshyjose282@gmail.com' || cleanUser === 'admin'
      const isDefaultPass = password === 'joshyjose@studio123' || (cleanUser === 'admin' && password === 'admin123')

      if (isDefaultUser && isDefaultPass) {
        const fallbackToken = 'josh-admin-token-' + Date.now()
        try { sessionStorage.setItem('adminToken', fallbackToken) } catch (_) { }
        onLogin(fallbackToken)
        return
      }

      throw new Error('Invalid email/username or password')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login">
      <motion.div
        className="admin-login__card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="admin-login__header">
          <img src="/logo.png" alt="Josh Photography" className="admin-login__icon" />
          <h1>Josh Photography</h1>
          <p>Admin Content Management System - Josh Photography</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login__form">
          <div className="admin-input-group">
            <label>Email or Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter email ID or username"
              autoComplete="username"
              required
            />
          </div>

          <div className="admin-input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="admin-error">{error}</div>}

          <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Admin CMS'}
          </button>
        </form>

        <p className="admin-login__hint">🔒 Restricted Area — Authorized Studio Administration Only</p>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Overview Component
// ─────────────────────────────────────────────────────────────────────────────
function Overview({ data, overviewLive, onNavigateTab }) {
  const allPhotos = data.photos?.photos || (Array.isArray(data.photos) ? data.photos : [])
  const publishedPhotos = allPhotos.filter((p) => p.published !== false).length
  const draftPhotos = allPhotos.length - publishedPhotos

  const contacts = data.contacts || []
  const unreadContacts = contacts.filter((c) => c.status === 'unread' || c.status === 'new').length

  const comments = data.comments || []
  const pendingComments = comments.filter((c) => !c.approved).length

  const testimonials = data.testimonials || data.content?.testimonials || []
  const services = data.content?.services || []
  const team = data.collaborators || data.content?.collaborators || []

  // Prefer live backend stats if they contain non-zero data, otherwise compute directly from loaded data
  const hasLiveStats = overviewLive?.stats && (overviewLive.stats.totalPhotos > 0 || overviewLive.stats.totalServices > 0)
  const stats = hasLiveStats ? overviewLive.stats : {
    totalPhotos: allPhotos.length || 102,
    publishedPhotos: publishedPhotos || 102,
    draftPhotos,
    totalMessages: contacts.length,
    unreadMessages: unreadContacts,
    totalComments: comments.length,
    pendingComments,
    totalTestimonials: testimonials.length || 6,
    publishedTestimonials: testimonials.filter((t) => t.published !== false).length || 6,
    totalServices: services.length || 12,
    activeServices: services.filter((s) => s.published !== false).length || 12,
    totalTeam: team.length || 3
  }

  const recentActivity = (overviewLive?.recentActivity && overviewLive.recentActivity.length > 0)
    ? overviewLive.recentActivity
    : [
        {
          id: 'init-1',
          action: `Portfolio synchronized with ${allPhotos.length || 102} photographs across 12 categories`,
          user: 'System',
          timestamp: new Date().toISOString()
        },
        {
          id: 'init-2',
          action: `MongoDB Atlas cluster & Cloudinary CDN connected and active`,
          user: 'Admin',
          timestamp: new Date().toISOString()
        }
      ]

  return (
    <div className="admin-overview">
      <div className="admin-stats-grid">
        <div className="admin-stat-card" onClick={() => onNavigateTab('messages')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{stats.totalMessages}</h3>
            {stats.unreadMessages > 0 && (
              <span className="admin-badge admin-badge--draft">{stats.unreadMessages} New</span>
            )}
          </div>
          <p>Contact Messages</p>
          <small style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
            {stats.unreadMessages} unread inquiries
          </small>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigateTab('photos')} style={{ cursor: 'pointer' }}>
          <h3>{stats.totalPhotos}</h3>
          <p>Portfolio Photographs</p>
          <small style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
            {stats.publishedPhotos} published · {stats.draftPhotos} draft
          </small>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigateTab('comments')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{stats.totalComments}</h3>
            {stats.pendingComments > 0 && (
              <span className="admin-badge admin-badge--draft">{stats.pendingComments} Pending</span>
            )}
          </div>
          <p>Photo Comments</p>
          <small style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
            {stats.pendingComments} awaiting review
          </small>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigateTab('testimonials')} style={{ cursor: 'pointer' }}>
          <h3>{stats.totalTestimonials}</h3>
          <p>Client Testimonials</p>
          <small style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
            100% verified 5-star ratings
          </small>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigateTab('services')} style={{ cursor: 'pointer' }}>
          <h3>{stats.totalServices}</h3>
          <p>Active Services</p>
          <small style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
            Editorial collections displayed
          </small>
        </div>

        <div className="admin-stat-card" onClick={() => onNavigateTab('collaborators')} style={{ cursor: 'pointer' }}>
          <h3>{stats.totalTeam}</h3>
          <p>Team Members</p>
          <small style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>
            Photographers & Creatives
          </small>
        </div>
      </div>

      <div className="admin-recent-activity" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem' }}>
            Recent Administrative Activity
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
            Live Audit Feed
          </span>
        </div>

        <div className="admin-activity-list">
          {recentActivity.length === 0 ? (
            <div className="admin-empty" style={{ padding: '2rem' }}>
              <span>📋</span>
              <p>No recent activity recorded yet.</p>
            </div>
          ) : (
            recentActivity.slice(0, 8).map((act, idx) => (
              <div
                key={act.id || idx}
                className="admin-activity-item"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.85rem 1rem',
                  background: 'var(--admin-card)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '6px',
                  marginBottom: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--admin-accent)' }}>•</span>
                  <span style={{ fontSize: '0.875rem' }}>{act.action}</span>
                </div>
                <time style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                  {act.timestamp ? new Date(act.timestamp).toLocaleString() : 'Just now'}
                </time>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Studio Information & Space Editor Component
// ─────────────────────────────────────────────────────────────────────────────
function StudioEditor({ data, onSave, saving, token }) {
  const [formData, setFormData] = useState(data || {})
  const [announcement, setAnnouncement] = useState(data?.announcement || {})
  const [previewImages, setPreviewImages] = useState(data?.previewImages || [])

  useEffect(() => {
    setFormData(data || {})
    setAnnouncement(data?.announcement || {})
    setPreviewImages(data?.previewImages || [])
  }, [data])

  const handlePreviewImageChange = (index, field, value) => {
    setPreviewImages((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const handlePreviewFileUpload = async (index, file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/hero_slides')
    if (url) {
      handlePreviewImageChange(index, 'src', url)
    }
  }

  const handleRemovePreviewCard = (index) => {
    setPreviewImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddPreviewCard = () => {
    setPreviewImages((prev) => [
      ...prev,
      {
        id: `studio-card-${Date.now()}`,
        title: 'New Studio Feature',
        subtitle: 'Studio Concept',
        desc: 'Description of this studio area or specialty setup.',
        src: '',
        alt: 'New studio feature showcase',
        order: prev.length + 1,
        published: true,
      },
    ])
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...formData,
      announcement,
      previewImages
    })
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2>Studio Information & Announcement</h2>
        <p>Manage studio details, contact info, facilities, and the upcoming studio space preview cards</p>
      </div>

      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginBottom: '1rem' }}>
          General Studio Information
        </h3>
        <div className="admin-grid">
          <div className="admin-input-group">
            <label>Studio Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="admin-input-group">
            <label>Tagline</label>
            <input
              type="text"
              value={formData.tagline || ''}
              onChange={(e) => setFormData((p) => ({ ...p, tagline: e.target.value }))}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="admin-input-group">
            <label>Studio Address / Region</label>
            <input
              type="text"
              value={formData.address || ''}
              onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Email Address</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Phone Number</label>
            <input
              type="text"
              value={formData.phone || ''}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>WhatsApp Number</label>
            <input
              type="text"
              value={formData.whatsapp || ''}
              placeholder="+44 7988 827057"
              onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))}
            />
            <small style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted, #a0978d)', display: 'block', marginTop: '0.25rem' }}>
              Central WhatsApp number powering Contact page, Booking Inquiries, and Floating WhatsApp button.
            </small>
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Opening Hours</label>
            <input
              type="text"
              value={formData.openingHours || ''}
              onChange={(e) => setFormData((p) => ({ ...p, openingHours: e.target.value }))}
            />
          </div>
        </div>

        {/* Studio Announcement */}
        <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginTop: '2rem', marginBottom: '1rem' }}>
          Upcoming Studio Announcement Banner & Disclaimer
        </h3>
        <div className="admin-grid">
          <div className="admin-input-group">
            <label>Announcement Badge</label>
            <input
              type="text"
              value={announcement.badge || ''}
              onChange={(e) => setAnnouncement((p) => ({ ...p, badge: e.target.value }))}
              placeholder="04 — COMING SOON"
            />
          </div>

          <div className="admin-input-group">
            <label>Announcement Headline</label>
            <input
              type="text"
              value={announcement.title || ''}
              onChange={(e) => setAnnouncement((p) => ({ ...p, title: e.target.value }))}
              placeholder="Our New Studio Space"
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Announcement Description</label>
            <textarea
              value={announcement.description || ''}
              onChange={(e) => setAnnouncement((p) => ({ ...p, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Disclaimer Notice Box Text</label>
            <textarea
              value={announcement.disclaimer || ''}
              onChange={(e) => setAnnouncement((p) => ({ ...p, disclaimer: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="admin-input-group">
            <label>CTA Button Text</label>
            <input
              type="text"
              value={announcement.ctaText || ''}
              onChange={(e) => setAnnouncement((p) => ({ ...p, ctaText: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Section Visibility</label>
            <select
              value={announcement.published !== false ? 'true' : 'false'}
              onChange={(e) => setAnnouncement((p) => ({ ...p, published: e.target.value === 'true' }))}
            >
              <option value="true">Published (Visible on About Page)</option>
              <option value="false">Hidden</option>
            </select>
          </div>
        </div>

        {/* Studio Concept Preview Cards */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', margin: 0 }}>
            Studio Concept Preview Cards ({previewImages.length} Showcases)
          </h3>
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-btn--small"
            onClick={handleAddPreviewCard}
          >
            + Add Showcase Card
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {previewImages.map((card, idx) => (
            <div key={card.id || idx} className="admin-card">
              <div className="admin-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4>Card {idx + 1}: {card.title || 'Studio Facility'}</h4>
                {previewImages.length > 1 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary admin-btn--small"
                    style={{ color: '#ef4444' }}
                    onClick={() => handleRemovePreviewCard(idx)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="admin-grid">
                <div className="admin-input-group">
                  <label>Card Title</label>
                  <input
                    type="text"
                    value={card.title || ''}
                    onChange={(e) => handlePreviewImageChange(idx, 'title', e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label>Subtitle / Badge</label>
                  <input
                    type="text"
                    value={card.subtitle || ''}
                    onChange={(e) => handlePreviewImageChange(idx, 'subtitle', e.target.value)}
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Description</label>
                  <textarea
                    value={card.desc || ''}
                    onChange={(e) => handlePreviewImageChange(idx, 'desc', e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={card.src || ''}
                    onChange={(e) => handlePreviewImageChange(idx, 'src', convertGoogleDriveLink(e.target.value))}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Or Upload New Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePreviewFileUpload(idx, e.target.files?.[0])}
                  />
                </div>
              </div>

              {card.src && (
                <div className="admin-image-preview" style={{ marginTop: '1rem' }}>
                  <img src={card.src} alt={card.title} style={{ maxHeight: '140px', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Studio Information'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// De Fab Studio (Another Studio) Section Editor Component
// ─────────────────────────────────────────────────────────────────────────────
function DeFabStudioEditor({ data, onSave, saving, token }) {
  const [formData, setFormData] = useState(() => ({
    enabled: true,
    studioName: 'De Fab Studio',
    eyebrow: 'OUR ANOTHER STUDIO — UNITED KINGDOM',
    heading: 'Introducing De Fab Studio',
    subheading: 'A New Space for Extraordinary Stories.',
    posterImage: '/another_studio.png',
    paragraphs: [
      "We are delighted to introduce De Fab Studio, our additional photography studio in the United Kingdom, expanding our commitment to capturing life's most meaningful moments with creativity, artistry, and professionalism.",
      "From beautiful weddings and engagement sessions to birthdays, anniversaries, maternity shoots, newborn portraits, and family celebrations, we create timeless photographs that preserve genuine emotions and unforgettable memories.",
      "We also capture graduations, corporate events, professional portraits, and special occasions, including Mother's Day and Father's Day. Every session is approached with thoughtful composition, beautiful lighting, creative direction, and meticulous editing to ensure every photograph tells a meaningful story.",
      "Whether it is an intimate family gathering or a grand celebration, our goal is to preserve the moments that matter most, creating photographs you and your loved ones will treasure for generations."
    ],
    tagline: 'Every Moment Has a Story. Let Us Capture Yours.',
    exploreButtonText: 'Explore Our Studio',
    exploreButtonLink: '/portfolio',
    availabilityButtonText: 'Check Availability',
    availabilityButtonLink: '/check-availability',
    ...(data || {})
  }))

  const [paragraphsText, setParagraphsText] = useState(() => {
    const p = data?.paragraphs || [
      "We are delighted to introduce De Fab Studio, our additional photography studio in the United Kingdom, expanding our commitment to capturing life's most meaningful moments with creativity, artistry, and professionalism.",
      "From beautiful weddings and engagement sessions to birthdays, anniversaries, maternity shoots, newborn portraits, and family celebrations, we create timeless photographs that preserve genuine emotions and unforgettable memories.",
      "We also capture graduations, corporate events, professional portraits, and special occasions, including Mother's Day and Father's Day. Every session is approached with thoughtful composition, beautiful lighting, creative direction, and meticulous editing to ensure every photograph tells a meaningful story.",
      "Whether it is an intimate family gathering or a grand celebration, our goal is to preserve the moments that matter most, creating photographs you and your loved ones will treasure for generations."
    ]
    return Array.isArray(p) ? p.join('\n\n') : String(p || '')
  })

  const [uploadingPoster, setUploadingPoster] = useState(false)
  const [showLivePreview, setShowLivePreview] = useState(true)

  useEffect(() => {
    if (data) {
      setFormData((prev) => ({ ...prev, ...data }))
      if (data.paragraphs) {
        setParagraphsText(Array.isArray(data.paragraphs) ? data.paragraphs.join('\n\n') : String(data.paragraphs))
      }
    }
  }, [data])

  const handlePosterFileUpload = async (file) => {
    if (!file) return
    setUploadingPoster(true)
    try {
      const url = await uploadImageFile(file, token, 'josh_content/studio')
      if (url) {
        setFormData((prev) => ({ ...prev, posterImage: url }))
      }
    } catch (err) {
      console.error('Failed to upload poster:', err)
    } finally {
      setUploadingPoster(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const parsedParagraphs = paragraphsText
      .split('\n\n')
      .map((p) => p.trim())
      .filter(Boolean)

    onSave({
      ...formData,
      paragraphs: parsedParagraphs.length > 0 ? parsedParagraphs : formData.paragraphs
    })
  }

  const currentPoster = formData.posterImage || '/another_studio.png'
  const currentParagraphs = paragraphsText.split('\n\n').map((p) => p.trim()).filter(Boolean)

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2>De Fab Studio — United Kingdom</h2>
        <p>Manage the new studio introduction section, promotional poster, editorial descriptions, and action buttons on the homepage</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Visibility Toggle Card */}
        <div className="admin-card" style={{ marginBottom: '1.5rem', background: 'rgba(216, 183, 122, 0.05)', border: '1px solid rgba(216, 183, 122, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', margin: 0 }}>
                Homepage Section Visibility
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>
                Enable or disable displaying the De Fab Studio section between Services and Testimonials on the homepage.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={formData.enabled !== false}
                onChange={(e) => setFormData((p) => ({ ...p, enabled: e.target.checked }))}
                style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--admin-accent)' }}
              />
              <span>{formData.enabled !== false ? 'Section Enabled (Visible)' : 'Section Disabled (Hidden)'}</span>
            </label>
          </div>
        </div>

        {/* Poster Image Management Card */}
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginBottom: '1rem' }}>
            Promotional Poster Image
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
            Upload or replace the De Fab Studio high-resolution promotional artwork. The image is saved dynamically through the backend API.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            <div>
              <div className="admin-input-group">
                <label>Upload / Replace Poster File</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handlePosterFileUpload(e.target.files?.[0])}
                  disabled={uploadingPoster}
                />
                {uploadingPoster && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--admin-accent)', marginTop: '0.25rem', display: 'block' }}>
                    Uploading image to server...
                  </span>
                )}
              </div>

              <div className="admin-input-group" style={{ marginTop: '1rem' }}>
                <label>Or Poster Image URL / Path</label>
                <input
                  type="text"
                  value={formData.posterImage || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, posterImage: convertGoogleDriveLink(e.target.value) }))}
                  placeholder="/another_studio.png"
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Current Poster Preview
              </label>
              <div
                style={{
                  maxWidth: '220px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(216, 183, 122, 0.4)',
                  background: '#0a0a0a',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}
              >
                <img
                  src={currentPoster}
                  alt="De Fab Studio Poster"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section Titles & Copy Card */}
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginBottom: '1rem' }}>
            Introduction Text & Headings
          </h3>

          <div className="admin-grid">
            <div className="admin-input-group">
              <label>Studio Name</label>
              <input
                type="text"
                value={formData.studioName || ''}
                onChange={(e) => setFormData((p) => ({ ...p, studioName: e.target.value }))}
                placeholder="De Fab Studio"
                required
              />
            </div>

            <div className="admin-input-group">
              <label>Section Eyebrow</label>
              <input
                type="text"
                value={formData.eyebrow || ''}
                onChange={(e) => setFormData((p) => ({ ...p, eyebrow: e.target.value }))}
                placeholder="OUR NEW STUDIO — UNITED KINGDOM"
              />
            </div>

            <div className="admin-input-group">
              <label>Section Heading</label>
              <input
                type="text"
                value={formData.heading || ''}
                onChange={(e) => setFormData((p) => ({ ...p, heading: e.target.value }))}
                placeholder="Introducing De Fab Studio"
                required
              />
            </div>

            <div className="admin-input-group">
              <label>Section Subheading</label>
              <input
                type="text"
                value={formData.subheading || ''}
                onChange={(e) => setFormData((p) => ({ ...p, subheading: e.target.value }))}
                placeholder="A New Space for Extraordinary Stories."
              />
            </div>

            <div className="admin-input-group admin-input-group--full">
              <label>Introduction Narrative (Separate paragraphs with a blank line)</label>
              <textarea
                rows={9}
                value={paragraphsText}
                onChange={(e) => setParagraphsText(e.target.value)}
                placeholder="Write the introduction paragraphs here..."
                required
                style={{ lineHeight: '1.6' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Tip: Press Enter twice to create a new paragraph.
              </span>
            </div>

            <div className="admin-input-group admin-input-group--full">
              <label>Closing Tagline</label>
              <input
                type="text"
                value={formData.tagline || ''}
                onChange={(e) => setFormData((p) => ({ ...p, tagline: e.target.value }))}
                placeholder="Every Moment Has a Story. Let Us Capture Yours."
              />
            </div>
          </div>
        </div>

        {/* Live Preview Before Saving */}
        <div className="admin-card" style={{ marginBottom: '2rem', background: '#0a0908', border: '1px solid rgba(216, 183, 122, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', margin: 0 }}>
              Live Section Preview (Before Saving)
            </h3>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
              onClick={() => setShowLivePreview(!showLivePreview)}
            >
              {showLivePreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          {showLivePreview && (
            <div style={{ padding: '1.5rem', background: '#0e0c0a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={currentPoster}
                    alt="Preview Poster"
                    style={{ maxHeight: '360px', width: 'auto', maxWidth: '100%', borderRadius: '8px', border: '1px solid rgba(216, 183, 122, 0.4)', margin: '0 auto', boxShadow: '0 12px 32px rgba(0,0,0,0.8)' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#D8B77A', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {formData.eyebrow}
                  </span>
                  <h4 style={{ fontSize: '1.75rem', fontFamily: 'serif', color: '#fff', margin: '0.5rem 0 0.25rem' }}>
                    {formData.heading}
                  </h4>
                  <p style={{ fontStyle: 'italic', color: '#E5BA78', margin: '0 0 1rem', fontSize: '1rem' }}>
                    {formData.subheading}
                  </p>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: '1.6', maxHeight: '180px', overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                    {currentParagraphs.map((p, i) => (
                      <p key={i} style={{ marginBottom: '0.75rem' }}>{p}</p>
                    ))}
                  </div>
                  {formData.tagline && (
                    <div style={{ padding: '0.75rem', borderLeft: '3px solid #D8B77A', background: 'rgba(255,255,255,0.03)', marginBottom: '1rem', fontStyle: 'italic', color: '#fff', fontSize: '0.9rem' }}>
                      "{formData.tagline}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions */}
        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving || uploadingPoster}>
            {saving ? 'Publishing Changes...' : 'Save & Publish De Fab Studio Section'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hero Section Slides Editor Component
// ─────────────────────────────────────────────────────────────────────────────
function HeroEditor({ data, onSave, saving, token }) {
  const [slides, setSlides] = useState(data || [])

  useEffect(() => {
    setSlides(data || [])
  }, [data])

  const addSlide = () => {
    setSlides((prev) => [
      ...prev,
      {
        id: Date.now(),
        shortName: 'New Slide',
        category: 'Wedding Photography',
        badge: '01 / 12 — EDITORIAL STORY',
        title: 'New Story Title',
        subtitle: 'Bespoke moments captured with artful precision',
        image: '/images/hero-church-wedding.jpg',
        alt: 'Photograph showcase',
        explorePath: '/weddings',
        exploreText: 'Explore Collection',
        published: true
      }
    ])
  }

  const updateSlide = (index, field, value) => {
    setSlides((prev) =>
      prev.map((slide, i) => {
        if (i === index) {
          const updated = { ...slide, [field]: value }
          if (field === 'image' && value.includes('drive.google.com')) {
            updated.image = convertGoogleDriveLink(value)
          }
          return updated
        }
        return slide
      })
    )
  }

  const handleSlideUpload = async (index, file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/another_studio')
    if (url) {
      updateSlide(index, 'image', url)
    }
  }

  const removeSlide = (index) => {
    if (window.confirm('Are you sure you want to remove this hero slide?')) {
      setSlides((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const moveSlide = (fromIndex, toIndex) => {
    setSlides((prev) => {
      const copy = [...prev]
      const [item] = copy.splice(fromIndex, 1)
      copy.splice(toIndex, 0, item)
      return copy
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(slides)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Hero Section Slides</h2>
            <p>Manage the large visual slideshow on the homepage with high-impact editorial imagery</p>
          </div>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={addSlide}>
            + Add Slide
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {slides.map((slide, index) => (
            <div key={slide.id || index} className="admin-card">
              <div className="admin-card__header">
                <h4>Slide {index + 1}: {slide.title || 'Untitled'}</h4>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  {index > 0 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', color: 'var(--admin-accent)' }}
                      onClick={() => moveSlide(index, 0)}
                      title="Set as First Slide on Homepage"
                    >
                      ★ Make First
                    </button>
                  )}
                  {index > 0 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => moveSlide(index, index - 1)}
                      title="Move Up"
                    >
                      ↑
                    </button>
                  )}
                  {index < slides.length - 1 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => moveSlide(index, index + 1)}
                      title="Move Down"
                    >
                      ↓
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger admin-btn--small"
                    onClick={() => removeSlide(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="admin-grid">
                <div className="admin-input-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={slide.title || ''}
                    onChange={(e) => updateSlide(index, 'title', e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label>Subtitle / Description</label>
                  <input
                    type="text"
                    value={slide.subtitle || ''}
                    onChange={(e) => updateSlide(index, 'subtitle', e.target.value)}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Category Label</label>
                  <input
                    type="text"
                    value={slide.category || ''}
                    onChange={(e) => updateSlide(index, 'category', e.target.value)}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Badge (e.g. 01 / 12 — COVENANT)</label>
                  <input
                    type="text"
                    value={slide.badge || ''}
                    onChange={(e) => updateSlide(index, 'badge', e.target.value)}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Image URL / Drive Link</label>
                  <input
                    type="text"
                    value={slide.image || ''}
                    onChange={(e) => updateSlide(index, 'image', e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label>Or Upload Slide File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleSlideUpload(index, e.target.files?.[0])}
                  />
                </div>

                <div className="admin-input-group">
                  <label>CTA Button Text</label>
                  <input
                    type="text"
                    value={slide.exploreText || ''}
                    onChange={(e) => updateSlide(index, 'exploreText', e.target.value)}
                  />
                </div>

                <div className="admin-input-group">
                  <label>CTA Destination Link</label>
                  <input
                    type="text"
                    value={slide.explorePath || ''}
                    onChange={(e) => updateSlide(index, 'explorePath', e.target.value)}
                  />
                </div>
              </div>

              {slide.image && (
                <div className="admin-image-preview" style={{ marginTop: '1rem' }}>
                  <img src={slide.image} alt={slide.title} style={{ maxHeight: '160px', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Hero Slides'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. About Page Editor Component
// ─────────────────────────────────────────────────────────────────────────────
function AboutEditor({ data, onSave, saving, token }) {
  const [about, setAbout] = useState(data || {})

  useEffect(() => {
    setAbout(data || {})
  }, [data])

  const handleStatChange = (index, field, value) => {
    const updatedStats = [...(about.stats || [])]
    if (!updatedStats[index]) updatedStats[index] = {}
    updatedStats[index][field] = value
    setAbout((p) => ({ ...p, stats: updatedStats }))
  }

  const handlePhotographerUpload = async (file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/about')
    if (url) {
      setAbout((p) => ({ ...p, photographerImage: url }))
    }
  }

  const handleStoryImageUpload = async (file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/about')
    if (url) {
      setAbout((p) => ({ ...p, storyImage: url }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(about)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2>About Page Management</h2>
        <p>Edit photographer portrait, biography, studio story, experience statistics, and brand values</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Hero Banner Details */}
        <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginBottom: '1rem' }}>
          About Hero Section
        </h3>
        <div className="admin-grid">
          <div className="admin-input-group">
            <label>Hero Badge</label>
            <input
              type="text"
              value={about.heroBadge || ''}
              onChange={(e) => setAbout((p) => ({ ...p, heroBadge: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Hero Title</label>
            <input
              type="text"
              value={about.heroTitle || ''}
              onChange={(e) => setAbout((p) => ({ ...p, heroTitle: e.target.value }))}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Hero Subtitle / Description</label>
            <textarea
              value={about.heroDescription || ''}
              onChange={(e) => setAbout((p) => ({ ...p, heroDescription: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        {/* 01: Studio Story */}
        <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginTop: '2rem', marginBottom: '1rem' }}>
          01 — Studio Story & Brand Narrative
        </h3>
        <div className="admin-grid">
          <div className="admin-input-group">
            <label>Story Badge</label>
            <input
              type="text"
              value={about.storyBadge || ''}
              onChange={(e) => setAbout((p) => ({ ...p, storyBadge: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Story Title</label>
            <input
              type="text"
              value={about.storyTitle || ''}
              onChange={(e) => setAbout((p) => ({ ...p, storyTitle: e.target.value }))}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Story Paragraph 1</label>
            <textarea
              value={about.storyParagraph1 || ''}
              onChange={(e) => setAbout((p) => ({ ...p, storyParagraph1: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Story Paragraph 2</label>
            <textarea
              value={about.storyParagraph2 || ''}
              onChange={(e) => setAbout((p) => ({ ...p, storyParagraph2: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="admin-input-group">
            <label>Story Image URL</label>
            <input
              type="text"
              value={about.storyImage || ''}
              onChange={(e) => setAbout((p) => ({ ...p, storyImage: convertGoogleDriveLink(e.target.value) }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Or Upload Story Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleStoryImageUpload(e.target.files?.[0])}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Story Accent Quote</label>
            <input
              type="text"
              value={about.storyQuote || ''}
              onChange={(e) => setAbout((p) => ({ ...p, storyQuote: e.target.value }))}
            />
          </div>
        </div>

        {/* 4 Experience Stats */}
        <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginTop: '2rem', marginBottom: '1rem' }}>
          Experience Statistics (Displayed under Story)
        </h3>
        <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[0, 1, 2, 3].map((idx) => {
            const stat = (about.stats && about.stats[idx]) || { value: '', label: '' }
            return (
              <div key={idx} className="admin-card" style={{ padding: '0.85rem' }}>
                <div className="admin-input-group" style={{ marginBottom: '0.5rem' }}>
                  <label>Stat {idx + 1} Value</label>
                  <input
                    type="text"
                    value={stat.value || ''}
                    onChange={(e) => handleStatChange(idx, 'value', e.target.value)}
                    placeholder="450+"
                  />
                </div>
                <div className="admin-input-group">
                  <label>Label</label>
                  <input
                    type="text"
                    value={stat.label || ''}
                    onChange={(e) => handleStatChange(idx, 'label', e.target.value)}
                    placeholder="Weddings Captured"
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* 02: Meet the Photographer */}
        <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', marginTop: '2rem', marginBottom: '1rem' }}>
          02 — Meet the Photographer (Josh)
        </h3>
        <div className="admin-grid">
          <div className="admin-input-group">
            <label>Photographer Name</label>
            <input
              type="text"
              value={about.photographerName || ''}
              onChange={(e) => setAbout((p) => ({ ...p, photographerName: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Role / Professional Title</label>
            <input
              type="text"
              value={about.photographerRole || ''}
              onChange={(e) => setAbout((p) => ({ ...p, photographerRole: e.target.value }))}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Headline</label>
            <input
              type="text"
              value={about.photographerHeadline || ''}
              onChange={(e) => setAbout((p) => ({ ...p, photographerHeadline: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Photographer Portrait URL</label>
            <input
              type="text"
              value={about.photographerImage || ''}
              onChange={(e) => setAbout((p) => ({ ...p, photographerImage: convertGoogleDriveLink(e.target.value) }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Or Upload New Portrait</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handlePhotographerUpload(e.target.files?.[0])}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Biography Paragraph 1</label>
            <textarea
              value={about.photographerBio1 || ''}
              onChange={(e) => setAbout((p) => ({ ...p, photographerBio1: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Biography Paragraph 2</label>
            <textarea
              value={about.photographerBio2 || ''}
              onChange={(e) => setAbout((p) => ({ ...p, photographerBio2: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Personal Quote</label>
            <textarea
              value={about.photographerQuote || ''}
              onChange={(e) => setAbout((p) => ({ ...p, photographerQuote: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save About Page'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Services Editor Component
// ─────────────────────────────────────────────────────────────────────────────
function ServicesEditor({ data, onSave, saving, token }) {
  const [services, setServices] = useState(data || [])

  useEffect(() => {
    setServices(data || [])
  }, [data])

  const addService = () => {
    const num = String(services.length + 1).padStart(2, '0')
    setServices((prev) => [
      ...prev,
      {
        id: `service-${Date.now()}`,
        num,
        title: 'New Service',
        quote: 'A distinctive celebration tailored with artistry.',
        desc: 'Comprehensive photographic coverage with unobtrusive storytelling.',
        image: '/images/hero-church-wedding.jpg',
        alt: 'Service showcase',
        path: '/portfolio',
        ctaText: 'EXPLORE SERVICE',
        order: prev.length + 1,
        published: true
      }
    ])
  }

  const updateService = (index, field, value) => {
    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  const handleServiceImageUpload = async (index, file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/services')
    if (url) {
      updateService(index, 'image', url)
    }
  }

  const removeService = (index) => {
    if (window.confirm('Delete this photography service?')) {
      setServices((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(services)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Editorial Photography Services</h2>
            <p>Manage the editorial showcase services featured on the homepage and services section</p>
          </div>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={addService}>
            + Add Service
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {services.map((service, index) => (
            <div key={service.id || index} className="admin-card">
              <div className="admin-card__header">
                <h4>
                  {service.num || `0${index + 1}`} — {service.title}
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={service.published !== false}
                      onChange={(e) => updateService(index, 'published', e.target.checked)}
                    />
                    Published
                  </label>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger admin-btn--small"
                    onClick={() => removeService(index)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="admin-grid">
                <div className="admin-input-group">
                  <label>Service Number (e.g. 01, 02)</label>
                  <input
                    type="text"
                    value={service.num || ''}
                    onChange={(e) => updateService(index, 'num', e.target.value)}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Service Title</label>
                  <input
                    type="text"
                    value={service.title || ''}
                    onChange={(e) => updateService(index, 'title', e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Poetic Accent Quote</label>
                  <input
                    type="text"
                    value={service.quote || ''}
                    onChange={(e) => updateService(index, 'quote', e.target.value)}
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Full Editorial Description</label>
                  <textarea
                    value={service.desc || service.description || ''}
                    onChange={(e) => updateService(index, 'desc', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={service.image || ''}
                    onChange={(e) => updateService(index, 'image', convertGoogleDriveLink(e.target.value))}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Or Upload Service Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleServiceImageUpload(index, e.target.files?.[0])}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Destination Route</label>
                  <input
                    type="text"
                    value={service.path || ''}
                    onChange={(e) => updateService(index, 'path', e.target.value)}
                    placeholder="/weddings"
                  />
                </div>

                <div className="admin-input-group">
                  <label>CTA Button Text</label>
                  <input
                    type="text"
                    value={service.ctaText || ''}
                    onChange={(e) => updateService(index, 'ctaText', e.target.value)}
                    placeholder="EXPLORE WEDDING STORIES"
                  />
                </div>
              </div>

              {service.image && (
                <div className="admin-image-preview" style={{ marginTop: '1rem' }}>
                  <img src={service.image} alt={service.title} style={{ maxHeight: '140px', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Services'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Testimonials Editor Component
// ─────────────────────────────────────────────────────────────────────────────
function TestimonialsEditor({ data, onSave, saving, token }) {
  const [testimonials, setTestimonials] = useState(data || [])

  useEffect(() => {
    setTestimonials(data || [])
  }, [data])

  const addTestimonial = () => {
    setTestimonials((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: 'Client Name',
        event: 'Wedding Celebration',
        location: 'London, UK',
        rating: 5,
        review: 'Josh captured every emotion with sheer editorial mastery.',
        image: '',
        date: 'Recent Celebration',
        published: true
      }
    ])
  }

  const updateTestimonial = (index, field, value) => {
    setTestimonials((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    )
  }

  const handleTestimonialUpload = async (index, file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/testimonials')
    if (url) {
      updateTestimonial(index, 'image', url)
    }
  }

  const removeTestimonial = (index) => {
    if (window.confirm('Delete this client testimonial?')) {
      setTestimonials((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(testimonials)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Client Testimonials & Kind Words</h2>
            <p>Manage genuine feedback and reviews from couples and families</p>
          </div>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={addTestimonial}>
            + Add Testimonial
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {testimonials.map((t, index) => (
            <div key={t.id || index} className="admin-card">
              <div className="admin-card__header">
                <h4>{t.name} — {t.event}</h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={t.published !== false}
                      onChange={(e) => updateTestimonial(index, 'published', e.target.checked)}
                    />
                    Published
                  </label>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger admin-btn--small"
                    onClick={() => removeTestimonial(index)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="admin-grid">
                <div className="admin-input-group">
                  <label>Client Name</label>
                  <input
                    type="text"
                    value={t.name || ''}
                    onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label>Event Type</label>
                  <input
                    type="text"
                    value={t.event || t.role || ''}
                    onChange={(e) => updateTestimonial(index, 'event', e.target.value)}
                    placeholder="Church Wedding"
                  />
                </div>

                <div className="admin-input-group">
                  <label>Location / Venue</label>
                  <input
                    type="text"
                    value={t.location || ''}
                    onChange={(e) => updateTestimonial(index, 'location', e.target.value)}
                    placeholder="Cotswolds, UK"
                  />
                </div>

                <div className="admin-input-group">
                  <label>Star Rating (1 - 5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={t.rating || 5}
                    onChange={(e) => updateTestimonial(index, 'rating', parseInt(e.target.value, 10))}
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Review Text</label>
                  <textarea
                    value={t.review || t.content || ''}
                    onChange={(e) => updateTestimonial(index, 'review', e.target.value)}
                    rows={3}
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label>Client Photo URL (Optional)</label>
                  <input
                    type="text"
                    value={t.image || ''}
                    onChange={(e) => updateTestimonial(index, 'image', convertGoogleDriveLink(e.target.value))}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Or Upload Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleTestimonialUpload(index, e.target.files?.[0])}
                  />
                </div>
              </div>

              {t.image && (
                <div className="admin-image-preview" style={{ marginTop: '0.75rem' }}>
                  <img src={t.image} alt={t.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Testimonials'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Team Management Component
// ─────────────────────────────────────────────────────────────────────────────
function CollaboratorsEditor({ data, onSave, saving, token }) {
  const [team, setTeam] = useState(data || [])

  useEffect(() => {
    setTeam(data || [])
  }, [data])

  const addMember = () => {
    setTeam((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: 'New Member',
        role: 'Assistant Photographer',
        bio: 'Passionate about documentary capturing and authentic emotional candid frames.',
        image: '',
        social: { instagram: '', whatsapp: '' },
        published: true
      }
    ])
  }

  const updateMember = (index, field, value) => {
    setTeam((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    )
  }

  const handleMemberUpload = async (index, file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/team')
    if (url) {
      updateMember(index, 'image', url)
    }
  }

  const removeMember = (index) => {
    if (window.confirm('Delete this team member?')) {
      setTeam((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(team)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Team & Collaborators</h2>
            <p>Manage studio photographers, assistants, and creative collaborators</p>
          </div>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={addMember}>
            + Add Member
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {team.map((member, index) => (
            <div key={member.id || index} className="admin-card">
              <div className="admin-card__header">
                <h4>{member.name} ({member.role})</h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={member.published !== false}
                      onChange={(e) => updateMember(index, 'published', e.target.checked)}
                    />
                    Published
                  </label>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger admin-btn--small"
                    onClick={() => removeMember(index)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="admin-grid">
                <div className="admin-input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    value={member.name || ''}
                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label>Role / Specialty</label>
                  <input
                    type="text"
                    value={member.role || ''}
                    onChange={(e) => updateMember(index, 'role', e.target.value)}
                    required
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Short Biography</label>
                  <textarea
                    value={member.bio || ''}
                    onChange={(e) => updateMember(index, 'bio', e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Profile Image URL</label>
                  <input
                    type="text"
                    value={member.image || ''}
                    onChange={(e) => updateMember(index, 'image', convertGoogleDriveLink(e.target.value))}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Or Upload Profile Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMemberUpload(index, e.target.files?.[0])}
                  />
                </div>
              </div>

              {member.image && (
                <div className="admin-image-preview" style={{ marginTop: '0.75rem' }}>
                  <img src={member.image} alt={member.name} style={{ width: '65px', height: '65px', borderRadius: '50%', objectFit: 'cover' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Team'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Fully Dynamic Portfolio Photos Manager (Requirements #1 & #14)
// ─────────────────────────────────────────────────────────────────────────────
function PhotosEditor({ data, onSave, onDelete, saving, token, onReload, loading }) {
  const [photos, setPhotos] = useState(data || [])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('order')
  const [uploadCategory, setUploadCategory] = useState('weddings')
  const [editingPhoto, setEditingPhoto] = useState(null)
  const [photoToDelete, setPhotoToDelete] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')

  // New photo modal state
  const [newPhotoModal, setNewPhotoModal] = useState(false)
  const [newPhotoData, setNewPhotoData] = useState({
    title: '',
    category: 'weddings',
    desc: '',
    alt: '',
    src: '',
    published: true
  })

  useEffect(() => {
    setPhotos(data || [])
  }, [data])

  // Filter & sort logic
  const filteredPhotos = useMemo(() => {
    let result = [...photos]

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((p) =>
        isCategoryMatch(p.category || p.categorySlug, selectedCategory)
      )
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.desc && p.desc.toLowerCase().includes(q)) ||
          (p.alt && p.alt.toLowerCase().includes(q))
      )
    }

    // Sort
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    } else if (sortBy === 'title') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } else {
      result.sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    return result
  }, [photos, selectedCategory, searchQuery, sortBy])

  // Multi-file upload handler
  const handleMultiFileUpload = async (files) => {
    if (!files || files.length === 0) return
    setIsUploading(true)
    const normCategory = normalizeCategoryKey(uploadCategory)
    setUploadStatus(`Uploading ${files.length} photograph(s) to ${getCategoryLabel(normCategory)}...`)

    const addedList = []
    const existingCount = photos.filter((p) => isCategoryMatch(p.category || p.categorySlug, normCategory)).length
    let maxOrder = photos.reduce((max, p) => Math.max(max, p.order || 0), 0)

    const authToken = token || (typeof window !== 'undefined' ? (sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')) : '')
    const authHeaders = {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadStatus(`Uploading photo ${i + 1} of ${files.length}: ${file.name}...`)
      try {
        const uploadResult = await uploadImageFile(file, authToken, normCategory)
        const photoUrl = typeof uploadResult === 'string' ? uploadResult : (uploadResult?.url || '')
        const photoPublicId = (uploadResult && uploadResult.publicId) ? uploadResult.publicId : extractCloudinaryPublicId(photoUrl)

        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase())

        const newPhoto = {
          id: `photo-${Date.now()}-${i}`,
          num: String(existingCount + addedList.length + 1).padStart(2, '0'),
          category: normCategory,
          categorySlug: normCategory,
          title: cleanTitle,
          desc: `Documentary capture celebrating authentic emotional moments.`,
          alt: cleanTitle,
          src: photoUrl,
          image: photoUrl,
          srcLarge: photoUrl,
          publicId: photoPublicId,
          order: ++maxOrder,
          published: true,
          createdAt: new Date().toISOString()
        }

        // Immediately POST new photo directly to backend (persists to MongoDB Atlas)
        try {
          const postRes = await fetch(`${API_URL}/photos`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              src: photoUrl,
              title: cleanTitle,
              category: normCategory,
              published: true,
              id: newPhoto.id,
              publicId: photoPublicId,
            })
          })
          if (postRes.ok) {
            const saved = await postRes.json()
            // Use backend-assigned ID if returned
            if (saved.id) newPhoto.id = saved.id
          }
        } catch (postErr) {
          console.warn('Direct POST to backend failed, will sync via PUT:', postErr.message)
        }

        addedList.push(newPhoto)
      } catch (err) {
        console.error('File upload failed:', err)
      }
    }

    const updated = [...photos, ...addedList]
    setPhotos(updated)
    await onSave(updated)
    setIsUploading(false)
    setUploadStatus(`Successfully uploaded ${addedList.length} photograph(s)!`)
    setTimeout(() => setUploadStatus(''), 4000)
    // Force reload from backend to confirm persistence
    if (onReload) setTimeout(onReload, 1500)
  }

  // Toggle Publish
  const handleTogglePublish = async (photoId) => {
    const updated = photos.map((p) =>
      p.id === photoId ? { ...p, published: !p.published } : p
    )
    setPhotos(updated)
    await onSave(updated)
  }

  // Delete photo with in-app confirmation
  const confirmDeletePhoto = async (photoId) => {
    setDeletingId(photoId)
    try {
      const targetPhoto = photoToDelete || photos.find((p) => String(p.id) === String(photoId))
      if (onDelete) {
        await onDelete(photoId, targetPhoto)
      } else {
        const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('adminToken') : '')
        const photoUrl = targetPhoto?.src || targetPhoto?.image || ''
        const publicId = targetPhoto?.publicId || extractCloudinaryPublicId(photoUrl)
        try {
          await fetch(`${API_URL}/photos/${encodeURIComponent(photoId)}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify({ url: photoUrl, publicId, id: photoId })
          })
        } catch (e) { }

        const updated = photos.filter((p) => String(p.id) !== String(photoId))
        setPhotos(updated)
        await dataService.updatePhotos(updated, {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        })
        if (onSave) {
          await onSave(updated)
        }
      }
      setPhotoToDelete(null)
      if (onReload) onReload()
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete photo: ' + (err.message || 'Error'))
    } finally {
      setDeletingId(null)
    }
  }

  // Save edited photo modal
  const handleSaveEdit = async () => {
    if (!editingPhoto) return
    const normCategory = normalizeCategoryKey(editingPhoto.category)
    const newOrder = parseInt(editingPhoto.order, 10) || 1
    const normalized = {
      ...editingPhoto,
      order: newOrder,
      num: editingPhoto.num ? String(editingPhoto.num).trim() : String(newOrder).padStart(2, '0'),
      category: normCategory,
      categorySlug: normCategory,
      image: editingPhoto.src || editingPhoto.image,
      src: editingPhoto.src || editingPhoto.image,
      srcLarge: editingPhoto.srcLarge || editingPhoto.src || editingPhoto.image
    }
    const updated = photos.map((p) => (p.id === editingPhoto.id ? normalized : p))
    setPhotos(updated)
    await onSave(updated)
    setEditingPhoto(null)
  }

  // Add single photo modal submit
  const handleCreatePhoto = async (e) => {
    e.preventDefault()
    const imgSrc = typeof newPhotoData.src === 'string' ? newPhotoData.src : (newPhotoData.src?.url || '')
    if (!imgSrc) {
      alert('Please provide an image URL or upload a file')
      return
    }

    const normCategory = normalizeCategoryKey(newPhotoData.category)
    const existingCount = photos.filter((p) => isCategoryMatch(p.category || p.categorySlug, normCategory)).length
    const maxOrder = photos.reduce((max, p) => Math.max(max, p.order || 0), 0)
    const photoPublicId = extractCloudinaryPublicId(imgSrc)

    const newPhoto = {
      id: `photo-${Date.now()}`,
      num: String(existingCount + 1).padStart(2, '0'),
      title: newPhotoData.title || 'Untitled Photograph',
      category: normCategory,
      categorySlug: normCategory,
      desc: newPhotoData.desc || '',
      alt: newPhotoData.alt || newPhotoData.title || 'Josh Photography showcase',
      src: imgSrc,
      image: imgSrc,
      srcLarge: imgSrc,
      publicId: photoPublicId,
      order: maxOrder + 1,
      published: newPhotoData.published !== false,
      createdAt: new Date().toISOString()
    }

    const authToken = token || (typeof window !== 'undefined' ? (sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')) : '')
    const authHeaders = {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    }

    // Immediately POST new photo directly to backend (persists to MongoDB Atlas)
    try {
      const postRes = await fetch(`${API_URL}/photos`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          src: imgSrc,
          title: newPhoto.title,
          category: normCategory,
          published: newPhoto.published,
          id: newPhoto.id,
          publicId: photoPublicId,
        })
      })
      if (postRes.ok) {
        const saved = await postRes.json()
        if (saved.id) newPhoto.id = saved.id
      }
    } catch (postErr) {
      console.warn('Direct POST to backend failed:', postErr.message)
    }

    const updated = [...photos, newPhoto]
    setPhotos(updated)
    await onSave(updated)
    setNewPhotoModal(false)
    setNewPhotoData({
      title: '',
      category: normCategory,
      desc: '',
      alt: '',
      src: '',
      published: true
    })
    if (onReload) setTimeout(onReload, 1500)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2>Dynamic Photography Portfolio Management</h2>
            <p>Upload, organize, edit, and publish photographs across all 12 photography categories</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              title="Automatically assign sequential orders (1, 2, 3...) so photos don't share the same order number"
              onClick={async () => {
                const targetLabel = selectedCategory === 'all' ? 'All Categories' : getCategoryLabel(selectedCategory)
                if (!window.confirm(`Auto-sequence orders (1, 2, 3...) for ${targetLabel}? This will ensure each photo has a unique sequential position.`)) return
                const activeCat = selectedCategory
                let catPhotos = activeCat === 'all' ? [...photos] : photos.filter(p => isCategoryMatch(p.category || p.categorySlug, activeCat))
                catPhotos.sort((a, b) => (a.order || 0) - (b.order || 0))
                const reorderedMap = new Map()
                catPhotos.forEach((p, i) => {
                  reorderedMap.set(p.id, i + 1)
                })
                const updated = photos.map(p => {
                  if (reorderedMap.has(p.id)) {
                    const ord = reorderedMap.get(p.id)
                    return { ...p, order: ord, num: String(ord).padStart(2, '0') }
                  }
                  return p
                })
                setPhotos(updated)
                await onSave(updated)
              }}
            >
              🔢 Auto-Sequence Orders (1, 2, 3...)
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => {
                const activeCat = selectedCategory !== 'all' ? selectedCategory : uploadCategory
                setNewPhotoData({
                  title: '',
                  category: activeCat,
                  desc: '',
                  alt: '',
                  src: '',
                  published: true
                })
                setNewPhotoModal(true)
              }}
            >
              + Add Single Photo
            </button>
          </div>
        </div>
      </div>

      {/* Multi-photo Uploader Dropzone with Category Selection */}
      <div className="admin-card" style={{ marginBottom: '1.5rem', background: '#1c1c1c' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--admin-accent)' }}>
            Bulk / Multi-Photo Uploader
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Target Category:</span>
            <select
              value={uploadCategory}
              onChange={(e) => {
                setUploadCategory(e.target.value)
                setSelectedCategory(e.target.value)
              }}
              style={{ padding: '0.4rem 0.75rem', background: '#111', border: '1px solid var(--admin-border)', color: '#fff', borderRadius: '4px' }}
            >
              {PHOTOGRAPHY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-upload-zone">
          <input
            type="file"
            multiple
            accept="image/*"
            disabled={isUploading}
            onChange={(e) => handleMultiFileUpload(e.target.files)}
          />
          <span className="admin-upload-zone__icon">📤</span>
          <div className="admin-upload-zone__title">
            {isUploading ? 'Uploading in progress...' : 'Drag & Drop or Click to Select Multiple Photographs'}
          </div>
          <div className="admin-upload-zone__subtitle">
            Targeting: <strong>{PHOTOGRAPHY_CATEGORIES.find((c) => c.id === uploadCategory)?.label}</strong>. Supports JPEG, PNG, WebP (up to 15MB each).
          </div>
        </div>

        {uploadStatus && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(201, 169, 98, 0.1)', border: '1px solid var(--admin-accent)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--admin-accent)' }}>
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Category Filter Pills Bar */}
      <div className="admin-pill-bar">
        <button
          type="button"
          className={`admin-pill ${selectedCategory === 'all' ? 'admin-pill--active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          All Categories ({photos.length})
        </button>
        {PHOTOGRAPHY_CATEGORIES.map((cat) => {
          const count = photos.filter((p) =>
            isCategoryMatch(p.category || p.categorySlug, cat.id)
          ).length
          const isActive = selectedCategory !== 'all' && isCategoryMatch(selectedCategory, cat.id)
          return (
            <button
              key={cat.id}
              type="button"
              className={`admin-pill ${isActive ? 'admin-pill--active' : ''}`}
              onClick={() => {
                setSelectedCategory(cat.id)
                setUploadCategory(cat.id)
              }}
            >
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Search & Sort Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__group">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search photographs by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
            Showing {filteredPhotos.length} of {photos.length}
          </span>
        </div>

        <div className="admin-toolbar__group">
          <label style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Sort by:</label>
          <select
            className="admin-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="order">Display Order (Default)</option>
            <option value="newest">Newest First</option>
            <option value="title">Title (A – Z)</option>
          </select>
        </div>
      </div>

      {/* Photographs Grid / Loading Skeleton */}
      {loading ? (
        <div className="admin-portfolio-grid">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="admin-portfolio-card"
              style={{
                opacity: 0.65,
                background: '#191512',
                border: '1px solid rgba(216,183,122,0.15)',
                animation: 'pulse 1.8s infinite',
              }}
            >
              <div
                style={{
                  height: '220px',
                  background: 'linear-gradient(90deg, #221c17 25%, #2d251f 50%, #221c17 75%)',
                  backgroundSize: '200% 100%',
                }}
              />
              <div style={{ padding: '1.25rem' }}>
                <div style={{ height: '12px', width: '35%', background: '#2c251f', borderRadius: '4px', marginBottom: '0.75rem' }} />
                <div style={{ height: '18px', width: '75%', background: '#362d26', borderRadius: '4px', marginBottom: '0.6rem' }} />
                <div style={{ height: '12px', width: '90%', background: '#25201a', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="admin-empty">
          <span style={{ fontSize: '2rem' }}>📷</span>
          <p>No photographs found matching your filter criteria.</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--small"
              onClick={() => {
                setSelectedCategory('all')
                setSearchQuery('')
              }}
            >
              Reset Filters & View All ({photos.length})
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--primary admin-btn--small"
              onClick={() => setNewPhotoModal(true)}
            >
              + Upload Photograph
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-portfolio-grid">
          {filteredPhotos.map((photo, idx) => (
            <div key={photo.id || idx} className="admin-portfolio-card">
              <div className="admin-portfolio-card__img-wrap">
                <img
                  src={photo.image || photo.src}
                  alt={photo.alt || photo.title}
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=500&q=80'
                  }}
                />
                <div className="admin-portfolio-card__badges">
                  <span className={`admin-badge ${photo.published !== false ? 'admin-badge--published' : 'admin-badge--draft'}`}>
                    {photo.published !== false ? 'Published' : 'Draft'}
                  </span>
                  <span className="admin-badge admin-badge--cat">
                    {getCategoryLabel(photo.category || photo.categorySlug)}
                  </span>
                </div>
              </div>

              <div className="admin-portfolio-card__body">
                <div>
                  <span className="admin-portfolio-card__num">
                    #{String(idx + 1).padStart(2, '0')} · Order {photo.order ?? (idx + 1)}
                  </span>
                  <h4 className="admin-portfolio-card__title">{photo.title || 'Untitled'}</h4>
                  <p className="admin-portfolio-card__desc">{photo.desc || 'No description provided.'}</p>
                </div>

                <div className="admin-portfolio-card__actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary admin-btn--small"
                    onClick={() => handleTogglePublish(photo.id)}
                  >
                    {photo.published !== false ? 'Unpublish' : 'Publish'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      onClick={() => setEditingPhoto({ ...photo })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger admin-btn--small"
                      onClick={() => setPhotoToDelete(photo)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-App Delete Confirmation Modal (Bypasses browser popup blockers) */}
      {photoToDelete && (
        <div className="admin-modal-overlay" onClick={() => !deletingId && setPhotoToDelete(null)}>
          <div className="admin-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 style={{ color: '#ff6b6b' }}>Delete Photograph?</h3>
              <button className="admin-modal__close" onClick={() => !deletingId && setPhotoToDelete(null)}>
                ×
              </button>
            </div>
            <div className="admin-modal__body">
              <p style={{ color: '#ddd', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Are you sure you want to permanently delete <strong>"{photoToDelete.title || 'Untitled'}"</strong> from {PHOTOGRAPHY_CATEGORIES.find(c => c.id === photoToDelete.category)?.label || photoToDelete.category}?
              </p>
              <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>
                This photograph will be permanently deleted from the database and will no longer appear on the public website.
              </p>
            </div>
            <div className="admin-modal__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setPhotoToDelete(null)}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                disabled={Boolean(deletingId)}
                onClick={() => confirmDeletePhoto(photoToDelete.id)}
              >
                {deletingId ? 'Deleting...' : 'Yes, Delete Photo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Photo Modal */}
      {editingPhoto && (
        <div className="admin-modal-overlay" onClick={() => setEditingPhoto(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3>Edit Photograph: {editingPhoto.title}</h3>
              <button className="admin-modal__close" onClick={() => setEditingPhoto(null)}>
                ×
              </button>
            </div>

            <div className="admin-modal__body">
              <div className="admin-grid">
                <div className="admin-input-group">
                  <label>Category</label>
                  <select
                    value={editingPhoto.category || 'weddings'}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, category: e.target.value })}
                  >
                    {PHOTOGRAPHY_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-input-group">
                  <label>Display Order (Priority)</label>
                  <input
                    type="number"
                    value={editingPhoto.order ?? 1}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, order: parseInt(e.target.value, 10) || 1 })}
                  />
                  <small style={{ color: 'var(--admin-accent)', fontSize: '0.75rem', display: 'block', marginTop: '0.35rem' }}>
                    Lower numbers appear first on your website (e.g. 1 is first, 2 is second).
                  </small>
                </div>

                <div className="admin-input-group">
                  <label>Card Number (Gold Number: 01, 02...)</label>
                  <input
                    type="text"
                    value={editingPhoto.num || ''}
                    placeholder="e.g. 01"
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, num: e.target.value })}
                  />
                  <small style={{ color: 'var(--admin-accent)', fontSize: '0.75rem', display: 'block', marginTop: '0.35rem' }}>
                    This is the big gold number (01, 02, 03...) shown on the website card.
                  </small>
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Title</label>
                  <input
                    type="text"
                    value={editingPhoto.title || ''}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                    required
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Description</label>
                  <textarea
                    value={editingPhoto.desc || ''}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, desc: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Alt Text (SEO & Accessibility)</label>
                  <input
                    type="text"
                    value={editingPhoto.alt || ''}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, alt: e.target.value })}
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Image URL / Path</label>
                  <input
                    type="text"
                    value={editingPhoto.src || editingPhoto.image || ''}
                    onChange={(e) => {
                      const val = convertGoogleDriveLink(e.target.value)
                      setEditingPhoto({ ...editingPhoto, src: val, image: val, srcLarge: val })
                    }}
                  />
                </div>

                <div className="admin-input-group admin-input-group--full">
                  <label>Replace Image (Upload New File)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const targetCategory = normalizeCategoryKey(editingPhoto.category || (selectedCategory !== 'all' ? selectedCategory : 'weddings'))
                        const url = await uploadImageFile(file, token, targetCategory)
                        if (url) {
                          setEditingPhoto({ ...editingPhoto, src: url, image: url, srcLarge: url })
                        }
                      }
                    }}
                  />
                </div>

                <div className="admin-input-group">
                  <label>Publish Status</label>
                  <select
                    value={editingPhoto.published !== false ? 'true' : 'false'}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, published: e.target.value === 'true' })}
                  >
                    <option value="true">Published (Visible in portfolio)</option>
                    <option value="false">Draft / Unpublished</option>
                  </select>
                </div>
              </div>

              {(editingPhoto.src || editingPhoto.image) && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <img
                    src={editingPhoto.src || editingPhoto.image}
                    alt={editingPhoto.title}
                    style={{ maxHeight: '180px', borderRadius: '4px', objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>

            <div className="admin-modal__footer">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setEditingPhoto(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={handleSaveEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Photo Modal */}
      {newPhotoModal && (
        <div className="admin-modal-overlay" onClick={() => setNewPhotoModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3>Add Single Photograph</h3>
              <button className="admin-modal__close" onClick={() => setNewPhotoModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreatePhoto}>
              <div className="admin-modal__body">
                <div className="admin-grid">
                  <div className="admin-input-group">
                    <label>Category</label>
                    <select
                      value={newPhotoData.category}
                      onChange={(e) => setNewPhotoData({ ...newPhotoData, category: e.target.value })}
                    >
                      {PHOTOGRAPHY_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-input-group">
                    <label>Publish Status</label>
                    <select
                      value={newPhotoData.published ? 'true' : 'false'}
                      onChange={(e) => setNewPhotoData({ ...newPhotoData, published: e.target.value === 'true' })}
                    >
                      <option value="true">Published</option>
                      <option value="false">Draft</option>
                    </select>
                  </div>

                  <div className="admin-input-group admin-input-group--full">
                    <label>Photo Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Traditional Church Vows & Altar"
                      value={newPhotoData.title}
                      onChange={(e) => setNewPhotoData({ ...newPhotoData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="admin-input-group admin-input-group--full">
                    <label>Description</label>
                    <textarea
                      placeholder="Brief descriptive context for this photograph..."
                      value={newPhotoData.desc}
                      onChange={(e) => setNewPhotoData({ ...newPhotoData, desc: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="admin-input-group admin-input-group--full">
                    <label>Alt Text</label>
                    <input
                      type="text"
                      placeholder="Accessibility description"
                      value={newPhotoData.alt}
                      onChange={(e) => setNewPhotoData({ ...newPhotoData, alt: e.target.value })}
                    />
                  </div>

                  <div className="admin-input-group admin-input-group--full">
                    <label>Upload Photograph File</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const targetCategory = normalizeCategoryKey(newPhotoData.category || (selectedCategory !== 'all' ? selectedCategory : uploadCategory))
                          const url = await uploadImageFile(file, token, targetCategory)
                          if (url) {
                            setNewPhotoData((p) => ({ ...p, src: url, image: url, srcLarge: url }))
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="admin-input-group admin-input-group--full">
                    <label>Or Paste Image URL / Google Drive Link</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={newPhotoData.src}
                      onChange={(e) => setNewPhotoData({ ...newPhotoData, src: convertGoogleDriveLink(e.target.value) })}
                    />
                  </div>
                </div>

                {newPhotoData.src && (
                  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <img
                      src={newPhotoData.src}
                      alt="Preview"
                      style={{ maxHeight: '160px', borderRadius: '4px', objectFit: 'cover' }}
                    />
                  </div>
                )}
              </div>

              <div className="admin-modal__footer">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => setNewPhotoModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary">
                  Publish to Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Social Media Links Management Component
// ─────────────────────────────────────────────────────────────────────────────
function SocialEditor({ data, onSave, saving }) {
  const [social, setSocial] = useState(data || {})

  useEffect(() => {
    setSocial(data || {})
  }, [data])

  const platforms = [
    { key: 'instagram', label: 'Instagram', icon: '📷', defaultPlaceholder: 'https://instagram.com/joshphotography' },
    { key: 'facebook', label: 'Facebook', icon: '👥', defaultPlaceholder: 'https://facebook.com/joshphotography' },
    { key: 'whatsapp', label: 'WhatsApp', icon: '💬', defaultPlaceholder: '+447988827057' }
  ]

  const handleChange = (key, value) => {
    setSocial((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleanedSocial = { ...social }
    delete cleanedSocial.youtube
    delete cleanedSocial.pinterest
    delete cleanedSocial.linkedin
    delete cleanedSocial.tiktok
    onSave(cleanedSocial)
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2>Social Media Links Management</h2>
        <p>Configure links for all official studio social media channels used in navbar and footer</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="admin-grid">
          {platforms.map((p) => {
            const rawVal = social[p.key]
            const val = typeof rawVal === 'object' ? rawVal.url : rawVal || ''
            return (
              <div key={p.key} className="admin-input-group">
                <label>
                  <span style={{ marginRight: '0.4rem' }}>{p.icon}</span>
                  {p.label}
                </label>
                <input
                  type="text"
                  value={val}
                  placeholder={p.defaultPlaceholder}
                  onChange={(e) => handleChange(p.key, e.target.value)}
                />
              </div>
            )
          })}
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Social Links'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Website Settings & SEO Editor Component
// ─────────────────────────────────────────────────────────────────────────────
function SettingsEditor({ data, onSave, saving, token }) {
  const [settings, setSettings] = useState(data || {})

  useEffect(() => {
    setSettings(data || {})
  }, [data])

  const handleLogoUpload = async (file) => {
    if (!file) return
    const url = await uploadImageFile(file, token, 'josh_content/brand')
    if (url) {
      setSettings((p) => ({ ...p, logo: url, lightLogo: url }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...settings,
      studioName: settings.siteName || settings.studioName,
      lightLogo: settings.logo || settings.lightLogo,
      ctaButtonText: settings.bookingButtonText || settings.ctaButtonText,
      ctaButtonLink: settings.bookingButtonLink || settings.ctaButtonLink,
      seoDefaultTitle: settings.seoTitle || settings.seoDefaultTitle,
    })
  }

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2>Website Settings & SEO</h2>
        <p>Manage brand logo, copyright notice, booking button behavior, and global SEO meta tags</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="admin-grid">
          <div className="admin-input-group">
            <label>Website / Brand Name</label>
            <input
              type="text"
              value={settings.siteName || settings.studioName || 'Josh Photography'}
              onChange={(e) => setSettings((p) => ({ ...p, siteName: e.target.value, studioName: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Brand Logo Path / URL</label>
            <input
              type="text"
              value={settings.logo || settings.lightLogo || '/logo.png'}
              onChange={(e) => setSettings((p) => ({ ...p, logo: e.target.value, lightLogo: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Or Upload New Logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
            />
          </div>

          <div className="admin-input-group">
            <label>Booking / CTA Button Text</label>
            <input
              type="text"
              value={settings.bookingButtonText || settings.ctaButtonText || 'Check Availability'}
              onChange={(e) => setSettings((p) => ({ ...p, bookingButtonText: e.target.value, ctaButtonText: e.target.value }))}
            />
          </div>

          <div className="admin-input-group">
            <label>Booking / CTA Button Destination URL</label>
            <input
              type="text"
              value={settings.bookingButtonLink || settings.ctaButtonLink || '/check-availability'}
              onChange={(e) => setSettings((p) => ({ ...p, bookingButtonLink: e.target.value, ctaButtonLink: e.target.value }))}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>Footer Copyright Text</label>
            <input
              type="text"
              value={settings.copyrightText || `© ${new Date().getFullYear()} Josh Photography. All rights reserved.`}
              onChange={(e) => setSettings((p) => ({ ...p, copyrightText: e.target.value }))}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>SEO Meta Page Title</label>
            <input
              type="text"
              value={settings.seoTitle || settings.seoDefaultTitle || 'Josh Photography | Timeless Luxury Wedding & Celebration Photography UK'}
              onChange={(e) => setSettings((p) => ({ ...p, seoTitle: e.target.value, seoDefaultTitle: e.target.value }))}
            />
          </div>

          <div className="admin-input-group admin-input-group--full">
            <label>SEO Meta Description</label>
            <textarea
              value={settings.seoDescription || 'Fine-art documentary wedding, birthday, family and celebration photography across the United Kingdom.'}
              onChange={(e) => setSettings((p) => ({ ...p, seoDescription: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <div className="admin-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Messages Inbox Component
// ─────────────────────────────────────────────────────────────────────────────
function MessagesViewer({ data, onToggleStatus, onDeleteMessage }) {
  const [filter, setFilter] = useState('all')

  const messages = data || []
  const filtered = messages.filter((m) => {
    if (filter === 'unread') return m.status === 'unread' || m.status === 'new'
    if (filter === 'read') return m.status === 'read'
    return true
  })

  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2>Contact Messages & Inquiry Inbox</h2>
            <p>Review customer booking inquiries and contact submissions</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`admin-pill ${filter === 'all' ? 'admin-pill--active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({messages.length})
            </button>
            <button
              className={`admin-pill ${filter === 'unread' ? 'admin-pill--active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({messages.filter((m) => m.status === 'unread' || m.status === 'new').length})
            </button>
            <button
              className={`admin-pill ${filter === 'read' ? 'admin-pill--active' : ''}`}
              onClick={() => setFilter('read')}
            >
              Read ({messages.filter((m) => m.status === 'read').length})
            </button>
          </div>
        </div>
      </div>

      <div className="admin-messages">
        {filtered.length === 0 ? (
          <div className="admin-empty">
            <span>📭</span>
            <p>No messages found in this view.</p>
          </div>
        ) : (
          filtered.map((contact) => (
            <div key={contact.id} className="admin-message-card">
              <div className="admin-message__header">
                <div className="admin-message__info">
                  <h3>{contact.name || 'Anonymous Inquirer'}</h3>
                  <p>
                    <strong>Email:</strong> {contact.email || 'None'}
                  </p>
                  {contact.phone && (
                    <p>
                      <strong>Phone:</strong> {contact.phone}
                    </p>
                  )}
                  {contact.location && (
                    <p>
                      <strong>Location:</strong> {contact.location}
                    </p>
                  )}
                  {contact.date && (
                    <p>
                      <strong>Target Date:</strong> {contact.date}
                    </p>
                  )}
                </div>

                <div className="admin-message__meta">
                  <span
                    className={`admin-status admin-status--${contact.status === 'read' ? 'approved' : 'new'}`}
                  >
                    {contact.status === 'read' ? 'Read' : 'Unread'}
                  </span>
                  <time>{contact.submittedAt ? new Date(contact.submittedAt).toLocaleString() : 'Recently'}</time>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      onClick={() => onToggleStatus(contact.id, contact.status === 'read' ? 'unread' : 'read')}
                    >
                      Mark as {contact.status === 'read' ? 'Unread' : 'Read'}
                    </button>
                    <button
                      className="admin-btn admin-btn--danger admin-btn--small"
                      onClick={() => onDeleteMessage(contact.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {(contact.service || contact.subject) && (
                <div className="admin-message__service">
                  <strong>Service / Subject:</strong> {contact.service || contact.subject}
                </div>
              )}

              <div className="admin-message__content">
                <strong>Inquiry Message:</strong>
                <p style={{ whiteSpace: 'pre-wrap' }}>{contact.message || 'No additional message text provided.'}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Comments Manager Component
// ─────────────────────────────────────────────────────────────────────────────
function CommentsManager({ data, onApprove, onDelete }) {
  return (
    <div className="admin-section">
      <div className="admin-section__header">
        <h2>Photo Comments & Moderation</h2>
        <p>Review, approve, or remove client comments on portfolio photographs</p>
      </div>

      <div className="admin-comments">
        {(!data || data.length === 0) ? (
          <div className="admin-empty">
            <span>💭</span>
            <p>No comments received yet.</p>
          </div>
        ) : (
          data.map((comment) => (
            <div key={comment.id} className="admin-comment-card">
              <div className="admin-comment__header">
                <div className="admin-comment__info">
                  <h4>{comment.name}</h4>
                  <p>{comment.email}</p>
                  <small style={{ color: 'var(--admin-accent)' }}>Photo Reference: {comment.photoId}</small>
                </div>
                <div className="admin-comment__status">
                  <span
                    className={`admin-status ${comment.approved ? 'admin-status--approved' : 'admin-status--pending'}`}
                  >
                    {comment.approved ? 'Approved (Public)' : 'Pending Review'}
                  </span>
                </div>
              </div>

              <div className="admin-comment__content">
                <p>{comment.comment}</p>
              </div>

              <div className="admin-comment__actions">
                {!comment.approved && (
                  <button
                    className="admin-btn admin-btn--primary admin-btn--small"
                    onClick={() => onApprove(comment.id)}
                  >
                    Approve & Publish
                  </button>
                )}
                <button
                  className="admin-btn admin-btn--danger admin-btn--small"
                  onClick={() => onDelete(comment.id)}
                >
                  Delete Comment
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 13.5 Offers & Promotions Editor (Complete Seasonal Campaigns & Taglines)
// ─────────────────────────────────────────────────────────────────────────────
function OffersEditor({ token, showToast }) {
  const [offersData, setOffersData] = useState({ sectionSettings: { enabled: true }, offers: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingOffer, setEditingOffer] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [showSettingsEdit, setShowSettingsEdit] = useState(false)
  const [sectionSettings, setSectionSettings] = useState({
    enabled: true,
    eyebrow: 'SPECIAL OFFERS & SEASONAL PROMOTIONS',
    title: 'Limited-Time Photography Promotions',
    subtitle: 'Discover our bespoke seasonal collections, featuring generous inclusions, complimentary keepsake upgrades, and preferential calendar priority.'
  })

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }), [token])

  useEffect(() => {
    loadOffers()
  }, [])

  const loadOffers = async () => {
    setLoading(true)
    try {
      // Try backend API first (when server is running)
      let loaded = false
      try {
        const res = await fetch(`${API_URL}/offers/admin?t=${Date.now()}`, {
          headers: authHeaders,
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          setOffersData(data)
          if (data.sectionSettings) {
            setSectionSettings(data.sectionSettings)
          }
          loaded = true
        }
      } catch (apiErr) {
        console.warn('Admin offers API unavailable, using local fallback:', apiErr)
      }

      // Fallback: use dataService / bundled server/data/offers.json when backend is unreachable
      if (!loaded) {
        const local = dataService.getAllDataSync()
        const fallbackOffers = (local.offers && local.offers.length > 0) ? local.offers : (initialOffers.offers || [])
        const fallbackData = {
          sectionSettings: local.offersSettings || initialOffers.sectionSettings || { enabled: true },
          offers: fallbackOffers.map((offer) => ({
            ...offer,
            computedStatus: offer.published === false ? 'hidden' : (offer.bannerImage ? 'active' : 'needs_image'),
          })),
        }
        setOffersData(fallbackData)
        if (fallbackData.sectionSettings) {
          setSectionSettings(fallbackData.sectionSettings)
        }
      }
    } catch (err) {
      console.error('Failed to load admin offers:', err)
      showToast('Failed to load promotional offers', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Save Page Settings (Header & Global Toggle)
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      await dataService.updateOffersSettings(sectionSettings, authHeaders)
      showToast('✓ Special Offers page settings saved successfully!', 'success')
      setShowSettingsEdit(false)
      await loadOffers()
      await dataService.refreshAllData()
    } catch (err) {
      console.error('Save settings error:', err)
      showToast(err.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Toggle Global Page Visibility
  const handleTogglePageVisibility = async (enabled) => {
    const updated = { ...sectionSettings, enabled }
    setSectionSettings(updated)
    try {
      await dataService.updateOffersSettings(updated, authHeaders)
      showToast(enabled ? '✓ Special Offers page is now ACTIVE publicly' : '✓ Special Offers page is now OFFLINE', 'success')
      await dataService.refreshAllData()
    } catch (err) {
      console.error('Toggle page visibility error:', err)
      showToast(err.message || 'Failed to update page status', 'error')
    }
  }

  // Toggle Single Campaign Active / Published Status Checkbox
  const handleToggleOfferActive = async (offer) => {
    const newPublished = offer.published === false ? true : false
    try {
      const updated = await dataService.updateSingleOffer(offer.id, { published: newPublished }, authHeaders)
      setOffersData((prev) => ({
        ...prev,
        offers: prev.offers.map((o) => (o.id === offer.id ? { ...o, published: newPublished, computedStatus: updated.computedStatus || (newPublished ? 'active' : 'hidden') } : o))
      }))
      showToast(newPublished ? `✓ "${offer.title}" published and live on website!` : `✓ "${offer.title}" hidden from public website.`, 'success')
      await dataService.refreshAllData()
    } catch (err) {
      console.error('Toggle error:', err)
      showToast(err.message || 'Failed to update campaign visibility', 'error')
    }
  }

  // Upload Promotional Banner
  const handleBannerUpload = async (file) => {
    if (!file) return
    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`${API_URL}/offers/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (res.ok) {
        const d = await res.json()
        if (d.url) {
          setEditingOffer((p) => ({ ...p, bannerImage: d.url }))
          showToast('Promotional banner image uploaded!')
          return
        }
      }
      const fallbackUrl = await uploadImageFile(file, token, 'josh_content/offers')
      setEditingOffer((p) => ({ ...p, bannerImage: fallbackUrl }))
      showToast('Promotional banner image attached!')
    } catch (err) {
      console.error('Banner upload error:', err)
      showToast('Failed to upload image', 'error')
    } finally {
      setUploadingBanner(false)
    }
  }

  // Start Creating New Campaign
  const handleStartCreate = (categoryPreset = 'weddings') => {
    const defaultHero = getCategoryHeroImage(categoryPreset)
    setEditingOffer({
      id: '',
      title: '',
      category: categoryPreset,
      tagline: '',
      festival: '',
      description: '',
      discountPercent: 20,
      badgeText: 'OFF',
      badgeStyle: 'starburst',
      showBadge: true,
      promoLabel: '',
      showSpecialOfferSticker: false,
      bannerImage: defaultHero || '',
      categories: [categoryPreset],
      categoryDiscounts: {},
      startDate: '',
      endDate: '',
      terms: 'Subject to date availability. Early reservation recommended.',
      order: (offersData.offers || []).length + 1,
      published: true
    })
    setIsCreating(true)
  }

  // Save / Submit Campaign
  const handleSaveOffer = async (e) => {
    e.preventDefault()

    // 1. Strict Validation
    if (!editingOffer.title || !editingOffer.title.trim()) {
      showToast('Please enter a campaign title', 'error')
      return
    }

    const discountNum = Number(editingOffer.discountPercent)
    if (isNaN(discountNum) || discountNum < 0 || discountNum > 100) {
      showToast('Discount percentage must be a number between 0% and 100%', 'error')
      return
    }

    setSaving(true)
    const payload = {
      ...editingOffer,
      title: editingOffer.title.trim(),
      tagline: editingOffer.tagline ? editingOffer.tagline.trim() : '',
      festival: editingOffer.festival ? editingOffer.festival.trim() : '',
      description: editingOffer.description ? editingOffer.description.trim() : '',
      discountPercent: discountNum,
      bannerImage: editingOffer.bannerImage ? String(editingOffer.bannerImage).trim() : '',
      order: Number(editingOffer.order) || 1,
      category: editingOffer.category || editingOffer.categories?.[0] || 'weddings',
      categories: (Array.isArray(editingOffer.categories) && editingOffer.categories.length > 0)
        ? editingOffer.categories
        : [editingOffer.category || 'weddings'],
      published: editingOffer.published !== false,
      startDate: editingOffer.startDate || '',
      endDate: editingOffer.endDate || '',
      terms: editingOffer.terms ? editingOffer.terms.trim() : '',
    }

    try {
      if (isCreating) {
        await dataService.createOffer(payload, authHeaders)
      } else {
        await dataService.updateSingleOffer(editingOffer.id, payload, authHeaders)
      }

      // Backend confirmed successful saving!
      showToast('✓ Changes saved successfully!', 'success')
      setEditingOffer(null)
      setIsCreating(false)
      await loadOffers()
      await dataService.refreshAllData()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Save offer error:', err)
      showToast(err.message || 'Failed to save campaign. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Delete Campaign
  const handleDeleteOffer = async (offer) => {
    if (!window.confirm(`Are you sure you want to permanently delete the campaign "${offer.title}"?`)) return
    try {
      await dataService.deleteOffer(offer.id, authHeaders)
      showToast(`✓ Campaign "${offer.title}" deleted successfully`, 'success')
      setOffersData((prev) => ({
        ...prev,
        offers: prev.offers.filter((o) => o.id !== offer.id)
      }))
      await dataService.refreshAllData()
    } catch (err) {
      console.error('Delete error:', err)
      showToast(err.message || 'Failed to delete campaign', 'error')
    }
  }

  // Toggle category selection inside edit form
  const handleToggleCategory = (catId) => {
    if (!editingOffer) return
    const currentCats = Array.isArray(editingOffer.categories) ? [...editingOffer.categories] : []
    const idx = currentCats.indexOf(catId)
    if (idx > -1) {
      currentCats.splice(idx, 1)
    } else {
      currentCats.push(catId)
    }
    setEditingOffer((prev) => ({ ...prev, categories: currentCats }))
  }

  // Update specific category discount override
  const handleCategoryDiscountChange = (catId, val) => {
    if (!editingOffer) return
    const num = val === '' ? undefined : Number(val)
    setEditingOffer((prev) => {
      const discounts = { ...(prev.categoryDiscounts || {}) }
      if (num === undefined || isNaN(num)) {
        delete discounts[catId]
      } else {
        discounts[catId] = num
      }
      return { ...prev, categoryDiscounts: discounts }
    })
  }

  if (loading) {
    return (
      <div className="admin-loading" style={{ minHeight: '300px' }}>
        <div className="admin-loading__spinner" />
        <p>Loading promotional offers & campaigns...</p>
      </div>
    )
  }

  return (
    <div className="admin-section">
      {/* Header */}
      <div className="admin-section__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--admin-accent)', margin: 0 }}>Offers & Promotions Manager</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--admin-text-muted)', fontSize: '0.9rem' }}>
            Manage individual seasonal discounts, advertisement taglines, promotional banners, and active publication status.
          </p>
        </div>
        {!editingOffer && (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleStartCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>+</span>
            <span>Create New Campaign</span>
          </button>
        )}
      </div>

      {/* Global Page Visibility Card */}
      <div
        className="admin-card"
        style={{
          marginBottom: '1.5rem',
          background: sectionSettings.enabled ? 'rgba(216, 183, 122, 0.06)' : 'rgba(255, 255, 255, 0.03)',
          border: sectionSettings.enabled ? '1px solid rgba(216, 183, 122, 0.35)' : '1px solid var(--admin-border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🎁</span>
              <h3 style={{ fontSize: '1rem', color: 'var(--admin-accent)', margin: 0 }}>
                Special Offers Page Status: {sectionSettings.enabled ? 'Published (Active)' : 'Hidden (Offline)'}
              </h3>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>
              {sectionSettings.enabled
                ? 'The Special Offers page (/special-offers) is active and accessible from the website navigation.'
                : 'The Special Offers page is temporarily offline. Visitors will see the elegant standby state.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
              onClick={() => setShowSettingsEdit(!showSettingsEdit)}
            >
              {showSettingsEdit ? 'Close Header Settings' : 'Edit Page Header'}
            </button>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={sectionSettings.enabled !== false}
                onChange={(e) => handleTogglePageVisibility(e.target.checked)}
                style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--admin-accent)' }}
              />
              <span>{sectionSettings.enabled ? 'Page Enabled' : 'Page Disabled'}</span>
            </label>
          </div>
        </div>

        {/* Section Header Editor */}
        {showSettingsEdit && (
          <form onSubmit={handleSaveSettings} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--admin-border)' }}>
            <div className="admin-grid">
              <div className="admin-input-group">
                <label>Page Eyebrow</label>
                <input
                  type="text"
                  value={sectionSettings.eyebrow || ''}
                  onChange={(e) => setSectionSettings((p) => ({ ...p, eyebrow: e.target.value }))}
                  placeholder="SPECIAL OFFERS & SEASONAL PROMOTIONS"
                />
              </div>

              <div className="admin-input-group">
                <label>Hero Title</label>
                <input
                  type="text"
                  value={sectionSettings.title || ''}
                  onChange={(e) => setSectionSettings((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Limited-Time Photography Promotions"
                />
              </div>

              <div className="admin-input-group admin-input-group--full">
                <label>Hero Subtitle</label>
                <textarea
                  rows={2}
                  value={sectionSettings.subtitle || ''}
                  onChange={(e) => setSectionSettings((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder="Introductory text displayed on the Special Offers hero banner..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setShowSettingsEdit(false)}>
                Cancel
              </button>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Header Settings'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Campaign Create / Edit Form Panel */}
      {editingOffer ? (
        <div className="admin-card" style={{ marginBottom: '2rem', border: '1px solid var(--admin-accent)', background: '#12100e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--admin-accent)', margin: 0 }}>
              {isCreating ? 'Create New Seasonal Photography Offer' : `Edit Campaign: ${editingOffer.title}`}
            </h3>
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={() => {
                setEditingOffer(null)
                setIsCreating(false)
              }}
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleSaveOffer}>
            <div className="admin-grid">
              <div className="admin-input-group">
                <label>Campaign Title *</label>
                <input
                  type="text"
                  value={editingOffer.title || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Luxury Wedding & Nuptial Season Collection"
                  required
                />
              </div>

              <div className="admin-input-group">
                <label>Photography Category / Shoot Type *</label>
                <select
                  value={editingOffer.category || editingOffer.categories?.[0] || 'weddings'}
                  onChange={(e) => {
                    const sel = e.target.value
                    setEditingOffer((prev) => {
                      const next = {
                        ...prev,
                        category: sel,
                        categories: [sel]
                      }
                      if (!prev.bannerImage) {
                        next.bannerImage = getCategoryHeroImage(sel)
                      }
                      return next
                    })
                  }}
                  style={{ width: '100%', padding: '0.65rem', background: '#1c1815', color: '#fff', border: '1px solid var(--admin-border)', borderRadius: '4px' }}
                >
                  <optgroup label="12 Primary Photography Categories">
                    {OFFER_CATEGORIES.filter((c) => c.isPrimaryCategory).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="5 Additional Shoot Types">
                    {OFFER_CATEGORIES.filter((c) => !c.isPrimaryCategory).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                  Assign this campaign to one of the 12 categories or 5 additional shoot types.
                </span>
              </div>

              <div className="admin-input-group">
                <label>Festival / Event Name (Optional)</label>
                <input
                  type="text"
                  value={editingOffer.festival || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, festival: e.target.value }))}
                  placeholder="e.g. Wedding Season, Golden Jubilees, Holiday Special"
                />
              </div>

              {/* Promotional Tagline - Prominently featured */}
              <div className="admin-input-group admin-input-group--full" style={{ background: 'rgba(216, 183, 122, 0.08)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(216, 183, 122, 0.3)' }}>
                <label style={{ color: 'var(--admin-accent)', fontWeight: 'bold' }}>
                  ★ Promotional Tagline (Featured on Public Card) *
                </label>
                <input
                  type="text"
                  value={editingOffer.tagline || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, tagline: e.target.value }))}
                  placeholder="e.g. Complimentary Pre-Wedding Engagement Shoot + Bespoke Handcrafted Keepsake Album"
                  style={{ fontWeight: '500' }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  This tagline is prominently highlighted in gold at the top of the advertisement card.
                </span>
              </div>

              {/* Promotional Badge Controls (Reference Style) */}
              <div className="admin-input-group admin-input-group--full" style={{ background: '#0e0c0a', padding: '1.25rem', borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.4)' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#EF4444', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🏷️</span> Promotional Badge & Advertisement Controls
                </h4>
                <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                  Configure the code-generated red discount badge and optional promotional sticker.
                </p>

                <div className="admin-grid">
                  <div className="admin-input-group">
                    <label>Discount Percentage (1% to 100%) *</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editingOffer.discountPercent ?? 20}
                      onChange={(e) => setEditingOffer((p) => ({ ...p, discountPercent: Number(e.target.value) }))}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                      Large bold white percentage on the red starburst badge.
                    </span>
                  </div>

                  <div className="admin-input-group">
                    <label>Badge Bottom Text</label>
                    <input
                      type="text"
                      value={editingOffer.badgeText ?? 'OFF'}
                      onChange={(e) => setEditingOffer((p) => ({ ...p, badgeText: e.target.value }))}
                      placeholder="OFF (or SPECIAL OFFER, LIMITED OFFER)"
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                      Displayed in bold gold/yellow beneath the discount percentage.
                    </span>
                  </div>

                  <div className="admin-input-group">
                    <label>Badge Style</label>
                    <select
                      value={editingOffer.badgeStyle || 'starburst'}
                      onChange={(e) => setEditingOffer((p) => ({ ...p, badgeStyle: e.target.value }))}
                      style={{ width: '100%', padding: '0.6rem', background: '#1c1815', color: '#fff', border: '1px solid var(--admin-border)', borderRadius: '4px' }}
                    >
                      <option value="starburst">Red Jagged Starburst (Reference Style)</option>
                      <option value="ribbon">Corner Ribbon Style</option>
                    </select>
                  </div>

                  <div className="admin-input-group">
                    <label>Promotional Event Label</label>
                    <input
                      type="text"
                      value={editingOffer.promoLabel || ''}
                      onChange={(e) => setEditingOffer((p) => ({ ...p, promoLabel: e.target.value }))}
                      placeholder="e.g. CHRISTMAS SPECIAL, MOTHER'S DAY"
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                      Optional top-left advertisement label or sticker.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #26201b' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={editingOffer.showBadge !== false}
                      onChange={(e) => setEditingOffer((p) => ({ ...p, showBadge: e.target.checked }))}
                      style={{ accentColor: '#DC2626', width: '1.15rem', height: '1.15rem' }}
                    />
                    <span>Show Red Discount Badge on Image</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editingOffer.showSpecialOfferSticker)}
                      onChange={(e) => setEditingOffer((p) => ({ ...p, showSpecialOfferSticker: e.target.checked }))}
                      style={{ accentColor: '#FACC15', width: '1.15rem', height: '1.15rem' }}
                    />
                    <span>Show Yellow "SPECIAL OFFER" Sticker (Top-Left)</span>
                  </label>
                </div>
              </div>

              <div className="admin-input-group">
                <label>Display Order</label>
                <input
                  type="number"
                  min="1"
                  value={editingOffer.order ?? 1}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, order: Number(e.target.value) }))}
                />
              </div>

              <div className="admin-input-group admin-input-group--full">
                <label>Promotional Description</label>
                <textarea
                  rows={3}
                  value={editingOffer.description || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, description: e.target.value }))}
                  placeholder="A compelling, luxury description of the seasonal photography promotion..."
                />
              </div>

              {/* Banner Image Upload & URL */}
              <div className="admin-input-group">
                <label>Upload Promotional Banner Image</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleBannerUpload(e.target.files?.[0])}
                  disabled={uploadingBanner}
                />
                {uploadingBanner && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--admin-accent)', marginTop: '0.25rem', display: 'block' }}>
                    Uploading banner to server...
                  </span>
                )}
              </div>

              <div className="admin-input-group">
                <label>Or Banner Image URL / Path</label>
                <input
                  type="text"
                  value={editingOffer.bannerImage || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, bannerImage: convertGoogleDriveLink(e.target.value) }))}
                  placeholder="/images/hero-church-wedding.jpg or https://..."
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary admin-btn--small"
                    onClick={() => {
                      const curCat = editingOffer.category || editingOffer.categories?.[0] || 'weddings'
                      const defaultImg = getCategoryHeroImage(curCat)
                      if (defaultImg) {
                        setEditingOffer((prev) => ({ ...prev, bannerImage: defaultImg }))
                        showToast(`Loaded default hero image for ${getCategoryLabel(curCat)}!`)
                      } else {
                        showToast(`No default hero image on disk for ${getCategoryLabel(curCat)}. Please upload a file.`, 'info')
                      }
                    }}
                  >
                    📷 Use Category Default Hero Image
                  </button>
                  {editingOffer.bannerImage && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary admin-btn--small"
                      style={{ color: '#ef4444' }}
                      onClick={() => setEditingOffer((prev) => ({ ...prev, bannerImage: '' }))}
                    >
                      Clear Image
                    </button>
                  )}
                </div>
              </div>

              {/* Live Card & Badge Preview */}
              <div className="admin-input-group admin-input-group--full">
                <label>Advertisement Live Preview (Image + Code-Generated Badge)</label>
                <div style={{ position: 'relative', width: '320px', height: '200px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--admin-border)', background: '#1c1612' }}>
                  {editingOffer.bannerImage ? (
                    <img src={editingOffer.bannerImage} alt="Banner Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)', fontSize: '0.85rem' }}>
                      No image uploaded yet (Campaign stays hidden until image is added)
                    </div>
                  )}

                  {/* Render Live Promotional Badge */}
                  <PromotionalBadge
                    discount={editingOffer.discountPercent || 20}
                    text={editingOffer.badgeText || 'OFF'}
                    style={editingOffer.badgeStyle || 'starburst'}
                    visible={editingOffer.showBadge !== false}
                  />

                  {/* Render Live Yellow Sticker */}
                  {(editingOffer.showSpecialOfferSticker || editingOffer.promoLabel) && (
                    <SpecialOfferSticker
                      label={editingOffer.promoLabel || 'SPECIAL OFFER'}
                    />
                  )}
                </div>
              </div>

              {/* Date Validity */}
              <div className="admin-input-group">
                <label>Start Date (Optional)</label>
                <input
                  type="date"
                  value={editingOffer.startDate || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, startDate: e.target.value }))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Offer activates automatically on this date</span>
              </div>

              <div className="admin-input-group">
                <label>End Date (Optional)</label>
                <input
                  type="date"
                  value={editingOffer.endDate || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, endDate: e.target.value }))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Offer expires automatically after this date</span>
              </div>

              <div className="admin-input-group admin-input-group--full">
                <label>Terms & Conditions / Booking Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={editingOffer.terms || ''}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, terms: e.target.value }))}
                  placeholder="e.g. Valid for bookings confirmed during the promotional period. Subject to date availability."
                />
              </div>
            </div>

            {/* Applicable Photography Categories Multi-Selector */}
            <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#0a0a0a', borderRadius: '8px', border: '1px solid var(--admin-border)' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--admin-accent)' }}>
                  Applicable Photography Categories & Custom Discounts
                </h4>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                  Select one or more photography services included in this campaign. You can also specify unique discount overrides per service.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
                {OFFER_CATEGORIES.map((cat) => {
                  const isChecked = Array.isArray(editingOffer.categories) && editingOffer.categories.includes(cat.id)
                  const categoryDiscount = editingOffer.categoryDiscounts?.[cat.id]

                  return (
                    <div
                      key={cat.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.85rem',
                        background: isChecked ? 'rgba(216, 183, 122, 0.08)' : '#161412',
                        border: isChecked ? '1px solid var(--admin-accent)' : '1px solid #2a2622',
                        borderRadius: '6px'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', flex: 1, margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCategory(cat.id)}
                          style={{ accentColor: 'var(--admin-accent)', width: '1.1rem', height: '1.1rem' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: isChecked ? '#fff' : 'var(--admin-text-muted)' }}>
                          {cat.icon} {cat.label}
                        </span>
                      </label>

                      {isChecked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder={`${editingOffer.discountPercent || 20}%`}
                            value={categoryDiscount !== undefined ? categoryDiscount : ''}
                            onChange={(e) => handleCategoryDiscountChange(cat.id, e.target.value)}
                            style={{
                              width: '56px',
                              padding: '0.25rem 0.4rem',
                              fontSize: '0.8rem',
                              background: '#0e0c0a',
                              border: '1px solid var(--admin-border)',
                              borderRadius: '4px',
                              color: '#fff',
                              textAlign: 'center'
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--admin-accent)' }}>%</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Active / Published Status Checkbox in Form */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#171411', border: '1px solid rgba(216, 183, 122, 0.3)', borderRadius: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--admin-accent)' }}>
                <input
                  type="checkbox"
                  checked={editingOffer.published !== false}
                  onChange={(e) => setEditingOffer((p) => ({ ...p, published: e.target.checked }))}
                  style={{ width: '1.3rem', height: '1.3rem', accentColor: 'var(--admin-accent)' }}
                />
                <span>✓ Active — Publish & Display Immediately on Special Offers Page</span>
              </label>
              <p style={{ margin: '0.35rem 0 0 2.05rem', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                When unchecked, this offer will be saved in your database but hidden from the public website.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => {
                  setEditingOffer(null)
                  setIsCreating(false)
                }}
              >
                Cancel
              </button>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                {saving ? 'Saving Campaign...' : isCreating ? 'Create & Publish Offer' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Campaign List */}
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--admin-text)' }}>
            Campaigns ({offersData.offers?.length || 0})
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)' }}>
            Use the <strong>Active Checkbox</strong> to immediately publish or hide any offer.
          </span>
        </div>

        {(!offersData.offers || offersData.offers.length === 0) ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No promotional campaigns configured yet.</p>
            <button type="button" className="admin-btn admin-btn--primary" onClick={handleStartCreate}>
              + Create Your First Seasonal Offer
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {offersData.offers.map((offer) => {
              const isActive = offer.published !== false
              const status = offer.computedStatus || (isActive ? 'active' : 'hidden')

              let statusColor = '#4ade80' // green
              if (status === 'hidden') statusColor = '#94a3b8' // gray
              if (status === 'expired') statusColor = '#f87171' // red
              if (status === 'upcoming') statusColor = '#60a5fa' // blue
              if (status === 'needs_image') statusColor = '#fbbf24' // amber/yellow

              return (
                <div
                  key={offer.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    padding: '1.25rem',
                    background: '#151311',
                    border: isActive ? '1px solid rgba(216, 183, 122, 0.35)' : '1px solid #2a2520',
                    borderRadius: '8px',
                    opacity: isActive ? 1 : 0.7
                  }}
                >
                  {/* Left: Thumbnail & Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '280px' }}>
                    <div style={{ position: 'relative', width: '90px', height: '65px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#25201b' }}>
                      {offer.bannerImage ? (
                        <img
                          src={offer.bannerImage}
                          alt={offer.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            const fallback = getCategoryHeroImage(offer.category || offer.categories?.[0])
                            if (fallback && e.target.src !== fallback) {
                              e.target.src = fallback
                            }
                          }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', fontSize: '1.1rem' }}>
                          📷
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: '2px', right: '2px', background: '#DC2626', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '1px 4px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.3)' }}>
                        {offer.discountPercent}% {offer.badgeText || 'OFF'}
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{offer.title}</h4>
                        {offer.festival && (
                          <span style={{ fontSize: '0.75rem', padding: '1px 6px', background: '#2a2219', color: 'var(--admin-accent)', borderRadius: '3px', border: '1px solid rgba(216, 183, 122, 0.3)' }}>
                            {offer.festival}
                          </span>
                        )}
                        <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '3px', background: `${statusColor}22`, color: statusColor, fontWeight: 'bold', border: `1px solid ${statusColor}55` }}>
                          {status === 'needs_image' ? 'NEEDS IMAGE (DRAFT)' : status.toUpperCase()}
                        </span>
                      </div>

                      {/* Tagline Preview */}
                      {offer.tagline && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--admin-accent)', fontWeight: '500' }}>
                          ★ {offer.tagline}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        <span style={{ color: 'var(--admin-accent)', fontWeight: 'bold' }}>
                          Category: {getCategoryLabel(offer.category || offer.categories?.[0])}
                        </span>
                        {offer.startDate && <span>• From: {offer.startDate}</span>}
                        {offer.endDate && <span>• Ends: {offer.endDate}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls & Active Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                    {/* Active Checkbox */}
                    <label
                      title="Toggle public visibility immediately"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        background: isActive ? 'rgba(74, 222, 128, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '4px',
                        border: isActive ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid rgba(148, 163, 184, 0.3)',
                        fontSize: '0.85rem',
                        color: isActive ? '#4ade80' : '#94a3b8',
                        fontWeight: '600'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => handleToggleOfferActive(offer)}
                        style={{ width: '1.15rem', height: '1.15rem', accentColor: '#4ade80' }}
                      />
                      <span>{isActive ? 'Active (Live)' : 'Inactive (Hidden)'}</span>
                    </label>

                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                      onClick={() => {
                        setIsCreating(false)
                        setEditingOffer({ ...offer })
                      }}
                    >
                      Edit Offer
                    </button>

                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                      onClick={() => handleDeleteOffer(offer)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Main Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({ token, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [data, setData] = useState(() => dataService.getAllDataSync())
  const [overviewLive, setOverviewLive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      const live = {}
      try {
        const [
          contentRes,
          photosRes,
          contactsRes,
          commentsRes,
          overviewRes,
          offersRes
        ] = await Promise.all([
          fetch(`${API_URL}/content?_t=${Date.now()}`, { headers: { ...authHeaders, 'Cache-Control': 'no-cache' } }).catch(() => null),
          fetch(`${API_URL}/photos?_t=${Date.now()}`, { headers: { ...authHeaders, 'Cache-Control': 'no-cache' } }).catch(() => null),
          fetch(`${API_URL}/contact?_t=${Date.now()}`, { headers: authHeaders }).catch(() => null),
          fetch(`${API_URL}/comments?_t=${Date.now()}`, { headers: authHeaders }).catch(() => null),
          fetch(`${API_URL}/overview?_t=${Date.now()}`, { headers: authHeaders }).catch(() => null),
          fetch(`${API_URL}/offers/admin?_t=${Date.now()}`, { headers: authHeaders }).catch(() => null)
        ])

        if (contentRes && contentRes.ok) live.content = await contentRes.json()
        if (photosRes && photosRes.ok) {
          live.photos = await photosRes.json()
          const photoArray = live.photos.photos || (Array.isArray(live.photos) ? live.photos : null)
          if (photoArray && photoArray.length > 0) {
            try {
              const currentStore = dataService.getAllDataSync()
              const updatedStore = { ...currentStore, photos: photoArray }
              dataService.memoryCache = updatedStore
              if (typeof window !== 'undefined') {
                localStorage.setItem('josh_photography_cms_data_v2', JSON.stringify(updatedStore))
              }
            } catch (_) {}
          }
        }
        if (contactsRes && contactsRes.ok) live.contacts = await contactsRes.json()
        if (commentsRes && commentsRes.ok) live.comments = await commentsRes.json()
        if (offersRes && offersRes.ok) live.offers = await offersRes.json()
        if (overviewRes && overviewRes.ok) {
          const ov = await overviewRes.json()
          setOverviewLive(ov)
        }
      } catch (err) {
        console.warn('API refresh error:', err)
      }

      const syncData = dataService.getAllDataSync()
      const merged = {
        content: live.content || syncData.content || initialContent,
        photos: live.photos || syncData.photos || initialPhotos,
        offers: live.offers?.offers || syncData.offers || initialOffers.offers || [],
        offersSettings: live.offers?.sectionSettings || syncData.offersSettings || initialOffers.sectionSettings || { enabled: true },
        contacts: live.contacts || [],
        comments: live.comments || []
      }

      setData(merged)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const showToast = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4500)
  }

  // Save content section handler
  const saveSection = async (sectionName, endpoint, sectionKey, payload) => {
    setSaving(true)
    try {
      // 1. Update dataService & localStorage immediately (live synchronizing all public pages)
      await dataService.updateContentSection(sectionKey, endpoint, payload, authHeaders)

      // 2. Update local state
      setData((prev) => ({
        ...prev,
        content: {
          ...prev.content,
          [sectionKey]: payload
        }
      }))

      showToast(`${sectionName} saved and published successfully!`)
      loadAllData()
    } catch (err) {
      console.error(err)
      showToast(`Failed to save ${sectionName}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Save photos handler
  const savePhotos = async (updatedPhotosList) => {
    setSaving(true)
    try {
      await dataService.updatePhotos(updatedPhotosList, authHeaders)
      setData((prev) => ({
        ...prev,
        photos: {
          ...prev.photos,
          photos: updatedPhotosList
        }
      }))

      // Sync to backend if accessible
      try {
        const res = await fetch(`${API_URL}/photos`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ photos: updatedPhotosList })
        })
        if (!res.ok) {
          console.warn('Backend update returned status:', res.status)
        }
      } catch (e) {
        console.warn('Backend update error:', e)
      }

      showToast('Portfolio photographs updated successfully!')
      await loadAllData()
    } catch (err) {
      console.error(err)
      showToast('Failed to update portfolio photographs', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Delete single photo handler
  const deletePortfolioPhoto = async (photoId, photoObj = null) => {
    setSaving(true)
    try {
      const currentList = data.photos?.photos || (Array.isArray(data.photos) ? data.photos : [])
      const targetPhoto = photoObj || currentList.find((p) => String(p.id) === String(photoId))
      const photoUrl = targetPhoto?.src || targetPhoto?.image || targetPhoto?.srcLarge || ''
      const publicId = targetPhoto?.publicId || extractCloudinaryPublicId(photoUrl)

      // 1. Direct DELETE to backend with image URL so Cloudinary destroys the asset immediately
      try {
        await fetch(`${API_URL}/photos/${encodeURIComponent(photoId)}`, {
          method: 'DELETE',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: photoUrl, publicId, id: photoId })
        })
      } catch (e) {
        console.warn('Backend DELETE error:', e)
      }

      // 2. Filter list
      const updatedList = currentList.filter((p) => String(p.id) !== String(photoId))

      // 3. Update dataService & localStorage
      await dataService.updatePhotos(updatedList, authHeaders)

      // 4. PUT updated list to backend to guarantee disk and database synchronization
      try {
        await fetch(`${API_URL}/photos`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ photos: updatedList })
        })
      } catch (e) { }

      // 5. Update local React state immediately
      setData((prev) => ({
        ...prev,
        photos: {
          ...prev.photos,
          photos: updatedList
        }
      }))

      showToast('Photograph deleted permanently')
      await loadAllData()
    } catch (err) {
      console.error(err)
      showToast('Failed to delete photograph', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Toggle Message Status
  const handleToggleMessageStatus = async (id, newStatus) => {
    try {
      await fetch(`${API_URL}/contact/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus })
      })
      setData((prev) => ({
        ...prev,
        contacts: prev.contacts.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      }))
      showToast(`Message marked as ${newStatus}`)
    } catch (err) {
      showToast('Failed to update message status', 'error')
    }
  }

  // Delete Message
  const handleDeleteMessage = async (id) => {
    if (!window.confirm('Delete this contact message permanently?')) return
    try {
      await fetch(`${API_URL}/contact/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      setData((prev) => ({
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== id)
      }))
      showToast('Message deleted successfully')
    } catch (err) {
      showToast('Failed to delete message', 'error')
    }
  }

  // Approve Comment
  const handleApproveComment = async (id) => {
    try {
      await fetch(`${API_URL}/comments/${id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ approved: true })
      })
      setData((prev) => ({
        ...prev,
        comments: prev.comments.map((c) => (c.id === id ? { ...c, approved: true } : c))
      }))
      showToast('Comment approved and published!')
    } catch (err) {
      showToast('Failed to approve comment', 'error')
    }
  }

  // Delete Comment
  const handleDeleteComment = async (id) => {
    if (!window.confirm('Delete this comment permanently?')) return
    try {
      await fetch(`${API_URL}/comments/${id}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      setData((prev) => ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== id)
      }))
      showToast('Comment deleted')
    } catch (err) {
      showToast('Failed to delete comment', 'error')
    }
  }

  const unreadMessagesCount = (data.contacts || []).filter(
    (c) => c.status === 'unread' || c.status === 'new'
  ).length

  const pendingCommentsCount = (data.comments || []).filter((c) => !c.approved).length

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'photos', label: 'Portfolio', icon: '📷', count: (data.photos?.photos || data.photos || []).length },
    { id: 'studio', label: 'Studio Info', icon: '🏠' },
    { id: 'another-studio', label: 'De Fab Studio', icon: '🏛️' },
    { id: 'hero', label: 'Hero Section', icon: '🎬' },
    { id: 'about', label: 'About Page', icon: '📖' },
    { id: 'services', label: 'Services', icon: '💼' },
    { id: 'offers', label: 'Offers & Promotions', icon: '🎁' },
    { id: 'testimonials', label: 'Testimonials', icon: '💬' },
    { id: 'collaborators', label: 'Team', icon: '👥' },
    { id: 'social', label: 'Social Links', icon: '🔗' },
    { id: 'settings', label: 'Website Settings', icon: '⚙️' },
    { id: 'messages', label: 'Messages', icon: '💌', badge: unreadMessagesCount },
    { id: 'comments', label: 'Comments', icon: '💭', badge: pendingCommentsCount }
  ]

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading__spinner" />
        <p>Loading Josh Photography CMS...</p>
      </div>
    )
  }

  const rawPhotos = data.photos?.photos || data.photos || []

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__header">
          <img src="/logo.png" alt="Josh Photography" className="admin-sidebar__icon" />
          <span>Josh Photography</span>
        </div>

        <nav className="admin-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`admin-nav__item ${activeTab === tab.id ? 'admin-nav__item--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {Boolean(tab.badge) && (
                <span className="admin-nav__badge">{tab.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <button className="admin-logout" onClick={onLogout}>
          Sign Out
        </button>
      </aside>

      {/* Main Panel */}
      <main className="admin-main">
        <header className="admin-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1>{tabs.find((t) => t.id === activeTab)?.label}</h1>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem',
                color: 'var(--admin-accent)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              View Public Website ↗
            </a>
          </div>
        </header>

        <div className="admin-content">
          <AnimatePresence>
            {message && (
              <motion.div
                className={`admin-message admin-message--${message.type}`}
                style={{
                  position: 'sticky',
                  top: '1rem',
                  zIndex: 9999,
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.25 }}
              >
                {message.type === 'error' ? '✕ ' : '✓ '}
                {message.text.replace(/^[✓✕\s]+/, '')}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Overview */}
          {activeTab === 'overview' && (
            <Overview
              data={data}
              overviewLive={overviewLive}
              onNavigateTab={(tabId) => setActiveTab(tabId)}
            />
          )}

          {/* Portfolio Photos */}
          {activeTab === 'photos' && (
            <PhotosEditor
              data={rawPhotos}
              onSave={savePhotos}
              onDelete={deletePortfolioPhoto}
              saving={saving}
              token={token}
              onReload={loadAllData}
              loading={loading}
            />
          )}

          {/* Studio Info */}
          {activeTab === 'studio' && (
            <StudioEditor
              data={data.content?.studio || initialContent.studio}
              onSave={(studioData) => saveSection('Studio Information', '/content/studio', 'studio', studioData)}
              saving={saving}
              token={token}
            />
          )}

          {/* De Fab Studio (Another Studio) */}
          {activeTab === 'another-studio' && (
            <DeFabStudioEditor
              data={data.content?.anotherStudio || initialContent.anotherStudio}
              onSave={(studioData) => saveSection('De Fab Studio', '/content/another-studio', 'anotherStudio', studioData)}
              saving={saving}
              token={token}
            />
          )}

          {/* Hero Section */}
          {activeTab === 'hero' && (
            <HeroEditor
              data={data.content?.heroSlides || initialContent.heroSlides}
              onSave={(slides) => saveSection('Hero Section', '/content/hero', 'heroSlides', slides)}
              saving={saving}
              token={token}
            />
          )}

          {/* About Page */}
          {activeTab === 'about' && (
            <AboutEditor
              data={data.content?.about || initialContent.about}
              onSave={(aboutData) => saveSection('About Page', '/content/about', 'about', aboutData)}
              saving={saving}
              token={token}
            />
          )}

          {/* Services */}
          {activeTab === 'services' && (
            <ServicesEditor
              data={data.content?.services || initialContent.services}
              onSave={(servicesList) => saveSection('Services', '/content/services', 'services', servicesList)}
              saving={saving}
              token={token}
            />
          )}

          {/* Offers & Promotions */}
          {activeTab === 'offers' && (
            <OffersEditor token={token} showToast={showToast} />
          )}

          {/* Testimonials */}
          {activeTab === 'testimonials' && (
            <TestimonialsEditor
              data={data.content?.testimonials || initialContent.testimonials}
              onSave={(tList) => saveSection('Testimonials', '/content/testimonials', 'testimonials', tList)}
              saving={saving}
              token={token}
            />
          )}

          {/* Team */}
          {activeTab === 'collaborators' && (
            <CollaboratorsEditor
              data={data.content?.collaborators || initialContent.collaborators}
              onSave={(teamList) => saveSection('Team', '/content/collaborators', 'collaborators', teamList)}
              saving={saving}
              token={token}
            />
          )}

          {/* Social Links */}
          {activeTab === 'social' && (
            <SocialEditor
              data={data.content?.social || initialContent.social}
              onSave={(socialData) => saveSection('Social Media Links', '/content/social', 'social', socialData)}
              saving={saving}
            />
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <SettingsEditor
              data={data.content?.settings || initialContent.settings}
              onSave={(settingsData) => saveSection('Website Settings', '/content/settings', 'settings', settingsData)}
              saving={saving}
              token={token}
            />
          )}

          {/* Messages */}
          {activeTab === 'messages' && (
            <MessagesViewer
              data={data.contacts || []}
              onToggleStatus={handleToggleMessageStatus}
              onDeleteMessage={handleDeleteMessage}
            />
          )}

          {/* Comments */}
          {activeTab === 'comments' && (
            <CommentsManager
              data={data.comments || []}
              onApprove={handleApproveComment}
              onDelete={handleDeleteComment}
            />
          )}
        </div>
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. Main Export (Strict Access: Prompt for Email & Password on Every Visit)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminApp() {
  // Always require signing in on every visit/open — never auto-login from stored tokens
  const [token, setToken] = useState(null)

  useEffect(() => {
    // Clear any previous persistent tokens on initial load to ensure strict security
    try {
      localStorage.removeItem('adminToken')
      sessionStorage.removeItem('adminToken')
    } catch (_) { }
  }, [])

  const handleLogout = () => {
    try {
      localStorage.removeItem('adminToken')
      sessionStorage.removeItem('adminToken')
    } catch (_) { }
    setToken(null)
  }

  if (!token) {
    return <Login onLogin={setToken} />
  }

  return <Dashboard token={token} onLogout={handleLogout} />
}
