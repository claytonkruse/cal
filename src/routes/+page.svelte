<script lang="ts">
	import { CalendarDate, getLocalTimeZone, parseDate } from '@internationalized/date';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import LinkIcon from '@lucide/svelte/icons/link';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { replaceState } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import { canvasFeedParam } from '$lib/canvas/canvas-feed-param';
	import { description } from '$lib/site';
	import { compareByDueDate, courseColor, displayDateKey, eventDateKey, eventWhenLabel } from '$lib/canvas/dates';
	import DisplaySettings, {
		appToday,
		debugSettings,
		displayMoves,
		hideDueDates
	} from '$lib/components/display-settings.svelte';
	import type { FeedItem } from '$lib/canvas/ics';
	import EventHover from '$lib/components/event-hover.svelte';
	import MonthCalendar from '$lib/components/month-calendar.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as InputGroup from '$lib/components/ui/input-group';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	let { data } = $props();

	function readDay(): CalendarDate {
		const raw = page.url.searchParams.get('day');
		if (raw) {
			try {
				return parseDate(raw);
			} catch {
				// Keep today when the day param is not a calendar date.
			}
		}
		return appToday(getLocalTimeZone());
	}

	const initialDay = readDay();
	let selected = $state<CalendarDate>(initialDay);
	let placeholder = $state<CalendarDate>(initialDay);
	let dialogOpen = $state(true);
	let feedDraft = $state('');
	let syncedKey = '';
	let linkCopied = $state(false);
	let feedCopied = $state(false);

	const bookmarkLink = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.delete('day');
		return url.href;
	});
	const icalLink = $derived.by(() => {
		if (!data.feed && !data.preview) return '';
		const url = new URL('/calendar.ics', page.url.origin);
		if (data.preview) url.searchParams.set('fixture', '1');
		else if (data.feed) url.searchParams.set(canvasFeedParam, data.feed);
		url.searchParams.set('tz', getLocalTimeZone());
		if (!displayMoves.weekend) url.searchParams.set('weekend', '0');
		if (!displayMoves.early) url.searchParams.set('early', '0');
		if (debugSettings.enabled && debugSettings.today) {
			try {
				parseDate(debugSettings.today);
				url.searchParams.set('today', debugSettings.today);
			} catch {
				// Skip a debug day that is not a calendar date.
			}
		}
		return url.href;
	});
	const loading = $derived(navigating.to != null);
	const dismissible = $derived(data.preview || (Boolean(data.feed) && !data.error));
	const timeZone = getLocalTimeZone();

	const currentDay = $derived(appToday(timeZone));
	const debugTodayLabel = $derived(
		new Intl.DateTimeFormat(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		}).format(currentDay.toDate(timeZone))
	);

	const eventsByDay = $derived.by(() => {
		const map = new Map<string, FeedItem[]>();
		for (const event of data.events) {
			const key = displayDateKey(event, timeZone, displayMoves, currentDay);
			const list = map.get(key) ?? [];
			list.push(event);
			map.set(key, list);
		}
		for (const list of map.values()) list.sort((a, b) => compareByDueDate(a, b, timeZone));
		return map;
	});

	const ghostsByDay = $derived.by(() => {
		const map = new Map<string, FeedItem[]>();
		if (hideDueDates.enabled) return map;
		for (const event of data.events) {
			if (event.kind !== 'assignment') continue;
			const actual = eventDateKey(event, timeZone);
			const shown = displayDateKey(event, timeZone, displayMoves, currentDay);
			if (actual === shown) continue;
			const list = map.get(actual) ?? [];
			list.push(event);
			map.set(actual, list);
		}
		for (const list of map.values()) list.sort((a, b) => compareByDueDate(a, b, timeZone));
		return map;
	});

	const actualByDay = $derived.by(() => {
		const map = new Map<string, FeedItem[]>();
		for (const event of data.events) {
			const key = eventDateKey(event, timeZone);
			const list = map.get(key) ?? [];
			list.push(event);
			map.set(key, list);
		}
		for (const list of map.values()) list.sort((a, b) => compareByDueDate(a, b, timeZone));
		return map;
	});

	const agenda = $derived.by(() => {
		const key = selected.toString();
		const onDay = (actualByDay.get(key) ?? []).map((item) => ({
			item,
			dueDay: null as string | null
		}));
		if (key !== currentDay.toString()) {
			return [...onDay].sort((a, b) => compareByDueDate(a.item, b.item, timeZone));
		}

		const moved = (eventsByDay.get(key) ?? []).filter((item) => eventDateKey(item, timeZone) !== key);
		return [...onDay, ...moved.map((item) => ({ item, dueDay: movedDueDay(item) }))].sort((a, b) =>
			compareByDueDate(a.item, b.item, timeZone)
		);
	});
	const upcomingLimit = 8;
	const upcoming = $derived.by(() => {
		const selectedKey = selected.toString();
		const groups: { key: string; label: string; items: FeedItem[] }[] = [];
		let shown = 0;
		let remaining = 0;
		const keys = [...actualByDay.keys()].filter((key) => key > selectedKey).sort();
		for (const key of keys) {
			const items = actualByDay.get(key) ?? [];
			if (shown >= upcomingLimit) {
				remaining += items.length;
				continue;
			}
			const visible = items.slice(0, upcomingLimit - shown);
			shown += visible.length;
			remaining += items.length - visible.length;
			const date = parseDate(key);
			groups.push({
				key,
				label: new Intl.DateTimeFormat(undefined, {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					timeZone: 'UTC'
				}).format(date.toDate('UTC')),
				items: visible
			});
		}
		return { groups, shown, remaining };
	});
	function movedDueDay(item: FeedItem): string {
		const actual = eventDateKey(item, timeZone);
		if (actual === currentDay.add({ days: 1 }).toString()) return 'Tomorrow';
		const date = parseDate(actual);
		return new Intl.DateTimeFormat(undefined, {
			weekday: 'long',
			timeZone: 'UTC'
		}).format(date.toDate('UTC'));
	}

	const dayLabel = $derived.by(() => {
		const date = selected.toDate(timeZone);
		const formatted = new Intl.DateTimeFormat(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		}).format(date);
		const current = currentDay;
		const key = selected.toString();
		if (key === current.toString()) return `Today, ${formatted}`;
		if (key === current.subtract({ days: 1 }).toString()) return `Yesterday, ${formatted}`;
		if (key === current.add({ days: 1 }).toString()) return `Tomorrow, ${formatted}`;
		return formatted;
	});

	const outsideWindow = $derived.by(() => {
		if (data.error || (!data.feed && !data.preview)) return false;
		if (data.events.length === 0) return true;
		const start = new CalendarDate(placeholder.year, placeholder.month, 1);
		const end = start.add({ months: 1 }).subtract({ days: 1 });
		let min = '9999-99-99';
		let max = '0000-00-00';
		for (const event of data.events) {
			const key = eventDateKey(event, timeZone);
			if (key < min) min = key;
			if (key > max) max = key;
		}
		return end.toString() < min || start.toString() > max;
	});

	$effect(() => {
		const key = `${data.feed ?? ''}|${data.error ?? ''}|${data.preview}`;
		if (key === syncedKey) return;
		syncedKey = key;
		feedDraft = data.feed ?? '';
		dialogOpen = !data.preview && (!data.feed || data.error !== null);
	});

	async function writeClipboard(link: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(link);
			return true;
		} catch {
			// Some browsers only allow the older copy command from a click.
		}
		const field = document.createElement('textarea');
		field.value = link;
		field.setAttribute('readonly', '');
		document.body.append(field);
		field.select();
		const copied = document.execCommand('copy');
		field.remove();
		return copied;
	}

	async function copyCalendarLink() {
		linkCopied = await writeClipboard(bookmarkLink);
	}

	async function copyIcalLink() {
		if (!icalLink) return;
		feedCopied = await writeClipboard(icalLink);
	}

	function disableDebugMode() {
		debugSettings.enabled = false;
	}

	function selectDay(day: CalendarDate) {
		selected = day;
		if (page.url.searchParams.get('day') === day.toString()) return;
		const url = new URL(page.url);
		url.searchParams.set('day', day.toString());
		replaceState(url, page.state);
	}

	function showToday() {
		placeholder = currentDay;
		selectDay(currentDay);
	}

	function shiftMonth(amount: number) {
		placeholder = placeholder.add({ months: amount });
	}

	function monthTitle(date: CalendarDate): string {
		return new Intl.DateTimeFormat(undefined, {
			month: 'long',
			year: 'numeric'
		}).format(date.toDate(timeZone));
	}
