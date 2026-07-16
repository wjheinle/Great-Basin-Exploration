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
  ]
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULTS, null, 2));
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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

app.listen(PORT, () => {
  console.log(`Great Basin Exploration running on port ${PORT}`);
});
