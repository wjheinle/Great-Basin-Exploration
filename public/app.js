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

// ---------- DIAL GAUGE ----------
// Flight DL730 landing ABQ 7:54 PM, Sep 15, 2026 (Mountain Time)
const TARGET = new Date('2026-09-15T19:54:00-06:00').getTime();
const GAUGE_MAX_DAYS = 60; // full-scale like the reference gauge's 0-60 range

// Gauge geometry: 270-degree sweep, matching the photo (start at 225deg/bottom-left,
// sweep clockwise through top, to -45deg/bottom-right — i.e. 60 at bottom-right, 0 at bottom-left... reversed here)
// We want the needle to point to a HIGH value on day 1 (far out) and swing down to 0 at touchdown,
// mirroring how the reference gauge's needle sits mid-scale and moves toward zero as pressure bleeds off.
const START_ANGLE = -225; // degrees, bottom-left
const END_ANGLE = 45;     // degrees, bottom-right (270 degree total sweep)
const CENTER = 200;
const TICK_OUTER_R = 178;
const TICK_MAJOR_LEN = 18;
const TICK_MINOR_LEN = 10;
const NUMBER_R = 148;
const ARC_R = 160;

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function angleForValue(value, maxValue) {
  const frac = Math.min(Math.max(value / maxValue, 0), 1);
  return START_ANGLE + frac * (END_ANGLE - START_ANGLE);
}

function buildGaugeFace() {
  const ticksGroup = document.getElementById('dial-ticks');
  const numbersGroup = document.getElementById('dial-numbers');
  const majorStep = 10;
  const minorStep = 2;

  let ticksHTML = '';
  let numbersHTML = '';

  for (let v = 0; v <= GAUGE_MAX_DAYS; v += minorStep) {
    const angle = angleForValue(v, GAUGE_MAX_DAYS);
    const isMajor = v % majorStep === 0;
    const len = isMajor ? TICK_MAJOR_LEN : TICK_MINOR_LEN;
    const outer = polar(CENTER, CENTER, TICK_OUTER_R, angle);
    const inner = polar(CENTER, CENTER, TICK_OUTER_R - len, angle);
    ticksHTML += `<line x1="${inner.x.toFixed(1)}" y1="${inner.y.toFixed(1)}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" class="dial-tick ${isMajor ? 'major' : ''}"/>`;

    if (isMajor) {
      const numPos = polar(CENTER, CENTER, NUMBER_R, angle);
      numbersHTML += `<text x="${numPos.x.toFixed(1)}" y="${numPos.y.toFixed(1)}" class="dial-number">${v}</text>`;
    }
  }

  ticksGroup.innerHTML = ticksHTML;
  numbersGroup.innerHTML = numbersHTML;

  // Red urgency arc from 0 to 10 days (the "low pressure" danger zone, mirroring the photo's red zone)
  const arcStart = polar(CENTER, CENTER, ARC_R, angleForValue(0, GAUGE_MAX_DAYS));
  const arcEnd = polar(CENTER, CENTER, ARC_R, angleForValue(10, GAUGE_MAX_DAYS));
  const arcPath = `M ${arcStart.x.toFixed(1)} ${arcStart.y.toFixed(1)} A ${ARC_R} ${ARC_R} 0 0 1 ${arcEnd.x.toFixed(1)} ${arcEnd.y.toFixed(1)}`;
  document.getElementById('dial-arc').setAttribute('d', arcPath);
}

function setNeedle(daysRemaining) {
  const clamped = Math.min(Math.max(daysRemaining, 0), GAUGE_MAX_DAYS);
  const angle = angleForValue(clamped, GAUGE_MAX_DAYS);
  // needle SVG line is drawn pointing "up" (angle -90deg) by default from the markup (x2 y=90, i.e. up from center)
  // rotate so it points along our computed angle instead
  const rotation = angle - (-90);
  document.getElementById('dial-needle').style.transform = `rotate(${rotation}deg)`;
}

