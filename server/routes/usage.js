const express = require('express');
const db = require('../config/database');
const { verifySession, requirePasswordChangeComplete } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');

const router = express.Router();

const USAGE_DECREASE_FILTER = `
  l.table_name = 'stock'
  AND l.action = 'UPDATE'
  AND json_extract(l.old_values, '$.quantity') IS NOT NULL
  AND json_extract(l.new_values, '$.quantity') IS NOT NULL
  AND CAST(json_extract(l.new_values, '$.quantity') AS REAL) < CAST(json_extract(l.old_values, '$.quantity') AS REAL)
`;

const USAGE_ROWS_SINCE_SQL = `
  SELECT
    l.created_at,
    p.stock_code,
    p.name,
    p.unit,
    c.name AS category_name,
    ROUND(
      CAST(json_extract(l.old_values, '$.quantity') AS REAL) -
      CAST(json_extract(l.new_values, '$.quantity') AS REAL),
      3
    ) AS used_quantity
  FROM activity_logs l
  LEFT JOIN products p ON p.id = l.record_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE
    ${USAGE_DECREASE_FILTER}
    AND datetime(l.created_at) >= datetime('now', ?)
`;

const USAGE_DIFF_SQL = `
  ROUND(
    CAST(json_extract(l.old_values, '$.quantity') AS REAL) -
    CAST(json_extract(l.new_values, '$.quantity') AS REAL),
    3
  )
`;

const TRACKED_CATEGORY_ORDER = [
  'bar_soslar',
  'cikolata',
  'suruplar',
  'cay_kahve_secili',
  'gida_urunleri'
];

const TRACKED_CATEGORY_LABELS = {
  bar_soslar: 'BAR SOSLAR',
  cikolata: 'CIKOLATA',
  suruplar: 'SURUPLAR',
  cay_kahve_secili: 'CAY-KAHVE (SECILI URUNLER)',
  gida_urunleri: 'GIDA URUNLERI'
};

const SELECTED_TEA_COFFEE_PRODUCTS = [
  'boston crust filtre kahve',
  'miko cay demlik poset',
  'boston crust espresso cekirdek kahve'
];

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toImageUrl(imagePath) {
  if (!imagePath) {
    return null;
  }
  return `/api/images/${encodeURIComponent(imagePath)}`;
}

function normalizeUnit(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('tr-TR');
  if (!normalized) {
    return 'adet';
  }
  if (normalized === 'kilo' || normalized === 'kilogram') {
    return 'kg';
  }
  return normalized;
}

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')
    .trim();
}

function round3(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(3));
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function formatCompact(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return '0';
  }
  return Number(numeric.toFixed(3)).toString();
}

function parseSqliteDate(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const baseIso = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const utcDate = new Date(baseIso.endsWith('Z') ? baseIso : `${baseIso}Z`);
  if (!Number.isNaN(utcDate.getTime())) {
    return utcDate;
  }

  const localDate = new Date(baseIso);
  if (!Number.isNaN(localDate.getTime())) {
    return localDate;
  }

  return null;
}

function rowsSinceDays(days) {
  return db.prepare(USAGE_ROWS_SINCE_SQL).all(`-${days} day`);
}

function fetchTopUsedProducts(limit = 7) {
  const rows = db.prepare(`
    SELECT
      p.id AS product_id,
      p.stock_code,
      p.name,
      p.unit,
      p.image_path,
      ROUND(SUM(CASE WHEN datetime(l.created_at) >= datetime('now', '-7 day') THEN ${USAGE_DIFF_SQL} ELSE 0 END), 3) AS used_7d,
      ROUND(SUM(CASE WHEN datetime(l.created_at) >= datetime('now', '-15 day') THEN ${USAGE_DIFF_SQL} ELSE 0 END), 3) AS used_15d,
      ROUND(SUM(${USAGE_DIFF_SQL}), 3) AS used_30d
    FROM activity_logs l
    JOIN products p ON p.id = l.record_id
    WHERE
      ${USAGE_DECREASE_FILTER}
      AND datetime(l.created_at) >= datetime('now', '-30 day')
    GROUP BY p.id, p.stock_code, p.name, p.unit, p.image_path
    HAVING ROUND(SUM(${USAGE_DIFF_SQL}), 3) > 0
    ORDER BY used_30d DESC, p.name ASC
    LIMIT ?
  `).all(limit);

  return rows.map((row) => ({
    product_id: row.product_id,
    stock_code: row.stock_code || '',
    name: row.name || '',
    unit: normalizeUnit(row.unit),
    image_url: toImageUrl(row.image_path),
    used_7d: round3(row.used_7d),
    used_15d: round3(row.used_15d),
    used_30d: round3(row.used_30d)
  }));
}

