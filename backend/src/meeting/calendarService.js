function buildIcsTimestamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildInterviewCalendarFile({ uid, method = 'REQUEST', sequence = 0, summary, description, location, startUtc, endUtc, organizer, attendees = [], status = 'CONFIRMED', url = null }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `METHOD:${method}`,
    'PRODID:-//Careeriz//Interview Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${buildIcsTimestamp(new Date())}`,
    `DTSTART:${buildIcsTimestamp(startUtc)}`,
    `DTEND:${buildIcsTimestamp(endUtc)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    `STATUS:${status}`,
    organizer?.email ? `ORGANIZER;CN=${escapeIcs(organizer.name || organizer.email)}:mailto:${organizer.email}` : null,
    url ? `URL:${escapeIcs(url)}` : null,
    ...attendees.map((attendee) => (
      `ATTENDEE;CN=${escapeIcs(attendee.name || attendee.email)};ROLE=${attendee.role || 'REQ-PARTICIPANT'};PARTSTAT=${attendee.partstat || 'NEEDS-ACTION'}:mailto:${attendee.email}`
    )),
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}
