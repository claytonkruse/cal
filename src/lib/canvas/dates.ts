import { CalendarDate, fromDate, getDayOfWeek, getLocalTimeZone, parseDate, today } from '@internationalized/date';
import type { FeedItem } from './ics';

export const COURSE_COLORS = [
	'bg-course-1',
	'bg-course-2',
	'bg-course-3',
	'bg-course-4',
	'bg-course-5',
	'bg-course-6',
	'bg-course-7',
	'bg-course-8'
] as const;

const COURSE_BORDERS = [
	'border-course-1',
	'border-course-2',
	'border-course-3',
	'border-course-4',
	'border-course-5',
	'border-course-6',
	'border-course-7',
	'border-course-8'
] as const;

const COURSE_FILLS = [
	'bg-course-1/20',
	'bg-course-2/20',
	'bg-course-3/20',
	'bg-course-4/20',
	'bg-course-5/20',
	'bg-course-6/20',
	'bg-course-7/20',
	'bg-course-8/20'
] as const;

const COURSE_TEXT = [
	'text-course-1',
	'text-course-2',
	'text-course-3',
	'text-course-4',
	'text-course-5',
	'text-course-6',
	'text-course-7',
	'text-course-8'
] as const;

function courseIndex(name: string): number {
	let hash = 0;
	for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return hash % COURSE_COLORS.length;
}

export function courseColor(name: string): (typeof COURSE_COLORS)[number] {
	return COURSE_COLORS[courseIndex(name)];
}

export function courseBorder(name: string): (typeof COURSE_BORDERS)[number] {
	return COURSE_BORDERS[courseIndex(name)];
}

export function courseFill(name: string): (typeof COURSE_FILLS)[number] {
	return COURSE_FILLS[courseIndex(name)];
}

export function courseText(name: string): (typeof COURSE_TEXT)[number] {
	return COURSE_TEXT[courseIndex(name)];
}

export function eventDateKey(event: FeedItem, timeZone = getLocalTimeZone()): string {
	if (event.allDay && event.date) return event.date;
	const zoned = fromDate(new Date(event.start), timeZone);
	return new CalendarDate(zoned.year, zoned.month, zoned.day).toString();
}

export type DisplayMoves = {
	weekend: boolean;
	early: boolean;
};

export const defaultDisplayMoves: DisplayMoves = {
	weekend: true,
	early: true
};

export type AssignmentPlacement = {
	key: string;
	weekendNote: boolean;
	earlyNote: boolean;
	fridayNote: boolean;
	earlyApplied: boolean;
	todayNote: boolean;
};

function isWeekendDay(date: CalendarDate): boolean {
	const weekday = getDayOfWeek(date, 'en-US');
	return weekday === 0 || weekday === 6;
}

function shiftOffWeekend(date: CalendarDate): CalendarDate {
	const weekday = getDayOfWeek(date, 'en-US');
	if (weekday === 6) return date.subtract({ days: 1 });
	if (weekday === 0) return date.subtract({ days: 2 });
	return date;
}

export function isEarlyDue(event: FeedItem, timeZone = getLocalTimeZone()): boolean {
	return event.kind === 'assignment' && !event.allDay && !isEndOfDay(event.start, timeZone);
}

function blankPlacement(key: string): AssignmentPlacement {
	return {
		key,
		weekendNote: false,
		earlyNote: false,
		fridayNote: false,
		earlyApplied: false,
		todayNote: false
	};
}

function movedAssignmentDate(
	actual: CalendarDate,
	event: FeedItem,
	timeZone: string,
	moves: DisplayMoves
): { date: CalendarDate; earlyApplied: boolean; weekendNote: boolean; fridayNote: boolean } {
	let date = actual;
	let earlyApplied = false;
	if (moves.early && isEarlyDue(event, timeZone)) {
		date = date.subtract({ days: 1 });
		earlyApplied = true;
	}

	let weekendNote = false;
	let fridayNote = false;
	if (moves.weekend && isWeekendDay(date)) {
		date = shiftOffWeekend(date);
		if (isWeekendDay(actual)) weekendNote = true;
		else fridayNote = true;
	}

	return { date, earlyApplied, weekendNote, fridayNote };
}

