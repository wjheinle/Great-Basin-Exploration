// ---------- TAB NAVIGATION ----------
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------- COUNTDOWN ----------
// Flight DL730 landing ABQ 7:54 PM, Sep 15, 2026 (Mountain Time)
const TARGET = new Date('2026-09-15T19:54:00-06:00').getTime();

function updateCountdown() {
  const now = Date.now();
  const diff = TARGET - now;
  const statusEl = document.getElementById('gauge-status');

  if (diff <= 0) {
    document.getElementById('d-days').textContent = '00';
    document.getElementById('d-hours').textContent = '00';
    document.getElementById('d-mins').textContent = '00';
    document.getElementById('d-secs').textContent = '00';
    statusEl.textContent = 'ON THE GROUND';
    statusEl.classList.add('landed');
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  document.getElementById('d-days').textContent = String(days).padStart(2, '0');
  document.getElementById('d-hours').textContent = String(hours).padStart(2, '0');
  document.getElementById('d-mins').textContent = String(mins).padStart(2, '0');
  document.getElementById('d-secs').textContent = String(secs).padStart(2, '0');
  statusEl.textContent = 'HOLDING';
}
updateCountdown();
setInterval(updateCountdown, 1000);

// ---------- VISITS ----------
const visitsList = document.getElementById('visits-list');
const modalBackdrop = document.getElementById('visit-modal-backdrop');
const visitForm = document.getElementById('visit-form');
const modalTitle = document.getElementById('modal-title');
const scheduleCheckbox = document.getElementById('f-scheduled');
const scheduleFields = document.getElementById('schedule-fields');
const deleteBtn = document.getElementById('delete-visit-btn');

let currentVisits = [];

async function fetchVisits() {
  const res = await fetch('/api/visits');
  currentVisits = await res.json();
  renderVisits();
}

function renderVisits() {
  if (!currentVisits.length) {
    visitsList.innerHTML = '<div class="empty-state">No visits logged yet. Add a prospect to get started.</div>';
    return;
  }

  // scheduled first, sorted by date; then prospects
  const scheduled = currentVisits.filter(v => v.status === 'scheduled')
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const prospects = currentVisits.filter(v => v.status !== 'scheduled');

  visitsList.innerHTML = [...scheduled, ...prospects].map(v => visitCardHTML(v)).join('');

  visitsList.querySelectorAll('.visit-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function visitCardHTML(v) {
  const isScheduled = v.status === 'scheduled';
  const dateStr = v.date ? formatDate(v.date) : '';
  return `
    <div class="visit-card ${isScheduled ? 'scheduled' : ''}" data-id="${v.id}">
      <div class="visit-card-top">
        <h3 class="visit-company">${escapeHTML(v.company)}</h3>
        <span class="visit-status-chip ${isScheduled ? 'scheduled' : ''}">${isScheduled ? 'SCHEDULED' : 'PROSPECT'}</span>
      </div>
      <div class="visit-meta-row">
        ${v.location ? `<span>&#128205; ${escapeHTML(v.location)}</span>` : ''}
        ${v.contact ? `<span>&#128100; ${escapeHTML(v.contact)}</span>` : ''}
        ${isScheduled && dateStr ? `<span>&#128197; ${dateStr}${v.time ? ' &middot; ' + formatTime(v.time) : ''}</span>` : ''}
      </div>
      ${v.notes ? `<div class="visit-notes">${escapeHTML(v.notes)}</div>` : ''}
      ${v.link ? `<a class="visit-link" href="${escapeAttr(v.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">VIEW LINK &rarr;</a>` : ''}
      ${v.addedBy ? `<div class="visit-added-by">ADDED BY ${escapeHTML(v.addedBy).toUpperCase()}</div>` : ''}
    </div>
  `;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${ampm}`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;');
}

function openModal(id) {
  const visit = id ? currentVisits.find(v => v.id === id) : null;
  document.getElementById('visit-id').value = visit ? visit.id : '';
  document.getElementById('f-company').value = visit ? visit.company : '';
  document.getElementById('f-contact').value = visit ? visit.contact : '';
  document.getElementById('f-location').value = visit ? visit.location : '';
  document.getElementById('f-link').value = visit ? visit.link : '';
  document.getElementById('f-notes').value = visit ? visit.notes : '';
  document.getElementById('f-addedby').value = visit ? visit.addedBy : '';
  document.getElementById('f-date').value = visit ? visit.date : '';
  document.getElementById('f-time').value = visit ? visit.time : '';
  scheduleCheckbox.checked = visit ? visit.status === 'scheduled' : false;
  toggleScheduleFields();

  modalTitle.textContent = visit ? 'EDIT VISIT' : 'ADD VISIT / PROSPECT';
  deleteBtn.style.display = visit ? 'inline-block' : 'none';
  modalBackdrop.classList.add('open');
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  visitForm.reset();
}

function toggleScheduleFields() {
  scheduleFields.classList.toggle('show', scheduleCheckbox.checked);
}

scheduleCheckbox.addEventListener('change', toggleScheduleFields);
document.getElementById('add-visit-btn').addEventListener('click', () => openModal(null));
document.getElementById('modal-close').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

visitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('visit-id').value;
  const payload = {
    company: document.getElementById('f-company').value.trim(),
    contact: document.getElementById('f-contact').value.trim(),
    location: document.getElementById('f-location').value.trim(),
    link: document.getElementById('f-link').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    addedBy: document.getElementById('f-addedby').value.trim(),
    status: scheduleCheckbox.checked ? 'scheduled' : 'prospect',
    date: scheduleCheckbox.checked ? document.getElementById('f-date').value : '',
    time: scheduleCheckbox.checked ? document.getElementById('f-time').value : ''
  };

  if (id) {
    await fetch(`/api/visits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } else {
    await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  closeModal();
  fetchVisits();
});

deleteBtn.addEventListener('click', async () => {
  const id = document.getElementById('visit-id').value;
  if (!id) return;
  if (!confirm('Delete this visit? This cannot be undone.')) return;
  await fetch(`/api/visits/${id}`, { method: 'DELETE' });
  closeModal();
  fetchVisits();
});

// ---------- GOLF ----------
const golfersList = document.getElementById('golfers-list');
let currentGolfers = [];

async function fetchGolfers() {
  const res = await fetch('/api/golfers');
  currentGolfers = await res.json();
  renderGolfers();
}

function renderGolfers() {
  golfersList.innerHTML = currentGolfers.map(g => `
    <div class="scorecard-row" data-id="${g.id}">
      <span class="golfer-name">${escapeHTML(g.name)}</span>
      <span class="golfer-ghin ghin-display">${g.ghin.toFixed(1)}</span>
      <button class="ghin-edit-btn" data-id="${g.id}">ADJUST</button>
    </div>
  `).join('');

  golfersList.querySelectorAll('.ghin-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editGhin(btn.dataset.id));
  });
}

function editGhin(id) {
  const golfer = currentGolfers.find(g => g.id === id);
  const row = golfersList.querySelector(`.scorecard-row[data-id="${id}"]`);
  const ghinSpan = row.querySelector('.golfer-ghin');

  const input = document.createElement('input');
  input.type = 'number';
  input.step = '0.1';
  input.className = 'ghin-input';
  input.value = golfer.ghin;
  ghinSpan.replaceWith(input);
  input.focus();
  input.select();

  const save = async () => {
    const newVal = parseFloat(input.value);
    if (!isNaN(newVal)) {
      await fetch(`/api/golfers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghin: newVal })
      });
      golfer.ghin = newVal;
    }
    renderGolfers();
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') renderGolfers();
  });
}

