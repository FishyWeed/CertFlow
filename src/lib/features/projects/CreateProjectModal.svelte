<script lang="ts">
	import { enhance } from '$app/forms';
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
	description="Each project holds its own role templates, imported dataset and generated certificates."
>
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
			<label for="project-name" class="block text-sm font-medium text-slate-700">
				Project Name
			</label>
			<input
				id="project-name"
				name="name"
				type="text"
				required
				placeholder="e.g. 21st Malaysian Chess Festival 2026"
				class="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
			/>
		</div>

		<div>
			<label for="cert-title" class="block text-sm font-medium text-slate-700">
				Default Certificate / Event Title
			</label>
			<input
				id="cert-title"
				name="defaultCertTitle"
				type="text"
				placeholder="Defaults to Project Name if left blank"
				class="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
			/>
		</div>

		<div>
			<label for="project-desc" class="block text-sm font-medium text-slate-700">
				Description (Optional)
			</label>
			<textarea
				id="project-desc"
				name="description"
				rows={3}
				placeholder="Notes about roles, categories or distribution..."
				class="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
			></textarea>
		</div>

		<div class="flex justify-end gap-2 pt-2">
			<button
				type="button"
				onclick={() => (open = false)}
				class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
			>
				Cancel
			</button>
			<button
				type="submit"
				class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
			>
				Create Project
			</button>
		</div>
	</form>
</Modal>
