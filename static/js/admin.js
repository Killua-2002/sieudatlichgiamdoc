// static/js/admin.js

let adminBookings = [];
let currentFilter = 'all';
let currentSelectedBooking = null;
let cachedTemplates = [];
let adminCalendarData = null;
let adminCalendarMode = 'week'; // 'week' or 'month'
let adminCurrentYear = new Date().getFullYear();
let adminCurrentMonth = new Date().getMonth() + 1;

document.addEventListener('DOMContentLoaded', () => {
  loadAdminCalendar();
  loadAdminBookings();
  loadEmailTemplates();
  initAdminEvents();
  setupAdminWheelScroll();
});

function switchAdminTab(tab) {
  const calSec = document.getElementById('adminSection_calendar');
  const bkSec = document.getElementById('adminSection_bookings');
  const btnCal = document.getElementById('adminTabBtn_calendar');
  const btnBk = document.getElementById('adminTabBtn_bookings');

  if (tab === 'calendar') {
    calSec.style.display = 'block';
    bkSec.style.display = 'none';
    btnCal.className = 'btn btn-primary';
    btnBk.className = 'btn btn-outline';
    if (adminCalendarMode === 'week') loadAdminCalendar();
    else loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);
  } else {
    calSec.style.display = 'none';
    bkSec.style.display = 'block';
    btnCal.className = 'btn btn-outline';
    btnBk.className = 'btn btn-primary';
    loadAdminBookings();
  }
}

function switchAdminCalendarMode(mode) {
  adminCalendarMode = mode;
  document.getElementById('adminBtnViewWeek').classList.toggle('active', mode === 'week');
  document.getElementById('adminBtnViewMonth').classList.toggle('active', mode === 'month');

  if (mode === 'week') {
    loadAdminCalendar();
  } else {
    loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);
  }
}

function setupAdminWheelScroll() {
  const wrapper = document.getElementById('adminCalendarScrollWrapper');
  if (!wrapper) return;

  wrapper.addEventListener('wheel', (e) => {
    if (adminCalendarMode === 'month') return;
    if (wrapper.scrollWidth <= wrapper.clientWidth) return;

    const atLeftEdge = wrapper.scrollLeft <= 2;
    const atRightEdge = wrapper.scrollLeft + wrapper.clientWidth >= wrapper.scrollWidth - 3;

    // Permit natural vertical scroll when at boundaries
    if ((e.deltaY < 0 && atLeftEdge) || (e.deltaY > 0 && atRightEdge)) {
      return;
    }

    e.preventDefault();
    wrapper.scrollLeft += e.deltaY * 1.5;
  }, { passive: false });
}

function initAdminEvents() {
  // Calendar Navigation
  const prevBtn = document.getElementById('adminBtnPrevWeek');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (adminCalendarMode === 'month') {
        if (adminCurrentMonth === 1) { adminCurrentMonth = 12; adminCurrentYear--; }
        else { adminCurrentMonth--; }
        loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);
      } else {
        if (adminCalendarData && adminCalendarData.prev_week_date) {
          loadAdminCalendar(adminCalendarData.prev_week_date);
        }
      }
    });
  }

  const nextBtn = document.getElementById('adminBtnNextWeek');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (adminCalendarMode === 'month') {
        if (adminCurrentMonth === 12) { adminCurrentMonth = 1; adminCurrentYear++; }
        else { adminCurrentMonth++; }
        loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);
      } else {
        if (adminCalendarData && adminCalendarData.next_week_date) {
          loadAdminCalendar(adminCalendarData.next_week_date);
        }
      }
    });
  }

  const currBtn = document.getElementById('adminBtnCurrentWeek');
  if (currBtn) {
    currBtn.addEventListener('click', () => {
      const today = new Date();
      adminCurrentYear = today.getFullYear();
      adminCurrentMonth = today.getMonth() + 1;
      if (adminCalendarMode === 'month') {
        loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);
      } else {
        loadAdminCalendar(today.toISOString().split('T')[0]);
      }
    });
  }

  // Filter buttons
  ['all', 'pending', 'confirmed', 'rescheduled', 'cancelled', 'completed'].forEach((f) => {
    const btn = document.getElementById(`filter_${f}`);
    if (btn) {
      btn.addEventListener('click', () => setFilter(f));
    }
  });

  // Modal Composer Events
  const closeComposer = document.getElementById('composerCloseBtn');
  if (closeComposer) closeComposer.addEventListener('click', closeComposerModal);

  const cancelComposer = document.getElementById('composerCancelBtn');
  if (cancelComposer) cancelComposer.addEventListener('click', closeComposerModal);

  // Block Slot Modal Events
  const openBlock = document.getElementById('btnOpenBlockModal');
  if (openBlock) openBlock.addEventListener('click', openBlockSlotModal);

  const closeBlock = document.getElementById('blockSlotCloseBtn');
  if (closeBlock) closeBlock.addEventListener('click', closeBlockSlotModal);

  const blockForm = document.getElementById('blockSlotForm');
  if (blockForm) blockForm.addEventListener('submit', submitBlockSlot);
}

