<script lang="ts">
	import { parseDate } from '@internationalized/date';
	import GhostIcon from '@lucide/svelte/icons/ghost';
	import { assignmentPlacement, eventDateKey } from '$lib/canvas/dates';
	import { appToday, displayMoves } from '$lib/components/display-settings.svelte';
	import type { FeedItem } from '$lib/canvas/ics';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { item, timeZone }: { item: FeedItem; timeZone: string } = $props();

	const placement = $derived(assignmentPlacement(item, timeZone, displayMoves, appToday(timeZone)));
	const actualKey = $derived(eventDateKey(item, timeZone));
	const shownLabel = $derived.by(() => {
		const date = parseDate(placement.key);
		return new Intl.DateTimeFormat(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		}).format(date.toDate('UTC'));
	});
</script>

{#if placement.key !== actualKey}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span
					{...props}
					class="inline-flex shrink-0 text-muted-foreground"
					aria-label="Actual due date"
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<GhostIcon class="size-3.5" />
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content class="flex-col items-start gap-1 text-left whitespace-normal">
			<p>This is the actual due date. The assignment is shown on {shownLabel}.</p>
		</Tooltip.Content>
	</Tooltip.Root>
{/if}
