<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
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
		<form method="POST" action="?/updateProject" use:enhance class="mt-4 space-y-4">
			<div>
				<label for="s-name" class="block text-xs font-medium text-ink-secondary">Project Name</label>
				<input
					id="s-name"
					name="name"
					type="text"
					required
					value={data.project.name}
					class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
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
					value={data.project.defaultCertTitle}
					class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="s-desc" class="block text-xs font-medium text-ink-secondary">Description</label>
				<textarea
					id="s-desc"
					name="description"
					rows={3}
					value={data.project.description ?? ''}
					class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
				></textarea>
			</div>
			<Button type="submit" variant="primary">Save Project Details</Button>
		</form>
	</section>

	<section class="rounded-xl border border-red-200 bg-red-50/40 p-5">
		<h2 class="text-base font-semibold text-red-900">Danger Zone</h2>
		<p class="mt-1 text-xs text-red-700">
			Warning: if you delete this project, CertFlow permanently removes all templates, table rows
			and certificates.
		</p>
		<form method="POST" action="?/deleteProject" class="mt-4">
			<Button type="submit" variant="danger">Delete Project</Button>
		</form>
	</section>
</main>
