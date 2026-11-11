// static/js/calendar.js

let currentWeekDate = null;
let currentMonthYear = new Date().getFullYear();
let currentMonthIndex = new Date().getMonth() + 1; // 1-12
let currentViewMode = 'grid'; // 'grid', 'table', 'month'
let weekDataCache = null;
let monthDataCache = null;
let currentBookingType = 'business'; // 'business' or 'individual'

document.addEventListener('DOMContentLoaded', () => {
  initPredictiveSearch();
  initCalendar();
  setupMouseWheelScroll();
  initFormTypeSwitcher();
});

function initCalendar() {
  // Load current week
  loadWeekSlots();

  // Navigation buttons
  document.getElementById('btnPrevWeek').addEventListener('click', () => {
    if (currentViewMode === 'month') {
      if (currentMonthIndex === 1) { currentMonthIndex = 12; currentMonthYear--; }
      else { currentMonthIndex--; }
      loadMonthSlots(currentMonthYear, currentMonthIndex);
    } else {
      if (weekDataCache && weekDataCache.prev_week_date) {
        loadWeekSlots(weekDataCache.prev_week_date);
      }
    }
  });

  document.getElementById('btnNextWeek').addEventListener('click', () => {
    if (currentViewMode === 'month') {
      if (currentMonthIndex === 12) { currentMonthIndex = 1; currentMonthYear++; }
      else { currentMonthIndex++; }
      loadMonthSlots(currentMonthYear, currentMonthIndex);
    } else {
      if (weekDataCache && weekDataCache.next_week_date) {
        loadWeekSlots(weekDataCache.next_week_date);
      }
    }
  });

  document.getElementById('btnCurrentWeek').addEventListener('click', () => {
    const today = new Date();
    currentMonthYear = today.getFullYear();
    currentMonthIndex = today.getMonth() + 1;
    if (currentViewMode === 'month') {
      loadMonthSlots(currentMonthYear, currentMonthIndex);
    } else {
      loadWeekSlots(today.toISOString().split('T')[0]);
    }
  });

  // Mode Switch
  document.getElementById('btnViewGrid').addEventListener('click', () => switchViewMode('grid'));
  document.getElementById('btnViewTable').addEventListener('click', () => switchViewMode('table'));
  document.getElementById('btnViewMonth').addEventListener('click', () => switchViewMode('month'));

  // Modal events
  document.getElementById('bookingModalClose').addEventListener('click', closeBookingModal);
  document.getElementById('bookingCancelBtn').addEventListener('click', closeBookingModal);
  document.getElementById('bookingForm').addEventListener('submit', submitBookingForm);
  document.getElementById('successModalCloseBtn').addEventListener('click', closeSuccessModal);

  // SIG Member checkbox toggle
  const sigCheckbox = document.getElementById('isSigMemberCheckbox');
  if (sigCheckbox) {
    sigCheckbox.addEventListener('change', function() {
      const depGroup = document.getElementById('sigDepartmentGroup');
      if (depGroup) depGroup.style.display = this.checked ? 'block' : 'none';
    });
  }
}

/* SMART MOUSE WHEEL: HORIZONTAL THEN NATURAL VERTICAL */
function setupMouseWheelScroll() {
  const scrollWrapper = document.getElementById('calendarScrollWrapper');
  if (!scrollWrapper) return;

  scrollWrapper.addEventListener('wheel', (e) => {
    // In month mode or if screen is desktop where grid fits, do normal vertical scroll
    if (currentViewMode === 'month') return;
    if (scrollWrapper.scrollWidth <= scrollWrapper.clientWidth) return;

    const atLeftEdge = scrollWrapper.scrollLeft <= 2;
    const atRightEdge = scrollWrapper.scrollLeft + scrollWrapper.clientWidth >= scrollWrapper.scrollWidth - 3;

    // When scrolling left at start, or scrolling right at end -> NATURAL VERTICAL SCROLL
    if ((e.deltaY < 0 && atLeftEdge) || (e.deltaY > 0 && atRightEdge)) {
      return; 
    }

    e.preventDefault();
    scrollWrapper.scrollLeft += e.deltaY * 1.5;
  }, { passive: false });
}

function initFormTypeSwitcher() {
  const btnBiz = document.getElementById('typeBtnBusiness');
  const btnInd = document.getElementById('typeBtnIndividual');
  const bizFields = document.getElementById('businessFieldsGroup');
  const indFields = document.getElementById('individualFieldsGroup');

  if (!btnBiz || !btnInd) return;

  btnBiz.addEventListener('click', () => {
    currentBookingType = 'business';
    btnBiz.classList.add('active');
    btnInd.classList.remove('active');
    if (bizFields) bizFields.style.display = 'block';
    if (indFields) indFields.style.display = 'none';
  });

  btnInd.addEventListener('click', () => {
    currentBookingType = 'individual';
    btnInd.classList.add('active');
    btnBiz.classList.remove('active');
    if (bizFields) bizFields.style.display = 'none';
    if (indFields) indFields.style.display = 'block';
  });
}

function switchViewMode(mode) {
  currentViewMode = mode;
  ['grid', 'table', 'month'].forEach(m => {
    const btn = document.getElementById(`btnView${capitalize(m)}`);
    if (btn) btn.classList.toggle('active', m === mode);
  });

  if (mode === 'month') {
    loadMonthSlots(currentMonthYear, currentMonthIndex);
  } else {
    if (weekDataCache) renderCalendar(weekDataCache);
    else loadWeekSlots();
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
      `Tuần từ ${formatDateVN(data.start_date)} đến ${formatDateVN(data.end_date)}`;

    renderCalendar(data);
  } catch (err) {
    container.innerHTML = '<div style="padding: 3rem; text-align: center; color: #ef4444;">Không thể tải dữ liệu lịch!</div>';
  }
}

