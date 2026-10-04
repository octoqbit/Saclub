// Existing SAC event listings. Dates are all-day because event times were not supplied.
export const events = [
  { id: 'genesis', title: 'AI Hackathon: Genesis 2026', shortTitle: 'AI HACKATHON', subtitle: 'GENESIS 2026', startDate: '2026-12-05', endDate: '2026-12-07', date: 'Dec 05–07, 2026', location: 'Tech Innovation Hub', image: 'hackathon', description: '48 hours to build the next generation of autonomous intelligence.', tags: ['AI', 'Software', 'Hackathon'], accentColor: '#00e5ff', prizePool: '3,00,000', symbol: '01' },
  { id: 'robowars', title: 'RoboWars: Steel & Sparks', shortTitle: 'ROBOWARS', subtitle: 'STEEL & SPARKS', startDate: '2026-11-15', endDate: '2026-11-15', date: 'Nov 15, 2026', location: 'Main Arena', image: 'robotics', description: 'The ultimate combat robotics competition. Build, fight, survive. 30+ teams competing for glory.', tags: ['Hardware', 'Combat', 'Robotics'], accentColor: '#ffc107', prizePool: '6,00,000', symbol: '02' },
  { id: 'iot-summit', title: 'IoT Smart Home Summit', shortTitle: 'IoT SUMMIT', subtitle: 'SMART HOME EDITION', startDate: '2026-08-22', endDate: '2026-08-22', date: 'Aug 22, 2026', location: 'Auditorium B', image: 'iot', description: 'Showcasing student-built home automation systems and advanced smart sensors.', tags: ['IoT', 'Sensors', 'Showcase'], accentColor: '#ff4ca0', prizePool: '1,50,000', symbol: '03' },
];
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function eventStatus(event, day = localDay()) {
  if (event.endDate < day) return 'Past';
  return event.startDate <= day ? 'Happening now' : 'Upcoming';
}
export function filterEvents(list, filter, query, day = localDay()) {
  const needle = query.trim().toLowerCase();
  return list.filter(event => {
    const status = eventStatus(event, day);
    return (filter === 'all' || (filter === 'past' ? status === 'Past' : status !== 'Past'))
      && [event.title, event.location, ...event.tags].join(' ').toLowerCase().includes(needle);
  });
}
export function nextEvent(list, day = localDay()) {
  return list.filter(event => eventStatus(event, day) !== 'Past').sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
}
export function daysUntil(event, day = localDay()) {
  return Math.max(0, Math.round((Date.parse(event.startDate) - Date.parse(day)) / 86400000));
}
export function calendarFile(event, now = new Date()) {
  const escape = text => text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const end = new Date(`${event.endDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  const compact = date => date.replaceAll('-', '');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SAC//Event Board//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${event.id}-${event.startDate}@sac-events`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(event.startDate)}`, `DTEND;VALUE=DATE:${compact(end.toISOString().slice(0, 10))}`, `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(event.location)}`, `DESCRIPTION:${escape(event.description)}`, 'END:VEVENT', 'END:VCALENDAR'];
  // Fold long lines to the iCalendar 75-octet limit without breaking UTF-8 characters.
  return lines.map(line => {
    let output = '', width = 0;
    for (const char of line) {
      const size = new TextEncoder().encode(char).length;
      if (width + size > 75) { output += '\r\n '; width = 1; }
      output += char; width += size;
    }
    return output;
  }).join('\r\n') + '\r\n';
}
