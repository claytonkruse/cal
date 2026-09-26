import { describe, expect, it } from 'vitest';
import { readCanvasFeed } from './canvas-feed-param';

describe('canvas feed query param', () => {
	it('reads canvasFeed', () => {
		const params = new URLSearchParams('canvasFeed=https%3A%2F%2Fschool.example%2Fa.ics');
		expect(readCanvasFeed(params)).toBe('https://school.example/a.ics');
	});

	it('ignores the older feed param', () => {
		const params = new URLSearchParams('feed=https%3A%2F%2Fschool.example%2Fa.ics');
		expect(readCanvasFeed(params)).toBeNull();
	});
});