async function loadMonthSlots(year, month) {
  const container = document.getElementById('calendarRenderContainer');
  container.innerHTML = '<div style="padding: 3rem; text-align: center; color: #64748b;">Đang tải dữ liệu lịch tháng...</div>';

  try {
    const res = await fetch(`/api/month-slots?year=${year}&month=${month}`);
    const data = await res.json();
    monthDataCache = data;

    document.getElementById('weekRangeDisplay').textContent = data.month_label;
    renderMonthView(data, container);
  } catch (err) {
    container.innerHTML = '<div style="padding: 3rem; text-align: center; color: #ef4444;">Không thể tải lịch tháng!</div>';
  }
}

function renderCalendar(data) {
  const container = document.getElementById('calendarRenderContainer');
  container.innerHTML = '';

  if (currentViewMode === 'grid') {
    renderGridView(data, container);
  } else if (currentViewMode === 'table') {
    renderTableView(data, container);
  } else {
    renderMonthView(monthDataCache, container);
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

  data.working_slots.forEach((slotDef) => {
    tableHtml += `
      <tr>
        <td class="col-time" style="background: #f8fafc; font-weight: 700; font-size: 0.775rem; text-align: center;">
          <div style="color: #1e293b;">${slotDef.label}</div>
          <div style="font-size: 0.725rem; color: #64748b; font-weight: normal;">${slotDef.time}</div>
        </td>
    `;

    data.days.forEach((dayItem) => {
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

/* 3. RENDER MONTH VIEW (CALENDAR 1-31) */
function renderMonthView(data, container) {
  if (!data) return;
  const monthWrap = document.createElement('div');
  monthWrap.className = 'month-view-container';

  let html = `
    <div class="month-days-header">
      <div>Thứ 2</div><div>Thứ 3</div><div>Thứ 4</div><div>Thứ 5</div>
      <div>Thứ 6</div><div>Thứ 7</div><div>Chủ Nhật</div>
    </div>
    <div class="month-days-grid">
  `;

  // Empty cells before first day
  for (let i = 0; i < data.first_day_weekday; i++) {
    html += `<div class="month-cell empty-cell"></div>`;
  }

  // Days of month
  data.days.forEach((day) => {
    html += `
      <div class="month-cell ${day.is_today ? 'is-today' : ''}" onclick="jumpToDate('${day.date}')">
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

function jumpToDate(dateStr) {
  switchViewMode('grid');
  loadWeekSlots(dateStr);
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
  } else if (slot.status === 'rescheduled') {
    badgeHtml = '<span class="badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe;">🔄 Đã dời lịch</span>';
    btnHtml = `<div class="slot-info">${escapeHtml(slot.company_name || 'Đã dời')}</div>`;
  } else if (slot.status === 'completed') {
    badgeHtml = '<span class="badge" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;">🎯 Đã xong</span>';
    btnHtml = `<div class="slot-info">${escapeHtml(slot.company_name || 'Đã hoàn thành')}</div>`;
  } else {
    // Confirmed
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

  // Reset inputs
  document.getElementById('companySearchInput').value = '';
  document.getElementById('taxCode').value = '';
  document.getElementById('companyName').value = '';
  document.getElementById('individualName').value = '';
  document.getElementById('contactPerson').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('email').value = '';
  document.getElementById('purpose').value = '';
  document.getElementById('attendeesCount').value = '1';
  document.getElementById('questions').value = '';
  document.getElementById('isSigMemberCheckbox').checked = false;
  document.getElementById('sigDepartmentGroup').style.display = 'none';
  document.getElementById('sigDepartmentInput').value = '';

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

  const isIndividual = currentBookingType === 'individual';
  const selectedLocationRadio = document.querySelector('input[name="meetingLocation"]:checked');
  const locationName = selectedLocationRadio ? selectedLocationRadio.value : "Phòng Giám Đốc Bệnh Viện (Lầu 9)";

  let targetName = "";
  let taxCode = "";

  if (isIndividual) {
    targetName = document.getElementById('individualName').value.trim();
    taxCode = "CANHAN";
  } else {
    targetName = document.getElementById('companyName').value.trim() || document.getElementById('companySearchInput').value.trim();
    taxCode = document.getElementById('taxCode').value.trim() || "KHONG-MST";
  }

  const isSig = document.getElementById('isSigMemberCheckbox').checked;
  const department = isSig ? document.getElementById('sigDepartmentInput').value.trim() : "";

  const payload = {
    booking_type: currentBookingType,
    meeting_date: document.getElementById('modalMeetingDate').value,
    time_slot: document.getElementById('modalTimeSlot').value,
    tax_code: taxCode,
    company_name: targetName,
    contact_person: isIndividual ? targetName : document.getElementById('contactPerson').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    purpose: document.getElementById('purpose').value.trim(),
    attendees_count: parseInt(document.getElementById('attendeesCount').value) || 1,
    questions: document.getElementById('questions').value.trim(),
    is_sig_member: isSig,
    department: department,
    location: locationName
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
      document.getElementById('succModalCompany').textContent = payload.company_name + (isSig ? ` (SIG - ${department})` : '');
      document.getElementById('succModalLocation').textContent = payload.location;
      document.getElementById('succModalEmail').textContent = payload.email;

      // Google Calendar Button
      const ggBtn = document.getElementById('succModalGgCalBtn');
      if (ggBtn && data.google_calendar_link) {
        ggBtn.href = data.google_calendar_link;
        ggBtn.style.display = 'inline-flex';
      }

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

function capitalize(s) {
  return s && s[0].toUpperCase() + s.slice(1);
}
