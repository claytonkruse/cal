<script lang="ts">
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import { actualDueLabel, assignmentPlacement, moveNote } from '$lib/canvas/dates';
	import { appToday, displayMoves } from '$lib/components/display-settings.svelte';
	import type { FeedItem } from '$lib/canvas/ics';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { item, timeZone }: { item: FeedItem; timeZone: string } = $props();

	const placement = $derived(assignmentPlacement(item, timeZone, displayMoves, appToday(timeZone)));
	const note = $derived(moveNote(placement));
	const dueLabel = $derived(actualDueLabel(item, timeZone));
</script>

{#if note}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<span
					{...props}
					class="inline-flex shrink-0 text-muted-foreground"
					aria-label="Why this date moved"
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<CircleHelpIcon class="size-3.5" />
				</span>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content class="flex-col items-start gap-1 text-left whitespace-normal">
			<p>{note}</p>
			<p>Due {dueLabel}.</p>
		</Tooltip.Content>
	</Tooltip.Root>
{/if}
