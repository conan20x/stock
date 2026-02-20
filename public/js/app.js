const state = {
  user: null,
  token: null,
  categories: [],
  products: [],
  usageEntries: [],
  users: [],
  pagination: { page: 1, pages: 1, total: 0, limit: 50 },
  filters: {
    search: '',
    category: '',
    sort: 'supplier_price',
    order: 'desc'
  },
  loading: {
    products: false
  },
  ui: {
    userModalMode: 'edit'
  }
};

const ROUTE_REGEX = /\/(admin|usage)\/?$/;
const routeMatch = window.location.pathname.match(ROUTE_REGEX);
const currentRoute = routeMatch ? routeMatch[1] : 'home';
const isAdminRoute = currentRoute === 'admin';
const isUsageRoute = currentRoute === 'usage';

const els = {
  mainPage: document.getElementById('mainPage'),
  adminPage: document.getElementById('adminPage'),
  usagePage: document.getElementById('usagePage'),
  adminDenied: document.getElementById('adminDenied'),
  usageDenied: document.getElementById('usageDenied'),
  authState: document.getElementById('authState'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
  navHomeLink: document.getElementById('navHomeLink'),
  navAdminLink: document.getElementById('navAdminLink'),
  navUsageLink: document.getElementById('navUsageLink'),
  logoutBtn: document.getElementById('logoutBtn'),

  passwordGate: document.getElementById('passwordGate'),
  passwordForm: document.getElementById('passwordForm'),
  currentPassword: document.getElementById('currentPassword'),
  newPassword: document.getElementById('newPassword'),

  kpiValue: document.getElementById('kpiValue'),
  kpiQty: document.getElementById('kpiQty'),
  kpiActive: document.getElementById('kpiActive'),
  kpiLow: document.getElementById('kpiLow'),
  kpiWarning: document.getElementById('kpiWarning'),

  lowAlertsList: document.getElementById('lowAlertsList'),
  warningAlertsList: document.getElementById('warningAlertsList'),

  searchInput: document.getElementById('searchInput'),
  categorySelect: document.getElementById('categorySelect'),
  categoryTabs: document.getElementById('categoryTabs'),
  reloadBtn: document.getElementById('reloadBtn'),
  openCreateBtn: document.getElementById('openCreateBtn'),
  actionHeader: document.getElementById('actionHeader'),
  productTableWrap: document.getElementById('productTableWrap'),
  productTableBody: document.getElementById('productTableBody'),
  scrollSentinel: document.getElementById('scrollSentinel'),
  paginationInfo: document.getElementById('paginationInfo'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  sortableHeaders: Array.from(document.querySelectorAll('th.sortable')),

  logsPanel: document.getElementById('logsPanel'),
  logActionFilter: document.getElementById('logActionFilter'),
  loadLogsBtn: document.getElementById('loadLogsBtn'),
  logTableBody: document.getElementById('logTableBody'),
  visitorsPanel: document.getElementById('visitorsPanel'),
  refreshVisitorsBtn: document.getElementById('refreshVisitorsBtn'),
  visitorTotal: document.getElementById('visitorTotal'),
  visitorUnique: document.getElementById('visitorUnique'),
  visitorToday: document.getElementById('visitorToday'),
  visitorLast24h: document.getElementById('visitorLast24h'),
  visitorDeviceHint: document.getElementById('visitorDeviceHint'),
  visitorsTableBody: document.getElementById('visitorsTableBody'),

  usagePanel: document.getElementById('usagePanel'),
  runUsageAiBtn: document.getElementById('runUsageAiBtn'),
  loadUsageBtn: document.getElementById('loadUsageBtn'),
  usageTableBody: document.getElementById('usageTableBody'),
  usage3dTotal: document.getElementById('usage3dTotal'),
  usage3dDaily: document.getElementById('usage3dDaily'),
  usage7dTotal: document.getElementById('usage7dTotal'),
  usage7dDaily: document.getElementById('usage7dDaily'),
  usage30dTotal: document.getElementById('usage30dTotal'),
  usage30dWeekly: document.getElementById('usage30dWeekly'),
  usageChoco30d: document.getElementById('usageChoco30d'),
  usageChocoUnit: document.getElementById('usageChocoUnit'),
  usageTopProducts: document.getElementById('usageTopProducts'),
  usageAiSummary: document.getElementById('usageAiSummary'),
  usageAiReport: document.getElementById('usageAiReport'),

  usersPanel: document.getElementById('usersPanel'),
  usersTableBody: document.getElementById('usersTableBody'),
  openCreateUserBtn: document.getElementById('openCreateUserBtn'),
  refreshUsersBtn: document.getElementById('refreshUsersBtn'),
  userModal: document.getElementById('userModal'),
  userModalTitle: document.getElementById('userModalTitle'),
  closeUserModalBtn: document.getElementById('closeUserModalBtn'),
  userForm: document.getElementById('userForm'),
  userId: document.getElementById('userId'),
  userUsername: document.getElementById('userUsername'),
  userRole: document.getElementById('userRole'),
  userIsActive: document.getElementById('userIsActive'),
  userCreatePasswordWrap: document.getElementById('userCreatePasswordWrap'),
  userCreatePassword: document.getElementById('userCreatePassword'),
  userPasswordResetSection: document.getElementById('userPasswordResetSection'),
  userNewPassword: document.getElementById('userNewPassword'),
  userResetPasswordBtn: document.getElementById('userResetPasswordBtn'),
  applyRoleDefaultsBtn: document.getElementById('applyRoleDefaultsBtn'),
  permCanCreateProduct: document.getElementById('permCanCreateProduct'),
  permCanEditProduct: document.getElementById('permCanEditProduct'),
  permCanUpdateStock: document.getElementById('permCanUpdateStock'),
  permCanDeleteProduct: document.getElementById('permCanDeleteProduct'),
  permCanViewLogs: document.getElementById('permCanViewLogs'),
  permCanManageUsers: document.getElementById('permCanManageUsers'),
  permCanScanPdf: document.getElementById('permCanScanPdf'),

  productModal: document.getElementById('productModal'),
  productModalTitle: document.getElementById('productModalTitle'),
  closeProductModalBtn: document.getElementById('closeProductModalBtn'),
  productForm: document.getElementById('productForm'),
  productId: document.getElementById('productId'),
  productStockCode: document.getElementById('productStockCode'),
  productName: document.getElementById('productName'),
  productCategory: document.getElementById('productCategory'),
  productPrice: document.getElementById('productPrice'),
  productMinQuantity: document.getElementById('productMinQuantity'),
  productUnit: document.getElementById('productUnit'),

  stockModal: document.getElementById('stockModal'),
  closeStockModalBtn: document.getElementById('closeStockModalBtn'),
  stockForm: document.getElementById('stockForm'),
  stockProductId: document.getElementById('stockProductId'),
  stockQuantity: document.getElementById('stockQuantity'),
  stockStepperButtons: Array.from(document.querySelectorAll('.stock-stepper [data-delta]')),

  toast: document.getElementById('toast')
};

function currentPermissions() {
  return state.user?.permissions || {};
}

function can(permission) {
  if (!state.user) {
    return false;
  }
  if (state.user.role === 'admin') {
    return true;
  }
  return Boolean(currentPermissions()[permission]);
}

function isAdmin() {
  return state.user?.role === 'admin';
}

function canViewUsageHistory() {
  return Boolean(state.user && !state.user.must_change_password);
}

function showActionColumn() {
  return Boolean(
    state.user &&
      !state.user.must_change_password &&
      (can('can_edit_product') || can('can_update_stock') || can('can_delete_product'))
  );
}

function basePath() {
  const path = window.location.pathname;
  const cleaned = routeMatch ? path.replace(ROUTE_REGEX, '/') : path;
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
}

function updateRouteUI() {
  if (els.mainPage) {
    els.mainPage.classList.toggle('hidden', currentRoute !== 'home');
  }
  if (els.adminPage) {
    els.adminPage.classList.toggle('hidden', !isAdminRoute);
  }
  if (els.usagePage) {
    els.usagePage.classList.toggle('hidden', !isUsageRoute);
  }

  const base = basePath();
  if (els.navHomeLink) {
    els.navHomeLink.href = base;
    els.navHomeLink.classList.toggle('active', currentRoute === 'home');
  }
  if (els.navAdminLink) {
    els.navAdminLink.href = `${base}admin`;
    els.navAdminLink.classList.toggle('active', currentRoute === 'admin');
  }
  if (els.navUsageLink) {
    els.navUsageLink.href = `${base}usage`;
    els.navUsageLink.classList.toggle('active', currentRoute === 'usage');
  }
}
function statusLabel(status) {
  if (status === 'dusuk') {
    return { text: 'Düşük', cls: 'low' };
  }
  if (status === 'azalabilir') {
    return { text: 'Bitmeye Yakın', cls: 'warn' };
  }
  return { text: 'Yeterli', cls: 'good' };
}

function showToast(message, type = 'info') {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.style.borderColor =
    type === 'error'
      ? 'rgba(240,95,82,0.85)'
      : type === 'success'
      ? 'rgba(90,212,131,0.85)'
      : 'var(--line)';

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2800);
}

function currencyTRY(value) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function numberTR(value) {
  return new Intl.NumberFormat('tr-TR').format(Number(value) || 0);
}

function parseLocaleNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  let normalized = String(value).trim().replace(/[^\d.,-]/g, '');
  if (!normalized) {
    return fallback;
  }

  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUnit(value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('tr-TR');
  if (!normalized) {
    return 'adet';
  }
  if (['kg', 'kilo', 'kilogram'].includes(normalized)) {
    return 'kg';
  }
  if (['koli', 'koli̇'].includes(normalized)) {
    return 'koli';
  }
  if (normalized === 'paket') {
    return 'paket';
  }
  if (normalized === 'birim') {
    return 'birim';
  }
  return normalized;
}

function formatQuantityWithUnit(quantity, unit) {
  const numeric = Number(quantity);
  if (!Number.isFinite(numeric)) {
    return '-';
  }
  const normalizedUnit = normalizeUnit(unit);
  if (normalizedUnit === 'kg') {
    return `${numberTR(numeric)} KG`;
  }
  if (normalizedUnit) {
    return `${numberTR(numeric)} ${normalizedUnit}`;
  }
  return numberTR(numeric);
}

function formatUsageStat(stat) {
  if (!stat) {
    return '0';
  }
  return formatQuantityWithUnit(stat.total_used, stat.unit);
}

function formatUsageRate(value, unit, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `${label}: 0`;
  }
  return `${label}: ${formatQuantityWithUnit(numeric, unit)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveAssetUrl(url) {
  if (!url) {
    return null;
  }
  if (url.startsWith('/')) {
    return `${basePath()}${url.slice(1)}`;
  }
  return url;
}

async function api(path, options = {}) {
  const init = { ...options, credentials: 'include' };
  const headers = { ...(options.headers || {}) };

  if (!headers['Content-Type'] && options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (state.token) {
    headers['x-session-token'] = state.token;
  }

  init.headers = headers;

  const prefix = basePath();
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(`${prefix}${normalized}`, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || 'İşlem başarısız');
    err.status = response.status;
    err.code = data.code;
    throw err;
  }

  return data;
}

function updateHeaderSortUI() {
  for (const th of els.sortableHeaders) {
    th.classList.remove('sorted-asc', 'sorted-desc');
    const key = th.dataset.sort;
    if (key === state.filters.sort) {
      th.classList.add(state.filters.order === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  }
}

function updateAuthUI() {
  const mustChangePassword = Boolean(state.user?.must_change_password);

  if (!state.user) {
    els.authState.textContent = 'Misafir: Sadece görüntüleme';
    els.authState.className = 'auth-state guest';
    els.loginForm.classList.remove('hidden');
    els.logoutBtn.classList.add('hidden');
    els.passwordGate.classList.add('hidden');
  } else {
    const label = state.user.role === 'admin' ? 'Yönetici' : state.user.role === 'manager' ? 'Müdür' : 'Misafir';
    els.authState.textContent = `${label} oturumu: ${state.user.username}`;
    els.authState.className = `auth-state ${state.user.role}`;
    els.loginForm.classList.add('hidden');
    els.logoutBtn.classList.remove('hidden');
    els.passwordGate.classList.toggle('hidden', !mustChangePassword);
  }

  const canOperate = state.user && !mustChangePassword;
  const showActions = showActionColumn();
  const adminAllowed = Boolean(canOperate && isAdmin());
  const usageAllowed = canViewUsageHistory();

  els.actionHeader.classList.toggle('hidden', !showActions);
  els.openCreateBtn.classList.toggle('hidden', !(canOperate && can('can_create_product')));
  els.logsPanel.classList.toggle('hidden', !(adminAllowed && can('can_view_logs')));
  if (els.visitorsPanel) {
    els.visitorsPanel.classList.toggle('hidden', !(adminAllowed && can('can_view_logs')));
  }
  els.usersPanel.classList.toggle('hidden', !(adminAllowed && can('can_manage_users')));
  if (els.adminDenied) {
    els.adminDenied.classList.toggle('hidden', !isAdminRoute || adminAllowed);
  }
  if (els.usageDenied) {
    els.usageDenied.classList.toggle('hidden', !isUsageRoute || usageAllowed);
  }
  if (els.usagePanel) {
    els.usagePanel.classList.toggle('hidden', !(isUsageRoute && usageAllowed));
  }
  if (els.runUsageAiBtn) {
    const canRunAi = Boolean(isUsageRoute && usageAllowed && isAdmin());
    els.runUsageAiBtn.classList.toggle('hidden', !canRunAi);
    els.runUsageAiBtn.disabled = !canRunAi;
  }
  if (els.navAdminLink) {
    els.navAdminLink.classList.toggle('hidden', !(canOperate && isAdmin()));
  }
  if (els.navUsageLink) {
    els.navUsageLink.classList.toggle('hidden', !usageAllowed);
  }
}

async function refreshSession() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
  } catch (_err) {
    state.user = null;
    state.token = null;
}
  updateAuthUI();
}

function renderCategoryOptions() {
  const options = ['<option value="">Tüm Kategoriler</option>'];
  for (const category of state.categories) {
    options.push(`<option value="${category.id}">${escapeHtml(category.name)}</option>`);
  }
  els.categorySelect.innerHTML = options.join('');

  const modalOptions = ['<option value="">Kategori Seçin</option>'];
  for (const category of state.categories) {
    modalOptions.push(`<option value="${category.id}">${escapeHtml(category.name)}</option>`);
  }
  els.productCategory.innerHTML = modalOptions.join('');
}

function renderCategoryTabs() {
  if (!els.categoryTabs) {
    return;
  }

  const active = String(state.filters.category || '');
  const tabs = [
    { id: '', label: 'Tümü' },
    ...state.categories.map((category) => ({
      id: String(category.id),
      label: category.name
    }))
  ];

  els.categoryTabs.innerHTML = tabs
    .map(
      (tab) =>
        `<button type="button" class="category-tab ${tab.id === active ? 'active' : ''}" data-category="${tab.id}">${escapeHtml(tab.label)}</button>`
    )
    .join('');
}

async function loadCategories() {
  const data = await api('/api/catalog/categories');
  state.categories = data.categories || [];
  renderCategoryOptions();
  renderCategoryTabs();
}

function renderSummary(summary) {
  els.kpiValue.textContent = currencyTRY(summary.total_value_try);
  els.kpiQty.textContent = numberTR(summary.total_quantity);
  els.kpiActive.textContent = numberTR(summary.active_item_count);
  els.kpiLow.textContent = numberTR(summary.low_stock_count);
  els.kpiWarning.textContent = numberTR(summary.warning_stock_count || 0);
}

async function loadSummary() {
  const data = await api('/api/catalog/summary');
  renderSummary(data.summary || {
    total_quantity: 0,
    total_value_try: 0,
    active_item_count: 0,
    low_stock_count: 0,
    warning_stock_count: 0
  });
}

function renderAlertList(element, items) {
  if (!items.length) {
    element.innerHTML = '<li>Uyarı yok.</li>';
    return;
  }

  element.innerHTML = items.map((item) => {
    const imageUrl = resolveAssetUrl(item.image_url);
    const image = imageUrl
      ? `<img class="alert-img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
      : '<div class="alert-img"></div>';
    return `<li class="alert-item">
      ${image}
      <span><strong>${escapeHtml(item.stock_code)}</strong> ${escapeHtml(item.name)} · ${formatQuantityWithUnit(item.quantity, item.unit)} (eşik ${numberTR(item.min_quantity)})</span>
    </li>`;
  }).join('');
}

