const eventForm = document.querySelector('#eventForm');
const attendeeForm = document.querySelector('#attendeeForm');
const eventList = document.querySelector('#eventList');
const eventSelect = document.querySelector('#eventSelect');
const filterEvent = document.querySelector('#filterEvent');
const attendeeBody = document.querySelector('#attendeeBody');
const searchInput = document.querySelector('#searchInput');
const message = document.querySelector('#message');
const views = document.querySelectorAll('.view');
let messageTimer;

function showView(viewName) {
  views.forEach(view => { view.hidden = view.id !== `${viewName}View`; });
  if (viewName === 'attendees') loadAttendees().catch(error => showMessage(error.message, 'error'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMessage(text, type = 'success') {
  clearTimeout(messageTimer);
  message.textContent = text;
  message.className = `message show ${type}`;
  messageTimer = setTimeout(() => { message.className = 'message'; }, 4500);
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderEvents(events) {
  document.querySelector('#eventCount').textContent = events.length;
  eventSelect.replaceChildren(makeElement('option', 'Choose an event'));
  eventSelect.firstElementChild.value = '';
  filterEvent.replaceChildren(makeElement('option', 'All events'));
  filterEvent.firstElementChild.value = '';
  events.forEach(event => {
    const option = makeElement('option', event.name);
    option.value = event.id;
    eventSelect.append(option);
    const filterOption = makeElement('option', event.name);
    filterOption.value = event.id;
    filterEvent.append(filterOption);
  });

  eventList.replaceChildren();
  if (!events.length) {
    eventList.append(makeElement('p', 'Your next gathering will appear here.', 'empty-state'));
    return;
  }
  events.forEach(event => {
    const card = makeElement('article', undefined, 'event-card');
    const details = makeElement('div');
    details.append(makeElement('div', new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), 'event-date'));
    details.append(makeElement('div', event.name, 'event-name'));
    details.append(makeElement('div', event.venue, 'event-venue'));
    const capacity = makeElement('div', `${event.attendee_count} / ${event.capacity}`, 'capacity');
    const deleteButton = makeElement('button', 'Delete', 'delete-button');
    deleteButton.type = 'button';
    deleteButton.addEventListener('click', () => removeEvent(event.id));
    card.append(details, capacity, deleteButton);
    eventList.append(card);
  });
}

function renderAttendees(attendees) {
  attendeeBody.replaceChildren();
  if (!attendees.length) {
    const row = makeElement('tr');
    const cell = makeElement('td', 'No registrations match your search.');
    cell.colSpan = 5;
    cell.className = 'empty-state';
    row.append(cell);
    attendeeBody.append(row);
    return;
  }
  attendees.forEach(attendee => {
    const row = makeElement('tr');
    row.append(makeElement('td', attendee.name), makeElement('td', attendee.email));
    const ticketCell = makeElement('td');
    ticketCell.append(makeElement('span', attendee.ticket_type, 'ticket'));
    row.append(ticketCell, makeElement('td', attendee.event_name));
    const actionCell = makeElement('td');
    const deleteButton = makeElement('button', 'Delete', 'delete-button');
    deleteButton.type = 'button';
    deleteButton.addEventListener('click', () => removeAttendee(attendee.id));
    actionCell.append(deleteButton);
    row.append(actionCell);
    attendeeBody.append(row);
  });
}

async function loadEvents() {
  renderEvents(await request('/api/events'));
}

async function loadAttendees() {
  const params = new URLSearchParams({ name: searchInput.value });
  if (filterEvent.value) params.set('eventId', filterEvent.value);
  renderAttendees(await request(`/api/attendees/search?${params}`));
}

async function refresh() {
  await Promise.all([loadEvents(), loadAttendees()]);
}

async function removeAttendee(id) {
  try { await request(`/api/attendees/${id}`, { method: 'DELETE' }); showMessage('Attendee removed.'); await refresh(); }
  catch (error) { showMessage(error.message, 'error'); }
}

async function removeEvent(id) {
  if (!window.confirm('Delete this event and all of its attendee registrations?')) return;
  try { await request(`/api/events/${id}`, { method: 'DELETE' }); showMessage('Event deleted.'); await refresh(); }
  catch (error) { showMessage(error.message, 'error'); }
}

eventForm.addEventListener('submit', async event => {
  event.preventDefault();
  const formData = new FormData(eventForm);
  const payload = Object.fromEntries(formData);
  payload.capacity = Number(payload.capacity);
  if (!payload.name.trim() || !payload.date || !payload.venue.trim()) return showMessage('Complete all event fields.', 'error');
  try { await request('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); eventForm.reset(); eventForm.capacity.value = 100; showMessage('Event created.'); await refresh(); }
  catch (error) { showMessage(error.message, 'error'); }
});

attendeeForm.addEventListener('submit', async event => {
  event.preventDefault();
  const formData = new FormData(attendeeForm);
  const payload = Object.fromEntries(formData);
  if (!payload.name.trim() || !payload.email.trim() || !payload.ticket_type || !payload.event_id) return showMessage('Complete all registration fields.', 'error');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) return showMessage('Enter a valid email address.', 'error');
  try { await request(`/api/events/${payload.event_id}/attendees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); attendeeForm.reset(); showMessage('Attendee registered.'); await refresh(); }
  catch (error) { showMessage(error.message, 'error'); }
});

searchInput.addEventListener('input', loadAttendees);
filterEvent.addEventListener('change', loadAttendees);
document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.view));
});
refresh().catch(error => showMessage(error.message, 'error'));
