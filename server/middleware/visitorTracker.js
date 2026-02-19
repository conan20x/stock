const db = require('../config/database');

const trackingEnabled = process.env.VISITOR_TRACKING !== '0';

const SKIP_PATH_PREFIXES = [
  '/api/',
  '/css/',
  '/js/',
  '/images/',
  '/favicon',
  '/robots.txt',
  '/manifest',
  '/service-worker'
];

const STATIC_EXTENSION_REGEX = /\.(?:css|js|map|png|jpe?g|webp|gif|svg|ico|avif|woff2?|ttf|otf|eot|txt|xml)$/i;

const insertVisitorStmt = db.prepare(`
  INSERT INTO visitor_events (
    ip_address,
    forwarded_for,
    method,
    path,
    query_string,
    device_type,
    browser_name,
    os_name,
    user_agent,
    referer,
    accept_language
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function clampText(value, maxLen = 512) {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value).slice(0, maxLen);
}

function normalizeIp(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const first = raw.split(',')[0].trim();
  if (first.startsWith('::ffff:')) {
    return first.slice(7);
  }
  return first;
}

function extractClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return normalizeIp(forwarded || req.ip || req.socket?.remoteAddress || '');
}

function detectDeviceType(userAgentRaw) {
  const userAgent = String(userAgentRaw || '').toLowerCase();
  if (!userAgent) {
    return 'unknown';
  }
  if (/bot|crawler|spider|slurp|bingpreview/i.test(userAgent)) {
    return 'bot';
  }
  if (/ipad|tablet/i.test(userAgent)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android/i.test(userAgent)) {
    return 'mobile';
  }
  return 'desktop';
}

function detectBrowser(userAgentRaw) {
  const userAgent = String(userAgentRaw || '');
  if (!userAgent) {
    return 'unknown';
  }
  if (/Edg\//i.test(userAgent)) {
    return 'edge';
  }
  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) {
    return 'opera';
  }
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) {
    return 'chrome';
  }
  if (/Firefox\//i.test(userAgent)) {
    return 'firefox';
  }
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
    return 'safari';
  }
  return 'other';
}

function detectOs(userAgentRaw) {
  const userAgent = String(userAgentRaw || '');
  if (!userAgent) {
    return 'unknown';
  }
  if (/Windows NT/i.test(userAgent)) {
    return 'windows';
  }
  if (/Android/i.test(userAgent)) {
    return 'android';
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'ios';
  }
  if (/Mac OS X|Macintosh/i.test(userAgent)) {
    return 'macos';
  }
  if (/Linux/i.test(userAgent)) {
    return 'linux';
  }
  return 'other';
}

function shouldSkipRequest(req) {
  if (req.method !== 'GET') {
    return true;
  }

  const path = String(req.path || req.originalUrl || '');
  if (!path) {
    return true;
  }

  if (SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return true;
  }

  if (STATIC_EXTENSION_REGEX.test(path)) {
    return true;
  }

  const accept = String(req.headers.accept || '').toLowerCase();
  if (accept && !accept.includes('text/html')) {
    return true;
  }

  return false;
}

function visitorTracker(req, _res, next) {
  if (!trackingEnabled || shouldSkipRequest(req)) {
    return next();
  }

  try {
    const userAgent = clampText(req.headers['user-agent'] || '', 1024);
    const forwardedFor = clampText(req.headers['x-forwarded-for'] || '', 1024);
    const referer = clampText(req.headers.referer || req.headers.referrer || '', 1024);
    const acceptLanguage = clampText(req.headers['accept-language'] || '', 256);
    const pathOnly = clampText(req.path || '/', 512);
    const queryString = clampText(req.originalUrl || '', 1024);
    const ipAddress = clampText(extractClientIp(req), 64);

    insertVisitorStmt.run(
      ipAddress,
      forwardedFor,
      req.method,
      pathOnly,
      queryString,
      detectDeviceType(userAgent),
      detectBrowser(userAgent),
      detectOs(userAgent),
      userAgent,
      referer,
      acceptLanguage
    );
  } catch (err) {
    console.error('Visitor tracking error:', err.message);
  }

  return next();
}

module.exports = visitorTracker;