async function loadAlerts() {
  const data = await api('/api/catalog/alerts?limit=500');
  const low = data.alerts?.low || [];
  const warning = data.alerts?.warning || [];
  renderAlertList(els.lowAlertsList, low);
  renderAlertList(els.warningAlertsList, warning);
}

function productRowTemplate(product) {
  const status = statusLabel(product.stock_status);
  const imageUrl = resolveAssetUrl(product.image_url);
  const imageHtml = imageUrl
    ? `<img class="product-img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
    : '<div class="product-img"></div>';

  const actions = [];
  if (can('can_edit_product')) {
    actions.push(`<button class="btn subtle" data-action="edit" data-id="${product.id}">Düzenle</button>`);
  }
  if (can('can_delete_product')) {
    actions.push(`<button class="btn danger" data-action="delete" data-id="${product.id}">X</button>`);
  }
  if (can('can_update_stock')) {
    actions.push(`<button class="btn subtle" data-action="stock" data-id="${product.id}">Stok Güncelle</button>`);
  }

  const actionCell = actions.length ? `<div class="row-actions">${actions.join('')}</div>` : '';
  const quantityCell = formatQuantityWithUnit(product.quantity, product.unit);

  return `
    <tr>
      <td data-label="Foto">${imageHtml}</td>
      <td data-label="Stok Kodu" class="mono">${escapeHtml(product.stock_code)}</td>
      <td data-label="Ürün">${escapeHtml(product.name)}</td>
      <td data-label="Kategori">${escapeHtml(product.category_name)}</td>
      <td data-label="Fiyat" class="mono">${currencyTRY(product.supplier_price_try)}</td>
      <td data-label="Miktar" class="mono">${quantityCell}</td>
      <td data-label="Uyarı Eşiği" class="mono">${numberTR(product.min_quantity)}</td>
      <td data-label="Stok Değeri" class="mono">${currencyTRY(product.stock_value_try)}</td>
      <td data-label="Durum"><span class="tag ${status.cls}">${status.text}</span></td>
      <td data-label="İşlemler" class="${showActionColumn() ? '' : 'hidden'}">${actionCell}</td>
    </tr>
  `;
}

function renderProducts() {
  if (!state.products.length) {
    els.productTableBody.innerHTML = '<tr><td colspan="10"><small>Kayıt bulunamadı.</small></td></tr>';
  } else {
    els.productTableBody.innerHTML = state.products.map(productRowTemplate).join('');
  }

  const { page, pages, total } = state.pagination;
  const loaded = state.products.length;
  els.paginationInfo.textContent = `${numberTR(loaded)} / ${numberTR(total)} kayıt • Sayfa ${page}/${pages}`;
}

function buildCatalogQuery() {
  const params = new URLSearchParams();
  params.set('page', String(state.pagination.page));
  params.set('limit', String(state.pagination.limit));
  params.set('sort', state.filters.sort);
  params.set('order', state.filters.order);

  if (state.filters.search) {
    params.set('search', state.filters.search);
  }
  if (state.filters.category) {
    params.set('category', state.filters.category);
  }

  return params.toString();
}

async function loadProducts({ reset = false } = {}) {
  if (state.loading.products) {
    return;
  }

  if (reset) {
    state.pagination.page = 1;
    state.products = [];
  }

  const query = buildCatalogQuery();
  state.loading.products = true;
  if (els.loadingIndicator) {
    els.loadingIndicator.classList.remove('hidden');
  }

  try {
    const data = await api(`/api/catalog?${query}`);
    const incoming = data.products || [];

    if (reset) {
      state.products = incoming;
    } else {
      state.products.push(...incoming);
    }

    state.pagination = data.pagination || { page: 1, pages: 1, total: 0, limit: state.pagination.limit };

    if (reset) {
      renderProducts();
    } else if (incoming.length > 0) {
      els.productTableBody.insertAdjacentHTML('beforeend', incoming.map(productRowTemplate).join(''));
    }

    updateHeaderSortUI();
    const { page, pages, total } = state.pagination;
    const loaded = state.products.length;
    els.paginationInfo.textContent = `${numberTR(loaded)} / ${numberTR(total)} kayıt • Sayfa ${page}/${pages}`;
  } finally {
    state.loading.products = false;
    if (els.loadingIndicator) {
      els.loadingIndicator.classList.add('hidden');
    }
  }
}

function canLoadMoreProducts() {
  return state.pagination.page < state.pagination.pages;
}

async function loadMoreProducts() {
  if (state.loading.products || !canLoadMoreProducts()) {
    return;
  }
  state.pagination.page += 1;
  await loadProducts();
}

function safeJsonParse(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

function toImageApiUrl(imagePath) {
  if (!imagePath) {
    return null;
  }
  return resolveAssetUrl(`/api/images/${encodeURIComponent(imagePath)}`);
}

function resolveLogProduct(log, oldValues, newValues) {
  const stockCode = oldValues?.stock_code || newValues?.stock_code || log.product_stock_code || `#${log.record_id ?? ''}`;
  const name = oldValues?.name || newValues?.name || log.product_name || '';
  const unit = oldValues?.unit || newValues?.unit || log.product_unit || 'adet';
  const imagePath = oldValues?.image_path || newValues?.image_path || log.product_image_path || null;
  return {
    stockCode: String(stockCode || ''),
    name: String(name || ''),
    unit: String(unit || 'adet'),
    imageUrl: toImageApiUrl(imagePath)
  };
}

