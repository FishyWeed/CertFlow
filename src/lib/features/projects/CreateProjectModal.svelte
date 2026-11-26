<script lang="ts">
	import { enhance } from '$app/forms';
	import { FolderPlus } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';

	interface Props {
		open: boolean;
		action?: string;
	}

	let { open = $bindable(false), action = '?/createProject' }: Props = $props();
</script>

<Modal
	bind:open
	title="Create New Project"
	description="Organise role templates, recipient spreadsheets and generated certificates in one workspace."
	maxWidthClass="max-w-md"
>
	{#snippet icon()}
		<FolderPlus class="h-5 w-5" />
	{/snippet}

	<form
		method="POST"
		{action}
		use:enhance={() => {
			return async ({ result, update }) => {
				await update();
				if (result.type === 'success') {
					open = false;
				}
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="project-name" class="block text-xs font-medium text-ink-secondary">
				Project Name
			</label>
			<input
				id="project-name"
				name="name"
				type="text"
				required
				placeholder="e.g. Annual Conference 2026"
				class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
			/>
		</div>

		<div>
			<label for="cert-title" class="block text-xs font-medium text-ink-secondary">
				Default Certificate / Event Title
			</label>
			<input
				id="cert-title"
				name="defaultCertTitle"
				type="text"
				placeholder="Defaults to Project Name if left blank"
				class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
			/>
		</div>

		<div>
			<label for="project-desc" class="block text-xs font-medium text-ink-secondary">
				Description (Optional)
			</label>
			<textarea
				id="project-desc"
				name="description"
				rows={3}
				placeholder="Notes about roles, categories or distribution..."
				class="mt-1.5 block w-full rounded-lg border border-border-strong bg-surface-card px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
			></textarea>
		</div>

		<div class="mt-6 flex items-center justify-end gap-2.5 border-t border-border-subtle pt-4">
			<Button type="button" variant="secondary" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit" variant="primary">Create Project</Button>
		</div>
	</form>
</Modal>