</script>

<svelte:head>
	<title>Canvas Cal</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-semibold tracking-tight">Canvas Cal</h1>
			<p class="text-sm text-muted-foreground">{description}</p>
		</div>
		<div class="flex items-center gap-2">
			<DisplaySettings />
			<ThemeToggle />
			<Button variant="outline" type="button" onclick={() => (dialogOpen = true)}>
				<LinkIcon data-icon="inline-start" />
				Change feed
			</Button>
		</div>
	</header>

	{#if debugSettings.enabled}
		<Alert.Root class="has-data-[slot=alert-action]:pr-36">
			<TriangleAlertIcon />
			<Alert.Title>
				Debug Mode is on. This calendar is treating {debugTodayLabel} as today.
			</Alert.Title>
			<Alert.Action class="top-1/2 -translate-y-1/2">
				<Button variant="outline" size="sm" type="button" onclick={disableDebugMode}>
					Exit Debug
				</Button>
			</Alert.Action>
		</Alert.Root>
	{/if}

	{#if loading}
		<div class="flex flex-col gap-4">
			<Skeleton class="h-96 w-full" />
			<Skeleton class="h-40 w-full" />
		</div>
	{:else}
		<div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
			<div class="flex flex-col gap-6">
				<Card.Root class="gap-3">
					<Card.Header class="items-center">
						<Card.Title class="text-3xl">{monthTitle(placeholder)}</Card.Title>
						<Card.Action class="row-span-1 self-center">
							<div class="flex items-center gap-1">
								<Button variant="outline" size="icon" type="button" onclick={() => shiftMonth(-1)}>
									<ChevronLeftIcon />
									<span class="sr-only">Previous month</span>
								</Button>
								<Button variant="outline" type="button" onclick={showToday}>
									Today
								</Button>
								<Button variant="outline" size="icon" type="button" onclick={() => shiftMonth(1)}>
									<ChevronRightIcon />
									<span class="sr-only">Next month</span>
								</Button>
							</div>
						</Card.Action>
					</Card.Header>
					<Card.Content>
						<MonthCalendar
							bind:month={placeholder}
							{selected}
							{eventsByDay}
							{ghostsByDay}
							todayDate={currentDay}
							onSelect={selectDay}
						/>
					</Card.Content>
					{#if outsideWindow}
						<Card.Footer>
							<p class="text-sm text-muted-foreground">
								Canvas only includes about the past month and the next year of this feed.
							</p>
						</Card.Footer>
					{/if}
				</Card.Root>

				<Card.Root class="gap-3">
					<Card.Header>
						<Card.Title class="text-3xl">{monthTitle(placeholder.add({ months: 1 }))}</Card.Title>
					</Card.Header>
					<Card.Content>
						<MonthCalendar
							month={placeholder.add({ months: 1 })}
							{selected}
							{eventsByDay}
							{ghostsByDay}
							todayDate={currentDay}
							onSelect={selectDay}
						/>
					</Card.Content>
				</Card.Root>
			</div>

			<div class="flex flex-col gap-6">
			<Card.Root>
				<Card.Header>
					<Card.Title>{dayLabel}</Card.Title>
					<Card.Description>
						{#if agenda.length === 0}
							{data.feed || data.preview ? 'Nothing scheduled.' : 'Add a calendar feed to see due dates.'}
						{:else}
							{agenda.length === 1 ? '1 item' : `${agenda.length} items`}
						{/if}
					</Card.Description>
				</Card.Header>
				{#if agenda.length > 0}
				<Card.Content>
						<ScrollArea class="max-h-96">
							<ul class="flex flex-col gap-3 pr-3">
								{#each agenda as entry, index (entry.item.id)}
									{#if index > 0}
										<li aria-hidden="true"><Separator /></li>
									{/if}
									<li class="flex flex-col gap-2">
										<div class="flex items-start justify-between gap-3">
											<div class="flex min-w-0 flex-col gap-1">
												<EventHover item={entry.item} {timeZone} class="truncate font-medium">
													{entry.item.title}
												</EventHover>
												<p class="text-sm text-muted-foreground">
													{eventWhenLabel(entry.item, timeZone)}{entry.dueDay
														? ` (${entry.dueDay})`
														: ''}
												</p>
											</div>
											<Badge variant={entry.item.kind === 'assignment' ? 'destructive' : 'secondary'}>
												{entry.item.kind === 'assignment' ? 'Due' : 'Event'}
											</Badge>
										</div>
										{#if entry.item.course}
											<p class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
												<span
													class={cn(
														'size-2 shrink-0 rounded-full',
														courseColor(entry.item.course)
													)}
												></span>
												<span class="min-w-0 truncate">{entry.item.course}</span>
											</p>
										{/if}
									</li>
								{/each}
							</ul>
						</ScrollArea>
				</Card.Content>
				{/if}
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Upcoming</Card.Title>
					<Card.Description>
						{upcoming.shown === 1 ? '1 item' : `${upcoming.shown} items`}
						after this day
					</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if upcoming.groups.length === 0}
						<p class="text-sm text-muted-foreground">
							{data.feed || data.preview ? 'Nothing else scheduled.' : 'Add a calendar feed to see what is next.'}
						</p>
					{:else}
						<div class="flex flex-col gap-4">
							{#each upcoming.groups as group (group.key)}
								<div class="flex flex-col gap-2">
									<Button
										variant="ghost"
										size="sm"
										class="w-full justify-center text-xs text-muted-foreground uppercase"
										onclick={() => selectDay(parseDate(group.key))}
									>
										{group.label}
									</Button>
									<ul class="flex flex-col gap-3">
										{#each group.items as item (item.id)}
											<li class="flex flex-col gap-2">
												<div class="flex items-start justify-between gap-3">
													<div class="flex min-w-0 flex-col gap-1">
														<EventHover {item} {timeZone} class="truncate font-medium">
															{item.title}
														</EventHover>
														<p class="text-sm text-muted-foreground">
															{eventWhenLabel(item, timeZone)}
														</p>
													</div>
													<Badge
														variant={item.kind === 'assignment' ? 'destructive' : 'secondary'}
													>
														{item.kind === 'assignment' ? 'Due' : 'Event'}
													</Badge>
												</div>
												{#if item.course}
													<p class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
														<span
															class={cn(
																'size-2 shrink-0 rounded-full',
																courseColor(item.course)
															)}
														></span>
														<span class="min-w-0 truncate">{item.course}</span>
													</p>
												{/if}
											</li>
										{/each}
									</ul>
								</div>
							{/each}
							{#if upcoming.remaining > 0}
								<p class="text-sm text-muted-foreground">
									{upcoming.remaining === 1 ? '1 more item' : `${upcoming.remaining} more items`} later
								</p>
							{/if}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Bookmark</Card.Title>
					<Card.Description>
						{data.feed || data.preview
							? 'Bookmark this page to open this calendar again.'
							: 'Add a calendar feed, then bookmark this page.'}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3">
					<InputGroup.Root>
						<InputGroup.Input readonly value={bookmarkLink} aria-label="Calendar link" />
						<InputGroup.Addon align="inline-end">
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<InputGroup.Button
											{...props}
											aria-label="Copy"
											size="icon-xs"
											disabled={!data.feed && !data.preview}
											onclick={copyCalendarLink}
										>
											{#if linkCopied}
												<CheckIcon />
											{:else}
												<CopyIcon />
											{/if}
										</InputGroup.Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>Copy</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</InputGroup.Addon>
					</InputGroup.Root>
					<p class="text-sm text-muted-foreground">
						Press Ctrl+D to bookmark this tab. The link includes your calendar feed, so keep the
						bookmark private.
					</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>iCal Feed</Card.Title>
					<Card.Description>
						{data.feed || data.preview
							? 'Subscribe with the same dates shown on this calendar.'
							: 'Add a calendar feed, then copy the iCal link.'}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3">
					<InputGroup.Root>
						<InputGroup.Input readonly value={icalLink} aria-label="iCal Feed" />
						<InputGroup.Addon align="inline-end">
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<InputGroup.Button
											{...props}
											aria-label="Copy"
											size="icon-xs"
											disabled={!icalLink}
											onclick={copyIcalLink}
										>
											{#if feedCopied}
												<CheckIcon />
											{:else}
												<CopyIcon />
											{/if}
										</InputGroup.Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>Copy</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</InputGroup.Addon>
					</InputGroup.Root>
					<p class="text-sm text-muted-foreground">
						The feed uses the display dates, and the link includes your calendar feed, so keep it
						private.
					</p>
				</Card.Content>
			</Card.Root>
			</div>
		</div>
	{/if}

	<footer class="@container border-t pt-4 text-sm text-muted-foreground">
		<section
			id="about"
			class="flex flex-col gap-2 text-left @min-[48rem]:flex-row @min-[48rem]:items-baseline @min-[48rem]:justify-between"
		>
			<p>Canvas Cal shows assignment due dates and course events from a Canvas calendar feed.</p>
			<p class="shrink-0">
				© 2026
				<a
					href="https://clayk.cc"
					target="_blank"
					rel="noopener noreferrer"
					class="text-foreground underline underline-offset-4"
				>
					Clayton Kruse
				</a>
			</p>
		</section>
	</footer>
</div>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content
		showCloseButton={dismissible}
		escapeKeydownBehavior={dismissible ? 'close' : 'ignore'}
		interactOutsideBehavior={dismissible ? 'close' : 'ignore'}
	>
		<Dialog.Header>
			<Dialog.Title>Add your Canvas calendar</Dialog.Title>
			<Dialog.Description>
				In Canvas, open Calendar and choose Calendar Feed. Paste that link here.
			</Dialog.Description>
		</Dialog.Header>
		<form method="GET" class="flex flex-col gap-4">
			<Field.FieldGroup>
				<Field.Field data-invalid={data.error ? 'true' : undefined}>
					<Field.FieldLabel for="canvas-feed">Calendar feed URL</Field.FieldLabel>
					<Input
						id="canvas-feed"
						name={canvasFeedParam}
						type="url"
						required
						autocomplete="off"
						placeholder="https://school.instructure.com/feeds/calendars/user_….ics"
						bind:value={feedDraft}
						aria-invalid={data.error ? true : undefined}
					/>
					{#if data.error}
						<Field.FieldError errors={[{ message: data.error }]} />
					{:else}
						<Field.FieldDescription>
							The link is a secret. Anyone with it can see this calendar.
						</Field.FieldDescription>
					{/if}
				</Field.Field>
			</Field.FieldGroup>
			<input type="hidden" name="day" value={selected.toString()} />
			<Dialog.Footer>
				<Button type="submit" disabled={loading}>Load calendar</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