// ---------- COURSES (static reference data) ----------
const courses = [
  {
    name: 'Twin Warriors Golf Club',
    location: 'Santa Ana Pueblo, NM',
    fromABQ: '~25 min (I-25)',
    fromFarmington: '~2 hr 15 min',
    note: 'Right on the route back from Nageezi to ABQ — no backtracking. Voted New Mexico\u2019s Best Golf Course 2022 & 2024. Best fit for a Thursday-afternoon round before Friday AM flights.',
    badge: 'ROUTE PICK'
  },
  {
    name: 'Black Mesa Golf Club',
    location: 'Espa\u00f1ola, NM',
    fromABQ: '~1 hr',
    fromFarmington: '~2 hr (via Cuba)',
    note: 'Top-ranked public course in NM, dramatic high-desert layout. Requires a detour off the direct ABQ route \u2014 about an extra hour back to the airport after golf.',
    badge: 'DETOUR'
  },
  {
    name: 'Pi\u00f1on Hills Golf Course',
    location: 'Farmington, NM',
    fromABQ: '~2 hr 45 min',
    fromFarmington: 'In town',
    note: 'Local favorite with real elevation changes. Best option for a round built directly into the Farmington leg of the trip rather than the ABQ drive.',
    badge: 'IN TOWN'
  },
  {
    name: 'San Juan Country Club',
    location: 'Farmington, NM',
    fromABQ: '~2 hr 45 min',
    fromFarmington: 'In town',
    note: 'Private club \u2014 would need a member connection or reciprocal access.',
    badge: 'PRIVATE'
  }
];

const courseGrid = document.getElementById('course-grid');
courseGrid.innerHTML = courses.map(c => `
  <div class="course-card">
    <h4 class="course-name">${c.name}</h4>
    <div class="course-loc">${c.location}</div>
    <div class="course-distances">
      <div><span>FROM ABQ</span><span>${c.fromABQ}</span></div>
      <div><span>FROM FARMINGTON</span><span>${c.fromFarmington}</span></div>
    </div>
    <div class="course-note">${c.note}</div>
    <span class="course-badge">${c.badge}</span>
  </div>
`).join('');

// ---------- INIT ----------
fetchVisits();
fetchGolfers();
