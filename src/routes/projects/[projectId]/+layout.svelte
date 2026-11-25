<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Settings } from '@lucide/svelte';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { PROJECT_WORKSPACE_TABS } from '#lib/config/navigation.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const isEditorRoute = $derived(page.url.pathname.endsWith('/editor'));
</script>

<div
	class="flex min-h-screen flex-col overflow-x-clip bg-surface-page {isEditorRoute
		? 'lg:h-dvh lg:max-h-dvh lg:overflow-hidden'
		: ''}"
>
	<AppHeader brandHref="/dashboard">
		{#snippet actions()}
			<a
				href="/dashboard"
				class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle sm:px-3"
			>
				<ArrowLeft class="h-3.5 w-3.5 shrink-0" />
				<span>Projects</span>
			</a>
			<a
				href="/settings"
				class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-ink-primary hover:bg-surface-subtle sm:px-3"
			>
				<Settings class="h-3.5 w-3.5 shrink-0" />
				<span class="hidden sm:inline">Account</span>
			</a>
		{/snippet}
	</AppHeader>

	<!-- Project Sub-Header & Colour-Coded Stage Tabs (Mobile, Tablet & Desktop) -->
	<div class="w-full border-b border-border-default bg-surface-card">
		<div
			class="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 pt-2.5 sm:px-6 lg:min-h-12 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0"
		>
			<div class="flex min-w-0 flex-wrap items-center gap-2 lg:py-2">
				<h1 class="min-w-0 truncate text-sm font-bold text-ink-primary sm:text-base">
					{data.project.name}
				</h1>
				<div class="flex flex-wrap items-center gap-1.5">
					<Badge tone="indigo">
						{data.templates.length} {data.templates.length === 1 ? 'template' : 'templates'}
					</Badge>
					<Badge tone="emerald">
						{data.recipients.length} {data.recipients.length === 1 ? 'row' : 'rows'}
					</Badge>
					<Badge tone="amber">
						{data.certificates.length} {data.certificates.length === 1 ? 'cert' : 'certs'}
					</Badge>
				</div>
			</div>

			<nav
				class="-mx-3 flex items-stretch gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0 lg:self-stretch"
				aria-label="Project sections"
			>
				{#each PROJECT_WORKSPACE_TABS as tab (tab.id)}
					{@const href = `/projects/${data.project.id}/${tab.segment}`}
					{@const active = page.url.pathname.startsWith(href)}
					<a
						{href}
						class="inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition sm:px-3.5 lg:min-h-12 {active
							? tab.accentClass
							: 'border-transparent text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
					>
						{tab.label}
					</a>
				{/each}
			</nav>
		</div>
	</div>

	<div class="flex min-h-0 min-w-0 flex-1 flex-col {isEditorRoute ? 'lg:overflow-hidden' : ''}">
		{@render children()}
	</div>
</div>
