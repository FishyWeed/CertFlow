<script lang="ts">
	import {
		ArrowLeft,
		ArrowRight,
		Award,
		Check,
		Cloud,
		Copy,
		Download,
		ExternalLink,
		FileSpreadsheet,
		FolderArchive,
		HardDrive,
		Layers,
		Mail,
		Maximize2,
		Monitor,
		Send,
		SlidersHorizontal,
		Star,
		Terminal,
		Type,
		X
	} from '@lucide/svelte';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Interactive sample certificate preview state in the hero
	interface SampleRecipient {
		id: string;
		tabLabel: string;
		templateName: string;
		badgeTone: string;
		certTitle: string;
		recipientName: string;
		roleLine: string;
		eventLine: string;
		email: string;
	}

	const sampleRecipients: SampleRecipient[] = [
		{
			id: 'champion',
			tabLabel: 'Champion',
			templateName: 'Winner Template',
			badgeTone: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
			certTitle: 'CERTIFICATE OF ACHIEVEMENT',
			recipientName: 'Daniel Lim Sheng Wei',
			roleLine: 'CHAMPION',
			eventLine: 'APU CHESS OPEN 2026',
			email: 'daniel.lim@example.edu'
		},
		{
			id: 'participant',
			tabLabel: 'Participant',
			templateName: 'Participant Template',
			badgeTone: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
			certTitle: 'CERTIFICATE OF PARTICIPATION',
			recipientName: 'Aisha Nurul Huda',
			roleLine: 'PARTICIPANT',
			eventLine: 'APU CHESS OPEN 2026',
			email: 'aisha.huda@example.edu'
		},
		{
			id: 'organiser',
			tabLabel: 'Organiser',
			templateName: 'Committee Template',
			badgeTone: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
			certTitle: 'CERTIFICATE OF APPRECIATION',
			recipientName: 'Marcus Tan Jun Jie',
			roleLine: 'EVENT DIRECTOR',
			eventLine: 'APU CHESS OPEN 2026',
			email: 'marcus.tan@example.edu'
		}
	];

	let activeSampleId = $state('champion');
	const activeSample = $derived(
		sampleRecipients.find((r) => r.id === activeSampleId) ?? sampleRecipients[0]
	);

	// Interactive Product Tour slides powered by real Playwright captures (light & dark)
	interface ProductSlide {
		id: string;
		step: string;
		label: string;
		title: string;
		caption: string;
		lightSrc: string;
		darkSrc: string;
		activeTabClass: string;
		badgeClass: string;
		highlights: string[];
	}

	const productSlides: ProductSlide[] = [
		{
			id: 'editor',
			step: '1',
			label: '1. Design Editor',
			title: 'Gridded canvas sandbox with direct on-canvas text editing',
			caption:
				'Drag properties onto the certificate, style individual words with 114 built-in fonts and align elements using smart centre and equal-spacing guides.',
			lightSrc: '/demo/editor-light.png',
			darkSrc: '/demo/editor-dark.png',
			activeTabClass: 'border-indigo-500 bg-indigo-50 text-indigo-700',
			badgeClass: 'bg-indigo-100 text-indigo-700',
			highlights: ['Direct on-canvas WYSIWYG', 'Optical vertical centring', '114 built-in fonts']
		},
		{
			id: 'data',
			step: '2',
			label: '2. Data & Mapping',
			title: 'Spreadsheet import, inline editing and automatic template routing',
			caption:
				'Upload CSV or Excel lists, search or filter any column, drag to reorder rows and inspect which certificate template matches each recipient.',
			lightSrc: '/demo/data-light.png',
			darkSrc: '/demo/data-dark.png',
			activeTabClass: 'border-emerald-500 bg-emerald-50 text-emerald-700',
			badgeClass: 'bg-emerald-100 text-emerald-700',
			highlights: ['CSV & Excel import', 'Filter & sort every column', 'Matched Template badges']
		},
		{
			id: 'certificates',
			step: '3',
			label: '3. Generate Certificates',
			title: 'Live side-by-side previews with per-recipient overrides',
			caption:
				'Review every generated certificate before export, override single-recipient properties without changing your dataset and download PDF, PNG, JPG or ZIP archives.',
			lightSrc: '/demo/certificates-light.png',
			darkSrc: '/demo/certificates-dark.png',
			activeTabClass: 'border-amber-500 bg-amber-50 text-amber-800',
			badgeClass: 'bg-amber-100 text-amber-800',
			highlights: ['Role filter pills', 'Per-recipient overrides', 'Single file or role-sorted ZIP']
		},
		{
			id: 'email',
			step: '4',
			label: '4. Send Email',
			title: 'Personalised bulk delivery with per-recipient tracking',
			caption:
				'Write reusable email templates with {{property}} tokens, attach rendered certificates and track sent, remaining, failed and skipped recipients.',
			lightSrc: '/demo/email-light.png',
			darkSrc: '/demo/email-dark.png',
			activeTabClass: 'border-sky-500 bg-sky-50 text-sky-700',
			badgeClass: 'bg-sky-100 text-sky-700',
			highlights: ['Brevo, Resend & SMTP', 'Saved project drafts', 'Live delivery tracker']
		}
	];

	let activeSlideIndex = $state(0);
	let expandedSlide = $state<ProductSlide | null>(null);
	const activeSlide = $derived(productSlides[activeSlideIndex] ?? productSlides[0]);

	function prevSlide() {
		activeSlideIndex = (activeSlideIndex - 1 + productSlides.length) % productSlides.length;
	}

	function nextSlide() {
		activeSlideIndex = (activeSlideIndex + 1) % productSlides.length;
	}

	function handleLandingKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && expandedSlide) {
			expandedSlide = null;
		}
	}

	// Interactive Deploy & Self-Host selector
	type DeployTab = 'windows' | 'portable' | 'cloud' | 'docker';
	let activeDeployTab = $state<DeployTab>('windows');
	let copiedCmdKey = $state<string | null>(null);

	const dockerGhcrCmd = 'docker compose -f docker-compose.ghcr.yml up -d';
	const dockerSingleCmd =
		'docker run -d --name certflow -p 3000:3000 -v certflow_data:/data ghcr.io/fishyweed/certflow:latest';
	const localDevCmd = 'pnpm install && cp .env.example .env && pnpm db:push && pnpm dev';

	async function copyCommand(key: string, value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copiedCmdKey = key;
			setTimeout(() => {
				if (copiedCmdKey === key) copiedCmdKey = null;
			}, 2000);
		} catch {
			// Ignore clipboard errors in restricted contexts.
		}
	}

	const formattedStars = $derived(
		data.github.stars !== null ? data.github.stars.toLocaleString('en-GB') : null
	);
