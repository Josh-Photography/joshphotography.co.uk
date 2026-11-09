import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronDown } from 'lucide-react'
import { siteConfig, navigation } from '../../data/siteConfig'
import { useWebsiteData } from '../../hooks/useWebsiteData'
import { getWhatsAppUrl } from '../../utils/whatsapp'

// Routes with dark hero imagery at the top
const DARK_HERO_ROUTES = [
  '/',
  '/weddings',
  '/birthday-photography',
  '/celebrations',
  '/pre-wedding',
  '/engagement',
  '/anniversary',
  '/baby-family',
  '/portraits',
  '/festivals',
  '/corporate-events',
  '/mothers-day',
  '/fathers-day',
  '/family',
  '/maternity',
  '/graduations',
  '/sports-photography',
  '/sports-shoot',
  '/product-photography',
  '/product-shoot',
  '/car-photography',
  '/car-shoot',
  '/cars-shoot',
  '/reels-shoots',
  '/reels-shoot',
  '/model-photography',
  '/model-shoot',
  '/portfolio',
  '/films',
  '/special-offers',
  '/offers',
  '/testimonials',
  '/about',
  '/contact',
]

export default function Navbar() {
  const { studio = {}, settings = {} } = useWebsiteData()
  const studioName = settings.siteName || studio.name || siteConfig.studioName
  const baseUrl = import.meta.env.BASE_URL || "./"
  const lightLogo = settings.logoBlack || `${baseUrl}logo-black.png`
  const darkLogo = settings.logo || `${baseUrl}logo.png`
  const ctaText = settings.ctaButtonText || settings.bookingButtonText || 'Check Availability'
  const ctaLink = settings.ctaButtonLink || settings.bookingButtonLink || '/check-availability' 
  const whatsappMobileUrl = getWhatsAppUrl(studio.whatsapp || siteConfig.whatsapp, `Hello ${studioName || 'Josh Photography'}! I would like to inquire about your photography services.`)

  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [mobileExpanded, setMobileExpanded] = useState({ '/celebrations': false, '/portfolio': false })
  const location = useLocation()
  const navContainerRef = useRef(null)

  const isDarkHeroPage = DARK_HERO_ROUTES.includes(location.pathname)

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 40)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Close dropdowns on route changes
  useEffect(() => {
    setIsMobileOpen(false)
    setActiveDropdown(null)
  }, [location])

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  // Click outside and Escape key handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target)) {
        setActiveDropdown(null)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null)
        setIsMobileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const isActive = (path) => {
    if (path === '/' && location.pathname !== '/') return false
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
  }

  // Header state
  // State A: Over dark hero at top -> transparent with subtle warm-charcoal top gradient & warm ivory text
  // State B: Scrolled or over light section -> solid opaque warm ivory background (#F8F3EA) with bold deep-charcoal text
  const isLightMode = isScrolled || !isDarkHeroPage

  const toggleDropdown = (path, e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setActiveDropdown((prev) => (prev === path ? null : path))
  }

  return (
    <>
      {/* Scroll Progress Bar */}
      <ScrollProgress />

      <header
        style={{
          backgroundColor: isLightMode ? '#F8F3EA' : undefined,
        }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ease-luxury ${isLightMode
          ? 'bg-ivory border-b border-[#D8B77A]/35 shadow-[0_4px_24px_rgba(41,37,34,0.06)] py-4'
          : 'bg-gradient-to-b from-[#181310]/90 via-[#181310]/40 to-transparent py-5'
          }`}
      >
        <div
          ref={navContainerRef}
          className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-6 xl:px-10 flex items-center justify-between gap-2 lg:gap-3 xl:gap-5"
        >
          {/* Column 1: Logo & Studio Name (Left Aligned) */}
          <div className="shrink-0 flex items-center mr-3 lg:mr-4 xl:mr-8">
            <Link
              to="/"
              className="group flex items-center gap-2 sm:gap-2.5 xl:gap-3"
              aria-label={`${studioName} - Home`}
            >
              <img
                src={isLightMode ? lightLogo : darkLogo}
                alt={studioName}
                className="h-9 sm:h-11 lg:h-10 xl:h-13 w-auto object-contain transition-all duration-300 group-hover:scale-105 shrink-0"
              />
              <span
                className={`font-serif text-[13px] sm:text-base lg:text-[0.95rem] xl:text-[1.2rem] 2xl:text-[1.4rem] tracking-[0.04em] xl:tracking-[0.06em] uppercase whitespace-nowrap transition-colors duration-300 font-normal shrink-0 ${isLightMode
                  ? 'text-charcoal'
                  : 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]'
                  }`}
              >
                {String(studioName || 'Josh Photography').toUpperCase()}
              </span>
            </Link>
          </div>

          {/* Column 2: Navigation Links (Centered with balanced spacing) */}
          <nav
            className="hidden lg:flex items-center justify-center gap-0 lg:gap-0.5 xl:gap-1.5 2xl:gap-3 flex-1 min-w-0 mx-1 lg:mx-2 xl:mx-4"
            role="navigation"
            aria-label="Main navigation"
          >
            {navigation.map((item) => {
              const hasChildren = Boolean(item.children && item.children.length > 0)
              const isOpen = activeDropdown === item.path

              // Responsive label: on tighter desktop screens, abbreviate labels to prevent crowding
              const displayLabel = item.label === 'Client Testimonials' ? (
                <span>
                  <span className="hidden 2xl:inline">CLIENT </span>TESTIMONIALS
                </span>
              ) : item.label === 'Special Offers' ? (
                <span>
                  <span className="hidden xl:inline">SPECIAL </span>OFFERS
                </span>
              ) : (
                item.label
              )

              return (
                <div
                  key={item.path}
                  className="relative shrink-0"
                  onMouseEnter={() => hasChildren && setActiveDropdown(item.path)}
                  onMouseLeave={() => hasChildren && setActiveDropdown(null)}
                >
                  {hasChildren ? (
                    <Link
                      to={item.path}
                      onClick={() => setActiveDropdown(null)}
                      aria-expanded={isOpen}
                      aria-haspopup="true"
                      className={`px-1 lg:px-1.5 xl:px-2.5 2xl:px-3 py-1 lg:py-1.5 xl:py-2 font-nav text-[10.5px] lg:text-[11px] xl:text-[12.5px] 2xl:text-[13.5px] uppercase tracking-[0.04em] lg:tracking-[0.05em] xl:tracking-[0.08em] transition-all duration-300 flex items-center gap-1 cursor-pointer rounded-sm whitespace-nowrap ${isOpen || isActive(item.path)
                        ? isLightMode
                          ? 'text-gold font-bold'
                          : 'text-[#E5BA78] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
                        : isLightMode
                          ? 'text-charcoal font-semibold hover:text-gold'
                          : 'text-ivory font-medium hover:text-[#E5BA78] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
                        }`}
                    >
                      <span>{displayLabel}</span>
                      <ChevronDown
                        className={`w-3 h-3 xl:w-3.5 xl:h-3.5 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-gold' : 'opacity-80'
                          }`}
                      />
                    </Link>
                  ) : (
                    <Link
                      to={item.path}
                      className={`px-1 lg:px-1.5 xl:px-2.5 2xl:px-3 py-1 lg:py-1.5 xl:py-2 font-nav text-[10.5px] lg:text-[11px] xl:text-[12.5px] 2xl:text-[13.5px] uppercase tracking-[0.04em] lg:tracking-[0.05em] xl:tracking-[0.08em] transition-all duration-300 flex items-center gap-1 rounded-sm whitespace-nowrap ${isActive(item.path)
                        ? isLightMode
                          ? 'text-gold font-bold'
                          : 'text-[#E5BA78] font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
                        : isLightMode
                          ? 'text-charcoal font-semibold hover:text-gold'
                          : 'text-ivory font-medium hover:text-[#E5BA78] drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
                        }`}
                    >
                      <span>{displayLabel}</span>
                    </Link>
                  )}

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {hasChildren && isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ backgroundColor: '#F8F3EA' }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 min-w-[280px] sm:min-w-[310px] max-h-[75vh] overflow-y-auto bg-ivory border border-[#D8B77A]/60 shadow-[0_16px_40px_rgba(41,37,34,0.18)] py-2.5 z-[70] rounded-sm"
                      >
                        {item.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setActiveDropdown(null)}
                            className={`flex items-center justify-between px-5 py-3 font-nav text-[14px] tracking-[0.04em] font-medium transition-all duration-200 border-l-2 group ${isActive(child.path)
                              ? 'border-gold text-gold bg-[#F3ECE0]'
                              : 'border-transparent text-charcoal/90 hover:text-charcoal hover:bg-[#F3ECE0] hover:border-gold/80 hover:pl-6'
                              }`}
                          >
                            <span>{child.label}</span>
                            <ChevronDown className="w-3.5 h-3.5 -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity text-gold shrink-0 ml-2" />
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* Column 3: Check Availability Button (Right Aligned) */}
          <div className="shrink-0 flex items-center justify-end gap-2 sm:gap-2.5 pr-2 sm:pr-0 ml-3 lg:ml-4 xl:ml-6">
            <Link
              to={ctaLink}
              className={`hidden lg:inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1.5 lg:px-3 lg:py-1.5 xl:px-4 xl:py-2 font-nav text-[10.5px] lg:text-[11px] xl:text-[12px] uppercase tracking-[0.06em] lg:tracking-[0.08em] xl:tracking-[0.12em] font-semibold transition-all duration-300 border shadow-sm rounded-sm shrink-0 ${isLightMode
                ? 'border-[#292522] text-[#292522] hover:bg-[#292522] hover:text-[#FAF6EE]'
                : 'border-[#E5BA78] text-[#E5BA78] hover:bg-[#E5BA78] hover:text-[#1A1715] backdrop-blur-sm bg-black/25'
                }`}
            >
              {ctaText}
            </Link>

            {/* Mobile WhatsApp Button — Visible ONLY on mobile phones (hidden on tablet md: and desktop lg:) */}
            <a
              href={whatsappMobileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="md:hidden flex items-center justify-center w-9 h-9 text-[#25D366] hover:scale-110 active:scale-95 transition-transform duration-200 shrink-0"
              aria-label="Chat on WhatsApp"
              title="Chat on WhatsApp"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </a>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className={`lg:hidden flex items-center justify-center w-9 h-9 transition-colors duration-300 rounded ${isLightMode ? 'text-charcoal' : 'text-ivory'}`}
              aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileOpen}
            >
              {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay — Full Screen on Warm Ivory Background */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ backgroundColor: '#F8F3EA' }}
            className="fixed inset-0 z-[60] bg-ivory flex flex-col"
          >
            {/* Mobile Header Bar */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#D8B77A]/30">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <img
                  src={lightLogo}
                  alt={studioName}
                  className="h-12 w-auto object-contain" style={{ filter: 'brightness(0)' }}
                />
                <span className="font-serif text-xl text-charcoal font-medium tracking-[0.08em] uppercase">
                  {String(studioName || 'Josh Photography').toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-2 text-charcoal hover:text-gold"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
              {navigation.map((item) => {
                const hasChildren = Boolean(item.children && item.children.length > 0)
                const isExpanded = Boolean(mobileExpanded[item.path])

                return (
                  <div key={item.path} className="border-b border-[#D8B77A]/20 pb-3">
                    {hasChildren ? (
                      <div>
                        <div className="w-full flex items-center justify-between py-1">
                          <Link
                            to={item.path}
                            onClick={() => setIsMobileOpen(false)}
                            className={`font-serif text-2xl font-light tracking-wide transition-colors ${isActive(item.path) ? 'text-gold font-medium' : 'text-charcoal hover:text-gold'
                              }`}
                          >
                            {item.label}
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setMobileExpanded((prev) => ({
                                ...prev,
                                [item.path]: !prev[item.path],
                              }))
                            }
                            className="p-2 -mr-2 text-charcoal/70 hover:text-gold"
                            aria-expanded={isExpanded}
                            aria-label={`Toggle ${item.label} submenu`}
                          >
                            <ChevronDown
                              className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-gold' : ''
                                }`}
                            />
                          </button>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22 }}
                              className="mt-2.5 pl-4 space-y-1 border-l-2 border-[#D8B77A]/50 overflow-hidden"
                            >
                              {item.children.map((child) => (
                                <Link
                                  key={child.path}
                                  to={child.path}
                                  onClick={() => setIsMobileOpen(false)}
                                  className={`block font-nav text-[13.5px] tracking-wider py-2 transition-colors ${isActive(child.path)
                                    ? 'text-gold font-semibold'
                                    : 'text-charcoal/85 hover:text-charcoal'
                                    }`}
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link
                        to={item.path}
                        onClick={() => setIsMobileOpen(false)}
                        className={`block font-serif text-2xl font-light tracking-wide transition-colors py-1 ${isActive(item.path)
                          ? 'text-gold font-medium'
                          : 'text-charcoal hover:text-gold'
                          }`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </div>
                )
              })}

              <div className="pt-6 pb-8">
                <Link
                  to={ctaLink}
                  onClick={() => setIsMobileOpen(false)}
                  className="w-full block text-center py-4 bg-muted-gold text-deep-black font-nav text-xs uppercase tracking-[0.16em] font-semibold hover:bg-gold-light shadow-sm"
                >
                  {ctaText}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-[65] h-[2px] bg-transparent">
      <div
        className="h-full bg-gradient-gold transition-all duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