export function assignmentPlacement(
	event: FeedItem,
	timeZone = getLocalTimeZone(),
	moves: DisplayMoves = defaultDisplayMoves,
	asOf: CalendarDate = today(timeZone)
): AssignmentPlacement {
	const actualKey = eventDateKey(event, timeZone);
	if (event.kind !== 'assignment') return blankPlacement(actualKey);

	const todayKey = asOf.toString();
	if (actualKey <= todayKey) return blankPlacement(actualKey);

	const actual = parseDate(actualKey);
	const moved = movedAssignmentDate(actual, event, timeZone, moves);
	const movedKey = moved.date.toString();
	if (movedKey < todayKey) return { ...blankPlacement(todayKey), todayNote: true };

	return {
		key: movedKey,
		weekendNote: moved.weekendNote,
		earlyNote: moved.earlyApplied && movedKey === actual.subtract({ days: 1 }).toString(),
		fridayNote: moved.fridayNote,
		earlyApplied: moved.earlyApplied,
		todayNote: false
	};
}

export function displayDateKey(
	event: FeedItem,
	timeZone = getLocalTimeZone(),
	moves: DisplayMoves = defaultDisplayMoves,
	asOf: CalendarDate = today(timeZone)
): string {
	return assignmentPlacement(event, timeZone, moves, asOf).key;
}

export function moveNote(placement: AssignmentPlacement): string | null {
	if (placement.todayNote) {
		return 'Shown on today because its usual day has passed, and this assignment is not due yet.';
	}
	if (placement.fridayNote) {
		if (placement.earlyApplied) {
			return 'Shown on the previous Friday because this assignment is due before 11:59 PM, and assignments are not shown on the weekend.';
		}
		return 'Shown on the previous Friday because assignments are not shown on the weekend.';
	}
	if (placement.weekendNote) {
		return 'Shown on the Friday before because this assignment is due on the weekend.';
	}
	if (placement.earlyNote) {
		return 'Shown on the day before because this assignment is due before 11:59 PM.';
	}
	return null;
}

export function isWeekendDue(
	event: FeedItem,
	timeZone = getLocalTimeZone(),
	moves: DisplayMoves = defaultDisplayMoves,
	asOf: CalendarDate = today(timeZone)
): boolean {
	return assignmentPlacement(event, timeZone, moves, asOf).weekendNote;
}

export function isEarlyShift(
	event: FeedItem,
	timeZone = getLocalTimeZone(),
	moves: DisplayMoves = defaultDisplayMoves,
	asOf: CalendarDate = today(timeZone)
): boolean {
	return assignmentPlacement(event, timeZone, moves, asOf).earlyNote;
}

export function eventDayLabel(event: FeedItem, timeZone = getLocalTimeZone()): string {
	const date = parseDate(eventDateKey(event, timeZone));
	return new Intl.DateTimeFormat(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	}).format(date.toDate('UTC'));
}

function clockTime(iso: string, timeZone: string): string {
	return new Intl.DateTimeFormat(undefined, {
		timeZone,
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(iso));
}

function isEndOfDay(iso: string, timeZone: string): boolean {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour: 'numeric',
		minute: 'numeric',
		hourCycle: 'h23'
	}).formatToParts(new Date(iso));
	const hour = Number(parts.find((part) => part.type === 'hour')?.value);
	const minute = Number(parts.find((part) => part.type === 'minute')?.value);
	return hour === 23 && minute >= 59;
}

export function eventClockLabel(event: FeedItem, timeZone = getLocalTimeZone()): string | null {
	if (event.allDay) return event.kind === 'event' ? 'All day' : null;
	if (event.kind === 'event' && event.end && event.end !== event.start) {
		return `${clockTime(event.start, timeZone)} – ${clockTime(event.end, timeZone)}`;
	}
	return clockTime(event.start, timeZone);
}

export function actualDueLabel(event: FeedItem, timeZone = getLocalTimeZone()): string {
	const day = eventDayLabel(event, timeZone);
	const clock = eventClockLabel(event, timeZone);
	return clock ? `${day}, ${clock}` : day;
}

export function eventWhenLabel(event: FeedItem, timeZone = getLocalTimeZone()): string {
	if (event.kind === 'assignment') {
		if (event.allDay) return '11:59 PM';
		return clockTime(event.start, timeZone);
	}
	if (event.allDay) return 'All day';
	if (event.end && event.end !== event.start) {
		return `${clockTime(event.start, timeZone)} – ${clockTime(event.end, timeZone)}`;
	}
	return clockTime(event.start, timeZone);
}
