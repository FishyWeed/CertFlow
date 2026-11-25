<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let projectId = untrack(() => data.project.id);
	let projectName = $state(untrack(() => data.project.name));
	let defaultCertTitle = $state(untrack(() => data.project.defaultCertTitle));
	let description = $state(untrack(() => data.project.description ?? ''));
	let saving = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	$effect(() => {
		if (data.project.id !== projectId) {
			projectId = data.project.id;
			projectName = data.project.name;
			defaultCertTitle = data.project.defaultCertTitle;
			description = data.project.description ?? '';
			confirmDelete = false;
		}
	});
</script>

<main class="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
	{#if form?.error}
		<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
			{form.error}
		</div>
	{/if}
	{#if form?.saved}
		<div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
			Project settings saved.
		</div>
	{/if}

	<section class="rounded-xl border border-border-default bg-surface-card p-5">
		<h2 class="text-base font-semibold text-ink-primary">Project Details</h2>
		<form
			method="POST"
			action="?/updateProject"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update({ reset: false });
					saving = false;
				};
			}}
			class="mt-4 space-y-4"
		>
			<div>
				<label for="s-name" class="block text-xs font-medium text-ink-secondary">Project Name</label>
				<input
					id="s-name"
					name="name"
					type="text"
					required
					minlength={2}
					bind:value={projectName}
					class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
				/>
			</div>
			<div>
				<label for="s-title" class="block text-xs font-medium text-ink-secondary">
					Default Certificate / Event Title
				</label>
				<input
					id="s-title"
					name="defaultCertTitle"
					type="text"
					bind:value={defaultCertTitle}
					class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
				/>
			</div>
			<div>
				<label for="s-desc" class="block text-xs font-medium text-ink-secondary">Description</label>
				<textarea
					id="s-desc"
					name="description"
					rows={3}
					bind:value={description}
					class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
				></textarea>
			</div>
			<Button type="submit" variant="primary" disabled={saving}>
				{saving ? 'Saving...' : 'Save Project Details'}
			</Button>
		</form>
	</section>

	<section class="rounded-xl border border-red-200 bg-red-50/40 p-5">
		<h2 class="text-base font-semibold text-red-900">Danger Zone</h2>
		<p class="mt-1 text-xs text-red-700">
			Warning: if you delete this project, CertFlow permanently removes all templates, uploaded
			images, table rows and certificates.
		</p>
		{#if !confirmDelete}
			<div class="mt-4">
				<Button type="button" variant="danger" onclick={() => (confirmDelete = true)}>
					Delete Project
				</Button>
			</div>
		{:else}
			<form
				method="POST"
				action="?/deleteProject"
				use:enhance={() => {
					deleting = true;
					return async ({ update }) => {
						await update();
						deleting = false;
					};
				}}
				class="mt-4 flex flex-wrap items-center gap-2"
			>
				<Button type="submit" variant="danger" disabled={deleting}>
					{deleting ? 'Deleting...' : 'Confirm Delete Project'}
				</Button>
				<Button
					type="button"
					variant="secondary"
					disabled={deleting}
					onclick={() => (confirmDelete = false)}
				>
					Cancel
				</Button>
			</form>
		{/if}
	</section>
</main>
