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
	details: string | null;
	location: string | null;
};

function textOf(value: ParameterValue | undefined): string {
	if (!value) return '';
	if (typeof value === 'string') return value;
	return value.val;
}

function plainText(value: ParameterValue | undefined): string {
	return textOf(value)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&quot;/gi, '"');
}

function titleCase(value: string): string {
	const small = new Set(['of', 'and', 'the', 'for', 'in', 'a', 'an']);
	return value
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.map((word, index) => {
			if (index > 0 && small.has(word)) return word;
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(' ');
}

function courseLabel(raw: string): string {
	const context = raw.trim();
	const term = context.match(/^(.*?)-(\d{4}(?:fs|sp|ss|su|fa|wi))-(.+)$/i);
	if (!term) return context;
	const prefix = term[1].split('-');
	const code = prefix.length >= 2 ? `${prefix[0]} ${prefix[1]}` : term[1];
	const name = titleCase(term[3]);
	return name ? `${code}: ${name}` : code;
}

function splitSummary(summary: string): { title: string; course: string | null } {
	const match = summary.match(/^(.*?)\s+\[(.+)\]\s*$/);
	if (!match) return { title: summary || 'Untitled', course: null };
	const title = match[1].trim() || 'Untitled';
	const course = courseLabel(match[2]);
	return { title, course: course || null };
}

function descriptionParts(
	description: ParameterValue | undefined,
	courseFromTitle: boolean
): { course: string | null; details: string | null } {
	const lines = plainText(description)
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length === 0) return { course: null, details: null };
	if (courseFromTitle) {
		const details = lines.join('\n');
		return { course: null, details: details.slice(0, 600) };
	}
	const first = lines[0];
	const course = first.length <= 80 ? first : null;
	const details = (course ? lines.slice(1) : lines).join('\n').trim();
	return { course, details: details ? details.slice(0, 600) : null };
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
		const summary = splitSummary(textOf(component.summary).trim());
		const title = summary.title;
		const url = textOf(component.url as ParameterValue | undefined).trim() || null;
		const described = descriptionParts(component.description, summary.course !== null);
		const location = plainText(component.location).trim() || null;

		items.push({
			id: component.uid,
			title,
			start: start.toISOString(),
			end: end ? end.toISOString() : null,
			allDay,
			date: allDay ? dateOnlyKey(start) : null,
			kind: isAssignment(component) ? 'assignment' : 'event',
			url,
			course: summary.course ?? described.course,
			details: described.details,
			location
		});
	}

	items.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
	return items;
}
