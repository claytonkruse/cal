import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { displayDateKey, eventDateKey, eventWhenLabel, isEarlyShift, isWeekendDue } from './dates';
import { assertCanvasFeedUrl, isPublicAddress } from './feed-url';
import { FIXTURE_ICS } from './fixture';
import { parseFeed } from './ics';

describe('parseFeed', () => {
	const items = parseFeed(FIXTURE_ICS);

	it('marks assignment due dates separately from course events', () => {
		const essay = items.find((item) => item.title === 'Essay');
		const lab = items.find((item) => item.title === 'Lab');
		assert.equal(essay?.kind, 'assignment');
		assert.equal(essay?.course, 'Biology 101');
		assert.equal(essay?.url, 'https://school.instructure.com/courses/1/assignments/42');
		assert.equal(lab?.kind, 'event');
		assert.equal(lab?.course, 'Chemistry');
	});

	it('keeps a date-only assignment on its calendar date', () => {
		const quiz = items.find((item) => item.title === 'Reading quiz');
		assert.equal(quiz?.kind, 'assignment');
		assert.equal(quiz?.allDay, true);
		assert.equal(quiz?.date, '2026-09-15');
		assert.equal(eventDateKey(quiz!, 'America/Chicago'), '2026-09-15');
		assert.equal(eventWhenLabel(quiz!, 'America/Chicago'), 'Due');
	});

	it('buckets a 11:59pm due date in the viewer timezone', () => {
		const essay = items.find((item) => item.title === 'Essay')!;
		assert.equal(eventDateKey(essay, 'America/Chicago'), '2026-09-26');
		assert.equal(eventWhenLabel(essay, 'America/Chicago'), 'Due');
		assert.equal(eventDateKey(essay, 'UTC'), '2026-09-27');
	});

	it('shows weekend assignments on the Friday before', () => {
		const essay = items.find((item) => item.title === 'Essay')!;
		const quiz = items.find((item) => item.title === 'Reading quiz')!;
		const lab = items.find((item) => item.title === 'Lab')!;
		assert.equal(displayDateKey(essay, 'America/Chicago'), '2026-09-25');
		assert.equal(isWeekendDue(essay, 'America/Chicago'), true);
		assert.equal(displayDateKey(essay, 'UTC'), '2026-09-25');
		assert.equal(displayDateKey(quiz, 'America/Chicago'), '2026-09-15');
		assert.equal(isWeekendDue(quiz, 'America/Chicago'), false);
		assert.equal(displayDateKey(lab, 'America/Chicago'), eventDateKey(lab, 'America/Chicago'));

		const sunday: typeof essay = {
			...essay,
			id: 'sunday',
			title: 'Sunday paper',
			allDay: true,
			date: '2026-09-27',
			start: '2026-09-27T00:00:00.000Z'
		};
		assert.equal(displayDateKey(sunday, 'America/Chicago'), '2026-09-25');

		const saturdayLab: typeof lab = {
			...lab,
			allDay: true,
			date: '2026-09-26',
			start: '2026-09-26T00:00:00.000Z'
		};
		assert.equal(displayDateKey(saturdayLab, 'America/Chicago'), '2026-09-26');
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
		assert.equal(displayDateKey(afternoon, 'America/Chicago'), '2026-09-15');
		assert.equal(isEarlyShift(afternoon, 'America/Chicago'), true);
		assert.equal(isWeekendDue(afternoon, 'America/Chicago'), false);
		assert.equal(eventWhenLabel(afternoon, 'America/Chicago'), '5:00 PM');

		const justBefore: typeof essay = {
			...afternoon,
			id: 'just-before',
			start: '2026-09-16T04:58:00.000Z'
		};
		assert.equal(eventDateKey(justBefore, 'America/Chicago'), '2026-09-15');
		assert.equal(displayDateKey(justBefore, 'America/Chicago'), '2026-09-14');

		const endOfTuesday: typeof essay = {
			...afternoon,
			id: 'end-of-day',
			start: '2026-09-16T04:59:00.000Z'
		};
		assert.equal(eventDateKey(endOfTuesday, 'America/Chicago'), '2026-09-15');
		assert.equal(displayDateKey(endOfTuesday, 'America/Chicago'), '2026-09-15');
		assert.equal(isEarlyShift(endOfTuesday, 'America/Chicago'), false);

		const mondayAfternoon: typeof essay = {
			...afternoon,
			id: 'monday-afternoon',
			start: '2026-09-14T22:00:00.000Z'
		};
		assert.equal(eventDateKey(mondayAfternoon, 'America/Chicago'), '2026-09-14');
		assert.equal(displayDateKey(mondayAfternoon, 'America/Chicago'), '2026-09-11');
		assert.equal(isEarlyShift(mondayAfternoon, 'America/Chicago'), false);
		assert.equal(
			displayDateKey(mondayAfternoon, 'America/Chicago', {
				weekend: false,
				early: true
			}),
			'2026-09-13'
		);
		assert.equal(
			displayDateKey(mondayAfternoon, 'America/Chicago', {
				weekend: true,
				early: false
			}),
			'2026-09-14'
		);

		const sundayAfternoon: typeof essay = {
			...afternoon,
			id: 'sunday-afternoon',
			start: '2026-09-27T20:00:00.000Z'
		};
		assert.equal(eventDateKey(sundayAfternoon, 'America/Chicago'), '2026-09-27');
		assert.equal(displayDateKey(sundayAfternoon, 'America/Chicago'), '2026-09-25');
		assert.equal(isWeekendDue(sundayAfternoon, 'America/Chicago'), true);
		assert.equal(isEarlyShift(sundayAfternoon, 'America/Chicago'), false);
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
