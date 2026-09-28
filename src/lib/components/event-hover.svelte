<script lang="ts">
	import type { Snippet } from 'svelte';
	import { assignmentPlacement, courseText, eventClockLabel, eventDayLabel, moveNote } from '$lib/canvas/dates';
	import { displayMoves, appToday } from '$lib/components/display-settings.svelte';
	import type { FeedItem } from '$lib/canvas/ics';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as HoverCard from '$lib/components/ui/hover-card';
	import { cn } from '$lib/utils';

	let {
		item,
		timeZone,
		class: className,
		children
	}: {
		item: FeedItem;
		timeZone: string;
		class?: string;
		children: Snippet;
	} = $props();

	const placement = $derived(assignmentPlacement(item, timeZone, displayMoves, appToday(timeZone)));
	const note = $derived(moveNote(placement));
	const clockLabel = $derived(eventClockLabel(item, timeZone));
	const locationLabel = $derived(
		item.location && item.location !== item.url && !/^https?:\/\//i.test(item.location)
			? item.location
			: null
	);
	let open = $state(false);
	let suppress = $state(false);
	let closedAt = 0;

	function closeCard() {
		open = false;
		suppress = true;
		closedAt = performance.now();
	}
</script>

<HoverCard.Root bind:open openDelay={0} closeDelay={0}>
	<HoverCard.Trigger>
		{#snippet child({ props })}
			<span
				{...props}
				role="presentation"
				class={cn(typeof props.class === 'string' ? props.class : undefined, className)}
				onpointerenter={(event) => {
					if (suppress) {
						if (performance.now() - closedAt < 300) return;
						suppress = false;
					}
					if (typeof props.onpointerenter === 'function') props.onpointerenter(event);
				}}
				onpointerleave={(event) => {
					if (typeof props.onpointerleave === 'function') props.onpointerleave(event);
					suppress = false;
				}}
			>
				{@render children()}
			</span>
		{/snippet}
	</HoverCard.Trigger>
	<HoverCard.Content class="w-80">
		<div class="flex flex-col gap-2">
			<div class="flex items-start justify-between gap-3">
				<p class="font-medium">{item.title}</p>
				<Badge variant={item.kind === 'assignment' ? 'destructive' : 'secondary'}>
					{item.kind === 'assignment' ? 'Due' : 'Event'}
				</Badge>
			</div>
			{#if item.course}
				<p class={cn('font-medium', courseText(item.course))}>{item.course}</p>
			{/if}
			<p class="text-muted-foreground">{eventDayLabel(item, timeZone)}</p>
			{#if clockLabel}
				<p>{clockLabel}</p>
			{/if}
			{#if locationLabel}
				<p>{locationLabel}</p>
			{/if}
			{#if item.details}
				<p class="line-clamp-6 whitespace-pre-line text-muted-foreground">{item.details}</p>
			{/if}
			{#if note}
				<p class="text-muted-foreground">{note}</p>
			{/if}
			{#if item.url}
				<Button href={item.url} target="_blank" rel="noreferrer" variant="default" size="sm">
					Open in Canvas
				</Button>
			{/if}
			<Button type="button" variant="outline" size="sm" class="w-full" onclick={closeCard}>
				Close
			</Button>
		</div>
	</HoverCard.Content>
</HoverCard.Root>