/* 1. ADMIN CALENDAR RENDERER (5x7 WEEK GRID) */
async function loadAdminCalendar(dateStr = '') {
  const container = document.getElementById('adminCalendarRenderContainer');
  if (!container) return;
  container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: #64748b;">Đang tải lịch Giám đốc...</div>';

  try {
    const url = dateStr ? `/api/admin/week-slots?date=${dateStr}` : '/api/admin/week-slots';
    const res = await fetch(url);
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    adminCalendarData = data;

    document.getElementById('adminWeekRangeDisplay').textContent = 
      `Tuần từ ${formatDateVN(data.start_date)} đến ${formatDateVN(data.end_date)}`;

    renderAdminCalendarGrid(data, container);
  } catch (err) {
    container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: #ef4444;">Lỗi khi tải lịch!</div>';
  }
}

async function loadAdminMonthSlots(year, month) {
  const container = document.getElementById('adminCalendarRenderContainer');
  if (!container) return;
  container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: #64748b;">Đang tải lịch tháng Giám đốc...</div>';

  try {
    const res = await fetch(`/api/admin/month-slots?year=${year}&month=${month}`);
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    document.getElementById('adminWeekRangeDisplay').textContent = data.month_label;
    renderAdminMonthView(data, container);
  } catch (err) {
    container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: #ef4444;">Lỗi khi tải lịch tháng!</div>';
  }
}

function renderAdminCalendarGrid(data, container) {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'week-grid-container';

  data.days.forEach((dayItem) => {
    const dayInfo = dayItem.day_info;
    const col = document.createElement('div');
    col.className = `day-column ${dayInfo.is_today ? 'is-today' : ''}`;

    col.innerHTML = `
      <div class="day-column-header">
        <div class="day-title">
          ${dayInfo.day_name}
          ${dayInfo.is_today ? '<span class="today-tag">Hôm nay</span>' : ''}
        </div>
        <div class="day-subtitle">${dayInfo.day_number} (${dayInfo.date})</div>
      </div>
      <div class="day-slots-list" id="admin_slots_day_${dayInfo.date}"></div>
    `;

    const slotsList = col.querySelector(`#admin_slots_day_${dayInfo.date}`);
    dayItem.slots.forEach((slot) => {
      const card = createAdminSlotCard(slot, dayInfo);
      slotsList.appendChild(card);
    });

    grid.appendChild(col);
  });

  container.appendChild(grid);
}

