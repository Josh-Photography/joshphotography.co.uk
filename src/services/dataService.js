import initialContent from '../../server/data/content.json'
import initialPhotos from '../../server/data/photos.json'
import initialOffers from '../../server/data/offers.json'
import { normalizeCategoryKey } from '../utils/categoryUtils'

const STORAGE_KEY = 'josh_cms_data'
const EVENT_NAME = 'josh_data_updated'

// In browser, relative '/api' works seamlessly through Vite proxy or same-domain deployment.
// When hosted statically on GitHub Pages, route API calls to the live Vercel backend.
const API_BASE = (typeof window !== 'undefined' && window.location.hostname.includes('github.io'))
  ? 'https://www.joshyphotography.co.uk/api'
  : '/api'

class DataService {
  constructor() {
    this.memoryCache = null
    this.listeners = new Set()
    this.init()
  }

  init() {
    // Listen for storage events across tabs or windows
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.memoryCache = null
          this.notify()
        }
      })
      window.addEventListener(EVENT_NAME, () => {
        this.notify()
      })
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getAllDataSync())
      } catch (err) {
        console.error('DataService listener error:', err)
      }
    })
  }

  // Get current state synchronously from cache or localStorage or bundled defaults
  getAllDataSync() {
    if (this.memoryCache) {
      return this.memoryCache
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed && typeof parsed === 'object') {
            const rawContent = (parsed.content && typeof parsed.content === 'object') ? parsed.content : {}

            // Normalize photos array safely
            let photosList = []
            if (Array.isArray(parsed.photos)) {
              photosList = parsed.photos
            } else if (parsed.photos && Array.isArray(parsed.photos.photos)) {
              photosList = parsed.photos.photos
            } else if (Array.isArray(initialPhotos.photos)) {
              photosList = initialPhotos.photos
            }

            // Normalize categories array safely
            let categoriesList = []
            if (Array.isArray(parsed.categories)) {
              categoriesList = parsed.categories
            } else if (parsed.photos && Array.isArray(parsed.photos.categories)) {
              categoriesList = parsed.photos.categories
            } else if (Array.isArray(initialPhotos.categories)) {
              categoriesList = initialPhotos.categories
            }

            const rawHeroSlides = Array.isArray(rawContent.heroSlides) ? rawContent.heroSlides : []
            const heroSlidesList = (rawHeroSlides.length > 0) ? rawHeroSlides : (initialContent.heroSlides || [])

            const rawServices = Array.isArray(rawContent.services) ? rawContent.services : []
            const servicesList = (rawServices.length > 0) ? rawServices : (initialContent.services || [])

            const rawOffers = Array.isArray(parsed.offers) ? parsed.offers : (Array.isArray(rawContent.offers) ? rawContent.offers : [])
            const offersList = (rawOffers.length > 0) ? rawOffers : (initialOffers.offers || [])
            const offersSettingsData = parsed.offersSettings || rawContent.offersSettings || initialOffers.sectionSettings || { enabled: true }

            const normalized = {
              content: {
                studio: { ...(initialContent.studio || {}), ...(rawContent.studio || {}) },
                about: { ...(initialContent.about || {}), ...(rawContent.about || {}) },
                heroSlides: heroSlidesList,
                services: servicesList,
                testimonials: (Array.isArray(rawContent.testimonials) && rawContent.testimonials.length > 0) ? rawContent.testimonials : (initialContent.testimonials || []),
                collaborators: (Array.isArray(rawContent.collaborators) && rawContent.collaborators.length > 0) ? rawContent.collaborators : (initialContent.collaborators || []),
                social: { ...(initialContent.social || {}), ...(rawContent.social || {}) },
                settings: { ...(initialContent.settings || {}), ...(rawContent.settings || {}) },
                anotherStudio: { ...(initialContent.anotherStudio || {}), ...(rawContent.anotherStudio || {}) },
              },
              photos: photosList,
              categories: categoriesList,
              offers: offersList,
              offersSettings: offersSettingsData,
            }
            this.memoryCache = normalized
            return normalized
          }
        }
      } catch (e) {
        console.warn('Failed to read from localStorage:', e)
      }
    }

    const fallback = {
      content: initialContent,
      photos: Array.isArray(initialPhotos.photos) ? initialPhotos.photos : [],
      categories: Array.isArray(initialPhotos.categories) ? initialPhotos.categories : [],
      offers: Array.isArray(initialOffers.offers) ? initialOffers.offers : [],
      offersSettings: initialOffers.sectionSettings || { enabled: true },
    }
    this.memoryCache = fallback
    return fallback
  }

  // Fetch latest data from backend API with cache update
  async refreshAllData() {
    try {
      const [contentRes, photosRes, offersRes] = await Promise.all([
        fetch(`${API_BASE}/content?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
        fetch(`${API_BASE}/photos?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
        fetch(`${API_BASE}/offers?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null),
      ])

      let content = null
      let photosData = null
      let offersData = null

      if (contentRes && contentRes.ok) {
        content = await contentRes.json()
      }
      if (photosRes && photosRes.ok) {
        photosData = await photosRes.json()
      }
      if (offersRes && offersRes.ok) {
        offersData = await offersRes.json()
      }

      if (content || photosData || offersData) {
        const current = this.getAllDataSync()

        let newPhotos = current.photos
        if (photosData) {
          if (Array.isArray(photosData.photos)) {
            newPhotos = photosData.photos
          } else if (Array.isArray(photosData)) {
            newPhotos = photosData
          }
        }

        let newCategories = current.categories
        if (photosData) {
          if (Array.isArray(photosData.categories)) {
            newCategories = photosData.categories
          }
        }

        const merged = {
          content: content || current.content,
          photos: newPhotos,
          categories: newCategories,
          offers: offersData ? (offersData.offers || []) : (current.offers || []),
          offersSettings: offersData
            ? {
                enabled: offersData.enabled !== false,
                eyebrow: offersData.eyebrow || 'SPECIAL OFFERS & SEASONAL PROMOTIONS',
                title: offersData.title || 'Limited-Time Photography Promotions',
                subtitle: offersData.subtitle || '',
              }
            : (current.offersSettings || { enabled: true }),
        }

        this.memoryCache = merged
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
            window.dispatchEvent(new Event(EVENT_NAME))
          } catch (e) { }
        }
        this.notify()
        return merged
      }
    } catch (err) {
      console.warn('Backend refresh failed, using cached data:', err)
    }

    return this.getAllDataSync()
  }

  // Category-specific photos getter
  getCategoryPhotos(categorySlugOrId) {
    const data = this.getAllDataSync()
    let all = []
    if (Array.isArray(data.photos)) {
      all = data.photos
    } else if (data.photos && Array.isArray(data.photos.photos)) {
      all = data.photos.photos
    } else if (Array.isArray(initialPhotos.photos)) {
      all = initialPhotos.photos
    }

    const targetKey = normalizeCategoryKey(categorySlugOrId)
    const rawTarget = String(categorySlugOrId || '').toLowerCase().trim()

    // Match exact category or alternate slug
    const matching = all.filter((p) => {
      if (!p || p.published === false) return false
      const pCat = normalizeCategoryKey(p.category)
      const pSlug = normalizeCategoryKey(p.categorySlug)
      const rawCat = String(p.category || '').toLowerCase().trim()
      const rawSlug = String(p.categorySlug || '').toLowerCase().trim()
      return pCat === targetKey || pSlug === targetKey || rawCat === rawTarget || rawSlug === rawTarget
    })

    // Sort by order ascending
    matching.sort((a, b) => (a.order || 0) - (b.order || 0))

    return matching.map((p, idx) => ({
      id: p.id || `photo-${idx}`,
      num: String(idx + 1).padStart(2, '0'),
      title: p.title || `Photograph ${idx + 1}`,
      desc: p.desc || '',
      image: p.image || p.src || '',
      src: p.src || p.image || '',
      srcLarge: p.srcLarge || p.image || p.src || '',
      alt: p.alt || p.title || 'Josh Photography portfolio image',
      category: p.category,
      order: p.order || idx + 1,
      published: p.published !== false,
      objectPosition: p.objectPosition || p.imagePosition || null,
      aspectRatio: p.aspectRatio || null,
    }))
  }

  // Studio Info
  getStudioInfo() {
    const data = this.getAllDataSync()
    return data.content?.studio || initialContent.studio
  }

  // About Page
  getAboutData() {
    const data = this.getAllDataSync()
    return data.content?.about || initialContent.about
  }

  // Hero Slides
  getHeroSlides() {
    const data = this.getAllDataSync()
    const slides = Array.isArray(data.content?.heroSlides)
      ? data.content.heroSlides
      : (Array.isArray(initialContent.heroSlides) ? initialContent.heroSlides : [])
    return slides.filter((s) => s && s.published !== false)
  }

  // Services
  getServices() {
    const data = this.getAllDataSync()
    const services = Array.isArray(data.content?.services)
      ? data.content.services
      : (Array.isArray(initialContent.services) ? initialContent.services : [])
    return services.filter((s) => s && s.published !== false)
  }

  // Testimonials
  getTestimonials() {
    const data = this.getAllDataSync()
    const testimonials = Array.isArray(data.content?.testimonials)
      ? data.content.testimonials
      : (Array.isArray(initialContent.testimonials) ? initialContent.testimonials : [])
    return testimonials.filter((t) => t && t.published !== false)
  }

  // Team
  getTeam() {
    const data = this.getAllDataSync()
    const team = Array.isArray(data.content?.collaborators)
      ? data.content.collaborators
      : (Array.isArray(initialContent.collaborators) ? initialContent.collaborators : [])
    return team.filter((t) => t && t.published !== false)
  }

  // Social
  getSocialLinks() {
    const data = this.getAllDataSync()
    return data.content?.social || initialContent.social
  }

  // Settings
  getSettings() {
    const data = this.getAllDataSync()
    return data.content?.settings || initialContent.settings
  }

  // Update Section (used by Admin)
  async updateContentSection(sectionKey, endpoint, payload, authHeaders = {}) {
    let cleanPayload = payload
    if (sectionKey === 'settings' && typeof payload === 'object' && payload !== null) {
      cleanPayload = {
        ...payload,
        ctaButtonText: payload.ctaButtonText || payload.bookingButtonText || 'Check Availability',
        bookingButtonText: payload.bookingButtonText || payload.ctaButtonText || 'Check Availability',
        ctaButtonLink: payload.ctaButtonLink || payload.bookingButtonLink || '/check-availability',
        bookingButtonLink: payload.bookingButtonLink || payload.ctaButtonLink || '/check-availability',
        seoDefaultTitle: payload.seoDefaultTitle || payload.seoTitle,
        seoTitle: payload.seoTitle || payload.seoDefaultTitle,
      }
    }

    // 1. Update memory and localStorage immediately
    const current = this.getAllDataSync()
    const updatedContent = { ...current.content, [sectionKey]: cleanPayload }
    if (sectionKey === 'studio' && cleanPayload?.name) {
      updatedContent.settings = {
        ...updatedContent.settings,
        siteName: cleanPayload.name,
      }
    }
    const updated = { ...current, content: updatedContent }

    this.memoryCache = updated
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(EVENT_NAME))
      } catch (e) { }
    }

    // 2. Persist to backend API if available
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(cleanPayload),
      })
      if (!res.ok) {
        console.warn('Backend update returned non-OK status:', res.status)
      }
    } catch (err) {
      console.warn('Backend update failed, saved to local cache:', err)
    }

    this.notify()
    return updated
  }

  // Update photos list
  async updatePhotos(photosList, authHeaders = {}) {
    const current = this.getAllDataSync()
    const updated = { ...current, photos: photosList }
    this.memoryCache = updated
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(EVENT_NAME))
      } catch (e) { }
    }

    // Persist to backend API if available
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...authHeaders,
      }
      const res = await fetch(`${API_BASE}/photos`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ photos: photosList }),
      })
      if (!res.ok) {
        console.warn('Backend photos update returned status:', res.status)
      }
    } catch (err) {
      console.warn('Backend photos update failed, saved to local cache:', err)
    }

    this.notify()
    return updated
  }

  // Update single promotional offer (used by Admin edit & publish toggle)
  async updateSingleOffer(offerId, partialOfferData, authHeaders = {}) {
    // 1. Update memoryCache and localStorage immediately
    const current = this.getAllDataSync()
    const currentOffers = Array.isArray(current.offers) ? [...current.offers] : []
    const idx = currentOffers.findIndex((o) => String(o.id) === String(offerId))

    let updatedOffer = null
    if (idx !== -1) {
      updatedOffer = {
        ...currentOffers[idx],
        ...partialOfferData,
        id: currentOffers[idx].id,
        updatedAt: new Date().toISOString(),
      }
      currentOffers[idx] = updatedOffer
    } else {
      updatedOffer = {
        id: offerId,
        ...partialOfferData,
        updatedAt: new Date().toISOString(),
      }
      currentOffers.push(updatedOffer)
    }

    const updated = { ...current, offers: currentOffers }
    this.memoryCache = updated

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(EVENT_NAME))
      } catch (e) { }
    }

    // 2. Persist to backend API
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...authHeaders,
    }

    const res = await fetch(`${API_BASE}/offers/${encodeURIComponent(offerId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(partialOfferData),
    })

    if (!res.ok) {
      let errorMsg = `Server returned ${res.status}`
      try {
        const text = await res.text()
        try {
          const errData = JSON.parse(text)
          errorMsg = errData.error || errData.message || errorMsg
        } catch {
          if (text && text.length < 200) {
            errorMsg = text
          }
        }
      } catch { }
      throw new Error(errorMsg)
    }

    const serverData = await res.json()
    if (serverData && serverData.id) {
      const finalIndex = currentOffers.findIndex((o) => String(o.id) === String(serverData.id))
      if (finalIndex !== -1) {
        currentOffers[finalIndex] = { ...currentOffers[finalIndex], ...serverData }
        this.memoryCache = { ...current, offers: currentOffers }
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memoryCache))
            window.dispatchEvent(new Event(EVENT_NAME))
          } catch (e) { }
        }
      }
    }

    this.notify()
    return serverData || updatedOffer
  }

  // Create new campaign offer
  async createOffer(newOfferPayload, authHeaders = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...authHeaders,
    }

    const res = await fetch(`${API_BASE}/offers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newOfferPayload),
    })

    if (!res.ok) {
      let errorMsg = `Server returned ${res.status}`
      try {
        const text = await res.text()
        try {
          const errData = JSON.parse(text)
          errorMsg = errData.error || errData.message || errorMsg
        } catch {
          if (text && text.length < 200) {
            errorMsg = text
          }
        }
      } catch { }
      throw new Error(errorMsg)
    }

    const created = await res.json()
    const current = this.getAllDataSync()
    const currentOffers = Array.isArray(current.offers) ? [...current.offers] : []
    currentOffers.push(created)

    const updated = { ...current, offers: currentOffers }
    this.memoryCache = updated
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(EVENT_NAME))
      } catch (e) { }
    }

    this.notify()
    return created
  }

  // Delete campaign offer
  async deleteOffer(offerId, authHeaders = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...authHeaders,
    }

    const res = await fetch(`${API_BASE}/offers/${encodeURIComponent(offerId)}`, {
      method: 'DELETE',
      headers,
    })

    if (!res.ok) {
      let errorMsg = `Server returned ${res.status}`
      try {
        const text = await res.text()
        try {
          const errData = JSON.parse(text)
          errorMsg = errData.error || errData.message || errorMsg
        } catch {
          if (text && text.length < 200) {
            errorMsg = text
          }
        }
      } catch { }
      throw new Error(errorMsg)
    }

    const current = this.getAllDataSync()
    const currentOffers = (current.offers || []).filter((o) => String(o.id) !== String(offerId))
    const updated = { ...current, offers: currentOffers }
    this.memoryCache = updated

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(EVENT_NAME))
      } catch (e) { }
    }

    this.notify()
    return true
  }

  // Update section settings (toggle page visibility, hero header)
  async updateOffersSettings(settingsPayload, authHeaders = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...authHeaders,
    }

    const res = await fetch(`${API_BASE}/offers/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(settingsPayload),
    })

    if (!res.ok) {
      let errorMsg = `Server returned ${res.status}`
      try {
        const text = await res.text()
        try {
          const errData = JSON.parse(text)
          errorMsg = errData.error || errData.message || errorMsg
        } catch {
          if (text && text.length < 200) {
            errorMsg = text
          }
        }
      } catch { }
      throw new Error(errorMsg)
    }

    const updatedSettings = await res.json()
    const current = this.getAllDataSync()
    const updated = { ...current, offersSettings: updatedSettings }
    this.memoryCache = updated

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        window.dispatchEvent(new Event(EVENT_NAME))
      } catch (e) { }
    }

    this.notify()
    return updatedSettings
  }

  // Submit Contact Form
  async submitContact(formData) {
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn('Backend contact submission error:', e)
    }

    // Fallback: store locally in messages queue if offline
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('josh_offline_messages') || '[]')
        stored.unshift({
          ...formData,
          id: 'offline-' + Date.now(),
          submittedAt: new Date().toISOString(),
          status: 'unread',
        })
        localStorage.setItem('josh_offline_messages', JSON.stringify(stored))
      } catch (e) { }
    }

    return { message: 'Message received successfully', status: 'stored' }
  }

  // Submit Comment
  async submitComment(photoId, commentData) {
    try {
      const res = await fetch(`${API_BASE}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId, ...commentData }),
      })
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn('Backend comment submission error:', e)
    }

    return { message: 'Comment submitted for approval' }
  }
}

export const dataService = new DataService()
export default dataService
