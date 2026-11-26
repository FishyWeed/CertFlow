<script lang="ts">
	import { page } from '$app/state';
	import { LayoutDashboard, Settings } from '@lucide/svelte';
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
	<div class="sticky top-0 z-40 shrink-0 shadow-xs">
		<AppHeader brandHref="/" sticky={false}>
			{#snippet actions()}
				<a
					href="/dashboard"
					class="cf-pressable inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle sm:px-3"
				>
					<LayoutDashboard class="h-3.5 w-3.5 shrink-0 text-ink-secondary" />
					<span>Dashboard</span>
				</a>
				<a
					href="/settings"
					class="cf-pressable inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle sm:px-3"
				>
					<Settings class="h-3.5 w-3.5 shrink-0 text-ink-secondary" />
					<span class="hidden sm:inline">Account</span>
				</a>
			{/snippet}
		</AppHeader>

		<!-- Sticky Project Sub-Header & Colour-Coded Stage Tabs -->
		<div class="w-full border-b border-border-default bg-surface-card/94 backdrop-blur-md">
			<div
				class="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 pt-2 sm:px-6 lg:min-h-12 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0"
			>
				<div class="flex min-w-0 flex-wrap items-center gap-2 lg:py-2">
					<h1
						class="font-display min-w-0 truncate text-sm font-semibold tracking-tight text-ink-primary sm:text-[15px]"
					>
						{data.project.name}
					</h1>
					<div class="flex flex-wrap items-center gap-1.5">
						<Badge tone="indigo" dot>
							{data.templates.length} {data.templates.length === 1 ? 'template' : 'templates'}
						</Badge>
						<Badge tone="emerald" dot>
							{data.recipients.length} {data.recipients.length === 1 ? 'row' : 'rows'}
						</Badge>
						<Badge tone="amber" dot>
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
							aria-current={active ? 'page' : undefined}
							class="cf-glide-thumb inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-[13px] whitespace-nowrap sm:px-3.5 lg:min-h-12 {active
								? `${tab.accentClass} font-semibold`
								: 'border-transparent font-medium text-ink-secondary hover:bg-surface-subtle/75 hover:text-ink-primary'}"
						>
							{#if tab.dotClass}
								<span
									class="h-1.5 w-1.5 shrink-0 rounded-full {tab.dotClass} {active
										? 'opacity-100'
										: 'opacity-70'}"
									aria-hidden="true"
								></span>
							{/if}
							{tab.label}
						</a>
					{/each}
				</nav>
			</div>
		</div>
	</div>

	<div class="flex min-h-0 min-w-0 flex-1 flex-col {isEditorRoute ? 'lg:overflow-hidden' : ''}">
		{@render children()}
	</div>
</div>
