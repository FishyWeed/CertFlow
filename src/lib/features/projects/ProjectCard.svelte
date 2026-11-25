<script lang="ts">
	import { FileBadge2, Layers, Users } from '@lucide/svelte';

	export interface ProjectSummary {
		id: string;
		name: string;
		defaultCertTitle: string;
		description: string | null;
		templateCount: number;
		recipientCount: number;
		certificateCount: number;
	}

	interface Props {
		project: ProjectSummary;
	}

	let { project }: Props = $props();
</script>

<a
	href="/projects/{project.id}/editor"
	class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-indigo-300 hover:shadow-md"
>
	<div>
		<h2 class="text-lg font-semibold text-slate-900">{project.name}</h2>
		{#if project.defaultCertTitle && project.defaultCertTitle !== project.name}
			<p class="mt-0.5 text-xs font-medium text-indigo-600">
				{project.defaultCertTitle}
			</p>
		{/if}
		{#if project.description}
			<p class="mt-2 line-clamp-2 text-sm text-slate-600">{project.description}</p>
		{/if}
	</div>

	<div class="mt-6 border-t border-slate-100 pt-4">
		<div class="grid grid-cols-3 gap-2 text-center text-xs">
			<div class="rounded-lg border border-indigo-100 bg-indigo-50/60 px-2 py-2">
				<div class="flex items-center justify-center gap-1 font-semibold text-indigo-900">
					<Layers class="h-3.5 w-3.5 text-indigo-600" />
					{project.templateCount}
				</div>
				<span class="mt-0.5 block text-[11px] text-indigo-700">Templates</span>
			</div>
			<div class="rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-2">
				<div class="flex items-center justify-center gap-1 font-semibold text-emerald-900">
					<Users class="h-3.5 w-3.5 text-emerald-600" />
					{project.recipientCount}
				</div>
				<span class="mt-0.5 block text-[11px] text-emerald-700">Rows</span>
			</div>
			<div class="rounded-lg border border-amber-100 bg-amber-50/60 px-2 py-2">
				<div class="flex items-center justify-center gap-1 font-semibold text-amber-900">
					<FileBadge2 class="h-3.5 w-3.5 text-amber-600" />
					{project.certificateCount}
				</div>
				<span class="mt-0.5 block text-[11px] text-amber-700">Certs</span>
			</div>
		</div>
	</div>
</a>
