// static/js/admin.js

let adminBookings = [];
let currentFilter = 'all';
let currentSelectedBooking = null;
let cachedTemplates = [];
let adminCalendarData = null;

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
    loadAdminCalendar();
  } else {
    calSec.style.display = 'none';
    bkSec.style.display = 'block';
    btnCal.className = 'btn btn-outline';
    btnBk.className = 'btn btn-primary';
    loadAdminBookings();
  }
}

function setupAdminWheelScroll() {
  const wrapper = document.getElementById('adminCalendarScrollWrapper');
  if (!wrapper) return;
  wrapper.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      wrapper.scrollLeft += e.deltaY * 1.5;
    }
  }, { passive: false });
}

function initAdminEvents() {
  // Calendar Navigation
  const prevBtn = document.getElementById('adminBtnPrevWeek');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (adminCalendarData && adminCalendarData.prev_week_date) {
        loadAdminCalendar(adminCalendarData.prev_week_date);
      }
    });
  }

  const nextBtn = document.getElementById('adminBtnNextWeek');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (adminCalendarData && adminCalendarData.next_week_date) {
        loadAdminCalendar(adminCalendarData.next_week_date);
      }
    });
  }

  const currBtn = document.getElementById('adminBtnCurrentWeek');
  if (currBtn) {
    currBtn.addEventListener('click', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      loadAdminCalendar(todayStr);
    });
  }

  // Filter buttons
  ['all', 'pending', 'confirmed', 'rejected'].forEach((f) => {
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

/* 1. ADMIN CALENDAR RENDERER (INTERACTIVE 5x7 GRID) */
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

    // Header Display
    document.getElementById('adminWeekRangeDisplay').textContent = 
      `Tuần từ ${formatDateVN(data.start_date)} đến ${formatDateVN(data.end_date)}`;

    renderAdminCalendarGrid(data, container);
  } catch (err) {
    container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: #ef4444;">Lỗi khi tải lịch!</div>';
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
        🔒 Khóa ca này
      </button>
    `;
  } else if (slot.status === 'confirmed') {
    badgeHtml = '<span class="badge badge-danger">✕ Kín lịch</span>';
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
  let reason = defaultReason;
  // If locking, ask for optional note
  const card = document.querySelector(`[onclick*="${date}"][onclick*="${timeSlot}"]`);
  
  try {
    const res = await fetch('/api/admin/toggle-slot-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_date: date,
        time_slot: timeSlot,
        reason: reason
      })
    });
    const data = await res.json();
    if (res.ok) {
      loadAdminCalendar(date);
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
  document.getElementById('count_rejected').textContent = adminBookings.filter(b => b.status === 'rejected').length;
}

function setFilter(filter) {
  currentFilter = filter;
  ['all', 'pending', 'confirmed', 'rejected'].forEach((f) => {
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
      statusBadge = '<span class="badge badge-success">✓ Đã duyệt</span>';
    } else {
      statusBadge = '<span class="badge badge-danger">✕ Từ chối</span>';
    }

    card.innerHTML = `
      <div class="booking-main-info">
        <div class="booking-title-row">
          ${statusBadge}
          <span class="booking-company">${escapeHtml(b.company_name)}</span>
          <span class="predict-tax-tag">MST: ${escapeHtml(b.tax_code)}</span>
        </div>

        <div class="booking-meta-grid">
          <div><strong>⏰ Thời gian:</strong> <span style="color: #2563eb; font-weight: 700;">${b.time_slot}</span> (Ngày ${b.meeting_date})</div>
          <div><strong>👤 Người đại diện:</strong> ${escapeHtml(b.contact_person)} - SĐT: ${escapeHtml(b.phone)}</div>
          <div><strong>✉️ Hộp thư:</strong> <span style="font-family: monospace;">${escapeHtml(b.email)}</span></div>
          <div><strong>👥 Đoàn dự kiến:</strong> ${b.attendees_count} người</div>
        </div>

        <div class="booking-purpose-box">
          <strong>Mục đích làm việc:</strong> ${escapeHtml(b.purpose || 'Không ghi')}
          ${b.questions ? `<br><span style="color: #64748b;"><strong>Câu hỏi/Tài liệu:</strong> ${escapeHtml(b.questions)}</span>` : ''}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.5rem; min-width: 170px;">
        <button class="btn btn-primary" onclick="openComposerModal(${b.id}, 'confirm')">
          ✓ Soạn Thư & Duyệt
        </button>
        <button class="btn btn-outline" style="color: #dc2626;" onclick="openComposerModal(${b.id}, 'reject')">
          ✕ Từ chối / Đổi giờ
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

/* LIVE EMAIL COMPOSER MODAL */
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

  let sub = template.subject.replace(/{ngay_hop}/g, b.meeting_date);
  let body = template.body
    .replace(/{ten_cty}/g, b.company_name)
    .replace(/{nguoi_lien_he}/g, b.contact_person)
    .replace(/{ngay_hop}/g, b.meeting_date)
    .replace(/{gio_hop}/g, b.time_slot)
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

function openComposerModal(bookingId, defaultAction) {
  currentSelectedBooking = adminBookings.find(b => b.id === bookingId);
  if (!currentSelectedBooking) return;

  const b = currentSelectedBooking;
  document.getElementById('composerBookingId').value = b.id;
  document.getElementById('composerAction').value = defaultAction;
  document.getElementById('composerGuestEmail').value = b.email;
  document.getElementById('composerBookingSubtitle').textContent = 
    `Gửi Doanh nghiệp: ${b.company_name} | Lịch: ${b.time_slot} (${b.meeting_date})`;

  // Apply default template
  if (defaultAction === 'reject') {
    const t = cachedTemplates.find(x => x.id === 'reschedule') || cachedTemplates[0];
    if (t) applyTemplate(t);
  } else {
    const t = cachedTemplates.find(x => x.id === 'in_person') || cachedTemplates[0];
    if (t) applyTemplate(t);
  }

  document.getElementById('composerModal').classList.remove('hidden');
}

function closeComposerModal() {
  document.getElementById('composerModal').classList.add('hidden');
}

// Action Trigger: Send & Launch Mail Client
async function confirmAndLaunchMail(clientType) {
  const id = document.getElementById('composerBookingId').value;
  const action = document.getElementById('composerAction').value;
  const subject = document.getElementById('composerSubject').value.trim();
  const body = document.getElementById('composerBody').value.trim();

  try {
    const res = await fetch(`/api/admin/bookings/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        custom_subject: subject,
        custom_body: body
      })
    });
    const data = await res.json();

    if (res.ok) {
      closeComposerModal();
      loadAdminBookings();

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
    const res = await fetch('/api/admin/block-slot', {
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
