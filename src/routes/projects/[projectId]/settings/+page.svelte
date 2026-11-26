<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { AlertTriangle, CheckCircle2, OctagonAlert } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
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

<main class="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
	<div>
		<h2 class="font-display text-lg font-semibold tracking-tight text-ink-primary">
			Project Settings
		</h2>
		<p class="mt-0.5 text-sm text-ink-secondary">
			Update project metadata or remove this project and all associated templates and datasets.
		</p>
	</div>

	{#if form?.error}
		<div
			role="alert"
			class="flex items-start gap-2.5 rounded-xl border border-tone-danger-border bg-tone-danger-soft px-4 py-3 text-sm text-tone-danger-ink"
		>
			<OctagonAlert class="mt-0.5 h-4 w-4 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}
	{#if form?.saved}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-tone-data-border bg-tone-data-soft px-4 py-3 text-sm font-medium text-tone-data-ink"
		>
			<CheckCircle2 class="cf-seal-stamp mt-0.5 h-4 w-4 shrink-0" />
			<span>Project settings saved.</span>
		</div>
	{/if}

	<section class="rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
		<h3 class="font-display text-[15px] font-semibold text-ink-primary">Project Details</h3>
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
				<label for="s-name" class="block text-xs font-medium text-ink-secondary">
					Project Name
				</label>
				<input
					id="s-name"
					name="name"
					type="text"
					required
					minlength={2}
					bind:value={projectName}
					class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary outline-none transition focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
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
					class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary outline-none transition focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
				/>
			</div>
			<div>
				<label for="s-desc" class="block text-xs font-medium text-ink-secondary">Description</label>
				<textarea
					id="s-desc"
					name="description"
					rows={3}
					bind:value={description}
					class="mt-1.5 block w-full rounded-lg border border-border-strong bg-surface-card px-3 py-2 text-sm text-ink-primary outline-none transition focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
				></textarea>
			</div>
			<div class="pt-1">
				<Button type="submit" variant="contrast" disabled={saving}>
					{saving ? 'Saving...' : 'Save Project Details'}
				</Button>
			</div>
		</form>
	</section>

	<section class="rounded-2xl border border-tone-danger-border bg-tone-danger-soft/55 p-6">
		<h3 class="font-display text-[15px] font-semibold text-tone-danger-ink">Danger Zone</h3>
		<p class="mt-1 text-xs leading-relaxed text-tone-danger-ink/90">
			Warning: if you delete this project, CertFlow permanently removes all templates, uploaded
			images, table rows and certificates.
		</p>
		<div class="mt-4">
			<Button type="button" variant="danger" onclick={() => (confirmDelete = true)}>
				Delete Project
			</Button>
		</div>
	</section>
</main>

<Modal
	bind:open={confirmDelete}
	title={`Delete "${data.project.name}"?`}
	description="This action cannot be undone. All templates, uploaded images, spreadsheet rows and generated certificates in this project will be permanently deleted."
	maxWidthClass="max-w-md"
>
	{#snippet icon()}
		<AlertTriangle class="h-5 w-5 text-tone-danger-ink" />
	{/snippet}

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
	>
		<div class="flex items-center justify-end gap-2.5 border-t border-border-subtle pt-4">
			<Button
				type="button"
				variant="secondary"
				disabled={deleting}
				onclick={() => (confirmDelete = false)}
			>
				Cancel
			</Button>
			<Button type="submit" variant="danger" disabled={deleting}>
				{deleting ? 'Deleting...' : 'Confirm Delete Project'}
			</Button>
		</div>
	</form>
</Modal>
