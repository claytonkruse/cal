import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.url.origin;
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replaceAll('__OG_ORIGIN__', origin)
	});
};
