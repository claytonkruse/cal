import { parseDate } from '@internationalized/date';
import { describe, expect, it } from 'vitest';
import { defaultDisplayMoves } from './dates';
import { FIXTURE_ICS } from './fixture';
import { buildAdjustedCalendar } from './ical';
import { parseFeed } from './ics';

const timeZone = 'America/Chicago';

function eventBlock(ics: string, uid: string): string {
	const match = ics.match(new RegExp(`BEGIN:VEVENT\\r\\nUID:${uid}[\\s\\S]*?END:VEVENT`));
	if (!match) throw new Error(`missing ${uid}`);
	return match[0];
}

describe('adjusted iCal feed', () => {
	const events = parseFeed(FIXTURE_ICS);

	it('moves an end-of-day weekend assignment onto Friday', () => {
		const ics = buildAdjustedCalendar(events, timeZone, defaultDisplayMoves, parseDate('2026-09-01'));
		const essay = eventBlock(ics, 'event-assignment-42');
		expect(essay).toContain('DTSTART:20260926T045900Z');
		expect(essay).toContain('Actual due date: 2026-09-26');
	});

	it('keeps an assignment on today after its display day has passed', () => {
		const ics = buildAdjustedCalendar(events, timeZone, defaultDisplayMoves, parseDate('2026-09-20'));
		const homework = eventBlock(ics, 'event-assignment-80');
		expect(homework).toContain('DTSTART:20260920T220000Z');
		expect(homework).toContain('Actual due date: 2026-09-21');
	});

	it('leaves course events on their real times', () => {
		const ics = buildAdjustedCalendar(events, timeZone, defaultDisplayMoves, parseDate('2026-09-01'));
		expect(eventBlock(ics, 'event-calendar-7')).toContain('DTSTART:20260928T150000Z');
	});

	it('emits a moved assignment once, on its display date', () => {
		const ics = buildAdjustedCalendar(events, timeZone, defaultDisplayMoves, parseDate('2026-09-01'));
		expect(ics.match(/UID:event-assignment-80/g)).toHaveLength(1);
		expect(eventBlock(ics, 'event-assignment-80')).toContain('DTSTART:20260918T220000Z');
		expect(ics).not.toContain('DTSTART:20260921T220000Z');
		expect(ics.match(/UID:event-assignment-42/g)).toHaveLength(1);
		expect(ics).not.toContain('DTSTART:20260927T045900Z');
	});
});
