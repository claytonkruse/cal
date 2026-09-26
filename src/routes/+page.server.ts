import { dev } from '$app/environment';
import { readCanvasFeed } from '$lib/canvas/canvas-feed-param';
import { fetchCanvasFeed } from '$lib/canvas/fetch-feed';
import { FeedUrlError } from '$lib/canvas/feed-url';
import { FIXTURE_ICS } from '$lib/canvas/fixture';
import { parseFeed, type FeedItem } from '$lib/canvas/ics';
import type { PageServerLoad } from './$types';

export type CalendarPageData = {
	feed: string | null;
	events: FeedItem[];
	error: string | null;
	preview: boolean;
};

export const ssr = false;

export const load: PageServerLoad = async ({ url }): Promise<CalendarPageData> => {
	const feed = readCanvasFeed(url.searchParams);

	if (!feed) {
		if (dev && url.searchParams.get('fixture') === '1') {
			return { feed: null, events: parseFeed(FIXTURE_ICS), error: null, preview: true };
		}
		return { feed: null, events: [], error: null, preview: false };
	}

	try {
		const ics = await fetchCanvasFeed(feed);
		return { feed, events: parseFeed(ics), error: null, preview: false };
	} catch (error) {
		const message =
			error instanceof FeedUrlError
				? error.message
				: 'Could not load that calendar feed. Check the link and try again.';
		return { feed, events: [], error: message, preview: false };
	}
};
