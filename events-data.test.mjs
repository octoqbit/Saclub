import test from 'node:test';
import assert from 'node:assert/strict';
import { events, eventStatus, filterEvents, nextEvent, daysUntil, calendarFile } from './events-data.mjs';

test('upcoming, current, and archived listings switch on the correct day', () => {
  const event = events[0];
  assert.equal(eventStatus(event, '2026-12-04'), 'Upcoming');
  assert.equal(eventStatus(event, '2026-12-05'), 'Happening now');
  assert.equal(eventStatus(event, '2026-12-07'), 'Happening now');
  assert.equal(eventStatus(event, '2026-12-08'), 'Past');
});
test('filters combine with case-insensitive topic and venue searches', () => {
  assert.equal(filterEvents(events, 'all', '', '2026-10-04').length, 3);
  assert.equal(filterEvents(events, 'upcoming', '', '2026-10-04').length, 2);
  assert.equal(filterEvents(events, 'past', '', '2026-10-04').length, 1);
  assert.equal(filterEvents(events, 'all', '  ROBOTICS  ', '2026-10-04')[0].id, 'robowars');
  assert.equal(filterEvents(events, 'all', 'auditorium', '2026-10-04')[0].id, 'iot-summit');
  assert.equal(filterEvents(events, 'past', 'hackathon', '2026-10-04').length, 0);
  assert.equal(filterEvents(events, 'all', 'no-such-event', '2026-10-04').length, 0);
});
test('radar finds nearest event without mutating the card order and handles an empty future', () => {
  const before = events.map(e => e.id);
  assert.equal(nextEvent(events, '2026-10-04').id, 'robowars');
  assert.equal(nextEvent(events, '2026-11-16').id, 'genesis');
  assert.equal(nextEvent(events, '2026-12-06').id, 'genesis');
  assert.equal(nextEvent(events, '2027-01-01'), null);
  assert.equal(daysUntil(events[1], '2026-10-04'), 42);
  assert.equal(daysUntil(events[0], '2026-12-06'), 0);
  assert.deepEqual(events.map(e => e.id), before);
});
test('calendar exports cover every listed day with an exclusive end date', () => {
  const output = calendarFile(events[0], new Date('2026-10-04T12:00:00Z'));
  assert.match(output, /DTSTART;VALUE=DATE:20261205\r\n/);
  assert.match(output, /DTEND;VALUE=DATE:20261208\r\n/);
  assert.match(output, /DTSTAMP:20261004T120000Z\r\n/);
  assert.match(calendarFile(events[1]), /DTEND;VALUE=DATE:20261116/);
  assert(output.endsWith('END:VCALENDAR\r\n'));
});
test('calendar text escapes delimiters and folds unicode safely', () => {
  const event = { ...events[0], title: 'A, B; C\\D\nNext', description: '🤖 '.repeat(90) };
  const output = calendarFile(event);
  const lines = output.split('\r\n');
  for (const line of lines) assert(Buffer.byteLength(line, 'utf8') <= 75);
  const unfolded = output.replace(/\r\n /g, '');
  assert(unfolded.includes('SUMMARY:A\\, B\\; C\\\\D\\nNext'));
  assert(unfolded.includes('DESCRIPTION:' + event.description));
});