function describeLog(log) {
  const oldValues = safeJsonParse(log.old_values);
  const newValues = safeJsonParse(log.new_values);
  const product = resolveLogProduct(log, oldValues, newValues);
  const productLabel = `${product.stockCode} ${product.name}`.trim();

  if (log.table_name === 'products' && log.action === 'DELETE') {
    return {
      title: 'Ürün silindi',
      subtitle: productLabel || `Kayıt #${log.record_id ?? '-'}`,
      imageUrl: product.imageUrl
    };
  }

  if (log.table_name === 'stock' && log.action === 'UPDATE') {
    const oldQty = Number(log.old_quantity);
    const newQty = Number(log.new_quantity);
    if (Number.isFinite(oldQty) && Number.isFinite(newQty)) {
      const diff = oldQty - newQty;
      if (diff > 0) {
        return {
          title: 'Stok düşürüldü',
          subtitle: `${productLabel} • ${formatQuantityWithUnit(diff, product.unit)} kullanıldı (${formatQuantityWithUnit(oldQty, product.unit)} → ${formatQuantityWithUnit(newQty, product.unit)})`,
          imageUrl: product.imageUrl
        };
      }
      if (diff < 0) {
        return {
          title: 'Stok artırıldı',
          subtitle: `${productLabel} • ${formatQuantityWithUnit(Math.abs(diff), product.unit)} eklendi (${formatQuantityWithUnit(oldQty, product.unit)} → ${formatQuantityWithUnit(newQty, product.unit)})`,
          imageUrl: product.imageUrl
        };
      }
    }
  }

  if (log.table_name === 'products' && log.action === 'INSERT') {
    return {
      title: 'Yeni ürün eklendi',
      subtitle: productLabel || `Kayıt #${log.record_id ?? '-'}`,
      imageUrl: product.imageUrl
    };
  }

  if (log.table_name === 'products' && log.action === 'UPDATE') {
    return {
      title: 'Ürün bilgisi güncellendi',
      subtitle: productLabel || `Kayıt #${log.record_id ?? '-'}`,
      imageUrl: product.imageUrl
    };
  }

  return {
    title: `${log.action || 'İşlem'} • ${log.table_name || 'kayıt'}`,
    subtitle: `Kayıt #${log.record_id ?? '-'}`,
    imageUrl: product.imageUrl
  };
}

