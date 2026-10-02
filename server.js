const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'events.db'));
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    venue TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 100 CHECK (capacity > 0)
  );
  CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('General', 'VIP', 'Student')),
    event_id INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE (event_id, email)
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ticketTypes = new Set(['General', 'VIP', 'Student']);
const emailOk = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const clean = value => typeof value === 'string' ? value.trim() : '';

function eventPayload(body) {
  const name = clean(body.name);
  const date = clean(body.date);
  const venue = clean(body.venue);
  const capacity = Number(body.capacity);
  if (!name || !date || !venue) return { error: 'Name, date, and venue are required' };
  if (!Number.isInteger(capacity) || capacity < 1) return { error: 'Capacity must be a positive whole number' };
  return { value: { name, date, venue, capacity } };
}

app.post('/api/events', (req, res) => {
  const result = eventPayload(req.body || {});
  if (result.error) return res.status(400).json({ error: result.error });
  const event = result.value;
  const insert = db.prepare('INSERT INTO events (name, date, venue, capacity) VALUES (?, ?, ?, ?)').run(
    event.name, event.date, event.venue, event.capacity
  );
  res.status(201).json({ id: Number(insert.lastInsertRowid), ...event, attendee_count: 0 });
});

app.get('/api/events', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, COUNT(a.id) AS attendee_count
    FROM events e
    LEFT JOIN attendees a ON a.event_id = e.id
    GROUP BY e.id
    ORDER BY e.date ASC, e.id ASC
  `).all();
  res.json(events);
});

app.get('/api/events/:id/attendees', (req, res) => {
  const event = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(db.prepare('SELECT * FROM attendees WHERE event_id = ? ORDER BY id DESC').all(event.id));
});

app.get('/api/attendees', (req, res) => {
  res.json(db.prepare(`
    SELECT a.*, e.name AS event_name
    FROM attendees a JOIN events e ON e.id = a.event_id
    ORDER BY a.id DESC
  `).all());
});

app.get('/api/attendees/search', (req, res) => {
  const name = clean(req.query.name);
  const eventId = clean(req.query.eventId);
  let sql = `
    SELECT a.*, e.name AS event_name
    FROM attendees a JOIN events e ON e.id = a.event_id
    WHERE a.name LIKE ?
  `;
  const params = [`%${name}%`];
  if (eventId) {
    sql += ' AND a.event_id = ?';
    params.push(eventId);
  }
  sql += ' ORDER BY a.id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/events/:id/attendees', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const name = clean(req.body?.name);
  const email = clean(req.body?.email).toLowerCase();
  const ticketType = clean(req.body?.ticket_type);
  if (!name || !email || !ticketType) return res.status(400).json({ error: 'All fields are required' });
  if (!emailOk(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (!ticketTypes.has(ticketType)) return res.status(400).json({ error: 'Invalid ticket type' });

  const { attendeeCount } = db.prepare(
    'SELECT COUNT(*) AS attendeeCount FROM attendees WHERE event_id = ?'
  ).get(event.id);
  if (attendeeCount >= event.capacity) return res.status(409).json({ error: 'Event is full' });

  try {
    const insert = db.prepare(
      'INSERT INTO attendees (name, email, ticket_type, event_id) VALUES (?, ?, ?, ?)'
    ).run(name, email, ticketType, event.id);
    res.status(201).json({ id: Number(insert.lastInsertRowid), name, email, ticket_type: ticketType, event_id: event.id });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Already registered for this event' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/attendees/:id', (req, res) => {
  const result = db.prepare('DELETE FROM attendees WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Attendee not found' });
  res.json({ message: 'Attendee deleted' });
});

app.delete('/api/events/:id', (req, res) => {
  const result = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Event not found' });
  res.json({ message: 'Event deleted' });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(error);
});

app.listen(port, () => {
  console.log(`Event manager running at http://localhost:${port}`);
});
