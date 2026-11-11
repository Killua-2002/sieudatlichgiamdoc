// static/js/calendar.js

let currentWeekDate = null;
let currentViewMode = 'grid'; // 'grid' or 'table'
let weekDataCache = null;

document.addEventListener('DOMContentLoaded', () => {
  initPredictiveSearch();
  initCalendar();
  setupMouseWheelScroll();
});

function initCalendar() {
  // Load current week
  loadWeekSlots();

  // Navigation buttons
  document.getElementById('btnPrevWeek').addEventListener('click', () => {
    if (weekDataCache && weekDataCache.prev_week_date) {
      loadWeekSlots(weekDataCache.prev_week_date);
    }
  });

  document.getElementById('btnNextWeek').addEventListener('click', () => {
    if (weekDataCache && weekDataCache.next_week_date) {
      loadWeekSlots(weekDataCache.next_week_date);
    }
  });

  document.getElementById('btnCurrentWeek').addEventListener('click', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    loadWeekSlots(todayStr);
  });

  // Mode Switch
  document.getElementById('btnViewGrid').addEventListener('click', () => {
    switchViewMode('grid');
  });
  document.getElementById('btnViewTable').addEventListener('click', () => {
    switchViewMode('table');
  });

  // Modal events
  document.getElementById('bookingModalClose').addEventListener('click', closeBookingModal);
  document.getElementById('bookingCancelBtn').addEventListener('click', closeBookingModal);
  document.getElementById('bookingForm').addEventListener('submit', submitBookingForm);
  document.getElementById('successModalCloseBtn').addEventListener('click', closeSuccessModal);
}

function setupMouseWheelScroll() {
  const scrollWrapper = document.getElementById('calendarScrollWrapper');
  if (!scrollWrapper) return;

  scrollWrapper.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      scrollWrapper.scrollLeft += e.deltaY * 1.5;
    }
  }, { passive: false });
}

function switchViewMode(mode) {
  currentViewMode = mode;
  document.getElementById('btnViewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('btnViewTable').classList.toggle('active', mode === 'table');

  if (weekDataCache) {
    renderCalendar(weekDataCache);
  }
}

async function loadWeekSlots(dateStr = '') {
  const container = document.getElementById('calendarRenderContainer');
  container.innerHTML = '<div style="padding: 3rem; text-align: center; color: #64748b;">Đang tải dữ liệu lịch tuần...</div>';

  try {
    const url = dateStr ? `/api/week-slots?date=${dateStr}` : '/api/week-slots';
    const res = await fetch(url);
    const data = await res.json();
    weekDataCache = data;
    currentWeekDate = data.start_date;

    // Update Header Date Range Display
    document.getElementById('weekRangeDisplay').textContent = 
      `Từ ${formatDateVN(data.start_date)} đến ${formatDateVN(data.end_date)}`;

    renderCalendar(data);
  } catch (err) {
    container.innerHTML = '<div style="padding: 3rem; text-align: center; color: #ef4444;">Không thể tải dữ liệu lịch!</div>';
  }
}

function renderCalendar(data) {
  const container = document.getElementById('calendarRenderContainer');
  container.innerHTML = '';

  if (currentViewMode === 'grid') {
    renderGridView(data, container);
  } else {
    renderTableView(data, container);
  }
}

/* 1. RENDER 7-DAY GRID VIEW */
function renderGridView(data, container) {
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
      <div class="day-slots-list" id="slots_day_${dayInfo.date}"></div>
    `;

    const slotsList = col.querySelector(`#slots_day_${dayInfo.date}`);
    dayItem.slots.forEach((slot) => {
      const card = createSlotCard(slot, dayInfo);
      slotsList.appendChild(card);
    });

    grid.appendChild(col);
  });

  container.appendChild(grid);
}