function aggregateRows(rows) {
  const unitTotals = new Map();
  let totalUsed = 0;

  for (const row of rows) {
    const qty = Number(row.used_quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const unit = normalizeUnit(row.unit);
    totalUsed += qty;
    unitTotals.set(unit, (unitTotals.get(unit) || 0) + qty);
  }

  return {
    totalUsed: round3(totalUsed),
    unitTotals
  };
}

function chooseDisplayUnit(unitTotals) {
  if (!unitTotals.size) {
    return 'adet';
  }
  if (unitTotals.size === 1) {
    return [...unitTotals.keys()][0];
  }
  return 'birim';
}

function buildPeriodStats(days) {
  const rows = rowsSinceDays(days);
  const aggregate = aggregateRows(rows);
  const unit = chooseDisplayUnit(aggregate.unitTotals);
  const total = aggregate.totalUsed;

  return {
    total_used: total,
    unit,
    daily_avg: round3(total / days),
    weekly_avg: round3(total / (days / 7))
  };
}

function isChocolateName(name) {
  const normalized = normalizeText(name);
  return normalized.includes('cikolata') || normalized.includes('chocolate');
}

function buildChocolateStats(days) {
  const rows = rowsSinceDays(days).filter((row) => isChocolateName(row.name));
  const aggregate = aggregateRows(rows);
  const unit = chooseDisplayUnit(aggregate.unitTotals);

  return {
    total_used: aggregate.totalUsed,
    unit
  };
}

function buildLocalSummary(d3, d7, d30, choco) {
  return [
    `Son 3 gunde toplam ${formatCompact(d3.total_used)} ${d3.unit} kullanim var.`,
    `Son 7 gun gunluk ortalama ${formatCompact(d7.daily_avg)} ${d7.unit}.`,
    `Son 30 gunde toplam ${formatCompact(d30.total_used)} ${d30.unit} tuketim var.`,
    `Cikolata urunlerinde 30 gunluk kullanim ${formatCompact(choco.total_used)} ${choco.unit}.`
  ].join(' ');
}

function isTeaCoffeeCategory(categoryNameNormalized) {
  return (
    categoryNameNormalized.includes('cay-kahve') ||
    (categoryNameNormalized.includes('cay') && categoryNameNormalized.includes('kahve'))
  );
}

function isSelectedTeaCoffeeProduct(productNameNormalized) {
  return SELECTED_TEA_COFFEE_PRODUCTS.some((phrase) => productNameNormalized.includes(phrase));
}

function classifyTrackedCategory(categoryName, productName) {
  const categoryNorm = normalizeText(categoryName);
  const productNorm = normalizeText(productName);

  if (categoryNorm.includes('bar sos')) {
    return 'bar_soslar';
  }
  if (categoryNorm.includes('cikolata')) {
    return 'cikolata';
  }
  if (categoryNorm.includes('surup')) {
    return 'suruplar';
  }
  if (categoryNorm.includes('gida urun')) {
    return 'gida_urunleri';
  }
  if (isTeaCoffeeCategory(categoryNorm) && isSelectedTeaCoffeeProduct(productNorm)) {
    return 'cay_kahve_secili';
  }

  return null;
}

function fetchTrackedRows(maxDays) {
  const rows = rowsSinceDays(maxDays);
  const trackedRows = [];

  for (const row of rows) {
    const qty = Number(row.used_quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const categoryKey = classifyTrackedCategory(row.category_name, row.name);
    if (!categoryKey) {
      continue;
    }

    const createdAt = parseSqliteDate(row.created_at);
    if (!createdAt) {
      continue;
    }

    trackedRows.push({
      created_at: row.created_at,
      created_at_ms: createdAt.getTime(),
      stock_code: row.stock_code || '',
      name: row.name || '',
      unit: normalizeUnit(row.unit),
      category_key: categoryKey,
      category_label: TRACKED_CATEGORY_LABELS[categoryKey] || categoryKey,
      used_quantity: qty
    });
  }

  return trackedRows;
}

function addToUnitMap(map, unit, value) {
  const safeUnit = normalizeUnit(unit);
  map.set(safeUnit, (map.get(safeUnit) || 0) + value);
}

function unitMapToArray(unitMap, days) {
  return [...unitMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([unit, total]) => ({
      unit,
      total_used: round3(total),
      daily_avg: round3(total / days)
    }));
}

function buildWindowMetrics(trackedRows, days) {
  const now = Date.now();
  const minTime = now - days * 24 * 60 * 60 * 1000;

  const categoryUnitTotals = new Map();
  const categoryEvents = new Map();
  const teaCoffeeProducts = new Map();
  const gidaProducts = new Map();

  for (const row of trackedRows) {
    if (row.created_at_ms < minTime || row.created_at_ms > now) {
      continue;
    }

    if (!categoryUnitTotals.has(row.category_key)) {
      categoryUnitTotals.set(row.category_key, new Map());
    }
    addToUnitMap(categoryUnitTotals.get(row.category_key), row.unit, row.used_quantity);
    categoryEvents.set(row.category_key, (categoryEvents.get(row.category_key) || 0) + 1);

    if (row.category_key === 'cay_kahve_secili') {
      const key = `${row.stock_code}||${row.name}||${row.unit}`;
      if (!teaCoffeeProducts.has(key)) {
        teaCoffeeProducts.set(key, {
          stock_code: row.stock_code,
          name: row.name,
          unit: row.unit,
          total_used: 0,
          event_count: 0
        });
      }
      const item = teaCoffeeProducts.get(key);
      item.total_used += row.used_quantity;
      item.event_count += 1;
    }

    if (row.category_key === 'gida_urunleri') {
      const key = `${row.stock_code}||${row.name}||${row.unit}`;
      if (!gidaProducts.has(key)) {
        gidaProducts.set(key, {
          stock_code: row.stock_code,
          name: row.name,
          unit: row.unit,
          total_used: 0,
          event_count: 0
        });
      }
      const item = gidaProducts.get(key);
      item.total_used += row.used_quantity;
      item.event_count += 1;
    }
  }

  const categories = TRACKED_CATEGORY_ORDER.map((categoryKey) => {
    const unitTotals = categoryUnitTotals.get(categoryKey) || new Map();
    const byUnit = unitMapToArray(unitTotals, days);
    const totalUsed = byUnit.reduce((sum, item) => sum + item.total_used, 0);
    return {
      key: categoryKey,
      label: TRACKED_CATEGORY_LABELS[categoryKey] || categoryKey,
      event_count: Number(categoryEvents.get(categoryKey) || 0),
      total_used: round3(totalUsed),
      has_mixed_units: byUnit.length > 1,
      by_unit: byUnit
    };
  });

  const teaCoffeeList = [...teaCoffeeProducts.values()]
    .map((item) => ({
      stock_code: item.stock_code,
      name: item.name,
      unit: item.unit,
      total_used: round3(item.total_used),
      daily_avg: round3(item.total_used / days),
      event_count: item.event_count
    }))
    .sort((a, b) => b.total_used - a.total_used);

  const gidaList = [...gidaProducts.values()]
    .map((item) => ({
      stock_code: item.stock_code,
      name: item.name,
      unit: item.unit,
      total_used: round3(item.total_used),
      daily_avg: round3(item.total_used / days),
      event_count: item.event_count
    }))
    .sort((a, b) => b.total_used - a.total_used);

  return {
    days,
    categories,
    tea_coffee_products: teaCoffeeList,
    gida_products: gidaList
  };
}

function buildAnalysisMetrics(trackedRows) {
  return {
    generated_at: new Date().toISOString(),
    windows: {
      d7: buildWindowMetrics(trackedRows, 7),
      d15: buildWindowMetrics(trackedRows, 15),
      d30: buildWindowMetrics(trackedRows, 30)
    }
  };
}

function metricsPrompt(metrics) {
  return [
    'Kafe stok kullanim analizi yap.',
    'Sadece asagidaki verilere dayan.',
    'Cikti Turkce olsun.',
    'Net ve uygulamaya donuk olsun.',
    'Format:',
    '1) 7 gun ozeti',
    '2) 15 gun ozeti',
    '3) 30 gun ozeti',
    '4) En hizli tuketilen kategoriler',
    '5) GIDA URUNLERI icin urun bazli ortalama kullanim yorumu',
    '6) Kisa operasyon onerileri (maks 5 madde)',
    '',
    'Veri JSON:',
    JSON.stringify(metrics)
  ].join('\n');
}

function extractOpenAiText(payload) {
  if (payload && typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload?.output)) {
    const chunks = [];
    for (const item of payload.output) {
      if (!item || !Array.isArray(item.content)) {
        continue;
      }
      for (const part of item.content) {
        if (part && typeof part.text === 'string' && part.text.trim()) {
          chunks.push(part.text.trim());
        }
      }
    }
    if (chunks.length) {
      return chunks.join('\n').trim();
    }
  }

  if (Array.isArray(payload?.choices) && payload.choices[0]?.message?.content) {
    return String(payload.choices[0].message.content).trim();
  }

  return '';
}

function buildFallbackAnalysis(metrics) {
  const lines = [];
  for (const [windowKey, windowStats] of Object.entries(metrics.windows || {})) {
    const dayLabel = windowKey.replace('d', '');
    const topCategories = (windowStats.categories || [])
      .filter((item) => item.by_unit && item.by_unit.length)
      .map((item) => {
        const first = item.by_unit[0];
        return `${item.label}: ${formatCompact(first.total_used)} ${first.unit}`;
      })
      .slice(0, 4);

    lines.push(`Son ${dayLabel} gun: ${topCategories.length ? topCategories.join(' | ') : 'veri yok'}.`);
  }

  const gida30 = metrics.windows?.d30?.gida_products || [];
  if (gida30.length) {
    const topGida = gida30
      .slice(0, 5)
      .map((item) => `${item.name}: ${formatCompact(item.total_used)} ${item.unit}`)
      .join(' | ');
    lines.push(`Gida urunleri (30 gun) urun bazli tuketim: ${topGida}.`);
  } else {
    lines.push('Gida urunleri (30 gun) urun bazli yeterli veri yok.');
  }

  return lines.join(' ');
}

async function runOpenAiAnalysis(metrics) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.OPENAI_MODEL || 'o3-mini').trim();
  const baseUrl = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
    .trim()
    .replace(/\/+$/, '');

  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY missing');
    err.code = 'MISSING_OPENAI_KEY';
    throw err;
  }

  if (typeof fetch !== 'function') {
    const err = new Error('Global fetch is not available');
    err.code = 'FETCH_NOT_AVAILABLE';
    throw err;
  }

  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: (() => {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };
      const openAiProject = String(process.env.OPENAI_PROJECT_ID || '').trim();
      const openAiOrg = String(process.env.OPENAI_ORG_ID || '').trim();
      if (openAiProject) {
        headers['OpenAI-Project'] = openAiProject;
      }
      if (openAiOrg) {
        headers['OpenAI-Organization'] = openAiOrg;
      }
      return headers;
    })(),
    body: JSON.stringify({
      model,
      reasoning: { effort: 'high' },
      max_output_tokens: 900,
      input: [
        {
          role: 'system',
          content: 'Sen deneyimli bir stok ve operasyon analistisin. Kisa, net, uygulanabilir Turkce cevap ver.'
        },
        {
          role: 'user',
          content: metricsPrompt(metrics)
        }
      ]
    })
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const err = new Error(`OpenAI request failed (${response.status})`);
    err.code = 'OPENAI_REQUEST_FAILED';
    err.details = bodyText.slice(0, 500);
    throw err;
  }

  const payload = await response.json();
  const text = extractOpenAiText(payload);
  if (!text) {
    const err = new Error('OpenAI returned empty analysis');
    err.code = 'OPENAI_EMPTY_RESPONSE';
    throw err;
  }

  return {
    text,
    model
  };
}