async function loadLogs() {
  if (!isAdminRoute) {
    return;
  }
  if (!can('can_view_logs') || state.user?.must_change_password) {
    return;
  }

  const params = new URLSearchParams();
  if (els.logActionFilter.value) {
    params.set('action', els.logActionFilter.value);
  }

  const data = await api(`/api/logs?${params.toString()}`);
  const logs = (data.logs || []).filter((log) => !(log.table_name === 'stock' && log.action === 'DELETE'));

  if (!logs.length) {
    els.logTableBody.innerHTML = '<tr><td colspan="5"><small>Kayıt bulunamadı.</small></td></tr>';
    return;
  }

  els.logTableBody.innerHTML = logs
    .map((log) => {
      const detail = describeLog(log);
      const thumb = detail.imageUrl
        ? `<img class="log-thumb" src="${escapeHtml(detail.imageUrl)}" alt="${escapeHtml(detail.title)}" loading="lazy" />`
        : '<div class="log-thumb"></div>';
      return `
        <tr>
          <td class="mono">${escapeHtml(formatDateTimeWithWeekday(log.created_at))}</td>
          <td>${escapeHtml(log.username || 'system')}</td>
          <td class="mono">${escapeHtml(log.action)}</td>
          <td>
            <div class="log-detail">
              ${thumb}
              <div>
                <p class="log-title">${escapeHtml(detail.title)}</p>
                <p class="log-subtitle">${escapeHtml(detail.subtitle)}</p>
              </div>
            </div>
          </td>
          <td class="mono">${escapeHtml(log.source || '')}</td>
        </tr>
      `;
    })
    .join('');
}

function formatVisitorDevice(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'mobile') {
    return 'Mobil';
  }
  if (key === 'tablet') {
    return 'Tablet';
  }
  if (key === 'desktop') {
    return 'Masaüstü';
  }
  if (key === 'bot') {
    return 'Bot';
  }
  return 'Bilinmiyor';
}

function visitorRowTemplate(visitor) {
  const browser = visitor.browser_name || '-';
  const os = visitor.os_name || '-';
  const page = visitor.query_string || visitor.path || '-';
  const referer = visitor.referer || '-';
  const locationParts = [visitor.country_code, visitor.city, visitor.timezone].filter(Boolean);
  const location = locationParts.length ? locationParts.join(' • ') : '-';
  return `
    <tr>
      <td class="mono">${escapeHtml(formatDateTimeWithWeekday(visitor.created_at))}</td>
      <td class="mono">${escapeHtml(visitor.ip_address || '-')}</td>
      <td>${escapeHtml(location)}</td>
      <td>${escapeHtml(formatVisitorDevice(visitor.device_type))}</td>
      <td>${escapeHtml(`${browser} / ${os}`)}</td>
      <td class="mono">${escapeHtml(page)}</td>
      <td class="mono">${escapeHtml(referer)}</td>
    </tr>
  `;
}

function resetVisitorSummary() {
  if (!els.visitorTotal) {
    return;
  }
  els.visitorTotal.textContent = '0';
  els.visitorUnique.textContent = '0';
  els.visitorToday.textContent = '0';
  els.visitorLast24h.textContent = '0';
  if (els.visitorDeviceHint) {
    els.visitorDeviceHint.textContent = 'Cihaz dağılımı yüklenmedi.';
  }
  if (els.visitorsTableBody) {
    els.visitorsTableBody.innerHTML = '<tr><td colspan="7"><small>Kayıt bulunamadı.</small></td></tr>';
  }
}

function renderVisitorSummary(summary) {
  if (!els.visitorTotal) {
    return;
  }

  els.visitorTotal.textContent = numberTR(summary.total_visits || 0);
  els.visitorUnique.textContent = numberTR(summary.unique_visitors || 0);
  els.visitorToday.textContent = numberTR(summary.visits_today || 0);
  els.visitorLast24h.textContent = numberTR(summary.visits_last_24h || 0);

  const deviceText = (summary.devices || [])
    .map((item) => `${formatVisitorDevice(item.device_type)}: ${numberTR(item.visits)}`)
    .join(' • ');
  const countryText = (summary.countries || [])
    .filter((item) => item.country_code && item.country_code !== 'unknown')
    .map((item) => `${item.country_code}: ${numberTR(item.visits)}`)
    .join(' • ');

  if (els.visitorDeviceHint) {
    els.visitorDeviceHint.textContent = deviceText
      ? `Son 30 gün cihaz dağılımı: ${deviceText}${countryText ? ` | Ülke dağılımı: ${countryText}` : ''}`
      : 'Cihaz dağılımı verisi yok.';
  }
}

async function loadVisitors() {
  if (!isAdminRoute) {
    return;
  }
  if (!can('can_view_logs') || state.user?.must_change_password) {
    return;
  }

  const [summaryData, listData] = await Promise.all([
    api('/api/visitors/summary'),
    api('/api/visitors?limit=120')
  ]);

  renderVisitorSummary(summaryData.summary || {});

  const visitors = listData.visitors || [];
  if (!visitors.length) {
    els.visitorsTableBody.innerHTML = '<tr><td colspan="7"><small>Kayıt bulunamadı.</small></td></tr>';
    return;
  }
  els.visitorsTableBody.innerHTML = visitors.map(visitorRowTemplate).join('');
}

function usageRowTemplate(entry) {
  const imageHtml = entry.image_url
    ? `<img class="log-thumb" src="${escapeHtml(resolveAssetUrl(entry.image_url))}" alt="${escapeHtml(entry.name || '')}" loading="lazy" />`
    : '<div class="log-thumb"></div>';

  return `
    <tr>
      <td class="mono">${escapeHtml(formatDateTimeWithWeekday(entry.created_at))}</td>
      <td>
        <div class="usage-product">
          ${imageHtml}
          <div>
            <p class="log-title">${escapeHtml(`${entry.stock_code || ''} ${entry.name || ''}`.trim())}</p>
            <p class="log-subtitle">${escapeHtml(entry.unit || 'adet')}</p>
          </div>
        </div>
      </td>
      <td class="mono">-${escapeHtml(formatQuantityWithUnit(entry.used_quantity, entry.unit))}</td>
      <td class="mono">${escapeHtml(formatQuantityWithUnit(entry.old_quantity, entry.unit))}</td>
      <td class="mono">${escapeHtml(formatQuantityWithUnit(entry.new_quantity, entry.unit))}</td>
      <td>${escapeHtml(entry.username || 'system')}</td>
    </tr>
  `;
}

function usageTopProductTemplate(item, index) {
  const imageHtml = item.image_url
    ? `<img class="log-thumb" src="${escapeHtml(resolveAssetUrl(item.image_url))}" alt="${escapeHtml(item.name || '')}" loading="lazy" />`
    : '<div class="log-thumb"></div>';

  return `
    <article class="usage-top-card">
      <div class="usage-top-head">
        <span class="usage-top-rank">#${index + 1}</span>
      </div>
      <div class="usage-product">
        ${imageHtml}
        <div>
          <p class="log-title">${escapeHtml(`${item.stock_code || ''} ${item.name || ''}`.trim())}</p>
          <p class="log-subtitle">${escapeHtml(item.unit || 'adet')}</p>
        </div>
      </div>
      <dl class="usage-top-stats">
        <div><dt>7 Gün</dt><dd>${escapeHtml(formatQuantityWithUnit(item.used_7d, item.unit))}</dd></div>
        <div><dt>15 Gün</dt><dd>${escapeHtml(formatQuantityWithUnit(item.used_15d, item.unit))}</dd></div>
        <div><dt>30 Gün</dt><dd>${escapeHtml(formatQuantityWithUnit(item.used_30d, item.unit))}</dd></div>
      </dl>
    </article>
  `;
}

function renderUsageTopProducts(items) {
  if (!els.usageTopProducts) {
    return;
  }

  if (!Array.isArray(items) || !items.length) {
    els.usageTopProducts.innerHTML = '<p class="hint">Son 30 gün için kullanım kaydı bulunamadı.</p>';
    return;
  }

  els.usageTopProducts.innerHTML = items.map(usageTopProductTemplate).join('');
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim();
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

const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';
const ISTANBUL_WEEKDAY_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
  timeZone: ISTANBUL_TIME_ZONE
});
const ISTANBUL_DATE_TIME_PARTS = new Intl.DateTimeFormat('tr-TR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: ISTANBUL_TIME_ZONE
});

