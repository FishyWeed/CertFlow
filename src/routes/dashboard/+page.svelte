<script lang="ts">
	import { AlertTriangle, FolderPlus, OctagonAlert, Search, Settings, X } from '@lucide/svelte';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import CertFlowLogo from '#lib/components/ui/CertFlowLogo.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import CreateProjectModal from '#lib/features/projects/CreateProjectModal.svelte';
	import ProjectCard from '#lib/features/projects/ProjectCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showCreateModal = $state(false);
	let searchQuery = $state('');

	const atProjectLimit = $derived(
		data.limits.maxProjects !== null && data.projects.length >= data.limits.maxProjects
	);

	const filteredProjects = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return data.projects;
		return data.projects.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				(p.defaultCertTitle ?? '').toLowerCase().includes(q) ||
				(p.description ?? '').toLowerCase().includes(q)
		);
	});
</script>

<div class="min-h-screen bg-surface-page">
	<AppHeader brandHref="/">
		{#snippet actions()}
			<div class="hidden text-right md:block">
				<p class="text-xs font-semibold text-ink-primary">{data.user.name}</p>
				<p class="text-[11px] text-ink-muted">{data.user.email}</p>
			</div>
			<a
				href="/settings"
				class="cf-pressable inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle sm:px-3"
			>
				<Settings class="h-4 w-4 shrink-0 text-ink-secondary" />
				<span>Settings</span>
			</a>
		{/snippet}
	</AppHeader>

	<main class="mx-auto max-w-[1600px] space-y-6 px-4 py-8 sm:px-6">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2.5">
					<h1 class="font-display text-[28px] leading-tight font-semibold tracking-[-0.03em] text-ink-primary">
						Projects
					</h1>
					<Badge tone={atProjectLimit ? 'amber' : 'neutral'}>
						{#if data.limits.maxProjects !== null}
							{data.projects.length} / {data.limits.maxProjects}
						{:else}
							{data.projects.length} {data.projects.length === 1 ? 'project' : 'projects'}
						{/if}
					</Badge>
					{#if data.limits.maxProjects === null}
						<Badge tone="emerald" dot>Local Unlimited</Badge>
					{/if}
				</div>
				<p class="mt-1 text-sm text-ink-secondary">
					Each project holds its own role templates, imported dataset and generated certificates.
				</p>
			</div>

			<div class="flex flex-col gap-2.5 sm:flex-row sm:items-center">
				{#if data.projects.length > 0}
					<div class="relative w-full sm:w-64">
						<Search
							class="pointer-events-none absolute top-1/2 left-3 h-[15px] w-[15px] -translate-y-1/2 text-ink-muted"
						/>
						<input
							type="text"
							aria-label="Search projects"
							bind:value={searchQuery}
							placeholder="Search projects..."
							class="block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card py-1.5 pr-8 pl-9 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
						/>
						{#if searchQuery}
							<button
								type="button"
								aria-label="Clear project search"
								onclick={() => (searchQuery = '')}
								class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
							>
								<X class="h-3.5 w-3.5" />
							</button>
						{/if}
					</div>
				{/if}

				<Button
					variant="primary"
					disabled={atProjectLimit}
					title={atProjectLimit
						? `Maximum of ${data.limits.maxProjects} projects reached. Delete a project to add a new one.`
						: 'Create a new project'}
					onclick={() => (showCreateModal = true)}
					class="w-full sm:w-auto"
				>
					<FolderPlus class="h-4 w-4" />
					New Project
				</Button>
			</div>
		</div>

		{#if atProjectLimit}
			<div
				class="flex items-start gap-3 rounded-xl border border-tone-warning-border bg-tone-warning-soft px-4 py-3 text-xs text-tone-warning-ink sm:text-sm"
			>
				<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
				<span>
					You have reached the limit of {data.limits.maxProjects} projects per account. Open an older
					project's Settings to delete it before creating a new one.
				</span>
			</div>
		{/if}

		{#if form?.error}
			<div
				role="alert"
				class="flex items-start gap-3 rounded-xl border border-tone-danger-border bg-tone-danger-soft px-4 py-3 text-sm text-tone-danger-ink"
			>
				<OctagonAlert class="mt-0.5 h-4 w-4 shrink-0" />
				<span>{form.error}</span>
			</div>
		{/if}

		{#if data.projects.length === 0}
			<EmptyState
				title="No projects yet"
				description="Create your first project to design certificate templates, import your CSV or Excel sheet and generate certificates."
			>
				{#snippet icon()}
					<CertFlowLogo variant="studio" size={24} decorative />
				{/snippet}
				{#snippet action()}
					<Button variant="primary" onclick={() => (showCreateModal = true)}>
						<FolderPlus class="h-4 w-4" />
						Create First Project
					</Button>
				{/snippet}
			</EmptyState>
		{:else if filteredProjects.length === 0}
			<EmptyState
				title="No matching projects"
				description={`No projects match "${searchQuery.trim()}". Clear the search box to see all projects.`}
			>
				{#snippet icon()}
					<Search class="h-5 w-5" />
				{/snippet}
				{#snippet action()}
					<Button variant="secondary" onclick={() => (searchQuery = '')}>Clear Search</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredProjects as project (project.id)}
					<ProjectCard {project} />
				{/each}
			</div>
		{/if}
	</main>
</div>

<CreateProjectModal bind:open={showCreateModal} />