function updateCountdown() {
  const now = Date.now();
  const diff = TARGET - now;
  const statusEl = document.getElementById('gauge-status');
  const daysNumEl = document.getElementById('dial-days-num');

  if (diff <= 0) {
    document.getElementById('d-hours').textContent = '00';
    document.getElementById('d-mins').textContent = '00';
    document.getElementById('d-secs').textContent = '00';
    daysNumEl.textContent = '0';
    setNeedle(0);
    statusEl.textContent = 'ON THE GROUND';
    statusEl.classList.add('landed');
    return;
  }

  const totalDaysFrac = diff / (1000 * 60 * 60 * 24);
  const days = Math.floor(totalDaysFrac);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  document.getElementById('d-hours').textContent = String(hours).padStart(2, '0');
  document.getElementById('d-mins').textContent = String(mins).padStart(2, '0');
  document.getElementById('d-secs').textContent = String(secs).padStart(2, '0');
  daysNumEl.textContent = String(days);
  setNeedle(totalDaysFrac);
  statusEl.textContent = 'HOLDING';
}

buildGaugeFace();
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
  if (tripMap) renderTripMap();
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

function typeLabel(type) {
  const labels = { prospect: 'Prospect', customer: 'Customer', distributor: 'Distributor' };
  return labels[type] || 'Prospect';
}

function visitCardHTML(v) {
  const isScheduled = v.status === 'scheduled';
  const dateStr = v.date ? formatDate(v.date) : '';
  return `
    <div class="visit-card ${isScheduled ? 'scheduled' : ''}" data-id="${v.id}">
      <div class="visit-card-top">
        <h3 class="visit-company">${escapeHTML(v.company)}</h3>
        <div class="visit-chips">
          <span class="visit-type-chip visit-type-${v.type || 'prospect'}">${typeLabel(v.type)}</span>
          <span class="visit-status-chip ${isScheduled ? 'scheduled' : ''}">${isScheduled ? 'SCHEDULED' : 'NOT YET SCHEDULED'}</span>
        </div>
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
  document.getElementById('f-type').value = visit ? (visit.type || 'prospect') : 'prospect';
  document.getElementById('f-contact').value = visit ? visit.contact : '';
  document.getElementById('f-location').value = visit ? visit.location : '';
  document.getElementById('f-lat').value = (visit && visit.lat !== null && visit.lat !== undefined) ? visit.lat : '';
  document.getElementById('f-lng').value = (visit && visit.lng !== null && visit.lng !== undefined) ? visit.lng : '';
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
    type: document.getElementById('f-type').value,
    contact: document.getElementById('f-contact').value.trim(),
    location: document.getElementById('f-location').value.trim(),
    lat: document.getElementById('f-lat').value !== '' ? parseFloat(document.getElementById('f-lat').value) : null,
    lng: document.getElementById('f-lng').value !== '' ? parseFloat(document.getElementById('f-lng').value) : null,
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
    badge: 'ROUTE PICK',
    lat: 35.3510231, lng: -106.5487703,
    link: 'https://www.twin.mynewmexicogolf.com'
  },
  {
    name: 'Black Mesa Golf Club',
    location: 'Espa\u00f1ola, NM',
    fromABQ: '~1 hr',
    fromFarmington: '~2 hr (via Cuba)',
    note: 'Top-ranked public course in NM, dramatic high-desert layout. Requires a detour off the direct ABQ route \u2014 about an extra hour back to the airport after golf.',
    badge: 'DETOUR',
    lat: 35.9604305, lng: -106.0529103,
    link: 'https://www.golfblackmesa.com'
  },
  {
    name: 'Pi\u00f1on Hills Golf Course',
    location: 'Farmington, NM',
    fromABQ: '~2 hr 45 min',
    fromFarmington: 'In town',
    note: 'Local favorite with real elevation changes. Best option for a round built directly into the Farmington leg of the trip rather than the ABQ drive.',
    badge: 'IN TOWN',
    lat: 36.768149699999995, lng: -108.1782155,
    link: 'https://www.pinonhillsgolf.com'
  },
  {
    name: 'San Juan Country Club',
    location: 'Farmington, NM',
    fromABQ: '~2 hr 45 min',
    fromFarmington: 'In town',
    note: 'Private club \u2014 would need a member connection or reciprocal access.',
    badge: 'PRIVATE',
    lat: 36.7836013, lng: -108.1287521,
    link: 'https://www.sanjuancountryclub.org'
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
    <div class="course-card-footer">
      <span class="course-badge">${c.badge}</span>
      ${c.link ? `<a class="course-link" href="${c.link}" target="_blank" rel="noopener">VISIT SITE &rarr;</a>` : ''}
    </div>
  </div>
`).join('');

