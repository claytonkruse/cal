<script lang="ts">
	const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
	const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'medium' });
	// Starts empty so the server never renders its own time.
	let now = $state<Date | null>(null);

	$effect(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(timer);
	});
</script>

{#if now}
	<time
		datetime={now.toISOString()}
		title={dateFormatter.format(now)}
		class="px-1 text-sm font-medium text-muted-foreground tabular-nums"
	>
		{timeFormatter.format(now)}
	</time>
{/if}