/* 2. RENDER TABLE VIEW (T2 - CN) */
function renderTableView(data, container) {
  const tableWrap = document.createElement('div');
  tableWrap.className = 'week-table-container';

  let tableHtml = `
    <table class="week-table">
      <thead>
        <tr>
          <th class="col-time">Ca làm việc</th>
          ${data.days.map(d => `
            <th class="${d.day_info.is_today ? 'bg-blue-50 text-blue-600' : ''}">
              ${d.day_info.day_name}<br>
              <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">${d.day_info.day_number}</span>
              ${d.day_info.is_today ? '<span class="today-tag">Hôm nay</span>' : ''}
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  // Rows for each of the 5 working slots
  data.working_slots.forEach((slotDef) => {
    tableHtml += `
      <tr>
        <td class="col-time" style="background: #f8fafc; font-weight: 700; font-size: 0.8rem; text-align: center;">
          <div style="color: #1e293b;">${slotDef.label}</div>
          <div style="font-size: 0.75rem; color: #64748b; font-weight: normal;">${slotDef.time}</div>
        </td>
    `;

    data.days.forEach((dayItem) => {
      const slot = dayItem.slots.find(s => s.slot_id === slotDef.id);
      tableHtml += `
        <td>
          <div class="table-slot-cell" id="tbl_${dayItem.day_info.date}_${slotDef.id}"></div>
        </td>
      `;
    });

    tableHtml += `</tr>`;
  });

  tableHtml += `</tbody></table>`;
  tableWrap.innerHTML = tableHtml;

  // Insert cards into table cells
  data.working_slots.forEach((slotDef) => {
    data.days.forEach((dayItem) => {
      const slot = dayItem.slots.find(s => s.slot_id === slotDef.id);
      const cell = tableWrap.querySelector(`#tbl_${dayItem.day_info.date}_${slotDef.id}`);
      if (cell && slot) {
        cell.appendChild(createSlotCard(slot, dayItem.day_info));
      }
    });
  });

  container.appendChild(tableWrap);
}

function createSlotCard(slot, dayInfo) {
  const card = document.createElement('div');
  card.className = `slot-card status-${slot.status}`;

  let badgeHtml = '';
  let btnHtml = '';

  if (slot.status === 'available') {
    badgeHtml = '<span class="badge badge-success">● Còn trống</span>';
    btnHtml = '<button class="slot-book-btn">👉 Đặt Lịch Hẹn</button>';
    card.onclick = () => openBookingModal(dayInfo, slot);
  } else if (slot.status === 'pending') {
    badgeHtml = '<span class="badge badge-warning">⏳ Chờ duyệt</span>';
    btnHtml = `<div class="slot-info">${escapeHtml(slot.company_name || 'Đã có phiếu gửi')}</div>`;
  } else {
    badgeHtml = '<span class="badge badge-danger">✕ Đã kín</span>';
    btnHtml = `<div class="slot-info">${escapeHtml(slot.company_name || 'Giám đốc có lịch làm việc')}</div>`;
  }

  card.innerHTML = `
    <div class="slot-top">
      <span class="slot-name">${slot.label}</span>
      ${badgeHtml}
    </div>
    <div class="slot-time">⏰ ${slot.time}</div>
    ${btnHtml}
  `;

  return card;
}

function openBookingModal(dayInfo, slot) {
  document.getElementById('modalMeetingDate').value = dayInfo.date;
  document.getElementById('modalTimeSlot').value = slot.time;
  document.getElementById('modalSlotSubtitle').textContent = 
    `Thời gian: ${slot.time} | ${dayInfo.full_date_label}`;

  document.getElementById('companySearchInput').value = '';
  document.getElementById('taxCode').value = '';
  document.getElementById('companyName').value = '';
  document.getElementById('contactPerson').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('email').value = '';
  document.getElementById('purpose').value = '';
  document.getElementById('attendeesCount').value = '1';
  document.getElementById('questions').value = '';

  document.getElementById('bookingModal').classList.remove('hidden');
}

function closeBookingModal() {
  document.getElementById('bookingModal').classList.add('hidden');
}

async function submitBookingForm(e) {
  e.preventDefault();
  const btn = document.getElementById('bookingSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Đang gửi phiếu...';

  const payload = {
    meeting_date: document.getElementById('modalMeetingDate').value,
    time_slot: document.getElementById('modalTimeSlot').value,
    tax_code: document.getElementById('taxCode').value.trim() || 'KHONG-MST',
    company_name: document.getElementById('companyName').value.trim() || document.getElementById('companySearchInput').value.trim(),
    contact_person: document.getElementById('contactPerson').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    purpose: document.getElementById('purpose').value.trim(),
    attendees_count: parseInt(document.getElementById('attendeesCount').value) || 1,
    questions: document.getElementById('questions').value.trim()
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      closeBookingModal();
      document.getElementById('succModalTime').textContent = `${payload.time_slot} (${payload.meeting_date})`;
      document.getElementById('succModalCompany').textContent = payload.company_name;
      document.getElementById('succModalEmail').textContent = payload.email;
      document.getElementById('successModal').classList.remove('hidden');
      loadWeekSlots(payload.meeting_date);
    } else {
      alert(data.detail || 'Có lỗi xảy ra!');
    }
  } catch (err) {
    alert('Lỗi kết nối máy chủ!');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Gửi Phiếu Đăng Ký';
  }
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.add('hidden');
}

function formatDateVN(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
