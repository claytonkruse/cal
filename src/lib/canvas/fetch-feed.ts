import { assertCanvasFeedUrl, assertPublicFeedHost, FeedUrlError } from './feed-url';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

async function readLimited(response: Response): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) throw new FeedUrlError('The calendar feed was empty.');

	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		total += value.byteLength;
		if (total > MAX_BYTES) {
			await reader.cancel();
			throw new FeedUrlError('That calendar feed is too large.');
		}
		chunks.push(value);
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(body);
}

export async function fetchCanvasFeed(raw: string): Promise<string> {
	let current = assertCanvasFeedUrl(raw);

	try {
		for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
			await assertPublicFeedHost(current);
			const response = await fetch(current, {
				redirect: 'manual',
				signal: AbortSignal.timeout(TIMEOUT_MS),
				headers: {
					accept: 'text/calendar, text/plain;q=0.9, */*;q=0.1',
					'user-agent': 'canvas-calendar'
				}
			});

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('location');
				if (!location || hop === MAX_REDIRECTS) {
					throw new FeedUrlError('The calendar feed redirected too many times.');
				}
				current = assertCanvasFeedUrl(new URL(location, current).toString());
				continue;
			}

			if (!response.ok) {
				throw new FeedUrlError(
					'Canvas did not return that calendar feed. Check the link and try again.'
				);
			}

			return await readLimited(response);
		}
	} catch (error) {
		if (error instanceof FeedUrlError) throw error;
		if (
			error instanceof Error &&
			(error.name === 'TimeoutError' || error.name === 'AbortError')
		) {
			throw new FeedUrlError('The calendar feed took too long to respond.');
		}
		throw new FeedUrlError('Could not load that calendar feed. Check the link and try again.');
	}

	throw new FeedUrlError('The calendar feed redirected too many times.');
}
