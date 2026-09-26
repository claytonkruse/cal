<script lang="ts" module>
	import { type CalendarDate, getLocalTimeZone, parseDate, today } from '@internationalized/date';
	import { defaultDisplayMoves, type DisplayMoves } from '$lib/canvas/dates';

	const storageKey = 'canvas-calendar-display';

	function loadMoves(): DisplayMoves {
		if (typeof localStorage === 'undefined') return { ...defaultDisplayMoves };
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return { ...defaultDisplayMoves };
			const parsed = JSON.parse(raw) as Partial<DisplayMoves> & { avoidWeekend?: boolean };
			return {
				weekend: parsed.weekend !== false && parsed.avoidWeekend !== false,
				early: parsed.early !== false
			};
		} catch {
			return { ...defaultDisplayMoves };
		}
	}

	function loadDebug(): { enabled: boolean; today: string } {
		if (typeof localStorage === 'undefined') return { enabled: false, today: '' };
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return { enabled: false, today: '' };
			const parsed = JSON.parse(raw) as { debug?: boolean; debugToday?: string };
			return {
				enabled: parsed.debug === true,
				today: typeof parsed.debugToday === 'string' ? parsed.debugToday : ''
			};
		} catch {
			return { enabled: false, today: '' };
		}
	}

	export const displayMoves = $state<DisplayMoves>(loadMoves());
	export const debugSettings = $state(loadDebug());

	export function appToday(timeZone: string): CalendarDate {
		if (debugSettings.enabled && debugSettings.today) {
			try {
				return parseDate(debugSettings.today);
			} catch {
				// Ignore a stored value that is not a calendar date.
			}
		}
		return today(timeZone);
	}

	export function saveDisplayMoves(): void {
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				weekend: displayMoves.weekend,
				early: displayMoves.early,
				debug: debugSettings.enabled,
				debugToday: debugSettings.today
			})
		);
	}
</script>

<script lang="ts">
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Popover from '$lib/components/ui/popover';
	import { Separator } from '$lib/components/ui/separator';
	import { Switch } from '$lib/components/ui/switch';

	$effect(() => {
		displayMoves.weekend;
		displayMoves.early;
		debugSettings.enabled;
		debugSettings.today;
		saveDisplayMoves();
	});

	$effect(() => {
		if (debugSettings.enabled && debugSettings.today === '') {
			debugSettings.today = today(getLocalTimeZone()).toString();
		}
	});
</script>

<Popover.Root>
	<Popover.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
		<SettingsIcon />
		<span class="sr-only">Display settings</span>
	</Popover.Trigger>
	<Popover.Content align="end" class="w-80">
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<p class="font-medium">Display</p>
				<p class="text-sm text-muted-foreground">
					Choose when assignments move off their due date. Course events stay put.
				</p>
			</div>
			<div class="flex items-start justify-between gap-4">
				<div class="flex flex-col gap-1">
					<Label for="move-early">Due before 11:59 PM</Label>
					<p class="text-sm text-muted-foreground">
						Show these assignments on the previous day. 11:59 PM stays on the due date.
					</p>
				</div>
				<Switch id="move-early" bind:checked={displayMoves.early} />
			</div>
			<div class="flex items-start justify-between gap-4">
				<div class="flex flex-col gap-1">
					<Label for="move-weekend">Keep off weekends</Label>
					<p class="text-sm text-muted-foreground">
						If an assignment is due on a weekend, or would land on one, show it on the previous
						Friday.
					</p>
				</div>
				<Switch id="move-weekend" bind:checked={displayMoves.weekend} />
			</div>
			<Separator />
			<div class="flex items-start justify-between gap-4">
				<div class="flex flex-col gap-1">
					<Label for="debug-mode">Debug Mode</Label>
					<p class="text-sm text-muted-foreground">Change which day the calendar treats as today.</p>
				</div>
				<Switch id="debug-mode" bind:checked={debugSettings.enabled} />
			</div>
			{#if debugSettings.enabled}
				<div class="flex flex-col gap-1">
					<Label for="debug-today">Today</Label>
					<Input id="debug-today" type="date" bind:value={debugSettings.today} />
				</div>
			{/if}
		</div>
	</Popover.Content>
</Popover.Root>
