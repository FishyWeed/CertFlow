<script lang="ts">
	import { Award, FileSpreadsheet, Layers, Mail, ArrowRight } from '@lucide/svelte';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="min-h-screen bg-surface-page text-ink-primary">
	<AppHeader brandHref="/">
		{#snippet actions()}
			{#if data.user}
				<a
					href="/dashboard"
					class="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-accent-hover sm:px-4 sm:text-sm"
				>
					Dashboard
					<ArrowRight class="h-4 w-4" />
				</a>
			{:else}
				<a
					href="/login"
					class="inline-flex min-h-9 items-center rounded-lg px-2.5 py-2 text-xs font-medium text-ink-primary transition hover:bg-surface-subtle sm:px-4 sm:text-sm"
				>
					Sign In
				</a>
				<a
					href="/login?mode=signup"
					class="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-accent-hover sm:px-4 sm:text-sm"
				>
					Get Started
					<ArrowRight class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
				</a>
			{/if}
		{/snippet}
	</AppHeader>

	<main class="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:py-20">
		<div class="mx-auto max-w-3xl text-center">
			<span
				class="inline-flex items-center rounded-full border border-border-strong bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-hover"
			>
				Built for Events, Competitions and Organisations
			</span>
			<h1 class="mt-4 text-2xl font-bold tracking-tight text-ink-primary sm:text-4xl lg:text-5xl">
				Design, generate and email certificates in one workspace.
			</h1>
			<p class="mt-4 text-sm text-ink-secondary sm:text-base lg:text-lg">
				Create multiple templates per project, map CSV or Excel columns to properties and inspect
				every certificate. Export or email PDF, PNG and JPG files in one place.
			</p>
			<div class="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
				<a
					href={data.user ? '/dashboard' : '/login?mode=signup'}
					class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover"
				>
					{data.user ? 'Go to Projects' : 'Create Free Account'}
					<ArrowRight class="h-4 w-4" />
				</a>
			</div>
		</div>

		<section class="mt-12 grid grid-cols-1 gap-4 sm:mt-16 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
			<div class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"
				>
					<Layers class="h-5 w-5" />
				</div>
				<h2 class="mt-4 font-semibold text-ink-primary">Interactive Sandbox</h2>
				<p class="mt-2 text-sm text-ink-secondary">
					Drag, resize, align and style dynamic placeholders with full font, word-wrap and auto-fit
					controls.
				</p>
			</div>

			<div class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
				>
					<FileSpreadsheet class="h-5 w-5" />
				</div>
				<h2 class="mt-4 font-semibold text-ink-primary">CSV and Excel Mapping</h2>
				<p class="mt-2 text-sm text-ink-secondary">
					Detect headers automatically or assign columns manually to Name, Event Title, Role,
					Ranking, Email and custom fields.
				</p>
			</div>

			<div class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"
				>
					<Award class="h-5 w-5" />
				</div>
				<h2 class="mt-4 font-semibold text-ink-primary">Role Templates and Rankings</h2>
				<p class="mt-2 text-sm text-ink-secondary">
					Route Participants, Organisers and Winners to matched templates with a Properties panel on
					each certificate.
				</p>
			</div>

			<div class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
					<Mail class="h-5 w-5" />
				</div>
				<h2 class="mt-4 font-semibold text-ink-primary">Flexible Bulk Email</h2>
				<p class="mt-2 text-sm text-ink-secondary">
					Send PDF, PNG or JPG certificates with your account email or a separate sender address.
				</p>
			</div>
		</section>
	</main>
</div>
