import { parseICS, type ParameterValue, type VEvent } from 'node-ical';

export type FeedItemKind = 'assignment' | 'event';

export type FeedItem = {
	id: string;
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	date: string | null;
	kind: FeedItemKind;
	url: string | null;
	course: string | null;
};

function textOf(value: ParameterValue | undefined): string {
	if (!value) return '';
	if (typeof value === 'string') return value;
	return value.val;
}

function courseFromDescription(description: ParameterValue | undefined): string | null {
	const raw = textOf(description).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
	const first = raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	if (!first || first.length > 80) return null;
	return first;
}

function dateOnlyKey(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function isAssignment(event: VEvent): boolean {
	const uid = event.uid.toLowerCase();
	const url = textOf(event.url as ParameterValue | undefined).toLowerCase();
	return uid.includes('assignment') || url.includes('/assignments/');
}

export function parseFeed(ics: string): FeedItem[] {
	const parsed = parseICS(ics);
	const items: FeedItem[] = [];

	for (const component of Object.values(parsed)) {
		if (!component || component.type !== 'VEVENT') continue;
		if (component.status === 'CANCELLED') continue;

		const allDay = component.datetype === 'date' || component.start.dateOnly === true;
		const start = component.start;
		const end = component.end ?? null;
		const title = textOf(component.summary).trim() || 'Untitled';
		const url = textOf(component.url as ParameterValue | undefined).trim() || null;

		items.push({
			id: component.uid,
			title,
			start: start.toISOString(),
			end: end ? end.toISOString() : null,
			allDay,
			date: allDay ? dateOnlyKey(start) : null,
			kind: isAssignment(component) ? 'assignment' : 'event',
			url,
			course: courseFromDescription(component.description)
		});
	}

	items.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
	return items;
}
