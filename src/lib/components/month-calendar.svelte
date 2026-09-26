<script lang="ts">
	import { CalendarDate, getLocalTimeZone, startOfWeek } from '@internationalized/date';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { courseBorder, courseFill } from '$lib/canvas/dates';
	import type { FeedItem } from '$lib/canvas/ics';
	import EventHover from '$lib/components/event-hover.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	let {
		month = $bindable(),
		selected,
		eventsByDay,
		todayDate,
		onSelect
	}: {
		month: CalendarDate;
		selected: CalendarDate;
		eventsByDay: Map<string, FeedItem[]>;
		todayDate: CalendarDate;
		onSelect: (day: CalendarDate) => void;
	} = $props();

	const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
	const timeZone = getLocalTimeZone();
	const visibleEvents = 3;

	const monthLabel = $derived(
		new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
			month.toDate(timeZone)
		)
	);

	const weeks = $derived.by(() => {
		let cursor = startOfWeek(month.set({ day: 1 }), locale);
		return Array.from({ length: 6 }, () =>
			Array.from({ length: 7 }, () => {
				const day = cursor;
				cursor = cursor.add({ days: 1 });
				return day;
			})
		);
	});

	const weekdayLabels = $derived(
		weeks[0].map((day) =>
			new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day.toDate(timeZone))
		)
	);

	const todayKey = $derived(todayDate.toString());

	function shiftMonth(amount: number) {
		month = month.add({ months: amount });
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h2 class="text-lg font-semibold">{monthLabel}</h2>
		<div class="flex items-center gap-1">
			<Button variant="outline" size="icon" type="button" onclick={() => shiftMonth(-1)}>
				<ChevronLeftIcon />
				<span class="sr-only">Previous month</span>
			</Button>
			<Button
				variant="outline"
				type="button"
				onclick={() => {
					month = todayDate;
					onSelect(todayDate);
				}}
			>
				Today
			</Button>
			<Button variant="outline" size="icon" type="button" onclick={() => shiftMonth(1)}>
				<ChevronRightIcon />
				<span class="sr-only">Next month</span>
			</Button>
		</div>
	</div>

	<div class="overflow-x-auto">
		<div class="grid min-w-[720px] grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
			{#each weekdayLabels as label (label)}
				<div class="bg-card px-2 py-2 text-xs font-medium text-muted-foreground">{label}</div>
			{/each}
			{#each weeks as week (week[0].toString())}
				{#each week as day (day.toString())}
					{@const key = day.toString()}
					{@const items = eventsByDay.get(key) ?? []}
					{@const outside = day.month !== month.month}
					<button
						type="button"
						class={cn(
							'flex min-h-28 flex-col gap-1 bg-card p-1.5 text-left',
							outside && 'bg-muted/50 text-muted-foreground',
							key === selected.toString() && 'bg-accent text-accent-foreground'
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
							{#each items.slice(0, visibleEvents) as item (item.id)}
								<EventHover
									{item}
									{timeZone}
									class={cn(
										'block max-w-full truncate rounded-sm border-l-2 py-px pl-1 text-left text-xs',
										courseBorder(item.course ?? item.title),
										courseFill(item.course ?? item.title)
									)}
								>
									{item.title}
								</EventHover>
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
