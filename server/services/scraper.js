const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CATEGORY_INFO = {
  'BAR SOSLAR': { en: 'Bar Sauces', desc: 'Beverage sauces and toppings' },
  'BASKILI MALZEME': { en: 'Printed Materials', desc: 'Branded supplies and packaging' },
  'DİĞER': { en: 'Other', desc: 'Miscellaneous products' },
  'EKİPMAN-DEMİRBAŞ': { en: 'Equipment', desc: 'Equipment and fixtures' },
  'ENDÜSTRİYEL MAKİNELER': { en: 'Industrial Machines', desc: 'Industrial coffee and kitchen machines' },
  'GIDA ÜRÜNLERİ': { en: 'Food Products', desc: 'General food products' },
  'GİYİM': { en: 'Clothing', desc: 'Uniforms and clothing' },
  'MEYVE PÜRELERİ': { en: 'Fruit Purees', desc: 'Fruit purees and concentrates' },
  'SARF MALZEME': { en: 'Consumables', desc: 'Disposable and consumable products' },
  'TEMİZLİK': { en: 'Cleaning', desc: 'Cleaning products' },
  'ÇAY-KAHVE-İÇECEK': { en: 'Tea/Coffee/Beverages', desc: 'Tea, coffee, and beverage products' },
  'ÇİKOLATA': { en: 'Chocolate', desc: 'Chocolate products' },
  'ŞURUPLAR': { en: 'Syrups', desc: 'Flavor syrups' }
};

function parsePrice(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return 0;
  }

  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : 0;
  }

  const str = String(rawValue).trim();
  if (!str) {
    return 0;
  }

  let normalized = str.replace(/[^\d.,-]/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function cleanText(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeImagePath(srcValue, categoryName) {
  const rawSrc = cleanText(srcValue);
  if (!rawSrc) {
    return '';
  }

  let src = rawSrc.replace(/^\.\/+/, '').replace(/\\/g, '/');
  const filesPrefix = `${categoryName}_files/`;

  if (src.startsWith(filesPrefix)) {
    return src;
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const url = new URL(src);
      const fileName = path.basename(url.pathname);
      if (fileName) {
        return `${filesPrefix}${fileName}`;
      }
    } catch (err) {
      return '';
    }
  }

  const fileName = path.basename(src);
  if (!fileName || fileName.startsWith('?')) {
    return '';
  }

  return `${filesPrefix}${fileName}`;
}

function categorySlug(name) {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

class ProductScraper {
  constructor(sourceDir) {
    this.sourceDir = sourceDir;
    this.categoryInfo = CATEGORY_INFO;
  }

  parseHtmlFile(filePath, categoryName) {
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);
    const products = [];
    const seenCodes = new Set();

    $('productitem').each((_, element) => {
      const $item = $(element);

      let stockCode =
        cleanText($item.attr('data-basket-id')) ||
        cleanText($item.find('[data-basket-id]').first().attr('data-basket-id'));
      const stockCodeText = cleanText($item.find('.productItemStockCode').text());
      const stockCodeMatch = stockCodeText.match(/\d+/);
      if (stockCodeMatch) {
        stockCode = stockCodeMatch[0];
      }
      if (!stockCode) {
        return;
      }

      let name =
        cleanText($item.find('[itemprop="name"]').attr('title')) ||
        cleanText($item.find('[itemprop="name"]').text()) ||
        cleanText($item.find('.productItemTitle strong').first().text());
      if (!name) {
        return;
      }

      const metaPrice = cleanText($item.find('[itemprop="price"]').attr('content'));
      const displayPrice = cleanText($item.find('.calcDisPrice').first().text());
      const price = parsePrice(metaPrice || displayPrice);

      const imageSrc =
        cleanText($item.find('[itemprop="image"]').attr('src')) ||
        cleanText($item.find('[itemprop="image"]').attr('data-src'));
      const imagePath = normalizeImagePath(imageSrc, categoryName);

      let unit =
        cleanText($item.find('.pageDetailRightGroupBasketDiv1Button').first().text()) ||
        cleanText($item.find('[data-list-secenek-id]').first().attr('data-list-secenek-id')) ||
        'ADET';
      unit = unit.toLowerCase();

      if (seenCodes.has(stockCode)) {
        return;
      }
      seenCodes.add(stockCode);

      products.push({
        stockCode,
        name: name.slice(0, 250),
        price,
        imagePath,
        unit: unit.slice(0, 20) || 'adet',
        category: categoryName
      });
    });

    return products;
  }

  getCategoryFiles() {
    if (!fs.existsSync(this.sourceDir)) {
      return [];
    }

    return fs
      .readdirSync(this.sourceDir)
      .filter((fileName) => fileName.toLowerCase().endsWith('.html'))
      .sort((a, b) => a.localeCompare(b, 'tr'));
  }

  scrapeAll() {
    const allProducts = [];
    const categories = [];
    const htmlFiles = this.getCategoryFiles();

    for (const htmlFileName of htmlFiles) {
      const categoryName = path.basename(htmlFileName, '.html');
      const info = this.categoryInfo[categoryName] || {
        en: categoryName,
        desc: `${categoryName} category`
      };

      categories.push({
        name: categoryName,
        slug: categorySlug(categoryName),
        name_en: info.en,
        description: info.desc
      });

      const htmlFilePath = path.join(this.sourceDir, htmlFileName);
      const products = this.parseHtmlFile(htmlFilePath, categoryName);
      allProducts.push(...products);
    }

    return { products: allProducts, categories };
  }
}

module.exports = ProductScraper;
