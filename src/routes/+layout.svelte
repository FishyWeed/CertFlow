<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import ThemeToggle from '#lib/components/ui/ThemeToggle.svelte';
	import { theme } from '#lib/stores/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		theme.init();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>CertFlow — Interactive Certificate Studio & Bulk Distribution</title>
</svelte:head>

{@render children()}

<div class="fixed right-5 bottom-5 z-45">
	<ThemeToggle floating />
</div>