function renderAdminMonthView(data, container) {
  container.innerHTML = '';
  const monthWrap = document.createElement('div');
  monthWrap.className = 'month-view-container';

  let html = `
    <div class="month-days-header">
      <div>Thứ 2</div><div>Thứ 3</div><div>Thứ 4</div><div>Thứ 5</div>
      <div>Thứ 6</div><div>Thứ 7</div><div>Chủ Nhật</div>
    </div>
    <div class="month-days-grid">
  `;

  for (let i = 0; i < data.first_day_weekday; i++) {
    html += `<div class="month-cell empty-cell"></div>`;
  }

  data.days.forEach((day) => {
    html += `
      <div class="month-cell ${day.is_today ? 'is-today' : ''}" onclick="jumpAdminToWeek('${day.date}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="month-cell-num">${day.day_number}</span>
          ${day.is_today ? '<span class="today-tag" style="margin: 0;">Hôm nay</span>' : ''}
        </div>
        <div class="month-cell-badges">
          ${day.available_count > 0 ? `<span class="month-badge month-badge-avail">🟢 Trống: ${day.available_count} ca</span>` : ''}
          ${day.confirmed_count > 0 ? `<span class="month-badge month-badge-confirmed">🔴 Kín: ${day.confirmed_count} ca</span>` : ''}
          ${day.pending_count > 0 ? `<span class="month-badge month-badge-pending">🟡 Chờ: ${day.pending_count}</span>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  monthWrap.innerHTML = html;
  container.appendChild(monthWrap);
}

function jumpAdminToWeek(dateStr) {
  switchAdminCalendarMode('week');
  loadAdminCalendar(dateStr);
}

function createAdminSlotCard(slot, dayInfo) {
  const card = document.createElement('div');
  card.className = `slot-card status-${slot.status}`;

  let badgeHtml = '';
  let controlBtn = '';
  let infoText = '';

  if (slot.status === 'available') {
    badgeHtml = '<span class="badge badge-success">● Còn trống</span>';
    infoText = '<div class="slot-info" style="color: #10b981;">Ca làm việc đang mở</div>';
    controlBtn = `
      <button class="btn btn-outline" style="width: 100%; font-size: 0.725rem; padding: 0.35rem; color: #dc2626; border-color: #fecaca;" 
        onclick="toggleSlotLock('${dayInfo.date}', '${slot.time}', 'Giám đốc bận việc riêng')">
        🔒 Khóa ca bận
      </button>
    `;
  } else if (slot.status === 'confirmed' || slot.status === 'completed') {
    badgeHtml = slot.status === 'completed' 
      ? '<span class="badge" style="background:#f0fdf4; color:#15803d;">🎯 Đã xong</span>'
      : '<span class="badge badge-danger">✕ Kín lịch</span>';
    infoText = `<div class="slot-info" style="font-weight: 700; color: #0f172a;">${escapeHtml(slot.company_name || 'Đã có lịch')}</div>`;
    controlBtn = `
      <button class="btn btn-outline" style="width: 100%; font-size: 0.725rem; padding: 0.35rem; color: #10b981; border-color: #a7f3d0;" 
        onclick="toggleSlotLock('${dayInfo.date}', '${slot.time}')">
        🔓 Mở lại ca trống
      </button>
    `;
  } else {
    // Pending
    badgeHtml = `<span class="badge badge-warning">⏳ Chờ duyệt (${slot.pending_count || 1})</span>`;
    infoText = `<div class="slot-info" style="color: #d97706; font-weight: 600;">${escapeHtml(slot.company_name || 'Đang chờ duyệt')}</div>`;
    controlBtn = `
      <div style="display: flex; gap: 0.35rem;">
        <button class="btn btn-primary" style="flex: 1; font-size: 0.725rem; padding: 0.35rem;" 
          onclick="openFirstPendingBooking('${dayInfo.date}', '${slot.time}')">
          ✓ Xem & Duyệt
        </button>
        <button class="btn btn-outline" style="font-size: 0.725rem; padding: 0.35rem; color: #dc2626;" 
          title="Khóa ca này" onclick="toggleSlotLock('${dayInfo.date}', '${slot.time}', 'Sếp bận họp')">
          🔒
        </button>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="slot-top">
      <span class="slot-name">${slot.label}</span>
      ${badgeHtml}
    </div>
    <div class="slot-time" style="margin-bottom: 0.25rem;">⏰ ${slot.time}</div>
    ${infoText}
    ${controlBtn}
  `;

  return card;
}

async function toggleSlotLock(date, timeSlot, defaultReason = 'Giám đốc bận việc riêng') {
  try {
    const res = await fetch('/api/admin/toggle-slot-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_date: date,
        time_slot: timeSlot,
        reason: defaultReason
      })
    });
    const data = await res.json();
    if (res.ok) {
      if (adminCalendarMode === 'week') loadAdminCalendar(date);
      else loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);
      loadAdminBookings();
    } else {
      alert(data.detail || 'Không thể thao tác');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ!');
  }
}

