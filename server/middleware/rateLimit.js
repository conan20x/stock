const rateLimit = require('express-rate-limit');

function createLimiter({
  windowMs = 15 * 60 * 1000,
  max = 100,
  message = 'Çok fazla istek yapıldı, lütfen daha sonra tekrar deneyin.'
} = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message }
  });
}

module.exports = {
  createLimiter
};
