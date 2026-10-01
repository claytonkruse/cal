<script lang="ts">
	import { CalendarDate, getLocalTimeZone, startOfWeek } from '@internationalized/date';
	import { compareByDueDate, courseBorder, courseFill } from '$lib/canvas/dates';
	import type { FeedItem } from '$lib/canvas/ics';
	import EventHover from '$lib/components/event-hover.svelte';
	import GhostHint from '$lib/components/ghost-hint.svelte';
	import MoveHint from '$lib/components/move-hint.svelte';
	import { cn } from '$lib/utils';

	let {
		month = $bindable(),
		selected,
		eventsByDay,
		ghostsByDay,
		todayDate,
		onSelect
	}: {
		month: CalendarDate;
		selected: CalendarDate;
		eventsByDay: Map<string, FeedItem[]>;
		ghostsByDay: Map<string, FeedItem[]>;
		todayDate: CalendarDate;
		onSelect: (day: CalendarDate) => void;
	} = $props();

	const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
	const timeZone = getLocalTimeZone();
	const visibleEvents = 3;

	const weeks = $derived.by(() => {
		const first = month.set({ day: 1 });
		const last = first.add({ months: 1 }).subtract({ days: 1 });
		let cursor = startOfWeek(first, locale);
		const rows: CalendarDate[][] = [];
		while (cursor.compare(last) <= 0) {
			const week: CalendarDate[] = [];
			for (let day = 0; day < 7; day += 1) {
				week.push(cursor);
				cursor = cursor.add({ days: 1 });
			}
			rows.push(week);
		}
		return rows;
	});

	const weekdayLabels = $derived(
		weeks[0].map((day) =>
			new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day.toDate(timeZone))
		)
	);

	const todayKey = $derived(todayDate.toString());
</script>

<div class="flex flex-col gap-3">
	<div class="overflow-x-auto">
		<div class="grid min-w-[720px] grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
			{#each weekdayLabels as label (label)}
				<div class="bg-card px-2 py-2 text-xs font-medium text-muted-foreground">{label}</div>
			{/each}
			{#each weeks as week (week[0].toString())}
				{#each week as day (day.toString())}
					{@const key = day.toString()}
					{@const items = [
						...(eventsByDay.get(key) ?? []).map((item) => ({ item, ghost: false })),
						...(ghostsByDay.get(key) ?? []).map((item) => ({ item, ghost: true }))
					].sort((a, b) => compareByDueDate(a.item, b.item, timeZone))}
					{@const outside = day.month !== month.month}
					<button
						type="button"
						class={cn(
							'flex min-h-28 flex-col gap-1 bg-card p-1.5 text-left',
							outside && 'bg-muted/50 text-muted-foreground',
							key === selected.toString() &&
								'bg-accent text-accent-foreground outline-1 -outline-offset-2 outline-muted-foreground/55'
						)}
						aria-current={key === todayKey ? 'date' : undefined}
						aria-pressed={key === selected.toString()}
						onclick={() => onSelect(day)}
					>
						<span
							class={cn(
								'inline-flex size-6 items-center justify-center self-start rounded-full text-xs',
								key === todayKey && 'bg-primary text-primary-foreground'
							)}
						>
							{day.day}
						</span>
						<span class="flex flex-col gap-0.5">
							{#each items.slice(0, visibleEvents) as entry (`${entry.ghost ? 'ghost' : 'item'}-${entry.item.id}`)}
								<span
									class={cn(
										'flex max-w-full items-center gap-0.5 rounded-sm border-l-2 py-px pr-0.5 pl-1 text-left text-xs',
										courseBorder(entry.item.course ?? entry.item.title),
										courseFill(entry.item.course ?? entry.item.title),
										entry.ghost && 'opacity-40'
									)}
								>
									<EventHover item={entry.item} {timeZone} class="min-w-0 flex-1 truncate">
										{entry.item.title}
									</EventHover>
									{#if entry.ghost}
										<GhostHint item={entry.item} {timeZone} />
									{:else}
										<MoveHint item={entry.item} {timeZone} />
									{/if}
								</span>
							{/each}
							{#if items.length > visibleEvents}
								<span class="px-1 text-xs text-muted-foreground">
									+{items.length - visibleEvents} more
								</span>
							{/if}
						</span>
					</button>
				{/each}
			{/each}
		</div>
	</div>
</div>