function formatDateTimeWithWeekday(value) {
  const date = parseSqliteDate(value);
  if (!date) {
    return value ? String(value) : '-';
  }

  const parts = Object.fromEntries(
    ISTANBUL_DATE_TIME_PARTS
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  const weekdayRaw = ISTANBUL_WEEKDAY_FORMATTER.format(date);
  const weekday = weekdayRaw ? `${weekdayRaw.charAt(0).toUpperCase()}${weekdayRaw.slice(1)}` : '';

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}${weekday ? ` ${weekday}` : ''}`;
}

function usageTotalsByUnit(entries, maxDays, nowMs) {
  const totalsByUnit = new Map();
  let totalUsed = 0;

  for (const entry of entries) {
    const qty = Number(entry.used_quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const createdAt = parseSqliteDate(entry.created_at);
    if (!createdAt) {
      continue;
    }

    const diffDays = (nowMs - createdAt.getTime()) / 86400000;
    if (!Number.isFinite(diffDays) || diffDays < 0 || diffDays > maxDays) {
      continue;
    }

    const unit = normalizeUnit(entry.unit);
    totalUsed += qty;
    totalsByUnit.set(unit, (totalsByUnit.get(unit) || 0) + qty);
  }

  return {
    totalUsed: Number(totalUsed.toFixed(3)),
    totalsByUnit
  };
}

function pickUsageUnit(totalsByUnit) {
  if (!totalsByUnit || !totalsByUnit.size) {
    return 'adet';
  }
  if (totalsByUnit.size === 1) {
    return totalsByUnit.keys().next().value;
  }
  return 'birim';
}

function buildUsageInsightsFromEntries(entries) {
  const nowMs = Date.now();

  const totals3 = usageTotalsByUnit(entries, 3, nowMs);
  const totals7 = usageTotalsByUnit(entries, 7, nowMs);
  const totals30 = usageTotalsByUnit(entries, 30, nowMs);

  const d3 = {
    total_used: totals3.totalUsed,
    unit: pickUsageUnit(totals3.totalsByUnit),
    daily_avg: Number((totals3.totalUsed / 3).toFixed(3))
  };
  const d7 = {
    total_used: totals7.totalUsed,
    unit: pickUsageUnit(totals7.totalsByUnit),
    daily_avg: Number((totals7.totalUsed / 7).toFixed(3))
  };
  const d30 = {
    total_used: totals30.totalUsed,
    unit: pickUsageUnit(totals30.totalsByUnit),
    weekly_avg: Number((totals30.totalUsed / (30 / 7)).toFixed(3))
  };

  const chocolateEntries = entries.filter((entry) => {
    const fullName = normalizeSearchText(`${entry.stock_code || ''} ${entry.name || ''}`);
    return fullName.includes('cikolata') || fullName.includes('chocolate');
  });

  const chocoTotals = usageTotalsByUnit(chocolateEntries, 30, nowMs);
  const choco = {
    total_used: chocoTotals.totalUsed,
    unit: pickUsageUnit(chocoTotals.totalsByUnit)
  };

  const summaryText = [
    `Son 3 günde ${formatQuantityWithUnit(d3.total_used, d3.unit)} kullanım var.`,
    `Son 7 günde günlük ortalama ${formatQuantityWithUnit(d7.daily_avg, d7.unit)}.`,
    `Son 30 günde toplam ${formatQuantityWithUnit(d30.total_used, d30.unit)} tüketildi.`,
    `Çikolata ürünlerinde 30 gün toplam ${formatQuantityWithUnit(choco.total_used, choco.unit)} kullanım görünüyor.`
  ].join(' ');

  return {
    by_period: { d3, d7, d30 },
    chocolate: choco,
    summary_text: summaryText,
    summary_source: 'local'
  };
}

function insightsTotalUsed(insights) {
  const byPeriod = insights?.by_period || {};
  const d3 = Number(byPeriod?.d3?.total_used || 0);
  const d7 = Number(byPeriod?.d7?.total_used || 0);
  const d30 = Number(byPeriod?.d30?.total_used || 0);
  const choco = Number(insights?.chocolate?.total_used || 0);
  return [d3, d7, d30, choco]
    .filter((value) => Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
}

async function loadUsage() {
  if (!isUsageRoute) {
    return;
  }
  if (!canViewUsageHistory()) {
    return;
  }

  const data = await api('/api/usage?limit=200');
  const entries = data.entries || [];
  const topProducts = data.top_products || [];
  state.usageEntries = entries;
  renderUsageTopProducts(topProducts);

  if (!entries.length) {
    els.usageTableBody.innerHTML = '<tr><td colspan="6"><small>Kayıt bulunamadı.</small></td></tr>';
    resetUsageInsights();
    resetUsageAiReport();
    return;
  }

  els.usageTableBody.innerHTML = entries.map(usageRowTemplate).join('');
  renderUsageInsights(buildUsageInsightsFromEntries(entries));
}

function renderUsageInsights(insights) {
  const emptyPeriod = { total_used: 0, unit: 'adet', daily_avg: 0, weekly_avg: 0 };
  const byPeriod = insights?.by_period || {};
  const d3 = byPeriod.d3 || emptyPeriod;
  const d7 = byPeriod.d7 || emptyPeriod;
  const d30 = byPeriod.d30 || emptyPeriod;

  const choco = insights?.chocolate || { total_used: 0, unit: 'kg' };

  els.usage3dTotal.textContent = formatUsageStat(d3);
  els.usage3dDaily.textContent = formatUsageRate(d3.daily_avg, d3.unit, 'Günlük ort');

  els.usage7dTotal.textContent = formatUsageStat(d7);
  els.usage7dDaily.textContent = formatUsageRate(d7.daily_avg, d7.unit, 'Günlük ort');

  els.usage30dTotal.textContent = formatUsageStat(d30);
  els.usage30dWeekly.textContent = formatUsageRate(d30.weekly_avg, d30.unit, 'Haftalık ort');

  els.usageChoco30d.textContent = formatQuantityWithUnit(choco.total_used, choco.unit || 'kg');
  els.usageChocoUnit.textContent = `Birim: ${(choco.unit || '-').toUpperCase()}`;

  const localSummary = [
    `Son 3 günde ${formatQuantityWithUnit(d3.total_used, d3.unit)} kullanım var.`,
    `Günlük ortalama ${formatQuantityWithUnit(d3.daily_avg, d3.unit)}.`,
    `Son 30 günde toplam ${formatQuantityWithUnit(d30.total_used, d30.unit)} tüketildi.`,
    `Çikolata ürünlerinde 30 gün toplam ${formatQuantityWithUnit(choco.total_used, choco.unit || 'kg')} kullanım görünüyor.`
  ].join(' ');

  els.usageAiSummary.textContent = insights?.summary_text || localSummary;
}

function resetUsageInsights() {
  renderUsageTopProducts([]);
  renderUsageInsights({
    by_period: {
      d3: { total_used: 0, unit: 'adet', daily_avg: 0 },
      d7: { total_used: 0, unit: 'adet', daily_avg: 0 },
      d30: { total_used: 0, unit: 'adet', weekly_avg: 0 }
    },
    chocolate: { total_used: 0, unit: 'kg' },
    summary_text: 'Kullanım özeti yüklenmedi.'
  });
}

function resetUsageAiReport() {
  if (!els.usageAiReport) {
    return;
  }
  els.usageAiReport.classList.add('hidden');
  els.usageAiReport.textContent = '';
}

function renderUsageAiReport(result) {
  if (!els.usageAiReport) {
    return;
  }

  const lines = [];
  lines.push(result.analysis_text || 'Analiz sonucu bulunamadi.');

  if (result.model) {
    lines.push('');
    lines.push(`Model: ${result.model}`);
  }
  if (result.generated_at) {
    lines.push(`Olusturma zamani: ${result.generated_at}`);
  }
  if (result.warning) {
    lines.push(`Uyari: ${result.warning}`);
  }

  els.usageAiReport.textContent = lines.join('\n');
  els.usageAiReport.classList.remove('hidden');
}

async function runUsageAiAnalysis() {
  if (!isUsageRoute) {
    return;
  }
  if (!state.user || state.user.role !== 'admin') {
    showToast('Bu analiz sadece admin icin acik.', 'error');
    return;
  }

  if (!els.runUsageAiBtn) {
    return;
  }

  const originalText = els.runUsageAiBtn.textContent;
  els.runUsageAiBtn.disabled = true;
  els.runUsageAiBtn.textContent = 'Analiz yapiliyor...';

  try {
    const result = await api('/api/usage/ai-analysis', { method: 'POST' });
    renderUsageAiReport(result);
    showToast('AI analizi tamamlandi.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    els.runUsageAiBtn.disabled = false;
    els.runUsageAiBtn.textContent = originalText;
  }
}

async function loadUsageInsights() {
  if (!isUsageRoute) {
    return;
  }
  if (!canViewUsageHistory()) {
    return;
  }

  try {
    const data = await api('/api/usage/insights');
    const remoteInsights = data.insights || null;
    if (state.usageEntries.length) {
      const localInsights = buildUsageInsightsFromEntries(state.usageEntries);
      if (insightsTotalUsed(remoteInsights) <= 0 && insightsTotalUsed(localInsights) > 0) {
        renderUsageInsights(localInsights);
        return;
      }
    }
    renderUsageInsights(remoteInsights);
  } catch (err) {
    console.warn('Usage insights endpoint unavailable, local summary used.', err?.message || err);
    if (state.usageEntries.length) {
      renderUsageInsights(buildUsageInsightsFromEntries(state.usageEntries));
    }
  }
}

const ROLE_DEFAULT_PERMISSIONS = {
  admin: {
    can_create_product: true,
    can_edit_product: true,
    can_update_stock: true,
    can_delete_product: true,
    can_view_logs: true,
    can_manage_users: true,
    can_scan_pdf: true
  },
  manager: {
    can_create_product: false,
    can_edit_product: false,
    can_update_stock: true,
    can_delete_product: false,
    can_view_logs: false,
    can_manage_users: false,
    can_scan_pdf: true
  },
  guest: {
    can_create_product: false,
    can_edit_product: false,
    can_update_stock: false,
    can_delete_product: false,
    can_view_logs: false,
    can_manage_users: false,
    can_scan_pdf: false
  }
};

function permissionInputs() {
  return [
    els.permCanCreateProduct,
    els.permCanEditProduct,
    els.permCanUpdateStock,
    els.permCanDeleteProduct,
    els.permCanViewLogs,
    els.permCanManageUsers,
    els.permCanScanPdf
  ];
}

function collectPermissionsFromModal() {
  return {
    can_create_product: Boolean(els.permCanCreateProduct.checked),
    can_edit_product: Boolean(els.permCanEditProduct.checked),
    can_update_stock: Boolean(els.permCanUpdateStock.checked),
    can_delete_product: Boolean(els.permCanDeleteProduct.checked),
    can_view_logs: Boolean(els.permCanViewLogs.checked),
    can_manage_users: Boolean(els.permCanManageUsers.checked),
    can_scan_pdf: Boolean(els.permCanScanPdf.checked)
  };
}

function applyPermissionsToModal(permissions) {
  els.permCanCreateProduct.checked = Boolean(permissions.can_create_product);
  els.permCanEditProduct.checked = Boolean(permissions.can_edit_product);
  els.permCanUpdateStock.checked = Boolean(permissions.can_update_stock);
  els.permCanDeleteProduct.checked = Boolean(permissions.can_delete_product);
  els.permCanViewLogs.checked = Boolean(permissions.can_view_logs);
  els.permCanManageUsers.checked = Boolean(permissions.can_manage_users);
  els.permCanScanPdf.checked = Boolean(permissions.can_scan_pdf);
}

function syncPermissionStateByRole() {
  const selectedRole = els.userRole.value;
  const isRoleAdmin = selectedRole === 'admin';
  permissionInputs().forEach((input) => {
    if (isRoleAdmin) {
      input.checked = true;
    }
    input.disabled = isRoleAdmin;
  });
}

function roleDefaults(role) {
  return ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.guest;
}

function findUserById(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function closeAllUserMenus() {
  document.querySelectorAll('.user-menu').forEach((menu) => {
    menu.classList.add('hidden');
  });
}

function userRowTemplate(user) {
  const statusClass = user.is_active ? 'good' : 'low';
  const statusLabelText = user.is_active ? 'Aktif' : 'Pasif';
  const toggleActiveText = user.is_active ? 'Pasif Yap' : 'Aktif Et';

  return `
    <tr data-user-id="${user.id}">
      <td>${escapeHtml(user.username)}</td>
      <td><span class="user-role">${escapeHtml(user.role)}</span></td>
      <td><span class="tag ${statusClass}">${statusLabelText}</span></td>
      <td class="mono">${escapeHtml(user.last_login || '-')}</td>
      <td>
        <div class="user-actions-menu">
          <button type="button" class="icon-btn" data-action="toggle-user-menu" aria-label="Kullanıcı işlemleri">...</button>
          <div class="user-menu hidden">
            <button type="button" data-action="edit-user">Kullanıcıyı Düzenle</button>
            <button type="button" data-action="password-user">Şifre Güncelle</button>
            <button type="button" data-action="toggle-active-user">${toggleActiveText}</button>
          </div>
        </div>
      </td>
    </tr>
  `;
}

function openUserModalForCreate() {
  if (!can('can_manage_users')) {
    showToast('Bu işlem için yetkiniz yok.', 'error');
    return;
  }

  state.ui.userModalMode = 'create';
  els.userModalTitle.textContent = 'Yeni Kullanıcı';
  els.userId.value = '';
  els.userUsername.value = '';
  els.userRole.value = 'manager';
  els.userIsActive.checked = true;
  els.userCreatePassword.value = '';
  els.userNewPassword.value = '';

  els.userCreatePasswordWrap.classList.remove('hidden');
  els.userPasswordResetSection.classList.add('hidden');
  els.userCreatePassword.required = true;

  applyPermissionsToModal(roleDefaults('manager'));
  syncPermissionStateByRole();
  els.userModal.classList.remove('hidden');
}

function openUserModalForEdit(userId, focusPassword = false) {
  if (!can('can_manage_users')) {
    showToast('Bu işlem için yetkiniz yok.', 'error');
    return;
  }

  const user = findUserById(userId);
  if (!user) {
    showToast('Kullanıcı bulunamadı.', 'error');
    return;
  }

  state.ui.userModalMode = 'edit';
  els.userModalTitle.textContent = `Kullanıcı: ${user.username}`;
  els.userId.value = String(user.id);
  els.userUsername.value = user.username;
  els.userRole.value = user.role;
  els.userIsActive.checked = Boolean(user.is_active);
  els.userCreatePassword.value = '';
  els.userNewPassword.value = '';

  els.userCreatePasswordWrap.classList.add('hidden');
  els.userPasswordResetSection.classList.remove('hidden');
  els.userCreatePassword.required = false;

  applyPermissionsToModal({
    can_create_product: user.can_create_product,
    can_edit_product: user.can_edit_product,
    can_update_stock: user.can_update_stock,
    can_delete_product: user.can_delete_product,
    can_view_logs: user.can_view_logs,
    can_manage_users: user.can_manage_users,
    can_scan_pdf: user.can_scan_pdf
  });

  syncPermissionStateByRole();
  els.userModal.classList.remove('hidden');

  if (focusPassword) {
    setTimeout(() => els.userNewPassword.focus(), 20);
  }
}

function closeUserModal() {
  els.userModal.classList.add('hidden');
}

function buildUpdatePayloadFromUser(user, overrides = {}) {
  return {
    username: overrides.username ?? user.username,
    role: overrides.role ?? user.role,
    is_active: overrides.is_active ?? Boolean(user.is_active),
    can_create_product: overrides.can_create_product ?? Boolean(user.can_create_product),
    can_edit_product: overrides.can_edit_product ?? Boolean(user.can_edit_product),
    can_update_stock: overrides.can_update_stock ?? Boolean(user.can_update_stock),
    can_delete_product: overrides.can_delete_product ?? Boolean(user.can_delete_product),
    can_view_logs: overrides.can_view_logs ?? Boolean(user.can_view_logs),
    can_manage_users: overrides.can_manage_users ?? Boolean(user.can_manage_users),
    can_scan_pdf: overrides.can_scan_pdf ?? Boolean(user.can_scan_pdf)
  };
}

async function saveUserFromModal(event) {
  event.preventDefault();

  const username = els.userUsername.value.trim();
  const role = els.userRole.value;
  const is_active = Boolean(els.userIsActive.checked);

  if (!username) {
    showToast('Kullanıcı adı boş olamaz.', 'error');
    return;
  }

  if (state.ui.userModalMode === 'create') {
    const password = els.userCreatePassword.value;
    if (!password || password.length < 8) {
      showToast('Geçici şifre en az 8 karakter olmalı.', 'error');
      return;
    }

    const created = await api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role, is_active })
    });

    if (created?.user?.id) {
      await api(`/api/users/${created.user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          username,
          role,
          is_active,
          ...collectPermissionsFromModal()
        })
      });
    }

    closeUserModal();
    await loadUsers();
    showToast('Kullanıcı eklendi.', 'success');
    return;
  }

  const userId = Number(els.userId.value);
  const payload = {
    username,
    role,
    is_active,
    ...collectPermissionsFromModal()
  };

  await api(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  closeUserModal();
  await loadUsers();
  showToast('Kullanıcı güncellendi.', 'success');
}

