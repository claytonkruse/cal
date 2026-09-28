import { parseDate } from '@internationalized/date';
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
	assignmentPlacement,
	defaultDisplayMoves,
	displayDateKey,
	eventDateKey,
	eventWhenLabel,
	isEarlyShift,
	isWeekendDue
} from './dates';
import { assertCanvasFeedUrl, isPublicAddress } from './feed-url';
import { FIXTURE_ICS } from './fixture';
import { parseFeed } from './ics';

describe('parseFeed', () => {
	const items = parseFeed(FIXTURE_ICS);
	const during = parseDate('2026-09-01');

	it('marks assignment due dates separately from course events', () => {
		const essay = items.find((item) => item.title === 'Essay');
		const lab = items.find((item) => item.title === 'Lab');
		assert.equal(essay?.kind, 'assignment');
		assert.equal(essay?.course, 'Biology 101');
		assert.equal(essay?.url, 'https://school.instructure.com/courses/1/assignments/42');
		assert.equal(lab?.kind, 'event');
		assert.equal(lab?.course, 'Chemistry');
	});

	it('keeps the course name and the rest of the description', () => {
		const items = parseFeed(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-assignment-7
DTSTART:20260921T220000Z
SUMMARY:HW2
DESCRIPTION:Biology 101\\nWorth 20 points.\\nSubmit a PDF.
LOCATION:Science Hall
URL:https://school.instructure.com/courses/1/assignments/7
END:VEVENT
END:VCALENDAR`);
		const homework = items[0];
		assert.equal(homework?.course, 'Biology 101');
		assert.equal(homework?.details, 'Worth 20 points.\nSubmit a PDF.');
		assert.equal(homework?.location, 'Science Hall');
	});

	it('reads the course from the title and keeps the description as details', () => {
		const items = parseFeed(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:event-assignment-2
DTSTART:20260927T045900Z
SUMMARY:Assignment_2 [CMP_SC-4450-01-58527-2026FS-PRINCIPLES OF PROG LANG]
DESCRIPTION:Please check all four attached files carefully before starting the assignment.\\n[HW_02_Instructions.pdf](https://school.instructure.com/files/1)
URL:https://school.instructure.com/courses/1/assignments/2
END:VEVENT
END:VCALENDAR`);
		const homework = items[0];
		assert.equal(homework?.title, 'Assignment_2');
		assert.equal(homework?.course, 'CMP_SC 4450: Principles of Prog Lang');
		assert.equal(
			homework?.details,
			'Please check all four attached files carefully before starting the assignment.\n[HW_02_Instructions.pdf](https://school.instructure.com/files/1)'
		);
	});

	it('keeps a date-only assignment on its calendar date', () => {
		const quiz = items.find((item) => item.title === 'Reading quiz');
		assert.equal(quiz?.kind, 'assignment');
		assert.equal(quiz?.allDay, true);
		assert.equal(quiz?.date, '2026-09-15');
		assert.equal(eventDateKey(quiz!, 'America/Chicago'), '2026-09-15');
		assert.equal(eventWhenLabel(quiz!, 'America/Chicago'), '11:59 PM');
	});

	it('buckets a 11:59pm due date in the viewer timezone', () => {
		const essay = items.find((item) => item.title === 'Essay')!;
		assert.equal(eventDateKey(essay, 'America/Chicago'), '2026-09-26');
		assert.equal(eventWhenLabel(essay, 'America/Chicago'), '11:59 PM');
		assert.equal(eventDateKey(essay, 'UTC'), '2026-09-27');
	});

	it('shows weekend assignments on the Friday before', () => {
		const essay = items.find((item) => item.title === 'Essay')!;
		const quiz = items.find((item) => item.title === 'Reading quiz')!;
		const lab = items.find((item) => item.title === 'Lab')!;
		assert.equal(displayDateKey(essay, 'America/Chicago', defaultDisplayMoves, during), '2026-09-25');
		assert.equal(isWeekendDue(essay, 'America/Chicago', defaultDisplayMoves, during), true);
		assert.equal(displayDateKey(essay, 'UTC', defaultDisplayMoves, during), '2026-09-25');
		assert.equal(displayDateKey(quiz, 'America/Chicago', defaultDisplayMoves, during), '2026-09-15');
		assert.equal(isWeekendDue(quiz, 'America/Chicago', defaultDisplayMoves, during), false);
		assert.equal(displayDateKey(lab, 'America/Chicago', defaultDisplayMoves, during), eventDateKey(lab, 'America/Chicago'));

		const sunday: typeof essay = {
			...essay,
			id: 'sunday',
			title: 'Sunday paper',
			allDay: true,
			date: '2026-09-27',
			start: '2026-09-27T00:00:00.000Z'
		};
		assert.equal(displayDateKey(sunday, 'America/Chicago', defaultDisplayMoves, during), '2026-09-25');

		const saturdayLab: typeof lab = {
			...lab,
			allDay: true,
			date: '2026-09-26',
			start: '2026-09-26T00:00:00.000Z'
		};
		assert.equal(displayDateKey(saturdayLab, 'America/Chicago', defaultDisplayMoves, during), '2026-09-26');
	});

	it('shows assignments due before 11:59pm on the previous day', () => {
		const essay = items.find((item) => item.title === 'Essay')!;
		const afternoon: typeof essay = {
			...essay,
			id: 'afternoon',
			title: 'Problem set',
			allDay: false,
			date: null,
			start: '2026-09-16T22:00:00.000Z'
		};
		assert.equal(eventDateKey(afternoon, 'America/Chicago'), '2026-09-16');
		assert.equal(displayDateKey(afternoon, 'America/Chicago', defaultDisplayMoves, during), '2026-09-15');
		assert.equal(isEarlyShift(afternoon, 'America/Chicago', defaultDisplayMoves, during), true);
		assert.equal(isWeekendDue(afternoon, 'America/Chicago', defaultDisplayMoves, during), false);
		assert.equal(eventWhenLabel(afternoon, 'America/Chicago'), '5:00 PM');

		const justBefore: typeof essay = {
			...afternoon,
			id: 'just-before',
			start: '2026-09-16T04:58:00.000Z'
		};
		assert.equal(eventDateKey(justBefore, 'America/Chicago'), '2026-09-15');
		assert.equal(displayDateKey(justBefore, 'America/Chicago', defaultDisplayMoves, during), '2026-09-14');

		const endOfTuesday: typeof essay = {
			...afternoon,
			id: 'end-of-day',
			start: '2026-09-16T04:59:00.000Z'
		};
		assert.equal(eventDateKey(endOfTuesday, 'America/Chicago'), '2026-09-15');
		assert.equal(displayDateKey(endOfTuesday, 'America/Chicago', defaultDisplayMoves, during), '2026-09-15');
		assert.equal(isEarlyShift(endOfTuesday, 'America/Chicago', defaultDisplayMoves, during), false);

		const mondayAfternoon: typeof essay = {
			...afternoon,
			id: 'monday-afternoon',
			start: '2026-09-14T22:00:00.000Z'
		};
		assert.equal(eventDateKey(mondayAfternoon, 'America/Chicago'), '2026-09-14');
		assert.equal(displayDateKey(mondayAfternoon, 'America/Chicago', defaultDisplayMoves, during), '2026-09-11');
		assert.equal(isEarlyShift(mondayAfternoon, 'America/Chicago', defaultDisplayMoves, during), false);
		assert.equal(
			displayDateKey(mondayAfternoon, 'America/Chicago', { weekend: false, early: true }, during),
			'2026-09-13'
		);
		assert.equal(
			displayDateKey(mondayAfternoon, 'America/Chicago', { weekend: true, early: false }, during),
			'2026-09-14'
		);

		const sundayAfternoon: typeof essay = {
			...afternoon,
			id: 'sunday-afternoon',
			start: '2026-09-27T20:00:00.000Z'
		};
		assert.equal(eventDateKey(sundayAfternoon, 'America/Chicago'), '2026-09-27');
		assert.equal(displayDateKey(sundayAfternoon, 'America/Chicago', defaultDisplayMoves, during), '2026-09-25');
		assert.equal(isWeekendDue(sundayAfternoon, 'America/Chicago', defaultDisplayMoves, during), true);
		assert.equal(isEarlyShift(sundayAfternoon, 'America/Chicago', defaultDisplayMoves, during), false);
	});

	it('leaves assignments due today or earlier on their real day', () => {
		const essay = items.find((item) => item.title === 'Essay')!;
		const dueToday = parseDate('2026-09-26');
		assert.equal(displayDateKey(essay, 'America/Chicago', defaultDisplayMoves, dueToday), '2026-09-26');
		assert.equal(isWeekendDue(essay, 'America/Chicago', defaultDisplayMoves, dueToday), false);

		const after = parseDate('2026-09-27');
		assert.equal(displayDateKey(essay, 'America/Chicago', defaultDisplayMoves, after), '2026-09-26');
		assert.equal(isWeekendDue(essay, 'America/Chicago', defaultDisplayMoves, after), false);

		const afternoon: typeof essay = {
			...essay,
			id: 'afternoon',
			allDay: false,
			date: null,
			start: '2026-09-16T22:00:00.000Z'
		};
		assert.equal(displayDateKey(afternoon, 'America/Chicago', defaultDisplayMoves, after), '2026-09-16');
		assert.equal(isEarlyShift(afternoon, 'America/Chicago', defaultDisplayMoves, after), false);
	});

	it('keeps an assignment on today after its display day until the real due date passes', () => {
		const essay = items.find((item) => item.title === 'Essay')!;
		const homework: typeof essay = {
			...essay,
			id: 'hw2',
			title: 'HW2',
			allDay: false,
			date: null,
			start: '2026-09-21T22:00:00.000Z'
		};
		assert.equal(eventDateKey(homework, 'America/Chicago'), '2026-09-21');
		assert.equal(displayDateKey(homework, 'America/Chicago', defaultDisplayMoves, during), '2026-09-18');

		const onDisplayDay = parseDate('2026-09-18');
		assert.equal(displayDateKey(homework, 'America/Chicago', defaultDisplayMoves, onDisplayDay), '2026-09-18');
		assert.equal(assignmentPlacement(homework, 'America/Chicago', defaultDisplayMoves, onDisplayDay).todayNote, false);

		const sunday = parseDate('2026-09-20');
		const held = assignmentPlacement(homework, 'America/Chicago', defaultDisplayMoves, sunday);
		assert.equal(held.key, '2026-09-20');
		assert.equal(held.todayNote, true);
		assert.equal(held.fridayNote, false);
		assert.equal(held.weekendNote, false);
		assert.equal(held.earlyNote, false);

		const dueDay = parseDate('2026-09-21');
		assert.equal(displayDateKey(homework, 'America/Chicago', defaultDisplayMoves, dueDay), '2026-09-21');
		assert.equal(assignmentPlacement(homework, 'America/Chicago', defaultDisplayMoves, dueDay).todayNote, false);

		const afterDue = parseDate('2026-09-22');
		assert.equal(displayDateKey(homework, 'America/Chicago', defaultDisplayMoves, afterDue), '2026-09-21');
	});
});

