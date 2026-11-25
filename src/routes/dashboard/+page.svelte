<script lang="ts">
	import { goto } from '$app/navigation';
	import { Award, FolderPlus, LogOut, Settings } from '@lucide/svelte';
	import { authClient } from '#lib/auth-client.ts';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import CreateProjectModal from '#lib/features/projects/CreateProjectModal.svelte';
	import ProjectCard from '#lib/features/projects/ProjectCard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let showCreateModal = $state(false);
	let signingOut = $state(false);

	const atProjectLimit = $derived(
		data.limits.maxProjects !== null && data.projects.length >= data.limits.maxProjects
	);

	async function handleSignOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await goto('/', { invalidateAll: true });
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="min-h-screen bg-surface-page">
	<AppHeader brandHref="/dashboard">
		{#snippet actions()}
			<div class="hidden text-right md:block">
				<p class="text-sm font-medium text-ink-primary">{data.user.name}</p>
				<p class="text-xs text-ink-secondary">{data.user.email}</p>
			</div>
			<a
				href="/settings"
				class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-ink-primary transition hover:bg-surface-subtle sm:px-3 sm:text-sm"
			>
				<Settings class="h-4 w-4 shrink-0" />
				<span>Account</span>
			</a>
			<button
				type="button"
				disabled={signingOut}
				onclick={handleSignOut}
				class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-ink-primary transition hover:bg-surface-subtle sm:px-3 sm:text-sm"
			>
				<LogOut class="h-4 w-4 shrink-0" />
				<span class="hidden sm:inline">Sign Out</span>
			</button>
		{/snippet}
	</AppHeader>

	<main class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2.5">
					<h1 class="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">Your Projects</h1>
					<span
						class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {atProjectLimit
							? 'border-amber-300 bg-amber-50 text-amber-800'
							: 'border-border-default bg-surface-card text-ink-secondary'}"
					>
						{#if data.limits.maxProjects !== null}
							{data.projects.length} / {data.limits.maxProjects}
						{:else}
							{data.projects.length} {data.projects.length === 1 ? 'project' : 'projects'}
						{/if}
					</span>
				</div>
				<p class="mt-1 text-sm text-ink-secondary">
					Each project holds its own role templates, imported dataset and generated certificates.
				</p>
			</div>
			<button
				type="button"
				disabled={atProjectLimit}
				title={atProjectLimit
					? `Maximum of ${data.limits.maxProjects} projects reached. Delete a project to add a new one.`
					: 'Create a new project'}
				onclick={() => (showCreateModal = true)}
				class="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
			>
				<FolderPlus class="h-4 w-4" />
				New Project
			</button>
		</div>

		{#if atProjectLimit}
			<div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:text-sm">
				You have reached the limit of {data.limits.maxProjects} projects per account. Open an older
				project's Settings to delete it before creating a new one.
			</div>
		{/if}

		{#if form?.error}
			<div class="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
				{form.error}
			</div>
		{/if}

		{#if data.projects.length === 0}
			<div
				class="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface-card px-5 py-14 text-center"
			>
				<div
					class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"
				>
					<Award class="h-6 w-6" />
				</div>
				<h2 class="mt-4 text-lg font-semibold text-ink-primary">No projects yet</h2>
				<p class="mt-1 max-w-md text-sm text-ink-secondary">
					Create your first project to design certificate templates, import your CSV or Excel sheet
					and generate certificates.
				</p>
				<button
					type="button"
					onclick={() => (showCreateModal = true)}
					class="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover"
				>
					<FolderPlus class="h-4 w-4" />
					Create First Project
				</button>
			</div>
		{:else}
			<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
				{#each data.projects as project (project.id)}
					<ProjectCard {project} />
				{/each}
			</div>
		{/if}
	</main>
</div>

<CreateProjectModal bind:open={showCreateModal} />
