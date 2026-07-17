const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway volume mount path, falls back to local ./data for dev
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'trip-data.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULTS = {
  visits: [
    {
      id: 'seed-1',
      company: 'Example Producer Co.',
      type: 'prospect',
      contact: '',
      location: 'San Juan Basin, NM',
      lat: null,
      lng: null,
      notes: 'Sample entry — edit or delete me. Add real prospects here.',
      link: '',
      status: 'prospect', // prospect | scheduled (scheduling state, shown as "Not yet scheduled" / "Scheduled")
      date: '',
      time: '',
      addedBy: '',
      createdAt: new Date().toISOString()
    }
  ],
  golfers: [
    { id: 'g1', name: 'Bill Heinlein', ghin: 15.5 },
    { id: 'g2', name: 'Andrew Tjernagel', ghin: 14.8 },
    { id: 'g3', name: 'Tom Schreier', ghin: 8.8 }
  ],
  flights: [
    {
      id: 'flight-seed-1',
      traveler: 'Andrew Tjernagel & Tom Schreier',
      flightNum: 'DL730',
      from: '',
      to: 'ABQ',
      date: '2026-09-15',
      time: '19:54',
      notes: 'Landing ABQ Sunport',
      createdAt: new Date().toISOString()
    }
  ],
  hotels: [
    {
      id: 'hotel-seed-1',
      name: 'TownePlace Suites by Marriott ABQ Airport',
      city: 'Albuquerque, NM',
      checkin: '2026-09-15',
      checkout: '2026-09-16',
      confirmation: '',
      link: '',
      lat: 35.059015699999996,
      lng: -106.6197073,
      notes: 'Bill — Marriott',
      createdAt: new Date().toISOString()
    },
    {
      id: 'hotel-seed-2',
      name: 'Home2 Suites by Hilton ABQ Airport',
      city: 'Albuquerque, NM',
      checkin: '2026-09-15',
      checkout: '2026-09-16',
      confirmation: '',
      link: '',
      lat: 35.051762,
      lng: -106.63144199999999,
      notes: 'Andrew — Hilton',
      createdAt: new Date().toISOString()
    }
  ]
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULTS, null, 2));
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Migration safeguard: older deployments may predate flights/hotels
    if (!Array.isArray(data.flights)) data.flights = [];
    if (!Array.isArray(data.hotels)) data.hotels = [];
    if (!Array.isArray(data.visits)) data.visits = [];
    if (!Array.isArray(data.golfers)) data.golfers = DEFAULTS.golfers;
    return data;
  } catch (e) {
    console.error('Error reading data file, using defaults', e);
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Visits API ----
app.get('/api/visits', (req, res) => {
  const data = loadData();
  res.json(data.visits);
});

app.post('/api/visits', (req, res) => {
  const data = loadData();
  const visit = {
    id: 'v' + Date.now() + Math.floor(Math.random() * 1000),
    company: req.body.company || 'Unnamed Prospect',
    type: req.body.type || 'prospect',
    contact: req.body.contact || '',
    location: req.body.location || '',
    lat: (req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== '') ? parseFloat(req.body.lat) : null,
    lng: (req.body.lng !== undefined && req.body.lng !== null && req.body.lng !== '') ? parseFloat(req.body.lng) : null,
    notes: req.body.notes || '',
    link: req.body.link || '',
    status: 'prospect',
    date: '',
    time: '',
    addedBy: req.body.addedBy || '',
    createdAt: new Date().toISOString()
  };
  data.visits.push(visit);
  saveData(data);
  res.json(visit);
});

app.put('/api/visits/:id', (req, res) => {
  const data = loadData();
  const idx = data.visits.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Visit not found' });
  data.visits[idx] = { ...data.visits[idx], ...req.body };
  saveData(data);
  res.json(data.visits[idx]);
});

app.delete('/api/visits/:id', (req, res) => {
  const data = loadData();
  data.visits = data.visits.filter(v => v.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

// ---- Golfers API ----
app.get('/api/golfers', (req, res) => {
  const data = loadData();
  res.json(data.golfers);
});

app.put('/api/golfers/:id', (req, res) => {
  const data = loadData();
  const idx = data.golfers.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Golfer not found' });
  if (typeof req.body.ghin === 'number') {
    data.golfers[idx].ghin = req.body.ghin;
  }
  saveData(data);
  res.json(data.golfers[idx]);
});

// ---- Flights API ----
app.get('/api/flights', (req, res) => {
  const data = loadData();
  res.json(data.flights);
});

app.post('/api/flights', (req, res) => {
  const data = loadData();
  const flight = {
    id: 'f' + Date.now() + Math.floor(Math.random() * 1000),
    traveler: req.body.traveler || '',
    flightNum: req.body.flightNum || '',
    from: req.body.from || '',
    to: req.body.to || '',
    date: req.body.date || '',
    time: req.body.time || '',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString()
  };
  data.flights.push(flight);
  saveData(data);
  res.json(flight);
});

app.put('/api/flights/:id', (req, res) => {
  const data = loadData();
  const idx = data.flights.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Flight not found' });
  data.flights[idx] = { ...data.flights[idx], ...req.body };
  saveData(data);
  res.json(data.flights[idx]);
});

app.delete('/api/flights/:id', (req, res) => {
  const data = loadData();
  data.flights = data.flights.filter(f => f.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

// ---- Hotels API ----
app.get('/api/hotels', (req, res) => {
  const data = loadData();
  res.json(data.hotels);
});

app.post('/api/hotels', (req, res) => {
  const data = loadData();
  const hotel = {
    id: 'h' + Date.now() + Math.floor(Math.random() * 1000),
    name: req.body.name || 'Unnamed Hotel',
    city: req.body.city || '',
    checkin: req.body.checkin || '',
    checkout: req.body.checkout || '',
    confirmation: req.body.confirmation || '',
    link: req.body.link || '',
    lat: (req.body.lat !== undefined && req.body.lat !== null && req.body.lat !== '') ? parseFloat(req.body.lat) : null,
    lng: (req.body.lng !== undefined && req.body.lng !== null && req.body.lng !== '') ? parseFloat(req.body.lng) : null,
    notes: req.body.notes || '',
    createdAt: new Date().toISOString()
  };
  data.hotels.push(hotel);
  saveData(data);
  res.json(hotel);
});

app.put('/api/hotels/:id', (req, res) => {
  const data = loadData();
  const idx = data.hotels.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Hotel not found' });
  data.hotels[idx] = { ...data.hotels[idx], ...req.body };
  saveData(data);
  res.json(data.hotels[idx]);
});

app.delete('/api/hotels/:id', (req, res) => {
  const data = loadData();
  data.hotels = data.hotels.filter(h => h.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Great Basin Exploration running on port ${PORT}`);
});