// ---------- TRIP MAP ----------
const ABQ_SUNPORT = { name: 'ABQ Sunport', lat: 35.0405314, lng: -106.60979959999999 };
let tripMap = null;
let tripMapLayer = null;

function initTripMap() {
  if (tripMap) return;
  const mapEl = document.getElementById('trip-map');
  if (!mapEl || typeof L === 'undefined') return;

  tripMap = L.map(mapEl).setView([35.5, -107.2], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(tripMap);
  tripMapLayer = L.layerGroup().addTo(tripMap);
}

function pinIcon(color) {
  return L.divIcon({
    className: 'trip-pin',
    html: `<span style="background:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function renderTripMap() {
  if (!tripMap || !tripMapLayer) return;
  tripMapLayer.clearLayers();

  const bounds = [];

  // ABQ Sunport — always shown
  const sunportMarker = L.marker([ABQ_SUNPORT.lat, ABQ_SUNPORT.lng], { icon: pinIcon('#1C1E1A') })
    .bindPopup(`<strong>${ABQ_SUNPORT.name}</strong><br>Arrival/departure point`);
  tripMapLayer.addLayer(sunportMarker);
  bounds.push([ABQ_SUNPORT.lat, ABQ_SUNPORT.lng]);

  // Visits with coordinates
  currentVisits.forEach(v => {
    if (v.lat !== null && v.lat !== undefined && v.lng !== null && v.lng !== undefined && !isNaN(v.lat) && !isNaN(v.lng)) {
      const color = v.status === 'scheduled' ? '#8A9A8C' : '#B8541F';
      const marker = L.marker([v.lat, v.lng], { icon: pinIcon(color) })
        .bindPopup(`<strong>${escapeHTML(v.company)}</strong><br>${escapeHTML(typeLabel(v.type))} &middot; ${v.status === 'scheduled' ? 'Scheduled' : 'Not yet scheduled'}${v.location ? '<br>' + escapeHTML(v.location) : ''}`);
      tripMapLayer.addLayer(marker);
      bounds.push([v.lat, v.lng]);
    }
  });

  // Hotels with coordinates
  currentHotels.forEach(h => {
    if (h.lat !== null && h.lat !== undefined && h.lng !== null && h.lng !== undefined && !isNaN(h.lat) && !isNaN(h.lng)) {
      const marker = L.marker([h.lat, h.lng], { icon: pinIcon('#C9A876') })
        .bindPopup(`<strong>${escapeHTML(h.name)}</strong><br>Hotel${h.checkin ? '<br>' + formatDate(h.checkin) + (h.checkout ? ' \u2013 ' + formatDate(h.checkout) : '') : ''}`);
      tripMapLayer.addLayer(marker);
      bounds.push([h.lat, h.lng]);
    }
  });

  // Golf courses (always shown as reference)
  courses.forEach(c => {
    const marker = L.marker([c.lat, c.lng], { icon: pinIcon('#4d5c4f') })
      .bindPopup(`<strong>${escapeHTML(c.name)}</strong><br>Golf &middot; ${escapeHTML(c.location)}`);
    tripMapLayer.addLayer(marker);
    bounds.push([c.lat, c.lng]);
  });

  if (bounds.length) {
    tripMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
  }

  // Leaflet needs a nudge if it initialized while its tab was hidden
  setTimeout(() => tripMap.invalidateSize(), 50);
}

// re-render map whenever the Customer Visits tab is opened
document.querySelector('.tab-btn[data-tab="visits"]').addEventListener('click', () => {
  initTripMap();
  renderTripMap();
});

// ---------- FLIGHTS ----------
const flightsList = document.getElementById('flights-list');
const flightModalBackdrop = document.getElementById('flight-modal-backdrop');
const flightForm = document.getElementById('flight-form');
const flightModalTitle = document.getElementById('flight-modal-title');
const deleteFlightBtn = document.getElementById('delete-flight-btn');
let currentFlights = [];

async function fetchFlights() {
  const res = await fetch('/api/flights');
  currentFlights = await res.json();
  renderFlights();
}

function renderFlights() {
  if (!currentFlights.length) {
    flightsList.innerHTML = '<div class="empty-state">No flights logged yet.</div>';
    return;
  }
  const sorted = [...currentFlights].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  flightsList.innerHTML = sorted.map(f => `
    <div class="logistics-card" data-id="${f.id}">
      <div class="logistics-card-top">
        <h4 class="logistics-title">${escapeHTML(f.flightNum)}</h4>
        ${f.from || f.to ? `<span class="logistics-route">${escapeHTML(f.from)} &rarr; ${escapeHTML(f.to)}</span>` : ''}
      </div>
      <div class="logistics-meta-row">
        ${f.traveler ? `<span>&#128100; ${escapeHTML(f.traveler)}</span>` : ''}
        ${f.date ? `<span>&#128197; ${formatDate(f.date)}${f.time ? ' &middot; ' + formatTime(f.time) : ''}</span>` : ''}
      </div>
      ${f.notes ? `<div class="logistics-notes">${escapeHTML(f.notes)}</div>` : ''}
    </div>
  `).join('');

  flightsList.querySelectorAll('.logistics-card').forEach(card => {
    card.addEventListener('click', () => openFlightModal(card.dataset.id));
  });
}

function openFlightModal(id) {
  const flight = id ? currentFlights.find(f => f.id === id) : null;
  document.getElementById('fl-id').value = flight ? flight.id : '';
  document.getElementById('fl-traveler').value = flight ? flight.traveler : '';
  document.getElementById('fl-flightnum').value = flight ? flight.flightNum : '';
  document.getElementById('fl-from').value = flight ? flight.from : '';
  document.getElementById('fl-to').value = flight ? flight.to : '';
  document.getElementById('fl-date').value = flight ? flight.date : '';
  document.getElementById('fl-time').value = flight ? flight.time : '';
  document.getElementById('fl-notes').value = flight ? flight.notes : '';

  flightModalTitle.textContent = flight ? 'EDIT FLIGHT' : 'ADD FLIGHT';
  deleteFlightBtn.style.display = flight ? 'inline-block' : 'none';
  flightModalBackdrop.classList.add('open');
}

function closeFlightModal() {
  flightModalBackdrop.classList.remove('open');
  flightForm.reset();
}

document.getElementById('add-flight-btn').addEventListener('click', () => openFlightModal(null));
document.getElementById('flight-modal-close').addEventListener('click', closeFlightModal);
flightModalBackdrop.addEventListener('click', (e) => { if (e.target === flightModalBackdrop) closeFlightModal(); });

flightForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('fl-id').value;
  const payload = {
    traveler: document.getElementById('fl-traveler').value.trim(),
    flightNum: document.getElementById('fl-flightnum').value.trim(),
    from: document.getElementById('fl-from').value.trim(),
    to: document.getElementById('fl-to').value.trim(),
    date: document.getElementById('fl-date').value,
    time: document.getElementById('fl-time').value,
    notes: document.getElementById('fl-notes').value.trim()
  };
  if (id) {
    await fetch(`/api/flights/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    await fetch('/api/flights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  closeFlightModal();
  fetchFlights();
});

deleteFlightBtn.addEventListener('click', async () => {
  const id = document.getElementById('fl-id').value;
  if (!id) return;
  if (!confirm('Delete this flight? This cannot be undone.')) return;
  await fetch(`/api/flights/${id}`, { method: 'DELETE' });
  closeFlightModal();
  fetchFlights();
});

// ---------- HOTELS ----------
const hotelsList = document.getElementById('hotels-list');
const hotelModalBackdrop = document.getElementById('hotel-modal-backdrop');
const hotelForm = document.getElementById('hotel-form');
const hotelModalTitle = document.getElementById('hotel-modal-title');
const deleteHotelBtn = document.getElementById('delete-hotel-btn');
let currentHotels = [];

async function fetchHotels() {
  const res = await fetch('/api/hotels');
  currentHotels = await res.json();
  renderHotels();
}

function renderHotels() {
  if (!currentHotels.length) {
    hotelsList.innerHTML = '<div class="empty-state">No hotels logged yet.</div>';
    return;
  }
  const sorted = [...currentHotels].sort((a, b) => (a.checkin || '9999').localeCompare(b.checkin || '9999'));
  hotelsList.innerHTML = sorted.map(h => `
    <div class="logistics-card" data-id="${h.id}">
      <div class="logistics-card-top">
        <h4 class="logistics-title">${escapeHTML(h.name)}</h4>
      </div>
      <div class="logistics-meta-row">
        ${h.city ? `<span>&#128205; ${escapeHTML(h.city)}</span>` : ''}
        ${h.checkin ? `<span>&#128197; ${formatDate(h.checkin)}${h.checkout ? ' \u2013 ' + formatDate(h.checkout) : ''}</span>` : ''}
        ${h.confirmation ? `<span>&#128273; ${escapeHTML(h.confirmation)}</span>` : ''}
      </div>
      ${h.notes ? `<div class="logistics-notes">${escapeHTML(h.notes)}</div>` : ''}
      ${h.link ? `<a class="visit-link" href="${escapeAttr(h.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">VIEW LINK &rarr;</a>` : ''}
    </div>
  `).join('');

  hotelsList.querySelectorAll('.logistics-card').forEach(card => {
    card.addEventListener('click', () => openHotelModal(card.dataset.id));
  });
}

function openHotelModal(id) {
  const hotel = id ? currentHotels.find(h => h.id === id) : null;
  document.getElementById('ht-id').value = hotel ? hotel.id : '';
  document.getElementById('ht-name').value = hotel ? hotel.name : '';
  document.getElementById('ht-city').value = hotel ? hotel.city : '';
  document.getElementById('ht-checkin').value = hotel ? hotel.checkin : '';
  document.getElementById('ht-checkout').value = hotel ? hotel.checkout : '';
  document.getElementById('ht-confirmation').value = hotel ? hotel.confirmation : '';
  document.getElementById('ht-link').value = hotel ? hotel.link : '';
  document.getElementById('ht-lat').value = (hotel && hotel.lat !== null && hotel.lat !== undefined) ? hotel.lat : '';
  document.getElementById('ht-lng').value = (hotel && hotel.lng !== null && hotel.lng !== undefined) ? hotel.lng : '';
  document.getElementById('ht-notes').value = hotel ? hotel.notes : '';

  hotelModalTitle.textContent = hotel ? 'EDIT HOTEL' : 'ADD HOTEL';
  deleteHotelBtn.style.display = hotel ? 'inline-block' : 'none';
  hotelModalBackdrop.classList.add('open');
}

function closeHotelModal() {
  hotelModalBackdrop.classList.remove('open');
  hotelForm.reset();
}

document.getElementById('add-hotel-btn').addEventListener('click', () => openHotelModal(null));
document.getElementById('hotel-modal-close').addEventListener('click', closeHotelModal);
hotelModalBackdrop.addEventListener('click', (e) => { if (e.target === hotelModalBackdrop) closeHotelModal(); });

hotelForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('ht-id').value;
  const payload = {
    name: document.getElementById('ht-name').value.trim(),
    city: document.getElementById('ht-city').value.trim(),
    checkin: document.getElementById('ht-checkin').value,
    checkout: document.getElementById('ht-checkout').value,
    confirmation: document.getElementById('ht-confirmation').value.trim(),
    link: document.getElementById('ht-link').value.trim(),
    lat: document.getElementById('ht-lat').value !== '' ? parseFloat(document.getElementById('ht-lat').value) : null,
    lng: document.getElementById('ht-lng').value !== '' ? parseFloat(document.getElementById('ht-lng').value) : null,
    notes: document.getElementById('ht-notes').value.trim()
  };
  if (id) {
    await fetch(`/api/hotels/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } else {
    await fetch('/api/hotels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }
  closeHotelModal();
  fetchHotels();
  if (tripMap) renderTripMap();
});

deleteHotelBtn.addEventListener('click', async () => {
  const id = document.getElementById('ht-id').value;
  if (!id) return;
  if (!confirm('Delete this hotel? This cannot be undone.')) return;
  await fetch(`/api/hotels/${id}`, { method: 'DELETE' });
  closeHotelModal();
  fetchHotels();
  if (tripMap) renderTripMap();
});

// ---------- INIT ----------
fetchVisits();
fetchGolfers();
fetchFlights();
fetchHotels();
