import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const MAX_URL_LENGTH = 2048;

const blocked = new BlockList();
blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('10.0.0.0', 8, 'ipv4');
blocked.addSubnet('100.64.0.0', 10, 'ipv4');
blocked.addSubnet('127.0.0.0', 8, 'ipv4');
blocked.addSubnet('169.254.0.0', 16, 'ipv4');
blocked.addSubnet('172.16.0.0', 12, 'ipv4');
blocked.addSubnet('192.0.0.0', 24, 'ipv4');
blocked.addSubnet('192.0.2.0', 24, 'ipv4');
blocked.addSubnet('192.168.0.0', 16, 'ipv4');
blocked.addSubnet('198.18.0.0', 15, 'ipv4');
blocked.addSubnet('198.51.100.0', 24, 'ipv4');
blocked.addSubnet('203.0.113.0', 24, 'ipv4');
blocked.addSubnet('224.0.0.0', 4, 'ipv4');
blocked.addSubnet('240.0.0.0', 4, 'ipv4');
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');

export class FeedUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FeedUrlError';
	}
}

export function isPublicAddress(address: string): boolean {
	const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (mapped) return isPublicAddress(mapped[1]);

	const family = isIP(address);
	if (family === 4) return !blocked.check(address, 'ipv4');
	if (family === 6) return !blocked.check(address, 'ipv6');
	return false;
}

export function assertCanvasFeedUrl(raw: string): URL {
	const trimmed = raw.trim();
	if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
		throw new FeedUrlError('Enter a Canvas calendar feed URL.');
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new FeedUrlError('That is not a valid URL.');
	}

	if (url.protocol !== 'https:') {
		throw new FeedUrlError('The calendar feed URL must use HTTPS.');
	}
	if (url.username || url.password) {
		throw new FeedUrlError('The calendar feed URL cannot include a username or password.');
	}
	if (url.port && url.port !== '443') {
		throw new FeedUrlError('The calendar feed URL must use the default HTTPS port.');
	}
	if (!/^\/feeds\/calendars\/[^/]+\.ics$/i.test(url.pathname)) {
		throw new FeedUrlError(
			'Use the calendar feed link from Canvas: Calendar, then Calendar Feed. It should end in .ics.'
		);
	}

	const host = url.hostname.replace(/\.$/, '').toLowerCase();
	if (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host.endsWith('.local') ||
		host.endsWith('.internal')
	) {
		throw new FeedUrlError('That host is not a Canvas calendar feed.');
	}
	if (isIP(host) && !isPublicAddress(host)) {
		throw new FeedUrlError('That host is not a Canvas calendar feed.');
	}

	url.hostname = host;
	url.hash = '';
	return url;
}

export async function assertPublicFeedHost(url: URL): Promise<void> {
	let records: { address: string }[];
	try {
		records = await lookup(url.hostname, { all: true, verbatim: true });
	} catch {
		throw new FeedUrlError('Could not look up that calendar feed host.');
	}

	if (records.length === 0 || records.some((record) => !isPublicAddress(record.address))) {
		throw new FeedUrlError('That host is not a Canvas calendar feed.');
	}
}
