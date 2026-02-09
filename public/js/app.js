const state = {
  user: null,
  token: null,
  categories: [],
  products: [],
  users: [],
  pdfPreview: [],
  pagination: { page: 1, pages: 1, total: 0, limit: 20 },
  filters: {
    search: '',
    category: '',
    sort: 'supplier_price',
    order: 'desc'
  },
  ui: {
    adminOpen: false
  }
};

const els = {
  authState: document.getElementById('authState'),
  loginForm: document.getElementById('loginForm'),
  loginUsername: document.getElementById('loginUsername'),
  loginPassword: document.getElementById('loginPassword'),
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
  reloadBtn: document.getElementById('reloadBtn'),
  toggleAdminBtn: document.getElementById('toggleAdminBtn'),
  openCreateBtn: document.getElementById('openCreateBtn'),
  actionHeader: document.getElementById('actionHeader'),
  productTableBody: document.getElementById('productTableBody'),
  paginationInfo: document.getElementById('paginationInfo'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  sortableHeaders: Array.from(document.querySelectorAll('th.sortable')),

  logsPanel: document.getElementById('logsPanel'),
  logActionFilter: document.getElementById('logActionFilter'),
  loadLogsBtn: document.getElementById('loadLogsBtn'),
  logTableBody: document.getElementById('logTableBody'),

  usersPanel: document.getElementById('usersPanel'),
  usersTableBody: document.getElementById('usersTableBody'),
  refreshUsersBtn: document.getElementById('refreshUsersBtn'),

  pdfPanel: document.getElementById('pdfPanel'),
  pdfPreviewForm: document.getElementById('pdfPreviewForm'),
  pdfFileInput: document.getElementById('pdfFileInput'),
  pdfPreviewModal: document.getElementById('pdfPreviewModal'),
  closePdfPreviewBtn: document.getElementById('closePdfPreviewBtn'),
  pdfPreviewInfo: document.getElementById('pdfPreviewInfo'),
  pdfPreviewBody: document.getElementById('pdfPreviewBody'),
  applyPdfBtn: document.getElementById('applyPdfBtn'),

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
  productImagePath: document.getElementById('productImagePath'),
  imagePathWrap: document.getElementById('imagePathWrap'),

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

function showActionColumn() {
  return Boolean(
    state.user &&
      !state.user.must_change_password &&
      (can('can_edit_product') || can('can_update_stock') || can('can_delete_product'))
  );
}

function hasAdminTools() {
  return can('can_view_logs') || can('can_manage_users') || can('can_scan_pdf');
}

function updateAdminToggleUI() {
  const canOperate = state.user && !state.user.must_change_password;
  const visible = Boolean(canOperate && hasAdminTools());
  els.toggleAdminBtn.classList.toggle('hidden', !visible);
  if (visible) {
    els.toggleAdminBtn.textContent = state.ui.adminOpen ? 'Yönetim Panelini Gizle' : 'Yönetim Paneli';
  }
}

function statusLabel(status) {
  if (status === 'dusuk') {
    return { text: 'Düşük', cls: 'low' };
  }
  if (status === 'azalabilir') {
    return { text: 'Azalabilir', cls: 'warn' };
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

function formatKg(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '-';
  }
  return `${numberTR(numeric)} KG`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

  const response = await fetch(path, init);
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
  const showAdminPanels = Boolean(canOperate && state.ui.adminOpen);

  els.actionHeader.classList.toggle('hidden', !showActions);
  els.openCreateBtn.classList.toggle('hidden', !(canOperate && can('can_create_product')));
  els.logsPanel.classList.toggle('hidden', !(showAdminPanels && can('can_view_logs')));
  els.usersPanel.classList.toggle('hidden', !(showAdminPanels && can('can_manage_users')));
  els.pdfPanel.classList.toggle('hidden', !(showAdminPanels && can('can_scan_pdf')));
  els.imagePathWrap.classList.toggle('hidden', !can('can_edit_product'));
  updateAdminToggleUI();
}

async function refreshSession() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
  } catch (_err) {
    state.user = null;
    state.token = null;
    state.ui.adminOpen = false;
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

async function loadCategories() {
  const data = await api('/api/catalog/categories');
  state.categories = data.categories || [];
  renderCategoryOptions();
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
    const hasKg = item.stock_kg !== null && item.stock_kg !== undefined;
    const image = item.image_url
      ? `<img class="alert-img" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
      : '<div class="alert-img"></div>';
    return `<li class="alert-item">
      ${image}
      <span><strong>${escapeHtml(item.stock_code)}</strong> ${escapeHtml(item.name)} · ${numberTR(item.quantity)} adet${hasKg ? ` / ${formatKg(item.stock_kg)}` : ''} (min ${numberTR(item.min_quantity)})</span>
    </li>`;
  }).join('');
}

async function loadAlerts() {
  const data = await api('/api/catalog/alerts?limit=12');
  const low = data.alerts?.low || [];
  const warning = data.alerts?.warning || [];
  renderAlertList(els.lowAlertsList, low);
  renderAlertList(els.warningAlertsList, warning);
}

function productRowTemplate(product) {
  const status = statusLabel(product.stock_status);
  const imageHtml = product.image_url
    ? `<img class="product-img" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
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
  const quantityCell = product.package_kg
    ? `${numberTR(product.quantity)} adet <br><small>${formatKg(product.stock_kg)}</small>`
    : `${numberTR(product.quantity)}`;

  return `
    <tr>
      <td>${imageHtml}</td>
      <td class="mono">${escapeHtml(product.stock_code)}</td>
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category_name)}</td>
      <td class="mono">${currencyTRY(product.supplier_price_try)}</td>
      <td class="mono">${quantityCell}</td>
      <td class="mono">${numberTR(product.min_quantity)}</td>
      <td class="mono">${currencyTRY(product.stock_value_try)}</td>
      <td><span class="tag ${status.cls}">${status.text}</span></td>
      <td class="${showActionColumn() ? '' : 'hidden'}">${actionCell}</td>
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
  els.paginationInfo.textContent = `${numberTR(total)} kayıt • Sayfa ${page}/${pages}`;
  els.prevPageBtn.disabled = page <= 1;
  els.nextPageBtn.disabled = page >= pages;
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

async function loadProducts() {
  const query = buildCatalogQuery();
  const data = await api(`/api/catalog?${query}`);
  state.products = data.products || [];
  state.pagination = data.pagination || { page: 1, pages: 1, total: 0, limit: 20 };
  renderProducts();
  updateHeaderSortUI();
}

async function loadLogs() {
  if (!can('can_view_logs') || state.user?.must_change_password) {
    return;
  }

  const params = new URLSearchParams();
  if (els.logActionFilter.value) {
    params.set('action', els.logActionFilter.value);
  }

  const data = await api(`/api/logs?${params.toString()}`);
  const logs = data.logs || [];

  if (!logs.length) {
    els.logTableBody.innerHTML = '<tr><td colspan="8"><small>Kayıt bulunamadı.</small></td></tr>';
    return;
  }

  els.logTableBody.innerHTML = logs
    .map((log) => {
      const before = escapeHtml((log.old_values || '').slice(0, 160));
      const after = escapeHtml((log.new_values || '').slice(0, 160));
      return `
        <tr>
          <td class="mono">${escapeHtml(log.created_at || '')}</td>
          <td>${escapeHtml(log.username || 'system')}</td>
          <td class="mono">${escapeHtml(log.action)}</td>
          <td class="mono">${escapeHtml(log.table_name || '')}</td>
          <td class="mono">${escapeHtml(String(log.record_id ?? ''))}</td>
          <td><small>${before || '-'}</small></td>
          <td><small>${after || '-'}</small></td>
          <td class="mono">${escapeHtml(log.source || '')}</td>
        </tr>
      `;
    })
    .join('');
}

function userRowTemplate(user) {
  return `
    <tr data-user-id="${user.id}">
      <td>${escapeHtml(user.username)}</td>
      <td>
        <select data-field="role">
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>admin</option>
          <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>manager</option>
          <option value="guest" ${user.role === 'guest' ? 'selected' : ''}>guest</option>
        </select>
      </td>
      <td><input type="checkbox" data-field="is_active" ${user.is_active ? 'checked' : ''} /></td>
      <td><input type="checkbox" data-field="can_update_stock" ${user.can_update_stock ? 'checked' : ''} /></td>
      <td><input type="checkbox" data-field="can_edit_product" ${user.can_edit_product ? 'checked' : ''} /></td>
      <td><input type="checkbox" data-field="can_delete_product" ${user.can_delete_product ? 'checked' : ''} /></td>
      <td><input type="checkbox" data-field="can_create_product" ${user.can_create_product ? 'checked' : ''} /></td>
      <td><input type="checkbox" data-field="can_view_logs" ${user.can_view_logs ? 'checked' : ''} /></td>
      <td><input type="checkbox" data-field="can_manage_users" ${user.can_manage_users ? 'checked' : ''} /></td>
      <td><input type="checkbox" data-field="can_scan_pdf" ${user.can_scan_pdf ? 'checked' : ''} /></td>
      <td>
        <div class="row-actions">
          <input type="password" data-field="new_password" placeholder="Yeni şifre" />
          <button class="btn subtle" data-action="reset-password" type="button">Şifre</button>
        </div>
      </td>
      <td><button class="btn subtle" data-action="save-user" type="button">Kaydet</button></td>
    </tr>
  `;
}

async function loadUsers() {
  if (!can('can_manage_users') || state.user?.must_change_password) {
    return;
  }

  const data = await api('/api/users');
  state.users = data.users || [];

  if (!state.users.length) {
    els.usersTableBody.innerHTML = '<tr><td colspan="12"><small>Kullanıcı bulunamadı.</small></td></tr>';
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
  els.productImagePath.value = '';
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
  els.productImagePath.value = product.image_path || '';
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

function closePdfPreviewModal() {
  els.pdfPreviewModal.classList.add('hidden');
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
    unit: els.productUnit.value.trim() || 'adet',
    image_path: els.productImagePath.value.trim()
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
    await Promise.all([loadProducts(), loadAlerts()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitStock(event) {
  event.preventDefault();
  const productId = Number(els.stockProductId.value);
  const quantity = Number(els.stockQuantity.value || 0);

  try {
    const response = await api(`/api/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity })
    });

    renderSummary(response.summary);
    closeStockModal();
    await Promise.all([loadProducts(), loadAlerts()]);
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
    await Promise.all([loadProducts(), loadAlerts()]);
    showToast('Ürün silindi.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPdfPreview() {
  if (!state.pdfPreview.length) {
    els.pdfPreviewBody.innerHTML = '<tr><td colspan="11"><small>Eşleşen ürün bulunamadı.</small></td></tr>';
    return;
  }

  els.pdfPreviewBody.innerHTML = state.pdfPreview
    .map((row, index) => {
      const currentQuantity = Number(row.current_quantity || 0);
      const addQuantity = Math.max(0, Math.round(Number(row.add_quantity || 0)));
      const packageKg = parseLocaleNumber(row.package_kg, null);
      const currentKg = packageKg ? Number((currentQuantity * packageKg).toFixed(3)) : null;
      const addKg = packageKg ? Number((addQuantity * packageKg).toFixed(3)) : null;
      const newQuantityEstimate = currentQuantity + addQuantity;
      const newKgEstimate = packageKg ? Number((newQuantityEstimate * packageKg).toFixed(3)) : null;

      const currentUnitPrice = Number(row.current_unit_price || 0);
      const editableUnitPrice = parseLocaleNumber(
        row.new_unit_price === undefined ? row.pdf_unit_price : row.new_unit_price,
        null
      );

      const priceQty = row.order_unit === 'KG' && packageKg ? addQuantity * packageKg : addQuantity;
      const totalPrice = editableUnitPrice === null ? null : Number((priceQty * editableUnitPrice).toFixed(2));

      return `
      <tr>
        <td class="mono">${escapeHtml(row.stock_code)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td class="mono">${numberTR(currentQuantity)}</td>
        <td class="mono">${currentKg === null ? '-' : formatKg(currentKg)}</td>
        <td><input type="number" min="0" data-pdf-field="add_quantity" data-index="${index}" value="${addQuantity}" /></td>
        <td class="mono">${addKg === null ? '-' : formatKg(addKg)}</td>
        <td class="mono">${numberTR(newQuantityEstimate)}</td>
        <td class="mono">${newKgEstimate === null ? '-' : formatKg(newKgEstimate)}</td>
        <td class="mono">${currencyTRY(currentUnitPrice)}</td>
        <td>
          <input type="number" min="0" step="0.01" data-pdf-field="new_unit_price" data-index="${index}" value="${editableUnitPrice ?? ''}" ${
            can('can_edit_product') ? '' : 'disabled'
          } />
        </td>
        <td class="mono">${totalPrice === null ? '-' : currencyTRY(totalPrice)}</td>
      </tr>
    `;
    })
    .join('');
}

