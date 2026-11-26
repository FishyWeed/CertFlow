<script lang="ts">
	import { FileBadge2, Layers, Users } from '@lucide/svelte';

	export interface ProjectSummary {
		id: string;
		name: string;
		defaultCertTitle: string;
		description: string | null;
		updatedAt?: Date | string;
		templateCount: number;
		recipientCount: number;
		certificateCount: number;
	}

	interface Props {
		project: ProjectSummary;
	}

	let { project }: Props = $props();

	const updatedLabel = $derived.by(() => {
		if (!project.updatedAt) return '';
		const d = project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
	});
</script>

<a
	href="/projects/{project.id}/editor"
	class="cf-card-lift group flex flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-surface-card"
>
	<!-- Subtle 16:9 Cutting-Mat Preview Strip with Miniature .preserve-light Sheet -->
	<div
		class="editor-sandbox-grid relative flex aspect-[16/9] items-center justify-center border-b border-border-subtle p-5"
	>
		<div
			class="preserve-light flex h-full w-full max-w-[200px] flex-col items-center justify-center rounded-[3px] bg-white p-3 text-center transition-transform duration-200 group-hover:scale-[1.02]"
		>
			<div class="flex h-full w-full flex-col items-center justify-center border border-[#d4d4dc] px-3 py-2">
				<span class="h-1 w-12 rounded-full bg-[#b56806]/55"></span>
				<span class="mt-2 line-clamp-1 font-serif text-[10px] font-semibold tracking-tight text-[#121215]">
					{project.defaultCertTitle || project.name}
				</span>
				<span class="mt-1.5 h-1.5 w-20 rounded-full bg-[#121215]/18"></span>
				<span class="mt-1 h-1 w-14 rounded-full bg-[#121215]/12"></span>
				<span class="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[#d13b15]"></span>
			</div>
		</div>
	</div>

	<div class="flex flex-1 flex-col justify-between p-5">
		<div>
			<div class="flex items-start justify-between gap-2">
				<h2
					class="font-display line-clamp-1 text-[15px] font-semibold tracking-[-0.015em] text-ink-primary transition-colors group-hover:text-accent-ink"
				>
					{project.name}
				</h2>
				{#if updatedLabel}
					<span class="shrink-0 font-mono text-[11px] text-ink-muted tabular-nums">
						{updatedLabel}
					</span>
				{/if}
			</div>

			{#if project.defaultCertTitle && project.defaultCertTitle !== project.name}
				<p class="mt-0.5 truncate text-xs font-medium text-tone-editor-ink">
					{project.defaultCertTitle}
				</p>
			{/if}

			{#if project.description}
				<p class="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-secondary">
					{project.description}
				</p>
			{/if}
		</div>

		<div class="mt-5 border-t border-border-subtle pt-3.5">
			<div class="grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
				<div
					class="rounded-lg border border-tone-editor-border bg-tone-editor-soft px-2 py-1.5"
				>
					<div class="flex items-center justify-center gap-1 font-mono text-xs font-semibold text-tone-editor-ink">
						<Layers class="h-3.5 w-3.5 shrink-0" />
						{project.templateCount}
					</div>
					<span class="mt-0.5 block text-[10.5px] font-medium text-tone-editor-ink/85">
						Templates
					</span>
				</div>
				<div class="rounded-lg border border-tone-data-border bg-tone-data-soft px-2 py-1.5">
					<div class="flex items-center justify-center gap-1 font-mono text-xs font-semibold text-tone-data-ink">
						<Users class="h-3.5 w-3.5 shrink-0" />
						{project.recipientCount}
					</div>
					<span class="mt-0.5 block text-[10.5px] font-medium text-tone-data-ink/85">Rows</span>
				</div>
				<div class="rounded-lg border border-tone-certs-border bg-tone-certs-soft px-2 py-1.5">
					<div class="flex items-center justify-center gap-1 font-mono text-xs font-semibold text-tone-certs-ink">
						<FileBadge2 class="h-3.5 w-3.5 shrink-0" />
						{project.certificateCount}
					</div>
					<span class="mt-0.5 block text-[10.5px] font-medium text-tone-certs-ink/85">Certs</span>
				</div>
			</div>
		</div>
	</div>
</a>
