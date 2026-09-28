import type { Handle } from '@sveltejs/kit';
import { description } from '$lib/site';

function attribute(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.url.origin;
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replaceAll('__OG_ORIGIN__', origin).replaceAll('__SITE_DESCRIPTION__', attribute(description))
	});
};
