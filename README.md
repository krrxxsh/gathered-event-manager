# Gathered - Event & Attendee Manager

A single-page event and attendee management system built with HTML, CSS, JavaScript, Node.js, Express, and SQLite.

The application opens as a single-page dashboard with two focused workflows: manage events or register attendees. Users can create events, register attendees, search guest lists, filter attendees by event, and delete event or attendee records without reloading the page.

## Features

- Create events with a name, date, venue, and attendee capacity.
- Homepage with separate **Manage events** and **Register attendees** workflows.
- Client-side view switching without a page reload or frontend framework.
- Display all events with registration counts such as `12 / 100`.
- Register attendees to a selected event.
- Ticket types: `General`, `VIP`, and `Student`.
- Search attendees by name.
- Filter attendees by event.
- Delete individual attendees.
- Delete events and automatically delete their attendees through a foreign-key cascade.
- Dynamic Fetch-based updates without page reloads.
- Frontend and server-side validation.
- Safe DOM rendering for user-entered content.

## Requirements

- Node.js 18 or newer
- npm

## Installation

From the project directory, run:

```powershell
npm install
```

## Start the application

```powershell
npm start
```

Then open:

```text
http://localhost:3000
```

The SQLite database is created automatically as `events.db` when the server first starts.

For development with Node's watch mode:

```powershell
npm run dev
```

If port `3000` is already in use, stop the existing Node server first or start the app on another port:

```powershell
$env:PORT=3001; npm start
```

## Project structure

```text
.
├── server.js
├── package.json
├── package-lock.json
├── events.db              # auto-created SQLite database
├── README.md
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## Database schema

The database contains a one-to-many relationship: one event can have many attendees, while each attendee belongs to one event.

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  venue TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('General', 'VIP', 'Student')),
  event_id INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE (event_id, email)
);
```

SQLite foreign keys are enabled on the database connection with:

```js
db.pragma('foreign_keys = ON');
```

## REST API

| Method | Route | Description | Success | Common errors |
| --- | --- | --- | --- | --- |
| `POST` | `/api/events` | Create an event | `201` | `400` invalid or missing fields |
| `GET` | `/api/events` | List events with attendee counts | `200` | None |
| `GET` | `/api/attendees` | List all attendees | `200` | None |
| `GET` | `/api/events/:id/attendees` | List attendees for one event | `200` | `404` event not found |
| `GET` | `/api/attendees/search?name=&eventId=` | Search and optionally filter attendees | `200` | Returns `[]` when no match exists |
| `POST` | `/api/events/:id/attendees` | Register an attendee for an event | `201` | `400`, `404`, or `409` |
| `DELETE` | `/api/attendees/:id` | Delete an attendee | `200` | `404` attendee not found |
| `DELETE` | `/api/events/:id` | Delete an event and its attendees | `200` | `404` event not found |

## Validation and error handling

The backend validates every registration and event request:

- Required fields cannot be empty.
- Email addresses must match the expected email format.
- Ticket type must be `General`, `VIP`, or `Student`.
- An event must exist before an attendee can be registered.
- Registration is rejected with `409 Event is full` when capacity is reached.
- Email addresses are trimmed and normalized to lowercase.
- Duplicate email registration for the same event returns `409 Already registered for this event`.
- Parameterized SQL queries are used throughout the API.

The frontend repeats the basic checks for faster feedback, but the server remains the source of truth.

## API examples

Create an event:

```powershell
$event = @{ name = 'Design Meetup'; date = '2026-10-10'; venue = 'Studio A'; capacity = 50 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/events -ContentType 'application/json' -Body $event
```

Register an attendee:

```powershell
$attendee = @{ name = 'Jordan Lee'; email = 'jordan@example.com'; ticket_type = 'General' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/events/1/attendees -ContentType 'application/json' -Body $attendee
```

Search attendees:

```powershell
Invoke-RestMethod 'http://localhost:3000/api/attendees/search?name=Jordan'
```

## Tested edge cases

| Test | Expected result |
| --- | --- |
| Register with an empty name | `400` |
| Register with `abc@` as the email | `400` |
| Register the same email twice for one event | `409` |
| Register to event ID `9999` | `404` |
| Register when the event is at capacity | `409` |
| Search for a name that does not exist | `200` with `[]` |
| Delete attendee ID `9999` | `404` |
| Delete an event with attendees | Event and attendees are deleted through cascade |

## License

This project is intended for learning and demonstration purposes.
