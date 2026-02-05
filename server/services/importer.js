const ProductScraper = require('./scraper');

function makeImportService(db) {
  const upsertCategory = db.prepare(`
    INSERT INTO categories (name, slug, name_en, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      slug = excluded.slug,
      name_en = excluded.name_en,
      description = excluded.description
  `);

  const getCategoryId = db.prepare('SELECT id FROM categories WHERE name = ?');
  const getProductByCode = db.prepare('SELECT id, is_active FROM products WHERE stock_code = ?');

  const upsertProduct = db.prepare(`
    INSERT INTO products (
      stock_code,
      name,
      category_id,
      supplier_price,
      image_path,
      unit,
      is_active,
      created_by,
      updated_by,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(stock_code) DO UPDATE SET
      name = excluded.name,
      category_id = excluded.category_id,
      supplier_price = excluded.supplier_price,
      image_path = excluded.image_path,
      unit = excluded.unit,
      is_active = 1,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `);

  const ensureStock = db.prepare(`
    INSERT INTO stock (product_id, quantity, min_quantity, updated_by, created_at, updated_at)
    VALUES (?, 0, 5, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO NOTHING
  `);

  const deactivateAllWhenEmpty = db.prepare(`
    UPDATE products
    SET
      is_active = 0,
      updated_by = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE is_active = 1
  `);

  const getTotals = db.prepare('SELECT * FROM v_stock_totals');

  const transactionalImport = db.transaction((sourceDir, actorUserId) => {
    const scraper = new ProductScraper(sourceDir);
    const { categories, products } = scraper.scrapeAll();

    const stats = {
      categories: categories.length,
      scraped_products: products.length,
      inserted: 0,
      updated: 0,
      reactivated: 0,
      deactivated: 0,
      skipped: 0
    };

    for (const category of categories) {
      upsertCategory.run(category.name, category.slug, category.name_en, category.description);
    }

    const seenStockCodes = [];

    for (const product of products) {
      const category = getCategoryId.get(product.category);
      if (!category) {
        stats.skipped += 1;
        continue;
      }

      const existing = getProductByCode.get(product.stockCode);

      upsertProduct.run(
        product.stockCode,
        product.name,
        category.id,
        product.price,
        product.imagePath,
        product.unit || 'adet',
        actorUserId,
        actorUserId
      );

      const persisted = getProductByCode.get(product.stockCode);
      ensureStock.run(persisted.id, actorUserId);

      if (!existing) {
        stats.inserted += 1;
      } else if (existing.is_active === 0) {
        stats.reactivated += 1;
      } else {
        stats.updated += 1;
      }

      seenStockCodes.push(product.stockCode);
    }

    if (seenStockCodes.length > 0) {
      const placeholders = seenStockCodes.map(() => '?').join(', ');
      const stmt = db.prepare(`
        UPDATE products
        SET
          is_active = 0,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          is_active = 1
          AND stock_code NOT IN (${placeholders})
      `);
      const result = stmt.run(actorUserId, ...seenStockCodes);
      stats.deactivated = result.changes;
    } else {
      const result = deactivateAllWhenEmpty.run(actorUserId);
      stats.deactivated = result.changes;
    }

    const totals = getTotals.get();

    return {
      stats,
      totals: {
        total_quantity: totals?.total_quantity || 0,
        total_value_try: totals?.total_value_try || 0,
        active_item_count: totals?.active_item_count || 0,
        low_stock_count: totals?.low_stock_count || 0
      }
    };
  });

  function importFromHtml(sourceDir, actorUserId = null) {
    return transactionalImport(sourceDir, actorUserId);
  }

  return {
    importFromHtml
  };
}

module.exports = {
  makeImportService
};
