<script lang="ts">
	import type { Snippet } from 'svelte';
	import { assignmentPlacement, eventDayLabel, eventWhenLabel } from '$lib/canvas/dates';
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
</script>

<HoverCard.Root openDelay={0} closeDelay={0}>
	<HoverCard.Trigger>
		{#snippet child({ props })}
			<span
				{...props}
				role="presentation"
				class={cn(typeof props.class === 'string' ? props.class : undefined, className)}
			>
				{@render children()}
			</span>
		{/snippet}
	</HoverCard.Trigger>
	<HoverCard.Content class="w-72">
		<div class="flex flex-col gap-2">
			<div class="flex items-start justify-between gap-3">
				<p class="font-medium">{item.title}</p>
				<Badge variant={item.kind === 'assignment' ? 'destructive' : 'secondary'}>
					{item.kind === 'assignment' ? 'Due' : 'Event'}
				</Badge>
			</div>
			<p class="text-muted-foreground">{eventDayLabel(item, timeZone)}</p>
			{#if eventWhenLabel(item, timeZone) !== 'Due'}
				<p>{eventWhenLabel(item, timeZone)}</p>
			{/if}
			{#if item.course}
				<p>{item.course}</p>
			{/if}
			{#if placement.weekendNote}
				<p class="text-muted-foreground">
					Shown on the Friday before because this assignment is due on the weekend.
				</p>
			{/if}
			{#if placement.earlyNote}
				<p class="text-muted-foreground">
					Shown on the day before because this assignment is due before 11:59 PM.
				</p>
			{/if}
			{#if placement.fridayNote}
				<p class="text-muted-foreground">
					{#if placement.earlyApplied}
						Shown on the previous Friday because this assignment is due before 11:59 PM, and
						assignments are not shown on the weekend.
					{:else}
						Shown on the previous Friday because assignments are not shown on the weekend.
					{/if}
				</p>
			{/if}
			{#if placement.todayNote}
				<p class="text-muted-foreground">
					Shown on today because its usual day has passed, and this assignment is not due yet.
				</p>
			{/if}
			{#if item.url}
				<Button href={item.url} target="_blank" rel="noreferrer" variant="link" size="sm">
					Open in Canvas
				</Button>
			{/if}
		</div>
	</HoverCard.Content>
</HoverCard.Root>