router.get(
  '/insights',
  verifySession,
  requirePasswordChangeComplete,
  (_req, res) => {
    try {
      const d3 = buildPeriodStats(3);
      const d7 = buildPeriodStats(7);
      const d30 = buildPeriodStats(30);
      const choco = buildChocolateStats(30);
      const localSummary = buildLocalSummary(d3, d7, d30, choco);

      res.json({
        insights: {
          by_period: {
            d3,
            d7,
            d30
          },
          chocolate: choco,
          summary_text: localSummary,
          summary_source: 'local',
          ai_model: null
        }
      });
    } catch (err) {
      console.error('Usage insights error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/ai-analysis', verifySession, requirePasswordChangeComplete, isAdmin, async (_req, res) => {
  try {
    const trackedRows = fetchTrackedRows(30);
    const metrics = buildAnalysisMetrics(trackedRows);

    const fallback = buildFallbackAnalysis(metrics);

    if (!trackedRows.length) {
      return res.json({
        analysis_text: 'Son 30 gun icin secilen kategorilerde kullanim verisi bulunamadi.',
        generated_at: new Date().toISOString(),
        ai_used: false,
        model: null,
        metrics
      });
    }

    try {
      const aiResult = await runOpenAiAnalysis(metrics);
      return res.json({
        analysis_text: aiResult.text,
        generated_at: new Date().toISOString(),
        ai_used: true,
        model: aiResult.model,
        metrics
      });
    } catch (err) {
      if (err.code === 'MISSING_OPENAI_KEY') {
        return res.status(400).json({
          error: 'OPENAI_API_KEY tanimli degil. .env icine ekleyin.',
          code: err.code
        });
      }

      const details = String(err.details || '').toLowerCase();
      if (err.code === 'OPENAI_REQUEST_FAILED' && (details.includes('invalid_api_key') || details.includes('401'))) {
        return res.status(401).json({
          error: 'OpenAI anahtari dogrulanamadi. .env dosyanizdaki OPENAI_API_KEY degerini kontrol edin ve sunucuyu yeniden baslatin.',
          code: 'OPENAI_INVALID_KEY'
        });
      }

      console.error('Usage AI analysis fallback:', err.code || err.message, err.details || '');
      return res.json({
        analysis_text: fallback,
        generated_at: new Date().toISOString(),
        ai_used: false,
        model: null,
        metrics,
        warning: 'AI gecici olarak kullanilamadi. Yerel ozet gosterildi.'
      });
    }
  } catch (err) {
    console.error('Usage AI analysis error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', verifySession, requirePasswordChangeComplete, isAdmin, (req, res) => {
  try {
    const logId = parsePositiveInteger(req.params.id);
    if (!logId) {
      return res.status(400).json({ error: 'Geçersiz kayıt kimliği' });
    }

    const existing = db.prepare(`
      SELECT
        l.id,
        l.record_id,
        l.created_at,
        l.old_values,
        l.new_values,
        p.stock_code,
        p.name
      FROM activity_logs l
      LEFT JOIN products p ON p.id = l.record_id
      WHERE
        l.id = ?
        AND ${USAGE_DECREASE_FILTER}
    `).get(logId);

    if (!existing) {
      return res.status(404).json({ error: 'Kullanım kaydı bulunamadı' });
    }

    db.prepare('DELETE FROM activity_logs WHERE id = ?').run(logId);

    return res.json({
      ok: true,
      deleted_id: logId,
      product: {
        stock_code: existing.stock_code || '',
        name: existing.name || ''
      }
    });
  } catch (err) {
    console.error('Usage delete error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', verifySession, requirePasswordChangeComplete, (req, res) => {
  try {
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const limit = Math.min(Math.max(parseInteger(req.query.limit, 100), 1), 500);
    const offset = (page - 1) * limit;

    const listSql = `
      SELECT
        l.id,
        l.created_at,
        u.username,
        l.record_id AS product_id,
        p.stock_code,
        p.name,
        p.unit,
        p.image_path,
        CAST(json_extract(l.old_values, '$.quantity') AS REAL) AS old_quantity,
        CAST(json_extract(l.new_values, '$.quantity') AS REAL) AS new_quantity,
        ROUND(
          CAST(json_extract(l.old_values, '$.quantity') AS REAL) -
          CAST(json_extract(l.new_values, '$.quantity') AS REAL),
          3
        ) AS used_quantity
      FROM activity_logs l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN products p ON p.id = l.record_id
      WHERE
        ${USAGE_DECREASE_FILTER}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `
      SELECT COUNT(*) AS count
      FROM activity_logs l
      WHERE
        ${USAGE_DECREASE_FILTER}
    `;

    const rows = db.prepare(listSql).all(limit, offset).map((row) => ({
      ...row,
      image_url: toImageUrl(row.image_path)
    }));
    const total = db.prepare(countSql).get().count;
    const topProducts = fetchTopUsedProducts(7);

    res.json({
      entries: rows,
      top_products: topProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (err) {
    console.error('Usage history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
