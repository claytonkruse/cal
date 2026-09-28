import { fromDate, parseDate, type CalendarDate } from '@internationalized/date';
import { defaultDisplayMoves, displayDateKey, eventDateKey, type DisplayMoves } from './dates';
import type { FeedItem } from './ics';

function icsEscape(value: string): string {
	return value
		.replaceAll('\\', '\\\\')
		.replaceAll('\r\n', '\n')
		.replaceAll('\n', '\\n')
		.replaceAll(',', '\\,')
		.replaceAll(';', '\\;');
}

function fold(line: string): string {
	if (line.length <= 75) return line;
	let rest = line;
	let out = rest.slice(0, 75);
	rest = rest.slice(75);
	while (rest.length > 0) {
		out += `\r\n ${rest.slice(0, 74)}`;
		rest = rest.slice(74);
	}
	return out;
}

function prop(name: string, value: string): string {
	return fold(`${name}:${icsEscape(value)}`);
}

function compactDate(date: CalendarDate): string {
	const month = String(date.month).padStart(2, '0');
	const day = String(date.day).padStart(2, '0');
	return `${date.year}${month}${day}`;
}

function formatUtc(date: Date): string {
	return date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}

function dayShift(fromKey: string, toKey: string): number {
	const from = parseDate(fromKey).toDate('UTC').getTime();
	const to = parseDate(toKey).toDate('UTC').getTime();
	return Math.round((to - from) / 86_400_000);
}

function shiftInstant(iso: string, days: number, timeZone: string): Date {
	if (days === 0) return new Date(iso);
	return fromDate(new Date(iso), timeZone).add({ days }).toDate();
}

function allDaySpan(event: FeedItem): number {
	if (!event.allDay || !event.date || !event.end) return 1;
	const start = parseDate(event.date).toDate('UTC').getTime();
	const endDate = fromDate(new Date(event.end), 'UTC');
	const end = Date.UTC(endDate.year, endDate.month - 1, endDate.day);
	const days = Math.round((end - start) / 86_400_000);
	return Math.max(1, days);
}

function description(event: FeedItem, actualKey: string, shownKey: string): string {
	const lines: string[] = [];
	if (event.course) lines.push(event.course);
	if (event.details) lines.push(event.details);
	if (event.kind === 'assignment' && shownKey !== actualKey) {
		lines.push(`Actual due date: ${actualKey}`);
	}
	return lines.join('\n\n');
}

function eventLines(event: FeedItem, timeZone: string, moves: DisplayMoves, asOf: CalendarDate): string[] {
	const actualKey = eventDateKey(event, timeZone);
	const shownKey = displayDateKey(event, timeZone, moves, asOf);
	const lines = ['BEGIN:VEVENT', prop('UID', event.id), prop('SUMMARY', event.title)];

	if (event.allDay) {
		const start = parseDate(shownKey);
		const end = start.add({ days: allDaySpan(event) });
		lines.push(`DTSTART;VALUE=DATE:${compactDate(start)}`, `DTEND;VALUE=DATE:${compactDate(end)}`);
	} else {
		const days = dayShift(actualKey, shownKey);
		lines.push(`DTSTART:${formatUtc(shiftInstant(event.start, days, timeZone))}`);
		if (event.end) lines.push(`DTEND:${formatUtc(shiftInstant(event.end, days, timeZone))}`);
	}

	const body = description(event, actualKey, shownKey);
	if (body) lines.push(prop('DESCRIPTION', body));
	if (event.location && event.location !== event.url && !/^https?:\/\//.test(event.location)) {
		lines.push(prop('LOCATION', event.location));
	}
	if (event.url) lines.push(prop('URL', event.url));
	lines.push('END:VEVENT');
	return lines;
}

export function buildAdjustedCalendar(
	events: FeedItem[],
	timeZone: string,
	moves: DisplayMoves = defaultDisplayMoves,
	asOf: CalendarDate
): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Canvas Cal//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		prop('X-WR-CALNAME', 'Canvas Cal'),
		`X-WR-TIMEZONE:${timeZone}`
	];
	for (const event of events) lines.push(...eventLines(event, timeZone, moves, asOf));
	lines.push('END:VCALENDAR');
	return `${lines.join('\r\n')}\r\n`;
}
