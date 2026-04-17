import rateLimit from 'express-rate-limit'

/**
 * Anti brute-force : login + register
 * 10 tentatives par IP sur 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Anti manipulation de votes
 * 30 votes par IP sur 15 minutes
 */
export const voteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Trop de votes, réessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Limite générale sur toutes les routes API
 * 200 requêtes par IP par minute — anti scraping / DoS basique
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Trop de requêtes, ralentissez.' },
  standardHeaders: true,
  legacyHeaders: false,
})