async function previewPdf(event) {
  event.preventDefault();

  const file = els.pdfFileInput.files?.[0];
  if (!file) {
    showToast('Önce bir PDF seçin.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const response = await api('/api/pdf/preview', {
      method: 'POST',
      body: formData,
      headers: {}
    });

    state.pdfPreview = (response.preview?.items || []).map((row) => ({
      ...row,
      add_quantity: Math.max(0, Math.round(Number(row.add_quantity || 0))),
      new_unit_price: row.pdf_unit_price ?? row.current_unit_price ?? null
    }));
    const info = response.preview || {};
    els.pdfPreviewInfo.textContent =
      `Taranan satır: ${numberTR(info.scanned_line_count || 0)} · Eşleşen ürün: ${numberTR(info.matched_item_count || 0)} · ` +
      `Toplam eklenecek adet: ${numberTR(info.total_add_quantity || 0)} · Toplam eklenecek KG: ${formatKg(
        info.total_add_kg || 0
      )}`;

    renderPdfPreview();
    els.pdfPreviewModal.classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function applyPdfPreview() {
  if (!state.pdfPreview.length) {
    showToast('Uygulanacak satır yok.', 'error');
    return;
  }

  const payloadItems = state.pdfPreview
    .map((row) => ({
      product_id: row.product_id,
      add_quantity: Math.max(0, Math.round(Number(row.add_quantity || 0))),
      new_unit_price:
        row.new_unit_price === '' || row.new_unit_price === null || row.new_unit_price === undefined
          ? null
          : parseLocaleNumber(row.new_unit_price, null)
    }))
    .filter((row) => row.add_quantity > 0);

  if (!payloadItems.length) {
    showToast('Eklenecek adet 0 olamaz.', 'error');
    return;
  }

  try {
    const response = await api('/api/pdf/apply', {
      method: 'POST',
      body: JSON.stringify({ items: payloadItems })
    });

    renderSummary(response.summary);
    closePdfPreviewModal();
    els.pdfFileInput.value = '';
    await Promise.all([loadProducts(), loadAlerts()]);
    showToast(`PDF verisi uygulandı: ${response.applied_count} ürün`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveUserFromRow(row) {
  const userId = Number(row.dataset.userId);
  const payload = {
    role: row.querySelector('[data-field="role"]').value,
    is_active: row.querySelector('[data-field="is_active"]').checked,
    can_create_product: row.querySelector('[data-field="can_create_product"]').checked,
    can_edit_product: row.querySelector('[data-field="can_edit_product"]').checked,
    can_update_stock: row.querySelector('[data-field="can_update_stock"]').checked,
    can_delete_product: row.querySelector('[data-field="can_delete_product"]').checked,
    can_view_logs: row.querySelector('[data-field="can_view_logs"]').checked,
    can_manage_users: row.querySelector('[data-field="can_manage_users"]').checked,
    can_scan_pdf: row.querySelector('[data-field="can_scan_pdf"]').checked
  };

  await api(`/api/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

async function resetUserPasswordFromRow(row) {
  const userId = Number(row.dataset.userId);
  const input = row.querySelector('[data-field="new_password"]');
  const newPassword = input.value;

  if (!newPassword || newPassword.length < 8) {
    throw new Error('Yeni şifre en az 8 karakter olmalı.');
  }

  await api(`/api/users/${userId}/password`, {
    method: 'PUT',
    body: JSON.stringify({ new_password: newPassword })
  });

  input.value = '';
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
    await Promise.all([loadSummary(), loadProducts(), loadAlerts()]);

    if (state.ui.adminOpen && can('can_view_logs') && !state.user.must_change_password) {
      await loadLogs();
    }

    if (state.ui.adminOpen && can('can_manage_users') && !state.user.must_change_password) {
      await loadUsers();
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
  state.ui.adminOpen = false;
  state.filters = {
    search: '',
    category: '',
    sort: 'supplier_price',
    order: 'desc'
  };

  els.searchInput.value = '';
  els.categorySelect.value = '';

  updateAuthUI();
  await Promise.all([loadSummary(), loadProducts(), loadAlerts()]);
  els.logTableBody.innerHTML = '';
  els.usersTableBody.innerHTML = '';

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

    await Promise.all([loadSummary(), loadProducts(), loadAlerts()]);

    if (state.ui.adminOpen && can('can_view_logs')) {
      await loadLogs();
    }

    if (state.ui.adminOpen && can('can_manage_users')) {
      await loadUsers();
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

  if (button.dataset.action === 'save-user') {
    saveUserFromRow(row)
      .then(async () => {
        showToast('Kullanıcı yetkileri kaydedildi.', 'success');
        await loadUsers();
      })
      .catch((err) => showToast(err.message, 'error'));
  }

  if (button.dataset.action === 'reset-password') {
    resetUserPasswordFromRow(row)
      .then(() => showToast('Kullanıcı şifresi sıfırlandı.', 'success'))
      .catch((err) => showToast(err.message, 'error'));
  }
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logoutBtn.addEventListener('click', handleLogout);
  els.passwordForm.addEventListener('submit', handlePasswordChange);

  els.reloadBtn.addEventListener('click', () => {
    state.pagination.page = 1;
    Promise.all([loadSummary(), loadProducts(), loadAlerts()]).catch((err) => showToast(err.message, 'error'));
  });

  els.toggleAdminBtn.addEventListener('click', () => {
    state.ui.adminOpen = !state.ui.adminOpen;
    updateAuthUI();

    if (state.ui.adminOpen && state.user && !state.user.must_change_password) {
      const jobs = [];
      if (can('can_view_logs')) {
        jobs.push(loadLogs());
      }
      if (can('can_manage_users')) {
        jobs.push(loadUsers());
      }
      Promise.all(jobs).catch((err) => showToast(err.message, 'error'));
    }
  });

  let searchTimer;
  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = els.searchInput.value.trim();
      state.pagination.page = 1;
      loadProducts().catch((err) => showToast(err.message, 'error'));
    }, 250);
  });

  els.categorySelect.addEventListener('change', () => {
    state.filters.category = els.categorySelect.value;
    state.pagination.page = 1;
    loadProducts().catch((err) => showToast(err.message, 'error'));
  });

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
      loadProducts().catch((err) => showToast(err.message, 'error'));
    });
  });

  els.prevPageBtn.addEventListener('click', () => {
    if (state.pagination.page <= 1) {
      return;
    }
    state.pagination.page -= 1;
    loadProducts().catch((err) => showToast(err.message, 'error'));
  });

  els.nextPageBtn.addEventListener('click', () => {
    if (state.pagination.page >= state.pagination.pages) {
      return;
    }
    state.pagination.page += 1;
    loadProducts().catch((err) => showToast(err.message, 'error'));
  });

  els.openCreateBtn.addEventListener('click', openCreateModal);
  els.closeProductModalBtn.addEventListener('click', closeProductModal);
  els.productForm.addEventListener('submit', createOrUpdateProduct);

  els.closeStockModalBtn.addEventListener('click', closeStockModal);
  els.stockForm.addEventListener('submit', submitStock);
  els.stockStepperButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const delta = Number(button.dataset.delta || 0);
      const current = Number(els.stockQuantity.value || 0);
      const next = Math.max(0, current + delta);
      els.stockQuantity.value = String(next);
    });
  });

  els.productTableBody.addEventListener('click', onProductTableClick);

  els.loadLogsBtn.addEventListener('click', () => {
    loadLogs().catch((err) => showToast(err.message, 'error'));
  });

  els.refreshUsersBtn.addEventListener('click', () => {
    loadUsers().catch((err) => showToast(err.message, 'error'));
  });
  els.usersTableBody.addEventListener('click', onUsersTableClick);

  els.pdfPreviewForm.addEventListener('submit', previewPdf);
  els.closePdfPreviewBtn.addEventListener('click', closePdfPreviewModal);
  els.applyPdfBtn.addEventListener('click', applyPdfPreview);

  els.pdfPreviewBody.addEventListener('change', (event) => {
    const input = event.target;
    const index = Number(input.dataset.index);
    if (!Number.isFinite(index) || !state.pdfPreview[index]) {
      return;
    }

    const field = input.dataset.pdfField;
    if (field === 'add_quantity') {
      state.pdfPreview[index].add_quantity = Math.max(0, Math.round(Number(input.value || 0)));
    }
    if (field === 'new_unit_price') {
      state.pdfPreview[index].new_unit_price = input.value;
    }

    renderPdfPreview();
  });

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

  els.pdfPreviewModal.addEventListener('click', (event) => {
    if (event.target === els.pdfPreviewModal) {
      closePdfPreviewModal();
    }
  });
}

async function bootstrap() {
  bindEvents();

  try {
    await refreshSession();
    await loadCategories();
    await Promise.all([loadSummary(), loadProducts(), loadAlerts()]);

    if (state.ui.adminOpen && state.user && !state.user.must_change_password) {
      const jobs = [];
      if (can('can_view_logs')) {
        jobs.push(loadLogs());
      }
      if (can('can_manage_users')) {
        jobs.push(loadUsers());
      }
      await Promise.all(jobs);
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Uygulama başlatılamadı.', 'error');
  }
}

bootstrap();