</script>

<svelte:head>
	<title>CertFlow — Bulk Certificate Designer, Generator and Emailer</title>
	<meta
		name="description"
		content="Design certificate templates, import CSV or Excel spreadsheets, generate personalised certificates in bulk and email them from one workspace."
	/>
</svelte:head>

<svelte:window onkeydown={handleLandingKeydown} />

<div class="flex min-h-screen flex-col bg-surface-page text-ink-primary">
	<AppHeader brandHref="/">
		{#snippet actions()}
			<nav aria-label="Landing sections" class="hidden items-center gap-1 md:flex">
				<a
					href="#tour"
					class="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
				>
					Product Tour
				</a>
				<a
					href="#features"
					class="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
				>
					Features
				</a>
				<a
					href="#how-it-works"
					class="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
				>
					How It Works
				</a>
				<a
					href="#deploy"
					class="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
				>
					Deploy &amp; Host
				</a>
			</nav>

			<a
				href={data.github.repoUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-semibold text-ink-primary transition hover:border-border-strong hover:bg-surface-subtle"
				title="Star CertFlow on GitHub"
			>
				<svg class="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
					/>
				</svg>
				<span class="hidden sm:inline">GitHub</span>
				{#if formattedStars !== null}
					<span
						class="inline-flex items-center gap-0.5 rounded-md bg-surface-subtle px-1.5 py-0.5 text-[11px] font-semibold text-ink-secondary"
					>
						<Star class="h-3 w-3 fill-amber-400 text-amber-500" />
						{formattedStars}
					</span>
				{/if}
			</a>

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
					class="inline-flex min-h-9 items-center rounded-lg px-2.5 py-2 text-xs font-medium text-ink-primary transition hover:bg-surface-subtle sm:px-3.5 sm:text-sm"
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

	<main class="flex-1">
		<!-- Hero Section -->
		<section class="editor-sandbox-grid relative border-b border-border-default">
			<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16 lg:py-20">
				<div class="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
					<!-- Left: Copy and Primary CTAs -->
					<div class="lg:col-span-6">
						<div class="flex flex-wrap items-center gap-2">
							<a
								href={data.github.releasesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-card px-3 py-1 text-xs font-semibold text-accent shadow-xs transition hover:border-accent"
							>
								<span>Open Source</span>
								{#if data.github.latestVersion}
									<span class="text-ink-muted">·</span>
									<span>{data.github.latestVersion}</span>
								{/if}
								<ExternalLink class="h-3 w-3" />
							</a>
							{#if data.isLocalApp}
								<span
									class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
								>
									Local Edition · Unlimited
								</span>
							{/if}
						</div>

						<h1
							class="mt-5 text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl lg:text-5xl lg:leading-[1.12]"
						>
							Design, generate and send certificates in one workspace.
						</h1>

						<p class="mt-4 max-w-xl text-sm leading-relaxed text-ink-secondary sm:text-base">
							Build reusable templates on an interactive canvas, import CSV or Excel sheets, route
							roles automatically and deliver PDF, PNG or JPG certificates in bulk.
						</p>

						<div class="mt-7 flex flex-wrap items-center gap-3">
							<a
								href={data.user ? '/dashboard' : '/login?mode=signup'}
								class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover"
							>
								{data.user ? 'Open Your Projects' : 'Create Free Account'}
								<ArrowRight class="h-4 w-4" />
							</a>

							<a
								href={data.github.windowsInstallerUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-card px-4 py-2.5 text-sm font-semibold text-ink-primary shadow-xs transition hover:bg-surface-subtle"
							>
								<Download class="h-4 w-4 text-accent" />
								<span>Windows Installer</span>
							</a>

							<a
								href={data.github.repoUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-card px-4 py-2.5 text-sm font-semibold text-ink-primary transition hover:border-border-strong hover:bg-surface-subtle"
							>
								<Star class="h-4 w-4 fill-amber-400 text-amber-500" />
								<span>Star on GitHub</span>
								{#if formattedStars !== null}
									<span
										class="rounded-md bg-surface-subtle px-1.5 py-0.5 text-xs font-bold text-ink-primary"
									>
										{formattedStars}
									</span>
								{/if}
							</a>
						</div>

						<div
							class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-ink-secondary"
						>
							<span class="inline-flex items-center gap-1.5">
								<Check class="h-3.5 w-3.5 text-emerald-600" />
								114 built-in fonts
							</span>
							<span class="inline-flex items-center gap-1.5">
								<Check class="h-3.5 w-3.5 text-emerald-600" />
								Browser-rendered PDF, PNG, JPG &amp; ZIP
							</span>
							<span class="inline-flex items-center gap-1.5">
								<Check class="h-3.5 w-3.5 text-emerald-600" />
								Cloud, Docker or offline desktop
							</span>
						</div>
					</div>

					<!-- Right: Interactive Certificate Preview Stage -->
					<div class="lg:col-span-6">
						<div
							class="overflow-hidden rounded-2xl border border-border-strong bg-surface-card shadow-lg"
						>
							<!-- Mock Editor Header Bar -->
							<div
								class="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-card px-3.5 py-2.5"
							>
								<div class="flex items-center gap-1.5">
									<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
									<span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
									<span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
									<span class="ml-2 text-xs font-semibold text-ink-primary">
										Live Template Routing Preview
									</span>
								</div>
								<div class="flex items-center gap-1" role="tablist" aria-label="Sample recipients">
									{#each sampleRecipients as sample (sample.id)}
										<button
											type="button"
											role="tab"
											aria-selected={activeSampleId === sample.id}
											onclick={() => (activeSampleId = sample.id)}
											class="rounded-md px-2.5 py-1 text-[11px] font-semibold transition {activeSampleId ===
											sample.id
												? 'bg-accent text-white shadow-xs'
												: 'bg-surface-subtle text-ink-secondary hover:text-ink-primary'}"
										>
											{sample.tabLabel}
										</button>
									{/each}
								</div>
							</div>

							<!-- Mini Formatting Toolbar -->
							<div
								class="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-page px-3.5 py-1.5 text-[11px] text-ink-secondary"
							>
								<div class="flex items-center gap-2">
									<span class="rounded border border-border-default bg-surface-card px-2 py-0.5 font-medium">
										Playfair Display
									</span>
									<span class="rounded border border-border-default bg-surface-card px-1.5 py-0.5 font-medium">
										42 px
									</span>
									<span class="font-bold text-ink-primary">B</span>
									<span class="italic">I</span>
									<span class="underline">U</span>
								</div>
								<span class="font-medium text-accent">{activeSample.templateName}</span>
							</div>

							<!-- Live Styled Certificate Card -->
							<div class="editor-sandbox-grid p-4 sm:p-6">
								<div
									class="preserve-light relative mx-auto aspect-[1.414/1] w-full overflow-hidden rounded-sm bg-[#11192b] p-4 text-center shadow-md ring-1 ring-slate-900/20 sm:p-6"
								>
									<!-- Outer & Inner Gold Borders -->
									<div
										class="flex h-full w-full flex-col items-center justify-between border-2 border-[#d4af37] p-1.5"
									>
										<div
											class="flex h-full w-full flex-col items-center justify-center border border-[#d4af37]/50 px-4 py-3"
										>
											<span
												class="inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wider uppercase {activeSample.badgeTone}"
											>
												Matched: {activeSample.templateName}
											</span>

											<p
												class="mt-2.5 font-serif text-xs font-bold tracking-[0.2em] text-[#e5c158] sm:text-sm"
											>
												{activeSample.certTitle}
											</p>

											<p class="mt-2 text-[9px] tracking-[0.18em] text-slate-400 uppercase">
												HONOURING THE ACHIEVEMENT OF
											</p>

											<!-- Selected Bounding Box Mock -->
											<div
												class="relative mt-2 w-full max-w-[88%] border border-indigo-400/90 px-3 py-1.5"
											>
												<span
													class="absolute -top-1 -left-1 h-2 w-2 rounded-[1px] border border-indigo-500 bg-white"
												></span>
												<span
													class="absolute -top-1 -right-1 h-2 w-2 rounded-[1px] border border-indigo-500 bg-white"
												></span>
												<span
													class="absolute -bottom-1 -left-1 h-2 w-2 rounded-[1px] border border-indigo-500 bg-white"
												></span>
												<span
													class="absolute -right-1 -bottom-1 h-2 w-2 rounded-[1px] border border-indigo-500 bg-white"
												></span>
												<p class="truncate font-serif text-lg font-semibold italic text-white sm:text-2xl">
													{activeSample.recipientName}
												</p>
											</div>

											<div class="mt-2.5 h-px w-28 bg-[#d4af37]/70"></div>

											<p class="mt-2 text-[10px] font-bold tracking-[0.16em] text-slate-100 uppercase">
												{activeSample.roleLine}
											</p>
											<p class="mt-0.5 text-[10px] tracking-[0.12em] text-slate-300">
												{activeSample.eventLine}
											</p>
										</div>
									</div>
								</div>
							</div>

							<!-- Bound Properties Footer Strip -->
							<div
								class="flex flex-wrap items-center justify-between gap-2 border-t border-border-default bg-surface-card px-3.5 py-2 text-[11px] text-ink-secondary"
							>
								<div class="flex flex-wrap items-center gap-1.5">
									<code class="rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">
										{'{{name}}'}
									</code>
									<code class="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
										{'{{role}}'}
									</code>
									<code class="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
										{'{{rank}}'}
									</code>
								</div>
								<span class="truncate text-ink-muted">Ready to send to {activeSample.email}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Interactive Product Tour Slides (Real Screenshots in Light & Dark Mode) -->
		<section id="tour" class="mx-auto max-w-6xl scroll-mt-24 px-4 pt-14 pb-6 sm:px-6 lg:pt-20">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div class="max-w-2xl">
					<p class="text-xs font-semibold tracking-wider text-accent uppercase">Product Tour</p>
					<h2 class="mt-2 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
						See every stage of the workspace in action.
					</h2>
					<p class="mt-2 text-sm text-ink-secondary sm:text-base">
						Step through real screenshots of the editor, spreadsheet router, certificate generator
						and email sender. Switch light or dark mode above to preview both themes.
					</p>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<span class="text-xs font-semibold text-ink-muted">
						{activeSlideIndex + 1} / {productSlides.length}
					</span>
					<button
						type="button"
						onclick={prevSlide}
						aria-label="Previous product slide"
						class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-surface-card text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
					>
						<ArrowLeft class="h-4 w-4" />
					</button>
					<button
						type="button"
						onclick={nextSlide}
						aria-label="Next product slide"
						class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-surface-card text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
					>
						<ArrowRight class="h-4 w-4" />
					</button>
				</div>
			</div>

			<!-- Slide Selector Tabs -->
			<div
				class="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
				role="tablist"
				aria-label="Product walkthrough slides"
			>
				{#each productSlides as slide, idx (slide.id)}
					<button
						type="button"
						role="tab"
						aria-selected={activeSlideIndex === idx}
						onclick={() => (activeSlideIndex = idx)}
						class="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition {activeSlideIndex ===
						idx
							? slide.activeTabClass + ' shadow-xs'
							: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
					>
						<span
							class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold {slide.badgeClass}"
						>
							{slide.step}
						</span>
						<span class="truncate">{slide.label.replace(/^\d+\.\s*/, '')}</span>
					</button>
				{/each}
			</div>

			<!-- Active Slide Frame -->
			<div
				class="mt-4 overflow-hidden rounded-2xl border border-border-strong bg-surface-card shadow-md"
			>
				<div
					class="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-page px-4 py-2.5"
				>
					<div class="flex min-w-0 items-center gap-2">
						<span class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400"></span>
						<span class="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400"></span>
						<span class="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400"></span>
						<span class="ml-1 truncate text-xs font-semibold text-ink-primary">
							{activeSlide.label} — {activeSlide.title}
						</span>
					</div>
					<button
						type="button"
						onclick={() => (expandedSlide = activeSlide)}
						class="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-2.5 py-1 text-[11px] font-semibold text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
					>
						<Maximize2 class="h-3 w-3" />
						Expand
					</button>
				</div>

				<div class="relative bg-surface-subtle">
					<img
						src={activeSlide.lightSrc}
						alt={`CertFlow ${activeSlide.label} screenshot (light mode)`}
						class="block aspect-[16/10] w-full object-cover object-top dark:hidden"
						loading="lazy"
					/>
					<img
						src={activeSlide.darkSrc}
						alt={`CertFlow ${activeSlide.label} screenshot (dark mode)`}
						class="hidden aspect-[16/10] w-full object-cover object-top dark:block"
						loading="lazy"
					/>
				</div>

				<div
					class="flex flex-col justify-between gap-3 border-t border-border-default bg-surface-card px-5 py-4 sm:flex-row sm:items-center"
				>
					<p class="max-w-2xl text-xs leading-relaxed text-ink-secondary sm:text-sm">
						{activeSlide.caption}
					</p>
					<div class="flex flex-wrap items-center gap-1.5">
						{#each activeSlide.highlights as item (item)}
							<span
								class="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-page px-2.5 py-1 text-[11px] font-medium text-ink-secondary"
							>
								<Check class="h-3 w-3 text-emerald-600" />
								{item}
							</span>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<!-- Features Section -->
		<section id="features" class="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 lg:py-20">
			<div class="max-w-2xl">
				<p class="text-xs font-semibold tracking-wider text-accent uppercase">Capabilities</p>
				<h2 class="mt-2 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
					Everything needed to issue certificates at scale.
				</h2>
				<p class="mt-2.5 text-sm text-ink-secondary sm:text-base">
					No external design software, mail-merge plugins or manual renaming. Every stage runs inside
					one consistent interface.
				</p>
			</div>

			<div class="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
				<div class="rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
						<Type class="h-5 w-5" />
					</div>
					<h3 class="mt-4 text-base font-semibold text-ink-primary">
						Direct On-Canvas WYSIWYG Editing
					</h3>
					<p class="mt-2 text-sm text-ink-secondary">
						Double-click any text element to type directly on the certificate. Highlight individual
						words to change font, size, weight, underline or colour live with optical vertical
						centring.
					</p>
				</div>

				<div class="rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
						<SlidersHorizontal class="h-5 w-5" />
					</div>
					<h3 class="mt-4 text-base font-semibold text-ink-primary">
						Precision Sandbox &amp; 114 Fonts
					</h3>
					<p class="mt-2 text-sm text-ink-secondary">
						Align elements with smart centre and equal-spacing guides, marquee-select from outside
						the canvas, crop images, add signatures and search 114 built-in serif, display and
						calligraphy fonts.
					</p>
				</div>

				<div class="rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
						<FileSpreadsheet class="h-5 w-5" />
					</div>
					<h3 class="mt-4 text-base font-semibold text-ink-primary">
						CSV &amp; Excel Mapping with Routing
					</h3>
					<p class="mt-2 text-sm text-ink-secondary">
						Upload CSV or Excel sheets, edit rows or columns in place and route Participants,
						Organisers and Prize Winners automatically to their matched templates.
					</p>
				</div>

				<div class="rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
						<Award class="h-5 w-5" />
					</div>
					<h3 class="mt-4 text-base font-semibold text-ink-primary">
						Bulk PDF, PNG, JPG &amp; ZIP Export
					</h3>
					<p class="mt-2 text-sm text-ink-secondary">
						Inspect every recipient's rendered certificate side by side, override single fields
						without modifying your sheet and export individual files or role-organised ZIP archives.
					</p>
				</div>

				<div class="rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
						<Mail class="h-5 w-5" />
					</div>
					<h3 class="mt-4 text-base font-semibold text-ink-primary">
						Multi-Provider Bulk Email Delivery
					</h3>
					<p class="mt-2 text-sm text-ink-secondary">
						Send personalised emails with Brevo, Resend, Custom SMTP (Gmail, Outlook, Zoho) or a
						shared server relay. Credentials are encrypted with AES-256-GCM and deliveries are
						tracked per recipient.
					</p>
				</div>

				<div class="rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
						<HardDrive class="h-5 w-5" />
					</div>
					<h3 class="mt-4 text-base font-semibold text-ink-primary">
						Unlimited Local &amp; Self-Hosted Privacy
					</h3>
					<p class="mt-2 text-sm text-ink-secondary">
						Run offline on your own computer with zero project, storage or recipient limits. Built-in
						embedded PostgreSQL keeps every project, image and setting inside one portable folder.
					</p>
				</div>
			</div>
		</section>

		<!-- How to Use Section -->
		<section
			id="how-it-works"
			class="scroll-mt-24 border-y border-border-default bg-surface-card/70 py-14 lg:py-20"
		>
			<div class="mx-auto max-w-6xl px-4 sm:px-6">
				<div class="max-w-2xl">
					<p class="text-xs font-semibold tracking-wider text-accent uppercase">How to Use It</p>
					<h2 class="mt-2 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
						From blank canvas to delivered inbox in four stages.
					</h2>
					<p class="mt-2.5 text-sm text-ink-secondary sm:text-base">
						Every project guides you through four clear tabs so organisers can prepare templates,
						verify data and send certificates without guesswork.
					</p>
				</div>

				<div class="mt-9 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-2xl border border-border-default bg-surface-page p-5">
						<div class="flex items-center justify-between">
							<span
								class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700"
							>
								1
							</span>
							<Layers class="h-4 w-4 text-indigo-600" />
						</div>
						<h3 class="mt-4 text-sm font-semibold text-ink-primary">Design Templates</h3>
						<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
							Start from a built-in preset or upload your own background. Place dynamic
							<code>{'{{name}}'}</code>, <code>{'{{role}}'}</code> and <code>{'{{rank}}'}</code>
							text elements, logos and signatures.
						</p>
					</div>

					<div class="rounded-2xl border border-border-default bg-surface-page p-5">
						<div class="flex items-center justify-between">
							<span
								class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold"
							>
								2
							</span>
							<FileSpreadsheet class="h-4 w-4 text-emerald-600" />
						</div>
						<h3 class="mt-4 text-sm font-semibold text-ink-primary">Import &amp; Map Data</h3>
						<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
							Upload a CSV or Excel sheet (or add rows manually). CertFlow detects headers
							automatically and displays the matched template for every recipient row.
						</p>
					</div>

					<div class="rounded-2xl border border-border-default bg-surface-page p-5">
						<div class="flex items-center justify-between">
							<span
								class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 text-xs font-bold"
							>
								3
							</span>
							<Award class="h-4 w-4 text-amber-600" />
						</div>
						<h3 class="mt-4 text-sm font-semibold text-ink-primary">Generate &amp; Export</h3>
						<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
							Click <strong>Generate from Dataset</strong>, inspect live certificate previews and
							download single PDF, PNG or JPG files or a role-grouped ZIP archive.
						</p>
					</div>

					<div class="rounded-2xl border border-border-default bg-surface-page p-5">
						<div class="flex items-center justify-between">
							<span
								class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 text-xs font-bold"
							>
								4
							</span>
							<Send class="h-4 w-4 text-sky-600" />
						</div>
						<h3 class="mt-4 text-sm font-semibold text-ink-primary">Send by Email</h3>
						<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
							Select a saved Brevo, Resend or SMTP sender profile, compose a personalised message
							with <code>{'{{property}}'}</code> tokens and track every sent email cleanly.
						</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Deploy & Self-Host Section -->
		<section id="deploy" class="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6 lg:py-20">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div class="max-w-2xl">
					<p class="text-xs font-semibold tracking-wider text-accent uppercase">
						Deploy &amp; Self-Host
					</p>
					<h2 class="mt-2 text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
						Run it on your desktop or deploy your own private server.
					</h2>
					<p class="mt-2.5 text-sm text-ink-secondary sm:text-base">
						CertFlow is fully open source. Install it locally with zero coding, deploy on Render or
						Railway in one click or host it with Docker.
					</p>
				</div>
				<a
					href={data.github.releasesUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
				>
					<span>All Releases on GitHub</span>
					<ExternalLink class="h-3.5 w-3.5" />
				</a>
			</div>

			<!-- Deployment Mode Tabs -->
			<div class="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Deployment options">
				<button
					type="button"
					role="tab"
					aria-selected={activeDeployTab === 'windows'}
					onclick={() => (activeDeployTab = 'windows')}
					class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition sm:text-sm {activeDeployTab ===
					'windows'
						? 'border-accent bg-accent text-white shadow-xs'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					<Monitor class="h-4 w-4" />
					Windows Installer (.exe)
				</button>

				<button
					type="button"
					role="tab"
					aria-selected={activeDeployTab === 'portable'}
					onclick={() => (activeDeployTab = 'portable')}
					class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition sm:text-sm {activeDeployTab ===
					'portable'
						? 'border-accent bg-accent text-white shadow-xs'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					<FolderArchive class="h-4 w-4" />
					Portable ZIP (Win / Mac / Linux)
				</button>

				<button
					type="button"
					role="tab"
					aria-selected={activeDeployTab === 'cloud'}
					onclick={() => (activeDeployTab = 'cloud')}
					class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition sm:text-sm {activeDeployTab ===
					'cloud'
						? 'border-accent bg-accent text-white shadow-xs'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					<Cloud class="h-4 w-4" />
					Cloud (Render &amp; Railway)
				</button>

				<button
					type="button"
					role="tab"
					aria-selected={activeDeployTab === 'docker'}
					onclick={() => (activeDeployTab = 'docker')}
					class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition sm:text-sm {activeDeployTab ===
					'docker'
						? 'border-accent bg-accent text-white shadow-xs'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					<Terminal class="h-4 w-4" />
					Docker &amp; Local Dev
				</button>
			</div>

			<!-- Tab Panels -->
			<div class="mt-4 rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs">
				{#if activeDeployTab === 'windows'}
					<div class="grid gap-6 lg:grid-cols-12 lg:items-center">
						<div class="space-y-3 lg:col-span-8">
							<h3 class="text-lg font-semibold text-ink-primary">
								Windows Desktop Installer (No Node.js or Docker Needed)
							</h3>
							<p class="text-sm text-ink-secondary">
								Install CertFlow into any folder you choose with no administrator prompt required.
								Includes a Desktop shortcut, Start Menu entry, silent system tray launcher
								(<code>CertFlow.exe</code> with no black terminal window) and unlimited local
								projects and storage.
							</p>
							<ol class="list-decimal space-y-1.5 pl-5 text-sm text-ink-secondary">
								<li>
									Download
									<code>{data.github.windowsInstallerName ?? 'CertFlow-Setup.exe'}</code> from
									GitHub Releases.
								</li>
								<li>
									Run the installer, pick any destination folder and keep
									<strong>Create a Desktop shortcut</strong> ticked.
								</li>
								<li>
									Double-click the <strong>CertFlow</strong> Desktop icon. Complete the one-time
									setup screen in your browser.
								</li>
								<li>
									Use <strong>Account Settings -&gt; Portable App Updates</strong> to download and
									install newer releases in place without losing your <code>data/</code> folder.
								</li>
							</ol>
						</div>
						<div class="flex flex-col gap-2.5 lg:col-span-4">
							<a
								href={data.github.windowsInstallerUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover"
							>
								<Download class="h-4 w-4" />
								Download Windows Installer
							</a>
							<a
								href={data.github.releasesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border-default bg-surface-page px-4 py-2 text-xs font-semibold text-ink-primary transition hover:bg-surface-subtle"
							>
								View Release Notes
								<ExternalLink class="h-3.5 w-3.5" />
							</a>
						</div>
					</div>
				{:else if activeDeployTab === 'portable'}
					<div class="grid gap-6 lg:grid-cols-12 lg:items-center">
						<div class="space-y-3 lg:col-span-8">
							<h3 class="text-lg font-semibold text-ink-primary">
								Zero-Install Portable ZIP (Windows, macOS &amp; Linux)
							</h3>
							<p class="text-sm text-ink-secondary">
								Unzip anywhere — on your Desktop, Documents folder or a USB drive. Every ZIP bundles
								Node.js 22 and embedded PostgreSQL (<code>PGlite</code>), and all user data stays
								inside the portable <code>data/</code> folder.
							</p>
							<ol class="list-decimal space-y-1.5 pl-5 text-sm text-ink-secondary">
								<li>
									Download the ZIP for your platform (<code>win-x64</code>,
									<code>darwin-arm64</code>, <code>darwin-x64</code> or <code>linux-x64</code>).
								</li>
								<li>Unzip the archive to any folder.</li>
								<li>
									Run <code>CertFlow.exe</code> on Windows (or <code>Create-Desktop-Shortcut.bat</code>
									for a Desktop shortcut), <code>Start-CertFlow.command</code> on macOS or
									<code>./start-certflow.sh</code> on Linux.
								</li>
							</ol>
						</div>
						<div class="flex flex-col gap-2.5 lg:col-span-4">
							<a
								href={data.github.releasesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover"
							>
								<FolderArchive class="h-4 w-4" />
								Download Portable ZIPs
							</a>
						</div>
					</div>
				{:else if activeDeployTab === 'cloud'}
					<div class="grid gap-6 md:grid-cols-2">
						<div class="flex flex-col justify-between rounded-xl border border-border-default bg-surface-page p-5">
							<div>
								<h3 class="text-base font-semibold text-ink-primary">Deploy on Railway</h3>
								<p class="mt-2 text-sm text-ink-secondary">
									Best for permanent cloud storage. Connects directly to GitHub with
									<code>railway.json</code>, managed PostgreSQL and a persistent
									<code>/data/uploads</code> Volume.
								</p>
								<ol class="mt-3 list-decimal space-y-1 pl-4 text-xs text-ink-secondary">
									<li>Click <strong>Deploy on Railway</strong> and select <code>FishyWeed/CertFlow</code>.</li>
									<li>Add a PostgreSQL service and a Volume mounted at <code>/data/uploads</code>.</li>
									<li>Set your auth URL and 64-character hex security secrets.</li>
								</ol>
							</div>
							<div class="mt-5">
								<a
									href="https://railway.com/new"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
								>
									Deploy on Railway
									<ExternalLink class="h-3.5 w-3.5" />
								</a>
							</div>
						</div>

						<div class="flex flex-col justify-between rounded-xl border border-border-default bg-surface-page p-5">
							<div>
								<h3 class="text-base font-semibold text-ink-primary">Deploy on Render</h3>
								<p class="mt-2 text-sm text-ink-secondary">
									True one-click Blueprint deploy via <code>render.yaml</code>. Provisions the
									Docker web service, PostgreSQL database and generated security keys automatically.
								</p>
								<ol class="mt-3 list-decimal space-y-1 pl-4 text-xs text-ink-secondary">
									<li>Click <strong>Deploy to Render</strong> and sign in with GitHub or Google.</li>
									<li>Click <strong>Apply</strong> and wait about 2 minutes for the build.</li>
									<li>Add a persistent disk on Render if you want permanent uploaded images.</li>
								</ol>
							</div>
							<div class="mt-5">
								<a
									href="https://render.com/deploy?repo=https://github.com/FishyWeed/CertFlow"
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
								>
									Deploy to Render
									<ExternalLink class="h-3.5 w-3.5" />
								</a>
							</div>
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						<div>
							<h3 class="text-base font-semibold text-ink-primary">
								Self-Host with Docker or Develop Locally
							</h3>
							<p class="mt-1 text-sm text-ink-secondary">
								Pull the multi-architecture GHCR image (<code>linux/amd64</code> and
								<code>linux/arm64</code>) and complete the built-in <code>/setup</code> wizard on
								first launch — no manual <code>.env</code> editing required.
							</p>
						</div>

						<div class="grid gap-3 md:grid-cols-2">
							<div class="rounded-xl border border-border-default bg-surface-page p-4">
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs font-semibold text-ink-primary">
										Docker Compose (Prebuilt GHCR + PostgreSQL)
									</span>
									<button
										type="button"
										onclick={() => copyCommand('ghcr', dockerGhcrCmd)}
										class="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary"
									>
										{#if copiedCmdKey === 'ghcr'}
											<Check class="h-3 w-3 text-emerald-600" />
											Copied
										{:else}
											<Copy class="h-3 w-3" />
											Copy
										{/if}
									</button>
								</div>
								<pre class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>{dockerGhcrCmd}</code></pre>
							</div>

							<div class="rounded-xl border border-border-default bg-surface-page p-4">
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs font-semibold text-ink-primary">
										Single Standalone Container (Embedded DB)
									</span>
									<button
										type="button"
										onclick={() => copyCommand('single', dockerSingleCmd)}
										class="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary"
									>
										{#if copiedCmdKey === 'single'}
											<Check class="h-3 w-3 text-emerald-600" />
											Copied
										{:else}
											<Copy class="h-3 w-3" />
											Copy
										{/if}
									</button>
								</div>
								<pre class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>{dockerSingleCmd}</code></pre>
							</div>
						</div>

						<div class="rounded-xl border border-border-default bg-surface-page p-4">
							<div class="flex items-center justify-between gap-2">
								<span class="text-xs font-semibold text-ink-primary">
									Local Development (Node.js 22 + pnpm, zero Docker needed)
								</span>
								<button
									type="button"
									onclick={() => copyCommand('dev', localDevCmd)}
									class="inline-flex items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary"
								>
									{#if copiedCmdKey === 'dev'}
										<Check class="h-3 w-3 text-emerald-600" />
										Copied
									{:else}
										<Copy class="h-3 w-3" />
										Copy
									{/if}
								</button>
							</div>
							<pre class="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>{localDevCmd}</code></pre>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- Open-Source CTA Strip -->
		<section class="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
			<div
				class="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border-strong bg-surface-card p-6 shadow-xs sm:p-8 lg:flex-row lg:items-center"
			>
				<div class="max-w-xl">
					<h2 class="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
						Ready to issue your next batch of certificates?
					</h2>
					<p class="mt-2 text-sm text-ink-secondary">
						Create a free account in the browser, install CertFlow on Windows or star the GitHub
						repository to follow new releases.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<a
						href={data.user ? '/dashboard' : '/login?mode=signup'}
						class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover"
					>
						{data.user ? 'Open Dashboard' : 'Get Started Free'}
						<ArrowRight class="h-4 w-4" />
					</a>
					<a
						href={data.github.repoUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface-page px-4 py-2.5 text-sm font-semibold text-ink-primary transition hover:bg-surface-subtle"
					>
						<Star class="h-4 w-4 fill-amber-400 text-amber-500" />
						<span>Star on GitHub</span>
						{#if formattedStars !== null}
							<span class="rounded-md bg-surface-card px-1.5 py-0.5 text-xs font-bold">
								{formattedStars}
							</span>
						{/if}
					</a>
				</div>
			</div>
		</section>
	</main>

	<!-- Footer -->
	<footer class="border-t border-border-default bg-surface-card">
		<div class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
			<div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Brand & GitHub Stars -->
				<div class="space-y-3">
					<a href="/" class="inline-flex items-center gap-2 font-semibold text-ink-primary">
						<span
							class="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white shadow-xs"
						>
							<Award class="h-4 w-4" />
						</span>
						<span class="text-base">CertFlow</span>
					</a>
					<p class="text-xs leading-relaxed text-ink-secondary">
						Open-source bulk certificate designer, generator and emailer for clubs, schools,
						competitions and organisations.
					</p>
					<div class="flex flex-wrap items-center gap-2 pt-1">
						<a
							href={data.github.repoUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-page px-2.5 py-1.5 text-xs font-semibold text-ink-primary transition hover:border-border-strong hover:bg-surface-subtle"
						>
							<Star class="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
							<span>Star</span>
							{#if formattedStars !== null}
								<span class="text-ink-secondary">{formattedStars}</span>
							{/if}
						</a>
						{#if data.github.latestVersion}
							<a
								href={data.github.releasesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center rounded-lg border border-border-default bg-surface-page px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition hover:text-ink-primary"
							>
								{data.github.latestVersion}
							</a>
						{/if}
					</div>
				</div>

				<!-- Product Links -->
				<div>
					<h3 class="text-xs font-semibold tracking-wider text-ink-primary uppercase">Product</h3>
					<ul class="mt-3 space-y-2 text-xs text-ink-secondary">
						<li>
							<a href="#features" class="transition hover:text-ink-primary">Features</a>
						</li>
						<li>
							<a href="#how-it-works" class="transition hover:text-ink-primary">How It Works</a>
						</li>
						<li>
							<a href="#deploy" class="transition hover:text-ink-primary">Deploy &amp; Host</a>
						</li>
						<li>
							<a
								href={data.user ? '/dashboard' : '/login'}
								class="transition hover:text-ink-primary"
							>
								{data.user ? 'Your Projects' : 'Sign In'}
							</a>
						</li>
					</ul>
				</div>

				<!-- Install & Hosting Links -->
				<div>
					<h3 class="text-xs font-semibold tracking-wider text-ink-primary uppercase">
						Install &amp; Host
					</h3>
					<ul class="mt-3 space-y-2 text-xs text-ink-secondary">
						<li>
							<a
								href={data.github.windowsInstallerUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Windows Installer (.exe)
							</a>
						</li>
						<li>
							<a
								href={data.github.releasesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Portable Desktop ZIPs
							</a>
						</li>
						<li>
							<a
								href="https://render.com/deploy?repo=https://github.com/FishyWeed/CertFlow"
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Deploy on Render
							</a>
						</li>
						<li>
							<a
								href="https://railway.com/new"
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Deploy on Railway
							</a>
						</li>
						<li>
							<a
								href={data.github.ghcrUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Docker Image (GHCR)
							</a>
						</li>
					</ul>
				</div>

				<!-- Open Source & Docs -->
				<div>
					<h3 class="text-xs font-semibold tracking-wider text-ink-primary uppercase">
						Open Source
					</h3>
					<ul class="mt-3 space-y-2 text-xs text-ink-secondary">
						<li>
							<a
								href={data.github.repoUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								GitHub Repository
							</a>
						</li>
						<li>
							<a
								href={`${data.github.repoUrl}/releases`}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Release Changelog
							</a>
						</li>
						<li>
							<a
								href={data.github.issuesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Report an Issue
							</a>
						</li>
						<li>
							<a
								href={`${data.github.repoUrl}/blob/main/docs/PIPELINES.md`}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Deployment Pipelines Guide
							</a>
						</li>
						<li>
							<a
								href={`${data.github.repoUrl}/blob/main/docs/BLUEPRINT.md`}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Architecture Blueprint
							</a>
						</li>
					</ul>
				</div>
			</div>

			<div
				class="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border-default pt-6 text-xs text-ink-muted sm:flex-row"
			>
				<p>CertFlow — Open-source certificate workspace.</p>
				<div class="flex items-center gap-4">
					<a
						href={data.github.repoUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="transition hover:text-ink-primary"
					>
						github.com/{data.github.repoSlug}
					</a>
				</div>
			</div>
		</div>
	</footer>

	<!-- Full-size Screenshot Lightbox -->
	{#if expandedSlide}
		<div
			role="dialog"
			aria-modal="true"
			aria-label={`${expandedSlide.label} full-size preview`}
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
		>
			<div
				class="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface-card shadow-2xl"
			>
				<div
					class="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3"
				>
					<p class="truncate text-sm font-semibold text-ink-primary">
						{expandedSlide.label} — {expandedSlide.title}
					</p>
					<button
						type="button"
						onclick={() => (expandedSlide = null)}
						aria-label="Close expanded preview"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-default text-ink-secondary transition hover:bg-surface-subtle hover:text-ink-primary"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
				<div class="overflow-auto bg-surface-subtle">
					<img
						src={expandedSlide.lightSrc}
						alt={`CertFlow ${expandedSlide.label} full-size screenshot (light mode)`}
						class="block w-full dark:hidden"
					/>
					<img
						src={expandedSlide.darkSrc}
						alt={`CertFlow ${expandedSlide.label} full-size screenshot (dark mode)`}
						class="hidden w-full dark:block"
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
