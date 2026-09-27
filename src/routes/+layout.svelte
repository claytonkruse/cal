<script lang="ts">
	import { ModeWatcher } from 'mode-watcher';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import './layout.css';

	let { children } = $props();
</script>

<Tooltip.Provider>
	<ModeWatcher />
	{@render children()}
</Tooltip.Provider>
