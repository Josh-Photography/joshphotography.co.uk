import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { siteConfig } from '../../data/siteConfig'
import { getCategoryBySlug } from '../../data/categoriesData'
import { PhotographyCard } from './PhotographyCard'
import ImageLightbox from './ImageLightbox'
import { useWebsiteData } from '../../hooks/useWebsiteData'

export default function CategoryTemplate({
  categoryId,
  badge,
  title,
  tagline,
  description = [],
  chapters = [],
  features = [],
  quote,
  quoteImage,
  heroPosition,
  quoteImagePosition,
  cardAspectRatio,
}) {
  const [selectedImage, setSelectedImage] = useState(null)
  const { getCategoryCards, data, studio = {} } = useWebsiteData()
  const rawNumber = studio.whatsapp || siteConfig.whatsapp
  const cleanWhatsapp = String(rawNumber).replace(/[^0-9]/g, '')
  const studioName = studio.name || siteConfig.studioName

  // Retrieve dynamic cards from CMS / database, fallback to categoriesData
  const categoryData = getCategoryBySlug(categoryId) || {}
  const dynamicCards = getCategoryCards ? getCategoryCards(categoryId) : []
  const hasLoadedData = Boolean(data && Array.isArray(data.photos) && data.photos.length > 0)
  const categoryCards = (dynamicCards && (dynamicCards.length > 0 || hasLoadedData)) ? dynamicCards : (categoryData?.cards || [])

  // Hero image: when the admin has reordered photos in the Portfolio editor, the first
  // dynamic card (order=1) becomes the effective hero — enabling admin-managed hero updates.
  // Falls back to categoryData.heroImage, then quoteImage, then a global default.
  const firstAdminCard = dynamicCards.length > 0 ? dynamicCards[0] : null
  const heroImg = (firstAdminCard?.image || firstAdminCard?.src) || categoryData?.heroImage || quoteImage || '/images/hero-church-wedding.jpg'

  // Focal position resolution for Hero so faces and athletes are never cropped
  const getHeroFocalPosition = (img, explicitPos) => {
    if (explicitPos) return explicitPos
    if (categoryData?.heroPosition) return categoryData.heroPosition
    const s = String(img || '').toLowerCase()
    // Model & Sports heroes remain portrait — keep faces at top
    if (s.includes('model_shoot_1')) return 'center 18%'
    if (s.includes('model_shoot_')) return 'center 20%'
    if (s.includes('sports_shoot_1')) return 'center 18%'
    if (s.includes('sports_shoot_')) return 'center 20%'
    // Reel heroes are now landscape — standard center
    if (s.includes('reel_shoot_')) return 'center center'
    // Car heroes are now high-res landscape — standard center
    if (s.includes('car_shoot_')) return 'center center'
    if (s.includes('product_shoot_1')) return 'center 45%'
    return 'center center'
  }
  const resolvedHeroPos = getHeroFocalPosition(heroImg, heroPosition)

  // Focal position resolution for Quote Image
  const quoteImg = quoteImage || categoryCards[1]?.image || heroImg
  const getQuoteFocalPosition = (img, explicitPos) => {
    if (explicitPos) return explicitPos
    if (categoryData?.quoteImagePosition) return categoryData.quoteImagePosition
    const s = String(img || '').toLowerCase()
    if (s.includes('model_shoot_')) return 'center 18%'
    if (s.includes('sports_shoot_')) return 'center 18%'
    // Reel shoots are now landscape — standard center
    if (s.includes('reel_shoot_')) return 'center center'
    return 'center center'
  }
  const resolvedQuotePos = getQuoteFocalPosition(quoteImg, quoteImagePosition)

  const lightboxImages = categoryCards.map((c, i) => ({
    id: `${categoryId}-${c.id || i}`,
    src: c.image || c.src,
    srcLarge: c.srcLarge || c.image || c.src,
    title: `${String(i + 1).padStart(2, '0')} — ${c.title}`,
    alt: c.alt || c.title,
    event: c.desc || '',
  }))

  return (
    <div className="bg-[#F8F3EA]">
      {/* ── Hero Banner ── */}
      <section className="relative min-h-[90vh] lg:min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImg}
            alt={title || categoryData?.name}
            style={{ objectPosition: resolvedHeroPos }}
            className="w-full h-full object-cover scale-105 animate-ken-burns"
            onError={(e) => {
              const fallback = categoryData?.heroImage || '/images/hero-church-wedding.jpg'
              if (e.target.src !== fallback) {
                e.target.src = fallback
              }
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(28, 22, 18, 0.45) 0%, rgba(28, 22, 18, 0.28) 45%, rgba(20, 14, 10, 0.82) 100%)',
            }}
          />
        </div>

        <div className="max-w-[1440px] mx-auto relative z-10 text-center px-6 pt-32 pb-24">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block px-5 py-1.5 border border-[#D8B77A]/40 text-[#D8B77A] font-nav text-xs uppercase tracking-[0.25em] mb-6 backdrop-blur-sm bg-black/30 rounded-full"
          >
            {badge || categoryData?.heroBadge || 'Luxury Photography'}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] text-[#F8F3EA] font-light tracking-wide max-w-5xl mx-auto mb-6 leading-[1.08] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
          >
            {title || categoryData?.name}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-[#F8F3EA]/90 text-base sm:text-lg md:text-xl font-light max-w-3xl mx-auto leading-relaxed mb-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          >
            {tagline || categoryData?.headline || categoryData?.subheadline}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to={`/check-availability?type=${categoryId}`}
              className="px-8 py-3.5 bg-[#B9975B] text-[#1A1715] font-nav font-semibold text-xs tracking-[0.16em] uppercase hover:bg-[#D8B77A] hover:-translate-y-0.5 transition-all duration-300 shadow-sm border border-[#D8B77A]/40"
            >
              Reserve A Date
            </Link>
            <a
              href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                `Hi ${studioName}, I would like to inquire about ${title || categoryData?.name}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 border border-[#F8F3EA]/80 text-[#F8F3EA] font-nav font-semibold text-xs tracking-[0.16em] uppercase hover:bg-[#F8F3EA]/15 transition-all duration-300 backdrop-blur-sm"
            >
              Chat on WhatsApp
            </a>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 text-[#F8F3EA]/70 pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.25em] font-nav">SCROLL TO EXPLORE</span>
          <div className="w-[1px] h-7 bg-gradient-to-b from-[#D8B77A] to-transparent animate-pulse" />
        </div>
      </section>

      {/* ── Editorial Story & Philosophy ── */}
      <section className="section-padding bg-[#F5EEE3]/80 border-b border-[#D8B77A]/25">
        <div className="container-luxury">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <span className="text-caption uppercase tracking-[0.2em] text-[#B9975B] font-nav font-semibold block mb-3">
                01 — THE APPROACH
              </span>
              <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-[#292522] font-light leading-tight mb-6">
                Artistic Vision & Thoughtful Composition
              </h2>

              <div className="space-y-4 mb-8">
                {description.length > 0 ? (
                  description.map((para, i) => (
                    <p key={i} className="text-[#51443A]/85 text-body-md leading-relaxed font-light">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="text-[#51443A]/85 text-body-md leading-relaxed font-light">
                    {categoryData?.description}
                  </p>
                )}
              </div>

              {features.length > 0 && (
                <div className="space-y-3.5 pt-2 border-t border-[#D8B77A]/25">
                  {features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#D8B77A]/30 flex items-center justify-center mt-0.5 text-[#B9975B] flex-shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[#292522]/85 text-body-sm font-light">{feature}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <div className="relative z-10 overflow-hidden shadow-luxury border-4 border-[#F8F3EA]">
                <img
                  src={quoteImg}
                  alt={title}
                  style={{ objectPosition: resolvedQuotePos }}
                  className="w-full h-[520px] object-cover"
                />
              </div>

              {quote && (
                <div className="absolute -bottom-6 -left-6 z-20 bg-[#FAF6EE] p-6 shadow-luxury max-w-xs border border-[#D8B77A]/60 hidden sm:block">
                  <p className="font-serif italic text-base text-[#292522] mb-2 leading-relaxed">
                    "{quote.text}"
                  </p>
                  <p className="text-caption text-[#B9975B] uppercase tracking-widest font-nav font-semibold">
                    {quote.author}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── The 3-Column Photography Cards Grid (Reference Image Layout) ── */}
      {categoryCards.length > 0 && (
        <section className="section-padding bg-[#F8F3EA]">
          <div className="max-w-[1360px] mx-auto px-6 sm:px-8 lg:px-12">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-caption uppercase tracking-[0.25em] text-[#B9975B] font-nav font-semibold block mb-3">
                {categoryData?.heroBadge || '02 — THE COMPLETE JOURNEY'}
              </span>
              <h2 className="font-serif text-3xl md:text-5xl text-[#292522] font-light">
                {categoryData?.headline || `${title} Showcase`}
              </h2>
              <div className="w-16 h-[1.5px] bg-[#D8B77A] mx-auto mt-4 mb-4" />
              <p className="text-[#51443A]/80 text-sm sm:text-base font-light">
                {categoryData?.subheadline ||
                  'We chronicle every chapter of your celebration with reverence, artistry, and authentic presence.'}
              </p>
            </div>

            {/* 3-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7 lg:gap-8">
              {categoryCards.map((card, idx) => (
                <PhotographyCard
                  key={card.id || `${categoryId}-${idx}`}
                  num={String(idx + 1).padStart(2, '0')}
                  title={card.title}
                  desc={card.desc}
                  image={card.image}
                  alt={card.alt}
                  objectPosition={card.objectPosition || card.imagePosition || categoryData?.cardObjectPosition}
                  aspectRatio={card.aspectRatio || cardAspectRatio || categoryData?.cardAspectRatio}
                  onImageClick={() => setSelectedImage(lightboxImages[idx])}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Experience / Process (if chapters provided) ── */}
      {chapters.length > 0 && (
        <section className="py-16 bg-[#F5EEE3]/60 border-t border-[#D8B77A]/25">
          <div className="container-luxury">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-caption uppercase tracking-[0.2em] text-[#B9975B] font-sans font-semibold block mb-2">
                The Experience
              </span>
              <h2 className="font-serif text-2xl md:text-4xl text-[#292522] font-light">
                What You Can Expect
              </h2>
              <div className="w-12 h-[1px] bg-[#D8B77A] mx-auto mt-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {chapters.map((ch, idx) => (
                <div
                  key={idx}
                  className="bg-[#FAF6EE] p-6 sm:p-7 border border-[#D8B77A]/50 hover:border-[#B9975B] transition-all duration-300 group"
                >
                  <span className="font-serif text-3xl text-[#B9975B]/50 group-hover:text-[#B9975B] transition-colors duration-300 block mb-3">
                    {ch.step || `0${idx + 1}`}
                  </span>
                  <h3 className="font-serif text-lg text-[#292522] mb-2 group-hover:text-[#9E7D42] transition-colors duration-300">
                    {ch.title}
                  </h3>
                  <p className="text-[#51443A]/80 text-xs sm:text-sm leading-relaxed font-light">
                    {ch.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Booking Banner ── */}
      <section className="py-16 bg-[#FAF6EE] border-t border-[#D8B77A]/35 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h3 className="font-serif text-2xl sm:text-3xl text-[#292522] font-light mb-4">
            Begin Your Photography Journey
          </h3>
          <p className="text-[#51443A]/85 text-sm font-light mb-6">
            Inquire today to discuss dates, location commissions, and bespoke packages.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to={`/check-availability?type=${categoryId}`}
              className="px-8 py-3 bg-[#B9975B] text-[#1A1715] font-nav font-semibold text-xs tracking-[0.16em] uppercase hover:bg-[#D8B77A] transition-all duration-300 shadow-sm"
            >
              Check Availability
            </Link>
            <Link
              to="/portfolio"
              className="px-8 py-3 border border-[#292522] text-[#292522] font-nav font-semibold text-xs tracking-[0.16em] uppercase hover:bg-[#292522] hover:text-[#FAF6EE] transition-all duration-300"
            >
              All Categories
            </Link>
          </div>
        </div>
      </section>

      {/* Lightbox for zooming photos */}
      {selectedImage && (
        <ImageLightbox
          image={selectedImage}
          images={lightboxImages}
          onClose={() => setSelectedImage(null)}
          onNavigate={(img) => setSelectedImage(img)}
        />
      )}
    </div>
  )
}