async function resetUserPasswordFromModal() {
  const userId = Number(els.userId.value);
  const newPassword = els.userNewPassword.value;

  if (!userId) {
    showToast('Önce kullanıcı seçin.', 'error');
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    showToast('Yeni şifre en az 8 karakter olmalı.', 'error');
    return;
  }

  await api(`/api/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ new_password: newPassword })
  });

  els.userNewPassword.value = '';
  showToast('Şifre güncellendi.', 'success');
}

async function toggleUserActiveQuick(userId) {
  if (!can('can_manage_users')) {
    showToast('Bu işlem için yetkiniz yok.', 'error');
    return;
  }

  const user = findUserById(userId);
  if (!user) {
    showToast('Kullanıcı bulunamadı.', 'error');
    return;
  }

  const nextActive = !Boolean(user.is_active);
  await api(`/api/users/${user.id}`, {
    method: 'PUT',
    body: JSON.stringify(buildUpdatePayloadFromUser(user, { is_active: nextActive }))
  });

  await loadUsers();
  showToast(nextActive ? 'Kullanıcı aktifleştirildi.' : 'Kullanıcı pasifleştirildi.', 'success');
}

async function loadUsers() {
  if (!isAdminRoute) {
    return;
  }
  if (!can('can_manage_users') || state.user?.must_change_password) {
    return;
  }

  const data = await api('/api/users');
  state.users = data.users || [];

  if (!state.users.length) {
    els.usersTableBody.innerHTML = '<tr><td colspan="5"><small>Kullanıcı bulunamadı.</small></td></tr>';
    return;
  }

  els.usersTableBody.innerHTML = state.users.map(userRowTemplate).join('');
}

function resetProductForm() {
  els.productId.value = '';
  els.productStockCode.value = '';
  els.productName.value = '';
  els.productCategory.value = '';
  els.productPrice.value = '0';
  els.productMinQuantity.value = '5';
  els.productUnit.value = 'adet';
}

function openCreateModal() {
  resetProductForm();
  els.productModalTitle.textContent = 'Yeni Ürün';
  els.productModal.classList.remove('hidden');
}

function openEditModal(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    showToast('Ürün bulunamadı.', 'error');
    return;
  }

  els.productId.value = String(product.id);
  els.productStockCode.value = product.stock_code;
  els.productName.value = product.name;
  els.productCategory.value = String(product.category_id);
  els.productPrice.value = String(product.supplier_price_try ?? 0);
  els.productMinQuantity.value = String(product.min_quantity ?? 0);
  els.productUnit.value = product.unit || 'adet';
  els.productModalTitle.textContent = 'Ürün Düzenle';
  els.productModal.classList.remove('hidden');
}

function closeProductModal() {
  els.productModal.classList.add('hidden');
}

function openStockModal(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    showToast('Ürün bulunamadı.', 'error');
    return;
  }

  els.stockProductId.value = String(product.id);
  els.stockQuantity.value = String(product.quantity ?? 0);
  els.stockModal.classList.remove('hidden');
}

function closeStockModal() {
  els.stockModal.classList.add('hidden');
}

async function createOrUpdateProduct(event) {
  event.preventDefault();

  if (!can('can_edit_product')) {
    showToast('Bu işlem için yetkiniz yok.', 'error');
    return;
  }

  const payload = {
    stock_code: els.productStockCode.value.trim(),
    name: els.productName.value.trim(),
    category_id: Number(els.productCategory.value),
    supplier_price: Number(els.productPrice.value || 0),
    min_quantity: Number(els.productMinQuantity.value || 0),
    unit: els.productUnit.value.trim() || 'adet'
  };

  const id = els.productId.value ? Number(els.productId.value) : null;

  try {
    if (id) {
      const response = await api(`/api/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      renderSummary(response.summary);
      showToast('Ürün güncellendi.', 'success');
    } else {
      const response = await api('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          quantity: 0
        })
      });
      renderSummary(response.summary);
      showToast('Ürün eklendi.', 'success');
    }

    closeProductModal();
    await Promise.all([loadProducts({ reset: true }), loadAlerts()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitStock(event) {
  event.preventDefault();
  const productId = Number(els.stockProductId.value);
  const quantity = parseLocaleNumber(els.stockQuantity.value, 0);

  try {
    const response = await api(`/api/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    });

    renderSummary(response.summary);
    closeStockModal();
    await Promise.all([loadProducts({ reset: true }), loadAlerts()]);
    showToast('Stok güncellendi.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) {
    return;
  }

  try {
    const response = await api(`/api/products/${productId}`, { method: 'DELETE' });
    renderSummary(response.summary);
    await Promise.all([loadProducts({ reset: true }), loadAlerts()]);
    showToast('Ürün silindi.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;

  if (!username || !password) {
    showToast('Kullanıcı adı ve şifre gerekli.', 'error');
    return;
  }

  try {
    const response = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    state.user = response.user;
    state.token = response.token;
    els.loginPassword.value = '';

    updateAuthUI();
    await Promise.all([loadSummary(), loadProducts({ reset: true }), loadAlerts()]);

    if (isAdminRoute && isAdmin() && !state.user.must_change_password) {
      const jobs = [];
      if (can('can_view_logs')) {
        jobs.push(loadLogs());
        jobs.push(loadVisitors());
      }
      if (can('can_manage_users')) {
        jobs.push(loadUsers());
      }
      await Promise.all(jobs);
    }
    if (isUsageRoute && canViewUsageHistory()) {
      await Promise.all([loadUsage(), loadUsageInsights()]);
    }

    showToast('Giriş başarılı.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleLogout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (_err) {
    // Ignore.
  }

  state.user = null;
  state.token = null;
  state.usageEntries = [];
  state.filters = {
    search: '',
    category: '',
    sort: 'supplier_price',
    order: 'desc'
  };

  els.searchInput.value = '';
  els.categorySelect.value = '';
  renderCategoryTabs();

  updateAuthUI();
  await Promise.all([loadSummary(), loadProducts({ reset: true }), loadAlerts()]);
  els.logTableBody.innerHTML = '';
  els.usersTableBody.innerHTML = '';
  if (els.visitorsTableBody) {
    resetVisitorSummary();
  }
  if (els.usageTableBody) {
    els.usageTableBody.innerHTML = '';
  }
  if (els.usageAiSummary) {
    resetUsageInsights();
  }
  if (els.usageAiReport) {
    resetUsageAiReport();
  }

  showToast('Çıkış yapıldı.', 'success');
}

async function handlePasswordChange(event) {
  event.preventDefault();

  try {
    const response = await api('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: els.currentPassword.value,
        newPassword: els.newPassword.value
      })
    });

    state.user = response.user;
    els.currentPassword.value = '';
    els.newPassword.value = '';

    updateAuthUI();

    await Promise.all([loadSummary(), loadProducts({ reset: true }), loadAlerts()]);

    if (isAdminRoute && isAdmin()) {
      const jobs = [];
      if (can('can_view_logs')) {
        jobs.push(loadLogs());
        jobs.push(loadVisitors());
      }
      if (can('can_manage_users')) {
        jobs.push(loadUsers());
      }
      await Promise.all(jobs);
    }
    if (isUsageRoute && canViewUsageHistory()) {
      await Promise.all([loadUsage(), loadUsageInsights()]);
    }

    showToast('Şifre güncellendi.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function onProductTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const productId = Number(button.dataset.id);
  if (!productId) {
    return;
  }

  const action = button.dataset.action;
  if (action === 'edit') {
    openEditModal(productId);
  } else if (action === 'stock') {
    openStockModal(productId);
  } else if (action === 'delete') {
    deleteProduct(productId);
  }
}

function onUsersTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const row = button.closest('tr[data-user-id]');
  if (!row) {
    return;
  }

  const userId = Number(row.dataset.userId);
  const action = button.dataset.action;

  if (action === 'toggle-user-menu') {
    const menu = button.nextElementSibling;
    const isOpen = menu && !menu.classList.contains('hidden');
    closeAllUserMenus();
    if (menu && !isOpen) {
      menu.classList.remove('hidden');
    }
    return;
  }

  closeAllUserMenus();

  if (action === 'edit-user') {
    openUserModalForEdit(userId, false);
    return;
  }

  if (action === 'password-user') {
    openUserModalForEdit(userId, true);
    return;
  }

  if (action === 'toggle-active-user') {
    toggleUserActiveQuick(userId).catch((err) => showToast(err.message, 'error'));
  }
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logoutBtn.addEventListener('click', handleLogout);
  els.passwordForm.addEventListener('submit', handlePasswordChange);

  els.reloadBtn.addEventListener('click', () => {
    state.pagination.page = 1;
    Promise.all([loadSummary(), loadProducts({ reset: true }), loadAlerts()]).catch((err) => showToast(err.message, 'error'));
  });

  let searchTimer;
  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = els.searchInput.value.trim();
      state.pagination.page = 1;
      loadProducts({ reset: true }).catch((err) => showToast(err.message, 'error'));
    }, 250);
  });

  els.categorySelect.addEventListener('change', () => {
    state.filters.category = els.categorySelect.value;
    state.pagination.page = 1;
    renderCategoryTabs();
    loadProducts({ reset: true }).catch((err) => showToast(err.message, 'error'));
  });

  if (els.categoryTabs) {
    els.categoryTabs.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-category]');
      if (!button) {
        return;
      }
      const categoryId = button.dataset.category || '';
      state.filters.category = categoryId;
      els.categorySelect.value = categoryId;
      renderCategoryTabs();
      loadProducts({ reset: true }).catch((err) => showToast(err.message, 'error'));
    });
  }

  els.sortableHeaders.forEach((th) => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (!sortKey) {
        return;
      }

      if (state.filters.sort === sortKey) {
        state.filters.order = state.filters.order === 'asc' ? 'desc' : 'asc';
      } else {
        state.filters.sort = sortKey;
        state.filters.order = ['supplier_price', 'quantity', 'min_quantity', 'stock_value'].includes(sortKey)
          ? 'desc'
          : 'asc';
      }

      state.pagination.page = 1;
      loadProducts({ reset: true }).catch((err) => showToast(err.message, 'error'));
    });
  });

  els.openCreateBtn.addEventListener('click', openCreateModal);
  els.closeProductModalBtn.addEventListener('click', closeProductModal);
  els.productForm.addEventListener('submit', createOrUpdateProduct);

  els.closeStockModalBtn.addEventListener('click', closeStockModal);
  els.stockForm.addEventListener('submit', submitStock);
  els.stockStepperButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const delta = Number(button.dataset.delta || 0);
      const current = parseLocaleNumber(els.stockQuantity.value, 0);
      const next = Math.max(0, current + delta);
      els.stockQuantity.value = String(next);
    });
  });

  els.productTableBody.addEventListener('click', onProductTableClick);

  els.loadLogsBtn.addEventListener('click', () => {
    loadLogs().catch((err) => showToast(err.message, 'error'));
  });
  if (els.refreshVisitorsBtn) {
    els.refreshVisitorsBtn.addEventListener('click', () => {
      loadVisitors().catch((err) => showToast(err.message, 'error'));
    });
  }
  if (els.loadUsageBtn) {
    els.loadUsageBtn.addEventListener('click', () => {
      Promise.all([loadUsage(), loadUsageInsights()]).catch((err) => showToast(err.message, 'error'));
    });
  }
  if (els.runUsageAiBtn) {
    els.runUsageAiBtn.addEventListener('click', () => {
      runUsageAiAnalysis().catch((err) => showToast(err.message, 'error'));
    });
  }

  els.refreshUsersBtn.addEventListener('click', () => {
    loadUsers().catch((err) => showToast(err.message, 'error'));
  });
  if (els.openCreateUserBtn) {
    els.openCreateUserBtn.addEventListener('click', openUserModalForCreate);
  }
  els.usersTableBody.addEventListener('click', onUsersTableClick);

  if (els.userForm) {
    els.userForm.addEventListener('submit', (event) => {
      saveUserFromModal(event).catch((err) => showToast(err.message, 'error'));
    });
  }
  if (els.closeUserModalBtn) {
    els.closeUserModalBtn.addEventListener('click', closeUserModal);
  }
  if (els.userResetPasswordBtn) {
    els.userResetPasswordBtn.addEventListener('click', () => {
      resetUserPasswordFromModal().catch((err) => showToast(err.message, 'error'));
    });
  }
  if (els.applyRoleDefaultsBtn) {
    els.applyRoleDefaultsBtn.addEventListener('click', () => {
      applyPermissionsToModal(roleDefaults(els.userRole.value));
      syncPermissionStateByRole();
    });
  }
  if (els.userRole) {
    els.userRole.addEventListener('change', syncPermissionStateByRole);
  }
  if (els.userModal) {
    els.userModal.addEventListener('click', (event) => {
      if (event.target === els.userModal) {
        closeUserModal();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.user-actions-menu')) {
      closeAllUserMenus();
    }
  });

  if (els.scrollSentinel && els.productTableWrap) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreProducts().catch((err) => showToast(err.message, 'error'));
        }
      },
      {
        root: els.productTableWrap,
        rootMargin: '0px 0px 160px 0px',
        threshold: 0.1
      }
    );
    observer.observe(els.scrollSentinel);
  }

  els.productModal.addEventListener('click', (event) => {
    if (event.target === els.productModal) {
      closeProductModal();
    }
  });

  els.stockModal.addEventListener('click', (event) => {
    if (event.target === els.stockModal) {
      closeStockModal();
    }
  });
}

async function bootstrap() {
  bindEvents();
  updateRouteUI();
  if (els.visitorTotal) {
    resetVisitorSummary();
  }
  if (els.usageAiSummary) {
    resetUsageInsights();
  }
  if (els.usageAiReport) {
    resetUsageAiReport();
  }

  try {
    await refreshSession();
    await loadCategories();
    await Promise.all([loadSummary(), loadProducts({ reset: true }), loadAlerts()]);

    if (isAdminRoute && isAdmin() && state.user && !state.user.must_change_password) {
      const jobs = [];
      if (can('can_view_logs')) {
        jobs.push(loadLogs());
        jobs.push(loadVisitors());
      }
      if (can('can_manage_users')) {
        jobs.push(loadUsers());
      }
      await Promise.all(jobs);
    }
    if (isUsageRoute && canViewUsageHistory()) {
      await Promise.all([loadUsage(), loadUsageInsights()]);
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Uygulama başlatılamadı.', 'error');
  }
}

bootstrap();
























