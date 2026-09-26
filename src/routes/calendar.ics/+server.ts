import { dev } from '$app/environment';
import { today, parseDate } from '@internationalized/date';
import { readCanvasFeed } from '$lib/canvas/canvas-feed-param';
import { fetchCanvasFeed } from '$lib/canvas/fetch-feed';
import { FeedUrlError } from '$lib/canvas/feed-url';
import { FIXTURE_ICS } from '$lib/canvas/fixture';
import { buildAdjustedCalendar } from '$lib/canvas/ical';
import { parseFeed } from '$lib/canvas/ics';
import type { RequestHandler } from './$types';

function timeZoneFrom(raw: string | null): string {
	if (!raw) return 'UTC';
	try {
		Intl.DateTimeFormat(undefined, { timeZone: raw });
		return raw;
	} catch {
		return 'UTC';
	}
}

function plain(message: string, status: number): Response {
	return new Response(message, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}

export const GET: RequestHandler = async ({ url }) => {
	const timeZone = timeZoneFrom(url.searchParams.get('tz'));
	const moves = {
		weekend: url.searchParams.get('weekend') !== '0',
		early: url.searchParams.get('early') !== '0'
	};
	let asOf = today(timeZone);
	const todayParam = url.searchParams.get('today');
	if (todayParam) {
		try {
			asOf = parseDate(todayParam);
		} catch {
			return plain('The today parameter is not a calendar date.', 400);
		}
	}

	let source: string;
	if (url.searchParams.get('fixture') === '1') {
		if (!dev) return plain('Not found', 404);
		source = FIXTURE_ICS;
	} else {
		const feed = readCanvasFeed(url.searchParams);
		if (!feed) return plain('Missing calendar feed.', 400);
		try {
			source = await fetchCanvasFeed(feed);
		} catch (err) {
			const message = err instanceof FeedUrlError ? err.message : 'Could not load that calendar feed.';
			return plain(message, 400);
		}
	}

	const body = buildAdjustedCalendar(parseFeed(source), timeZone, moves, asOf);
	return new Response(body, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'inline; filename="calendar.ics"',
			'cache-control': 'no-store'
		}
	});
};
