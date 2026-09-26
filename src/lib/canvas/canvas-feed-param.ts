export const canvasFeedParam = 'canvasFeed';

export function readCanvasFeed(params: URLSearchParams): string | null {
	const feed = params.get(canvasFeedParam)?.trim();
	return feed || null;
}