function openFirstPendingBooking(date, timeSlot) {
  const b = adminBookings.find(x => x.meeting_date === date && x.time_slot === timeSlot && x.status === 'pending');
  if (b) {
    openComposerModal(b.id, 'confirm');
  } else {
    switchAdminTab('bookings');
  }
}

/* 2. ADMIN BOOKINGS LIST */
async function loadAdminBookings() {
  const container = document.getElementById('bookingsListContainer');
  if (!container) return;
  container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #64748b;">Đang tải danh sách lịch hẹn...</div>';

  try {
    const res = await fetch('/api/admin/bookings');
    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }
    const data = await res.json();
    adminBookings = data.bookings;
    updateCounts();
    renderAdminBookings();
  } catch (err) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: #ef4444;">Lỗi khi tải dữ liệu!</div>';
  }
}

async function loadEmailTemplates() {
  try {
    const res = await fetch('/api/admin/templates');
    if (res.ok) {
      const data = await res.json();
      cachedTemplates = data.templates;
      renderTemplatePills();
    }
  } catch (err) {
    console.error('Lỗi tải mẫu email:', err);
  }
}

function updateCounts() {
  document.getElementById('count_all').textContent = adminBookings.length;
  document.getElementById('count_pending').textContent = adminBookings.filter(b => b.status === 'pending').length;
  document.getElementById('count_confirmed').textContent = adminBookings.filter(b => b.status === 'confirmed').length;
  document.getElementById('count_rescheduled').textContent = adminBookings.filter(b => b.status === 'rescheduled').length;
  document.getElementById('count_cancelled').textContent = adminBookings.filter(b => b.status === 'cancelled').length;
  document.getElementById('count_completed').textContent = adminBookings.filter(b => b.status === 'completed').length;
}

function setFilter(filter) {
  currentFilter = filter;
  ['all', 'pending', 'confirmed', 'rescheduled', 'cancelled', 'completed'].forEach((f) => {
    const btn = document.getElementById(`filter_${f}`);
    if (btn) {
      btn.classList.toggle('btn-primary', f === filter);
      btn.classList.toggle('btn-outline', f !== filter);
    }
  });
  renderAdminBookings();
}