describe('assertCanvasFeedUrl', () => {
	it('accepts a Canvas calendar feed URL', () => {
		const url = assertCanvasFeedUrl(
			'https://school.instructure.com/feeds/calendars/user_123~abc.ics'
		);
		assert.equal(url.hostname, 'school.instructure.com');
		assert.equal(url.pathname, '/feeds/calendars/user_123~abc.ics');
	});

	it('rejects links that are not a calendar feed', () => {
		assert.throws(
			() => assertCanvasFeedUrl('http://school.instructure.com/feeds/calendars/user.ics'),
			/HTTPS/
		);
		assert.throws(
			() => assertCanvasFeedUrl('https://school.instructure.com/calendar.ics'),
			/Calendar Feed/
		);
		assert.throws(
			() => assertCanvasFeedUrl('https://127.0.0.1/feeds/calendars/user.ics'),
			/not a Canvas calendar feed/
		);
		assert.throws(
			() => assertCanvasFeedUrl('https://user:pass@school.instructure.com/feeds/calendars/user.ics'),
			/username or password/
		);
	});
});

describe('isPublicAddress', () => {
	it('rejects loopback, private, and link-local addresses', () => {
		assert.equal(isPublicAddress('8.8.8.8'), true);
		assert.equal(isPublicAddress('127.0.0.1'), false);
		assert.equal(isPublicAddress('10.1.2.3'), false);
		assert.equal(isPublicAddress('192.168.1.8'), false);
		assert.equal(isPublicAddress('169.254.169.254'), false);
		assert.equal(isPublicAddress('::1'), false);
		assert.equal(isPublicAddress('::ffff:127.0.0.1'), false);
	});
});