function renderAdminBookings() {
  const container = document.getElementById('bookingsListContainer');
  if (!container) return;

  const filtered = adminBookings.filter(b => currentFilter === 'all' || b.status === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 3rem; text-align: center; border: 1px solid #e2e8f0; color: #94a3b8;">
        Không có lịch hẹn nào trong danh mục này.
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach((b) => {
    const card = document.createElement('div');
    card.className = `booking-item-card border-${b.status}`;

    let statusBadge = '';
    if (b.status === 'pending') {
      statusBadge = '<span class="badge badge-warning">⏳ Chờ duyệt</span>';
    } else if (b.status === 'confirmed') {
      statusBadge = '<span class="badge badge-success">✓ Đã xác nhận</span>';
    } else if (b.status === 'rescheduled') {
      statusBadge = '<span class="badge" style="background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe;">🔄 Đã dời</span>';
    } else if (b.status === 'completed') {
      statusBadge = '<span class="badge" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0;">🎯 Đã xong</span>';
    } else {
      statusBadge = '<span class="badge badge-danger">✕ Đã hủy / Từ chối</span>';
    }

    const isInd = b.booking_type === 'individual';
    const typeBadge = isInd 
      ? '<span class="badge" style="background:#f1f5f9; color:#475569;">👤 Cá nhân</span>'
      : '<span class="badge" style="background:#eff6ff; color:#1d4ed8;">🏢 Doanh nghiệp</span>';

    const sigBadge = b.is_sig_member 
      ? `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:700;">🏥 Thuộc SIG: ${escapeHtml(b.department || '')}</span>`
      : '';

    card.innerHTML = `
      <div class="booking-main-info">
        <div class="booking-title-row">
          ${statusBadge}
          ${typeBadge}
          ${sigBadge}
          <span class="booking-company">${escapeHtml(b.company_name)}</span>
          ${b.tax_code && b.tax_code !== 'CANHAN' ? `<span class="predict-tax-tag">MST: ${escapeHtml(b.tax_code)}</span>` : ''}
        </div>

        <div class="booking-meta-grid">
          <div><strong>⏰ Thời gian:</strong> <span style="color: #2563eb; font-weight: 700;">${b.time_slot}</span> (Ngày ${b.meeting_date})</div>
          <div><strong>👤 Người đại diện:</strong> ${escapeHtml(b.contact_person)} - SĐT: ${escapeHtml(b.phone)}</div>
          <div><strong>✉️ Hộp thư:</strong> <span style="font-family: monospace;">${escapeHtml(b.email)}</span></div>
          <div><strong>📍 Địa điểm:</strong> <span style="color: #0f172a; font-weight: 600;">${escapeHtml(b.location || 'Phòng GĐ Bệnh Viện')}</span></div>
        </div>

        <div class="booking-purpose-box">
          <strong>Nội dung:</strong> ${escapeHtml(b.purpose || 'Không ghi')}
          ${b.questions ? `<br><span style="color: #64748b;"><strong>Câu hỏi/Tài liệu:</strong> ${escapeHtml(b.questions)}</span>` : ''}
        </div>

        ${b.google_calendar_url ? `
          <div style="margin-top: 0.35rem;">
            <a href="${b.google_calendar_url}" target="_blank" style="font-size: 0.75rem; color: #2563eb; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
              📅 Mở Google Calendar của cuộc hẹn này ↗
            </a>
          </div>
        ` : ''}
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.4rem; min-width: 190px;">
        <button class="btn btn-primary" style="font-size: 0.775rem;" onclick="openComposerModal(${b.id}, 'confirm')">
          ✓ Phê Duyệt & Soạn Thư
        </button>
        <button class="btn btn-outline" style="border-color: #4338ca; color: #4338ca; font-size: 0.775rem;" onclick="openComposerModal(${b.id}, 'reschedule')">
          🔄 Dời Lịch / Đổi Giờ
        </button>
        <button class="btn btn-outline" style="border-color: #dc2626; color: #dc2626; font-size: 0.775rem;" onclick="openComposerModal(${b.id}, 'cancel')">
          ✕ Từ Chối / Hủy Lịch
        </button>
        <button class="btn btn-outline" style="border-color: #15803d; color: #15803d; font-size: 0.775rem;" onclick="openComposerModal(${b.id}, 'complete')">
          🎯 Đánh Dấu Đã Xong
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/* 3. LIVE EMAIL COMPOSER MODAL */
function renderTemplatePills() {
  const bar = document.getElementById('composerTemplatePills');
  if (!bar) return;
  bar.innerHTML = '';

  cachedTemplates.forEach((t) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'template-pill-btn';
    pill.textContent = t.title;
    pill.onclick = () => applyTemplate(t);
    bar.appendChild(pill);
  });
}

function applyTemplate(template) {
  if (!currentSelectedBooking) return;
  const b = currentSelectedBooking;

  const isInd = b.booking_type === 'individual';
  const loai = isInd ? 'Anh/Chị' : 'Quý Doanh nghiệp/Tổ chức';
  const ten = isInd ? b.contact_person : b.company_name;

  let sub = template.subject.replace(/{ngay_hop}/g, b.meeting_date);
  let body = template.body
    .replace(/{loai_doi_tuong}/g, loai)
    .replace(/{ten_doi_tuong}/g, ten)
    .replace(/{ten_cty}/g, b.company_name)
    .replace(/{nguoi_lien_he}/g, b.contact_person)
    .replace(/{ngay_hop}/g, b.meeting_date)
    .replace(/{gio_hop}/g, b.time_slot)
    .replace(/{dia_diem}/g, b.location || 'Phòng Giám Đốc Bệnh Viện (Lầu 9)')
    .replace(/{muc_dich}/g, b.purpose || 'Trao đổi công tác')
    .replace(/{google_calendar_link}/g, b.google_calendar_url || '')
    .replace(/{ghi_chu_them}/g, '');

  document.getElementById('composerSubject').value = sub;
  document.getElementById('composerBody').value = body;
}

function insertTag(tag) {
  const textarea = document.getElementById('composerBody');
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + tag + text.substring(end);
  textarea.focus();
}

function openComposerModal(bookingId, defaultAction = 'confirm') {
  currentSelectedBooking = adminBookings.find(b => b.id === bookingId);
  if (!currentSelectedBooking) return;

  const b = currentSelectedBooking;
  document.getElementById('composerBookingId').value = b.id;
  document.getElementById('composerAction').value = defaultAction;
  document.getElementById('composerGuestEmail').value = b.email;
  document.getElementById('composerBookingSubtitle').textContent = 
    `Đối tượng: ${b.company_name} | Ca: ${b.time_slot} (Ngày ${b.meeting_date})`;

  // Google Calendar Link preview
  const calLink = document.getElementById('composerGgCalLink');
  if (calLink) {
    calLink.href = b.google_calendar_url || '#';
  }

  // Auto pick template matching action
  let tpl = null;
  if (defaultAction === 'cancel') {
    tpl = cachedTemplates.find(x => x.id === 'cancel') || cachedTemplates[0];
  } else if (defaultAction === 'reschedule') {
    tpl = cachedTemplates.find(x => x.id === 'reschedule') || cachedTemplates[0];
  } else if (defaultAction === 'complete') {
    tpl = cachedTemplates.find(x => x.id === 'complete') || cachedTemplates[0];
  } else {
    // confirm
    if (b.location && b.location.includes('Trực Tuyến')) {
      tpl = cachedTemplates.find(x => x.id === 'online') || cachedTemplates[0];
    } else {
      tpl = cachedTemplates.find(x => x.id === 'in_person') || cachedTemplates[0];
    }
  }

  if (tpl) applyTemplate(tpl);
  document.getElementById('composerModal').classList.remove('hidden');
}

function closeComposerModal() {
  document.getElementById('composerModal').classList.add('hidden');
}

// Action Trigger: Send & Launch Mail Client
async function executeActionAndSend(actionType, clientType) {
  const id = document.getElementById('composerBookingId').value;
  const subject = document.getElementById('composerSubject').value.trim();
  const body = document.getElementById('composerBody').value.trim();

  try {
    const res = await fetch(`/api/admin/bookings/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: actionType,
        custom_subject: subject,
        custom_body: body
      })
    });
    const data = await res.json();

    if (res.ok) {
      alert(`Đã cập nhật trạng thái: ${data.status_label}!`);
      closeComposerModal();
      loadAdminBookings();
      if (adminCalendarMode === 'week') loadAdminCalendar();
      else loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);

      // Launch Mail Client
      if (clientType === 'gmail') {
        window.open(data.mail_links.gmail_url, '_blank');
      } else {
        window.location.href = data.mail_links.mailto_url;
      }
    } else {
      alert(data.detail || 'Lỗi khi cập nhật trạng thái');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ!');
  }
}

/* BLOCK SLOT MODAL */
function openBlockSlotModal() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('blockDateInput').value = tomorrow.toISOString().split('T')[0];
  document.getElementById('blockSlotModal').classList.remove('hidden');
}

function closeBlockSlotModal() {
  document.getElementById('blockSlotModal').classList.add('hidden');
}

async function submitBlockSlot(e) {
  e.preventDefault();
  const date = document.getElementById('blockDateInput').value;
  const slot = document.getElementById('blockSlotSelect').value;
  const reason = document.getElementById('blockReasonInput').value;

  try {
    const res = await fetch('/api/admin/toggle-slot-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_date: date,
        time_slot: slot,
        reason: reason
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      closeBlockSlotModal();
      loadAdminBookings();
      if (adminCalendarMode === 'week') loadAdminCalendar(date);
      else loadAdminMonthSlots(adminCurrentYear, adminCurrentMonth);
    } else {
      alert(data.detail || 'Không thể khóa khung giờ này');
    }
  } catch (err) {
    alert('Lỗi máy chủ!');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
