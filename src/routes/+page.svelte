<script lang="ts">
	import {
		ArrowLeft,
		ArrowRight,
		Check,
		Cloud,
		Copy,
		Download,
		ExternalLink,
		FileBadge2,
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
	import Badge from '#lib/components/ui/Badge.svelte';
	import CertFlowLogo from '#lib/components/ui/CertFlowLogo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface SampleRecipient {
		id: string;
		tabLabel: string;
		metaLine: string;
		templateName: string;
		badgeTone: 'amber' | 'indigo' | 'emerald';
		borderHex: string;
		certTitle: string;
		recipientName: string;
		roleLine: string;
		eventLine: string;
		certCode: string;
		email: string;
	}

	const sampleRecipients: SampleRecipient[] = [
		{
			id: 'champion',
			tabLabel: 'First Prize',
			metaLine: 'role: Winner · rank: 1st',
			templateName: 'Winner Template',
			badgeTone: 'amber',
			borderHex: '#B56806',
			certTitle: 'CERTIFICATE OF ACHIEVEMENT',
			recipientName: 'Daniel Lim Sheng Wei',
			roleLine: 'CHAMPION · OPEN DIVISION',
			eventLine: 'APU CHESS OPEN 2026',
			certCode: 'CF-2026-001',
			email: 'daniel.lim@example.edu'
		},
		{
			id: 'participant',
			tabLabel: 'Participant',
			metaLine: 'role: Participant · track: Open',
			templateName: 'Participant Template',
			badgeTone: 'indigo',
			borderHex: '#3B5BDB',
			certTitle: 'CERTIFICATE OF PARTICIPATION',
			recipientName: 'Aisha Nurul Huda',
			roleLine: 'OFFICIAL PARTICIPANT',
			eventLine: 'APU CHESS OPEN 2026',
			certCode: 'CF-2026-042',
			email: 'aisha.huda@example.edu'
		},
		{
			id: 'organiser',
			tabLabel: 'Organiser',
			metaLine: 'role: Committee · unit: Ops',
			templateName: 'Committee Template',
			badgeTone: 'emerald',
			borderHex: '#0D8A62',
			certTitle: 'CERTIFICATE OF APPRECIATION',
			recipientName: 'Marcus Tan Jun Jie',
			roleLine: 'EVENT DIRECTOR',
			eventLine: 'APU CHESS OPEN 2026',
			certCode: 'CF-2026-009',
			email: 'marcus.tan@example.edu'
		}
	];

	let activeSampleId = $state('champion');
	const activeSample = $derived(
		sampleRecipients.find((r) => r.id === activeSampleId) ?? sampleRecipients[0]
	);

	interface ProductSlide {
		id: string;
		step: string;
		label: string;
		title: string;
		caption: string;
		lightSrc: string;
		darkSrc: string;
		dotClass: string;
		activeTabClass: string;
		badgeClass: string;
		highlights: string[];
	}

	const productSlides: ProductSlide[] = [
		{
			id: 'editor',
			step: '01',
			label: '1. Design Editor',
			title: 'Gridded canvas sandbox with direct on-canvas text editing',
			caption:
				'Drag properties onto the certificate, style individual words with 114 built-in fonts and align elements using smart centre and equal-spacing guides.',
			lightSrc: '/demo/editor-light.png',
			darkSrc: '/demo/editor-dark.png',
			dotClass: 'bg-tone-editor',
			activeTabClass: 'border-tone-editor-border bg-tone-editor-soft text-tone-editor-ink',
			badgeClass: 'bg-tone-editor-soft text-tone-editor-ink border-tone-editor-border',
			highlights: ['Direct on-canvas WYSIWYG', 'Optical vertical centring', '114 built-in fonts']
		},
		{
			id: 'data',
			step: '02',
			label: '2. Data & Mapping',
			title: 'Spreadsheet import, inline editing and automatic template routing',
			caption:
				'Upload CSV or Excel lists, search or filter any column, drag to reorder rows and inspect which certificate template matches each recipient.',
			lightSrc: '/demo/data-light.png',
			darkSrc: '/demo/data-dark.png',
			dotClass: 'bg-tone-data',
			activeTabClass: 'border-tone-data-border bg-tone-data-soft text-tone-data-ink',
			badgeClass: 'bg-tone-data-soft text-tone-data-ink border-tone-data-border',
			highlights: ['CSV & Excel import', 'Filter & sort every column', 'Matched Template badges']
		},
		{
			id: 'certificates',
			step: '03',
			label: '3. Generate Certificates',
			title: 'Live side-by-side previews with per-recipient overrides',
			caption:
				'Review every generated certificate before export, override single-recipient properties without changing your dataset and download PDF, PNG, JPG or ZIP archives.',
			lightSrc: '/demo/certificates-light.png',
			darkSrc: '/demo/certificates-dark.png',
			dotClass: 'bg-tone-certs',
			activeTabClass: 'border-tone-certs-border bg-tone-certs-soft text-tone-certs-ink',
			badgeClass: 'bg-tone-certs-soft text-tone-certs-ink border-tone-certs-border',
			highlights: ['Column filter pills', 'Per-recipient overrides', 'Single file or grouped ZIP']
		},
		{
			id: 'email',
			step: '04',
			label: '4. Send Email',
			title: 'Personalised bulk delivery with per-recipient tracking',
			caption:
				'Write reusable email templates with {{property}} tokens, attach rendered certificates and track sent, remaining, failed and skipped recipients.',
			lightSrc: '/demo/email-light.png',
			darkSrc: '/demo/email-dark.png',
			dotClass: 'bg-tone-email',
			activeTabClass: 'border-tone-email-border bg-tone-email-soft text-tone-email-ink',
			badgeClass: 'bg-tone-email-soft text-tone-email-ink border-tone-email-border',
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

	// Smoothly scroll to landing-page section anchors instead of snapping via SvelteKit hash jumps.
	$effect(() => {
		const handleAnchorClick = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const target = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
			if (!target) return;
			const href = target.getAttribute('href');
			if (!href || href.length <= 1) return;
			const section = document.getElementById(href.slice(1));
			if (!section) return;
			event.preventDefault();
			const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
			window.history.replaceState(null, '', href);
		};
		document.addEventListener('click', handleAnchorClick);
		return () => document.removeEventListener('click', handleAnchorClick);
	});
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
	<AppHeader brandHref="/" maxWidthClass="max-w-7xl">
		{#snippet center()}
			<nav
				aria-label="Landing sections"
				class="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle/80 p-1"
			>
				<a
					href="#tour"
					class="rounded-full px-3.5 py-1 text-xs font-medium text-ink-secondary transition hover:bg-surface-card hover:text-ink-primary"
				>
					Tour
				</a>
				<a
					href="#features"
					class="rounded-full px-3.5 py-1 text-xs font-medium text-ink-secondary transition hover:bg-surface-card hover:text-ink-primary"
				>
					Features
				</a>
				<a
					href="#how-it-works"
					class="rounded-full px-3.5 py-1 text-xs font-medium text-ink-secondary transition hover:bg-surface-card hover:text-ink-primary"
				>
					Workflow
				</a>
				<a
					href="#deploy"
					class="rounded-full px-3.5 py-1 text-xs font-medium text-ink-secondary transition hover:bg-surface-card hover:text-ink-primary"
				>
					Self-Host
				</a>
			</nav>
		{/snippet}

		{#snippet actions()}
			<a
				href={data.github.repoUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="cf-pressable group inline-flex min-h-9 items-center gap-2 rounded-lg border border-tone-certs-border bg-tone-certs-soft/85 px-3 py-1.5 text-xs font-semibold text-tone-certs-ink shadow-xs transition hover:border-tone-certs hover:bg-tone-certs-soft"
				title="Star CertFlow on GitHub"
			>
				<svg class="h-3.5 w-3.5 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.4-5.26 5.68.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
					/>
				</svg>
				<span class="hidden sm:inline">Star on GitHub</span>
				<span class="sm:hidden">Star</span>
				<span
					class="inline-flex items-center gap-1 border-l border-tone-certs-border/80 pl-2 font-mono text-[11.5px] font-semibold tabular-nums"
				>
					<Star
						class="h-3.5 w-3.5 fill-tone-certs text-tone-certs transition-transform group-hover:scale-110"
					/>
					{#if formattedStars !== null}
						<span>{formattedStars}</span>
					{/if}
				</span>
			</a>

			{#if data.user}
				<a
					href="/dashboard"
					class="cf-pressable inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-white shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover sm:text-[13px]"
				>
					Dashboard
					<ArrowRight class="h-3.5 w-3.5" />
				</a>
			{:else}
				<a
					href="/login"
					class="cf-pressable inline-flex min-h-9 items-center rounded-lg px-2.5 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary sm:px-3 sm:text-[13px]"
				>
					Sign In
				</a>
				<a
					href="/login?mode=signup"
					class="cf-pressable inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-white shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover sm:text-[13px]"
				>
					Get Started
					<ArrowRight class="h-3.5 w-3.5" />
				</a>
			{/if}
		{/snippet}
	</AppHeader>

	<main class="flex-1">
		<!-- Hero Section (12-Column Editorial Split) -->
		<section class="relative border-b border-border-default">
			<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:py-24">
				<div class="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
					<!-- Left: Copy and Primary CTAs -->
					<div class="lg:col-span-5">
						<div class="flex flex-wrap items-center gap-2">
							<a
								href={data.github.releasesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-card px-3 py-1 text-xs font-medium text-ink-secondary shadow-xs transition hover:border-border-strong hover:text-ink-primary"
							>
								<span class="h-1.5 w-1.5 rounded-full bg-accent-vivid" aria-hidden="true"></span>
								<span>Open Source</span>
								{#if data.github.latestVersion}
									<span class="font-mono text-[11px] text-ink-muted">{data.github.latestVersion}</span>
								{/if}
								<ExternalLink class="h-3 w-3 text-ink-muted" />
							</a>
							{#if data.isLocalApp}
								<Badge tone="emerald" dot>Local Unlimited</Badge>
							{/if}
						</div>

						<h1
							class="font-display mt-5 text-4xl leading-[1.04] font-bold tracking-[-0.04em] text-ink-primary sm:text-[52px]"
						>
							Design, route and issue certificates with precision.
						</h1>

						<p class="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-secondary">
							Build print-faithful templates on a gridded canvas, import CSV or Excel lists, match
							roles automatically and deliver PDF, PNG or JPG certificates in bulk.
						</p>

						<div class="mt-8 flex flex-wrap items-center gap-3">
							<a
								href={data.user ? '/dashboard' : '/login?mode=signup'}
								class="cf-pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover"
							>
								{data.user ? 'Open Your Projects' : 'Get Started Free'}
								<ArrowRight class="h-4 w-4" />
							</a>

							<a
								href={data.github.windowsInstallerUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="cf-pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-border-strong bg-surface-card px-4 py-2.5 text-sm font-medium text-ink-primary shadow-xs hover:bg-surface-subtle"
							>
								<Download class="h-4 w-4 text-accent-vivid" />
								<span>Windows Setup</span>
							</a>
						</div>

						<div
							class="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-ink-muted"
						>
							<span class="inline-flex items-center gap-1.5">
								<Check class="h-3.5 w-3.5 text-tone-data" />
								114 built-in fonts
							</span>
							<span class="inline-flex items-center gap-1.5">
								<Check class="h-3.5 w-3.5 text-tone-data" />
								Client-side PDF, PNG, JPG &amp; ZIP
							</span>
							<span class="inline-flex items-center gap-1.5">
								<Check class="h-3.5 w-3.5 text-tone-data" />
								Offline desktop or Docker
							</span>
						</div>
					</div>

					<!-- Right: Interactive Certificate Routing Studio -->
					<div class="lg:col-span-7">
						<div
							class="overflow-hidden rounded-[20px] border border-border-default bg-surface-card shadow-lg"
						>
							<!-- Top Studio Header -->
							<div
								class="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-4 py-3"
							>
								<div class="flex items-center gap-2">
									<span class="h-2 w-2 rounded-full bg-accent-vivid" aria-hidden="true"></span>
									<span class="font-display text-xs font-semibold tracking-tight text-ink-primary">
										Interactive Routing Studio
									</span>
								</div>
								<span class="font-mono text-[11px] text-ink-muted">
									Select a row to route template
								</span>
							</div>

							<div class="grid grid-cols-1 md:grid-cols-12">
								<!-- Clickable Recipient Rows + Animated Signal Beam -->
								<div
									class="flex flex-col justify-between border-b border-border-default p-4 md:col-span-5 md:border-r md:border-b-0"
								>
									<div class="space-y-2" role="tablist" aria-label="Sample recipients">
										<p class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
											Spreadsheet Rows
										</p>
										{#each sampleRecipients as sample (sample.id)}
											{@const isActive = activeSampleId === sample.id}
											<button
												type="button"
												role="tab"
												aria-selected={isActive}
												onclick={() => (activeSampleId = sample.id)}
												class="cf-pressable flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition {isActive
													? 'border-accent-vivid bg-surface-subtle shadow-xs'
													: 'border-border-default bg-surface-card hover:border-border-strong'}"
											>
												<div class="min-w-0">
													<p class="truncate text-xs font-semibold text-ink-primary">
														{sample.recipientName}
													</p>
													<p class="mt-0.5 truncate font-mono text-[10.5px] text-ink-muted">
														{sample.metaLine}
													</p>
												</div>
												<Badge tone={sample.badgeTone}>{sample.tabLabel}</Badge>
											</button>
										{/each}
									</div>

									<!-- Animated Wax Vermilion Routing Signal Beam -->
									<div class="mt-4 pt-2">
										<div class="flex items-center justify-between font-mono text-[10.5px] text-ink-muted">
											<span>MATCHED RULE</span>
											<span class="font-semibold text-accent-ink">{activeSample.templateName}</span>
										</div>
										<svg class="mt-1 h-5 w-full overflow-visible" viewBox="0 0 320 20" aria-hidden="true">
											<path
												d="M 4 10 H 312"
												stroke="var(--color-border-strong)"
												stroke-width="1.5"
												stroke-dasharray="4 4"
												fill="none"
											/>
											{#key activeSampleId}
												<path
													d="M 4 10 H 312"
													pathLength="320"
													stroke="var(--color-accent-vivid)"
													stroke-width="2.5"
													stroke-linecap="round"
													fill="none"
													class="cf-route-beam"
												/>
											{/key}
											<circle cx="312" cy="10" r="3.5" fill="var(--color-accent-vivid)" />
										</svg>
									</div>
								</div>

								<!-- Gridded Cutting-Mat Stage with .preserve-light Paper Certificate -->
								<div
									class="editor-sandbox-grid relative flex flex-col items-center justify-center p-5 sm:p-6 md:col-span-7"
								>
									<!-- Floating Micro-Toolbar -->
									<div
										class="mb-3 inline-flex items-center gap-1 rounded-xl border border-border-default bg-surface-elevated px-1.5 py-1 text-[11px] font-medium text-ink-secondary shadow-md"
									>
										<span class="rounded-md bg-surface-subtle px-2 py-0.5 font-semibold text-ink-primary">
											Playfair Display
										</span>
										<span class="px-1.5 font-mono text-[10.5px] tabular-nums">42px</span>
										<span class="px-1.5 font-semibold text-tone-editor-ink">Selected</span>
									</div>

									<!-- .preserve-light Print-Faithful Certificate Sheet -->
									{#key activeSampleId}
										<div
											class="preserve-light w-full max-w-[360px] rounded-[3px] bg-white p-5 text-center transition-all duration-200"
										>
											<div class="border-2 p-4" style="border-color: {activeSample.borderHex};">
												<p class="text-[9px] font-semibold tracking-[0.22em] text-[#5e5e6a] uppercase">
													{activeSample.certTitle}
												</p>
												<p class="mt-1.5 text-[8.5px] tracking-[0.16em] text-[#858594] uppercase">
													PRESENTED TO
												</p>

												<!-- Blueprint Cobalt Selection Box with 8x8 Square Handles -->
												<div
													class="relative my-2.5 inline-block max-w-full border-[1.5px] border-[#3B5BDB] px-3 py-1"
												>
													<span
														class="cf-handle-settle absolute -top-1 -left-1 h-2 w-2 border border-[#3B5BDB] bg-white"
													></span>
													<span
														class="cf-handle-settle absolute -top-1 -right-1 h-2 w-2 border border-[#3B5BDB] bg-white"
													></span>
													<span
														class="cf-handle-settle absolute -bottom-1 -left-1 h-2 w-2 border border-[#3B5BDB] bg-white"
													></span>
													<span
														class="cf-handle-settle absolute -right-1 -bottom-1 h-2 w-2 border border-[#3B5BDB] bg-white"
													></span>
													<p
														class="truncate font-serif text-lg font-bold tracking-tight text-[#121215] sm:text-xl"
													>
														{activeSample.recipientName}
													</p>
												</div>

												<p class="text-[10px] font-semibold tracking-[0.14em] text-[#121215] uppercase">
													{activeSample.roleLine}
												</p>
												<p class="mt-0.5 text-[9.5px] tracking-[0.1em] text-[#4a4a54]">
													{activeSample.eventLine}
												</p>

												<div
													class="mt-3.5 flex items-center justify-between border-t border-[#e2e2e7] pt-2.5 font-mono text-[9.5px] text-[#5e5e6a]"
												>
													<span>{activeSample.certCode}</span>
													<span class="inline-flex items-center gap-1 font-semibold text-[#D13B15]">
														● Verified Seal
													</span>
												</div>
											</div>
										</div>
									{/key}

									<!-- Bound Properties Footer Pill -->
									<div
										class="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[10.5px]"
									>
										<span
											class="rounded-md border border-border-default bg-surface-elevated px-2 py-0.5 text-ink-secondary shadow-xs"
										>
											{'{{name}}'}
										</span>
										<span
											class="rounded-md border border-border-default bg-surface-elevated px-2 py-0.5 text-ink-secondary shadow-xs"
										>
											{'{{role}}'}
										</span>
										<span
											class="rounded-md border border-border-default bg-surface-elevated px-2 py-0.5 text-ink-secondary shadow-xs"
										>
											{'{{rank}}'}
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Interactive Product Tour Slides (Real Screenshots in Light & Dark Mode) -->
		<section id="tour" class="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-22">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div class="max-w-2xl">
					<p class="font-mono text-[11px] font-semibold tracking-[0.07em] text-accent-ink uppercase">
						Product Tour
					</p>
					<h2 class="font-display mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink-primary sm:text-3xl">
						Inspect every stage of the studio workspace.
					</h2>
					<p class="mt-2 text-sm text-ink-secondary sm:text-[15px]">
						Step through real captures of the editor, spreadsheet router, certificate generator and
						email dispatcher. Toggle light or dark mode above to preview both surfaces.
					</p>
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<span class="font-mono text-xs font-medium text-ink-muted tabular-nums">
						0{activeSlideIndex + 1} / 0{productSlides.length}
					</span>
					<button
						type="button"
						onclick={prevSlide}
						aria-label="Previous product slide"
						class="cf-pressable inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-default bg-surface-card text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary"
					>
						<ArrowLeft class="h-4 w-4" />
					</button>
					<button
						type="button"
						onclick={nextSlide}
						aria-label="Next product slide"
						class="cf-pressable inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-default bg-surface-card text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary"
					>
						<ArrowRight class="h-4 w-4" />
					</button>
				</div>
			</div>

			<!-- Slide Selector Tabs -->
			<div
				class="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
				role="tablist"
				aria-label="Product walkthrough slides"
			>
				{#each productSlides as slide, idx (slide.id)}
					<button
						type="button"
						role="tab"
						aria-selected={activeSlideIndex === idx}
						onclick={() => (activeSlideIndex = idx)}
						class="cf-pressable flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition {activeSlideIndex ===
						idx
							? `${slide.activeTabClass} shadow-xs`
							: 'border-border-default bg-surface-card text-ink-secondary hover:border-border-strong hover:text-ink-primary'}"
					>
						<span class="h-2 w-2 shrink-0 rounded-full {slide.dotClass}" aria-hidden="true"></span>
						<span class="truncate">{slide.label}</span>
					</button>
				{/each}
			</div>

			<!-- Active Slide Frame -->
			<div
				class="mt-4 overflow-hidden rounded-[20px] border border-border-default bg-surface-card shadow-md"
			>
				<div
					class="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-subtle/60 px-4 py-2.5"
				>
					<div class="flex min-w-0 items-center gap-2.5">
						<span class="h-2 w-2 shrink-0 rounded-full {activeSlide.dotClass}" aria-hidden="true"></span>
						<span class="truncate text-xs font-semibold text-ink-primary">
							{activeSlide.label} — {activeSlide.title}
						</span>
					</div>
					<button
						type="button"
						onclick={() => (expandedSlide = activeSlide)}
						class="cf-pressable inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-2.5 py-1 text-[11px] font-medium text-ink-secondary shadow-xs hover:bg-surface-subtle hover:text-ink-primary"
					>
						<Maximize2 class="h-3 w-3" />
						Expand
					</button>
				</div>

				<div class="relative bg-surface-recessed">
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
								class="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-subtle px-2.5 py-0.5 text-[11px] font-medium text-ink-secondary"
							>
								<Check class="h-3 w-3 text-tone-data" />
								{item}
							</span>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<!-- 6 Capability Cards -->
		<section id="features" class="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-22">
			<div class="max-w-2xl">
				<p class="font-mono text-[11px] font-semibold tracking-[0.07em] text-accent-ink uppercase">
					Capabilities
				</p>
				<h2 class="font-display mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink-primary sm:text-3xl">
					Everything needed to issue certificates at scale.
				</h2>
				<p class="mt-2.5 text-sm text-ink-secondary sm:text-[15px]">
					No external design software, mail-merge plugins or manual renaming. Every stage runs inside
					one consistent workspace.
				</p>
			</div>

			<div class="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				<div class="cf-card-lift rounded-2xl border border-border-default bg-surface-card p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-border bg-accent-soft text-accent-ink"
					>
						<Type class="h-5 w-5" strokeWidth={1.65} />
					</div>
					<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
						Direct On-Canvas WYSIWYG Editing
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-secondary">
						Double-click any text element to type directly on the certificate. Highlight individual
						words to adjust font, size, weight, underline or colour live.
					</p>
				</div>

				<div class="cf-card-lift rounded-2xl border border-border-default bg-surface-card p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl border border-tone-editor-border bg-tone-editor-soft text-tone-editor-ink"
					>
						<SlidersHorizontal class="h-5 w-5" strokeWidth={1.65} />
					</div>
					<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
						Precision Sandbox &amp; 114 Fonts
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-secondary">
						Align elements with smart centre and equal-spacing guides, marquee-select across the
						cutting mat, crop images, draw signatures and search 114 built-in fonts.
					</p>
				</div>

				<div class="cf-card-lift rounded-2xl border border-border-default bg-surface-card p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl border border-tone-data-border bg-tone-data-soft text-tone-data-ink"
					>
						<FileSpreadsheet class="h-5 w-5" strokeWidth={1.65} />
					</div>
					<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
						CSV &amp; Excel Mapping with Routing
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-secondary">
						Upload CSV or Excel sheets, edit rows or columns in place and route Participants,
						Organisers and Prize Winners automatically to matched templates.
					</p>
				</div>

				<div class="cf-card-lift rounded-2xl border border-border-default bg-surface-card p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl border border-tone-certs-border bg-tone-certs-soft text-tone-certs-ink"
					>
						<FileBadge2 class="h-5 w-5" strokeWidth={1.65} />
					</div>
					<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
						Bulk PDF, PNG, JPG &amp; ZIP Export
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-secondary">
						Inspect every recipient's rendered certificate side by side, override single fields
						without modifying your sheet and export individual files or grouped ZIP archives.
					</p>
				</div>

				<div class="cf-card-lift rounded-2xl border border-border-default bg-surface-card p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl border border-tone-email-border bg-tone-email-soft text-tone-email-ink"
					>
						<Mail class="h-5 w-5" strokeWidth={1.65} />
					</div>
					<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
						Multi-Provider Bulk Email Delivery
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-secondary">
						Send personalised emails with Brevo, Resend, Custom SMTP or a shared relay. Credentials
						are encrypted with AES-256-GCM and tracked per recipient.
					</p>
				</div>

				<div class="cf-card-lift rounded-2xl border border-border-default bg-surface-card p-6">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-xl border border-border-default bg-surface-subtle text-ink-primary"
					>
						<HardDrive class="h-5 w-5" strokeWidth={1.65} />
					</div>
					<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
						Unlimited Local &amp; Self-Hosted Privacy
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-ink-secondary">
						Run offline on your computer with zero project, storage or recipient limits. Embedded
						PostgreSQL keeps every project, image and setting inside one folder.
					</p>
				</div>
			</div>
		</section>

		<!-- 4-Stage Workflow Strip -->
		<section
			id="how-it-works"
			class="scroll-mt-20 border-y border-border-default bg-surface-card/70 py-16 lg:py-22"
		>
			<div class="mx-auto max-w-7xl px-4 sm:px-6">
				<div class="max-w-2xl">
					<p class="font-mono text-[11px] font-semibold tracking-[0.07em] text-accent-ink uppercase">
						Workflow
					</p>
					<h2 class="font-display mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink-primary sm:text-3xl">
						From blank canvas to delivered inbox in four stages.
					</h2>
					<p class="mt-2.5 text-sm text-ink-secondary sm:text-[15px]">
						Every project uses four colour-coded tabs so organisers prepare templates, verify data
						and dispatch certificates without guesswork.
					</p>
				</div>

				<div class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
					<div class="overflow-hidden rounded-2xl border border-border-default bg-surface-page">
						<div class="h-0.5 w-full bg-tone-editor"></div>
						<div class="p-5">
							<div class="flex items-center justify-between">
								<span
									class="inline-flex items-center rounded-md border border-tone-editor-border bg-tone-editor-soft px-2 py-0.5 font-mono text-xs font-semibold text-tone-editor-ink"
								>
									01
								</span>
								<Layers class="h-4 w-4 text-tone-editor" />
							</div>
							<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
								Design Templates
							</h3>
							<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
								Start from a preset or upload your background. Place dynamic
								<code class="font-mono">{'{{name}}'}</code>,
								<code class="font-mono">{'{{role}}'}</code> and
								<code class="font-mono">{'{{rank}}'}</code> tokens, logos and signatures.
							</p>
						</div>
					</div>

					<div class="overflow-hidden rounded-2xl border border-border-default bg-surface-page">
						<div class="h-0.5 w-full bg-tone-data"></div>
						<div class="p-5">
							<div class="flex items-center justify-between">
								<span
									class="inline-flex items-center rounded-md border border-tone-data-border bg-tone-data-soft px-2 py-0.5 font-mono text-xs font-semibold text-tone-data-ink"
								>
									02
								</span>
								<FileSpreadsheet class="h-4 w-4 text-tone-data" />
							</div>
							<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
								Import &amp; Map Data
							</h3>
							<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
								Upload a CSV or Excel sheet or add rows manually. CertFlow detects headers
								automatically and displays the matched template for each recipient.
							</p>
						</div>
					</div>

					<div class="overflow-hidden rounded-2xl border border-border-default bg-surface-page">
						<div class="h-0.5 w-full bg-tone-certs"></div>
						<div class="p-5">
							<div class="flex items-center justify-between">
								<span
									class="inline-flex items-center rounded-md border border-tone-certs-border bg-tone-certs-soft px-2 py-0.5 font-mono text-xs font-semibold text-tone-certs-ink"
								>
									03
								</span>
								<FileBadge2 class="h-4 w-4 text-tone-certs" />
							</div>
							<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
								Generate &amp; Export
							</h3>
							<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
								Click <strong>Generate from Dataset</strong>, inspect live previews and download
								single PDF, PNG or JPG files or a grouped ZIP archive.
							</p>
						</div>
					</div>

					<div class="overflow-hidden rounded-2xl border border-border-default bg-surface-page">
						<div class="h-0.5 w-full bg-tone-email"></div>
						<div class="p-5">
							<div class="flex items-center justify-between">
								<span
									class="inline-flex items-center rounded-md border border-tone-email-border bg-tone-email-soft px-2 py-0.5 font-mono text-xs font-semibold text-tone-email-ink"
								>
									04
								</span>
								<Send class="h-4 w-4 text-tone-email" />
							</div>
							<h3 class="font-display mt-4 text-[15px] font-semibold text-ink-primary">
								Send by Email
							</h3>
							<p class="mt-1.5 text-xs leading-relaxed text-ink-secondary">
								Select a saved Brevo, Resend or SMTP sender profile, compose a personalised message
								with <code class="font-mono">{'{{property}}'}</code> tokens and track delivery.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Deploy & Self-Host Panel -->
		<section id="deploy" class="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-22">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div class="max-w-2xl">
					<p class="font-mono text-[11px] font-semibold tracking-[0.07em] text-accent-ink uppercase">
						Deploy &amp; Self-Host
					</p>
					<h2 class="font-display mt-2 text-2xl font-semibold tracking-[-0.025em] text-ink-primary sm:text-3xl">
						Run locally on desktop or deploy a private server.
					</h2>
					<p class="mt-2.5 text-sm text-ink-secondary sm:text-[15px]">
						CertFlow is MIT open source. Install on Windows with zero dependencies, deploy to Render
						or Railway or run our multi-architecture Docker image.
					</p>
				</div>
				<a
					href={data.github.releasesUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline"
				>
					<span>All Releases on GitHub</span>
					<ExternalLink class="h-3.5 w-3.5" />
				</a>
			</div>

			<div class="mt-8 rounded-[20px] border border-border-default bg-surface-card p-5 shadow-xs sm:p-6">
				<!-- Segmented Deployment Mode Switcher -->
				<div
					role="tablist"
					aria-label="Deployment options"
					class="inline-flex flex-wrap items-center gap-1 rounded-[10px] border border-border-default bg-surface-subtle p-[3px] dark:bg-surface-recessed"
				>
					<button
						type="button"
						role="tab"
						aria-selected={activeDeployTab === 'windows'}
						onclick={() => (activeDeployTab = 'windows')}
						class="cf-glide-thumb inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs transition {activeDeployTab ===
						'windows'
							? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
							: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
					>
						<Monitor class="h-3.5 w-3.5" />
						Windows App
					</button>

					<button
						type="button"
						role="tab"
						aria-selected={activeDeployTab === 'portable'}
						onclick={() => (activeDeployTab = 'portable')}
						class="cf-glide-thumb inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs transition {activeDeployTab ===
						'portable'
							? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
							: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
					>
						<FolderArchive class="h-3.5 w-3.5" />
						Portable ZIP
					</button>

					<button
						type="button"
						role="tab"
						aria-selected={activeDeployTab === 'cloud'}
						onclick={() => (activeDeployTab = 'cloud')}
						class="cf-glide-thumb inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs transition {activeDeployTab ===
						'cloud'
							? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
							: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
					>
						<Cloud class="h-3.5 w-3.5" />
						Railway &amp; Render
					</button>

					<button
						type="button"
						role="tab"
						aria-selected={activeDeployTab === 'docker'}
						onclick={() => (activeDeployTab = 'docker')}
						class="cf-glide-thumb inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-xs transition {activeDeployTab ===
						'docker'
							? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
							: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
					>
						<Terminal class="h-3.5 w-3.5" />
						Docker &amp; Node.js
					</button>
				</div>

				<div class="mt-6">
					{#if activeDeployTab === 'windows'}
						<div class="grid gap-6 lg:grid-cols-12 lg:items-center">
							<div class="space-y-3 lg:col-span-8">
								<h3 class="font-display text-lg font-semibold text-ink-primary">
									Windows Desktop Installer (No Node.js or Docker Needed)
								</h3>
								<p class="text-sm text-ink-secondary">
									Install CertFlow into any folder without administrator prompts. Includes a Desktop
									shortcut, Start Menu entry, silent tray launcher (<code class="font-mono text-xs">CertFlow.exe</code>)
									and unlimited local projects and storage.
								</p>
								<ol class="list-decimal space-y-1.5 pl-5 text-sm text-ink-secondary">
									<li>
										Download
										<code class="font-mono text-xs">{data.github.windowsInstallerName ?? 'CertFlow-Setup.exe'}</code>
										from GitHub Releases.
									</li>
									<li>
										Run the installer, pick a destination folder and keep
										<strong>Create a Desktop shortcut</strong> ticked.
									</li>
									<li>
										Open the <strong>CertFlow</strong> icon and finish the one-time setup screen in
										your browser.
									</li>
									<li>
										Use <strong>Settings → Portable App Updates</strong> to update in place without
										touching your <code class="font-mono text-xs">data/</code> folder.
									</li>
								</ol>
							</div>
							<div class="flex flex-col gap-2.5 lg:col-span-4">
								<a
									href={data.github.windowsInstallerUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="cf-pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-accent px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover"
								>
									<Download class="h-4 w-4" />
									Download Windows Setup
								</a>
								<a
									href={data.github.releasesUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="cf-pressable inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface-card px-4 py-2 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle"
								>
									View Release Notes
									<ExternalLink class="h-3.5 w-3.5" />
								</a>
							</div>
						</div>
					{:else if activeDeployTab === 'portable'}
						<div class="grid gap-6 lg:grid-cols-12 lg:items-center">
							<div class="space-y-3 lg:col-span-8">
								<h3 class="font-display text-lg font-semibold text-ink-primary">
									Zero-Install Portable ZIP (Windows, macOS &amp; Linux)
								</h3>
								<p class="text-sm text-ink-secondary">
									Unzip anywhere — on your Desktop, Documents folder or USB drive. Every ZIP bundles
									Node.js 22 and embedded PostgreSQL (<code class="font-mono text-xs">PGlite</code>)
									with all data kept inside <code class="font-mono text-xs">data/</code>.
								</p>
								<ol class="list-decimal space-y-1.5 pl-5 text-sm text-ink-secondary">
									<li>
										Download the ZIP for your platform (<code class="font-mono text-xs">win-x64</code>,
										<code class="font-mono text-xs">darwin-arm64</code>,
										<code class="font-mono text-xs">darwin-x64</code> or
										<code class="font-mono text-xs">linux-x64</code>).
									</li>
									<li>Unzip the archive to any folder.</li>
									<li>
										Run <code class="font-mono text-xs">CertFlow.exe</code> on Windows,
										<code class="font-mono text-xs">Start-CertFlow.command</code> on macOS or
										<code class="font-mono text-xs">./start-certflow.sh</code> on Linux.
									</li>
								</ol>
							</div>
							<div class="flex flex-col gap-2.5 lg:col-span-4">
								<a
									href={data.github.releasesUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="cf-pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-accent px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover"
								>
									<FolderArchive class="h-4 w-4" />
									Download Portable ZIPs
								</a>
							</div>
						</div>
					{:else if activeDeployTab === 'cloud'}
						<div class="grid gap-5 md:grid-cols-2">
							<div
								class="flex flex-col justify-between rounded-xl border border-border-default bg-surface-page p-5"
							>
								<div>
									<h3 class="font-display text-base font-semibold text-ink-primary">
										Deploy on Railway
									</h3>
									<p class="mt-2 text-sm text-ink-secondary">
										Ideal for permanent cloud storage. Connects to GitHub with
										<code class="font-mono text-xs">railway.json</code>, managed PostgreSQL and a
										persistent <code class="font-mono text-xs">/data/uploads</code> volume.
									</p>
									<ol class="mt-3 list-decimal space-y-1 pl-4 text-xs text-ink-secondary">
										<li>Select <code class="font-mono">FishyWeed/CertFlow</code> in Railway.</li>
										<li>Attach a PostgreSQL service and mount <code class="font-mono">/data/uploads</code>.</li>
										<li>Set your public URL and 64-character hex security secrets.</li>
									</ol>
								</div>
								<div class="mt-5">
									<a
										href="https://railway.com/new"
										target="_blank"
										rel="noopener noreferrer"
										class="cf-pressable inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-contrast px-4 py-2 text-xs font-medium text-ink-inverted shadow-xs hover:bg-contrast-hover"
									>
										Deploy on Railway
										<ExternalLink class="h-3.5 w-3.5" />
									</a>
								</div>
							</div>

							<div
								class="flex flex-col justify-between rounded-xl border border-border-default bg-surface-page p-5"
							>
								<div>
									<h3 class="font-display text-base font-semibold text-ink-primary">
										Deploy on Render
									</h3>
									<p class="mt-2 text-sm text-ink-secondary">
										One-click Blueprint deploy via <code class="font-mono text-xs">render.yaml</code>.
										Provisions the Docker web service, PostgreSQL database and security keys
										automatically.
									</p>
									<ol class="mt-3 list-decimal space-y-1 pl-4 text-xs text-ink-secondary">
										<li>Click <strong>Deploy to Render</strong> and sign in with GitHub or Google.</li>
										<li>Click <strong>Apply</strong> and wait for the container build to finish.</li>
										<li>Attach a persistent disk on Render for permanent uploaded images.</li>
									</ol>
								</div>
								<div class="mt-5">
									<a
										href="https://render.com/deploy?repo=https://github.com/FishyWeed/CertFlow"
										target="_blank"
										rel="noopener noreferrer"
										class="cf-pressable inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover"
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
								<h3 class="font-display text-base font-semibold text-ink-primary">
									Self-Host with Docker or Run with Node.js
								</h3>
								<p class="mt-1 text-sm text-ink-secondary">
									Pull the multi-architecture GHCR image (<code class="font-mono text-xs">linux/amd64</code>
									and <code class="font-mono text-xs">linux/arm64</code>) and finish setup at
									<code class="font-mono text-xs">/setup</code> on first launch.
								</p>
							</div>

							<div class="grid gap-3 md:grid-cols-2">
								<div class="rounded-xl border border-border-default bg-surface-page p-4">
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-semibold text-ink-primary">
											Docker Compose (GHCR + PostgreSQL)
										</span>
										<button
											type="button"
											onclick={() => copyCommand('ghcr', dockerGhcrCmd)}
											class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary"
										>
											{#if copiedCmdKey === 'ghcr'}
												<Check class="cf-seal-stamp h-3 w-3 text-tone-data" />
												Copied
											{:else}
												<Copy class="h-3 w-3" />
												Copy
											{/if}
										</button>
									</div>
									<pre
										class="mt-2.5 overflow-x-auto rounded-lg border border-[#26262e] bg-[#0b0b0e] p-3 font-mono text-[12.5px] text-[#f5f5f7]"><code>{dockerGhcrCmd}</code></pre>
								</div>

								<div class="rounded-xl border border-border-default bg-surface-page p-4">
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-semibold text-ink-primary">
											Single Container (Embedded DB)
										</span>
										<button
											type="button"
											onclick={() => copyCommand('single', dockerSingleCmd)}
											class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary"
										>
											{#if copiedCmdKey === 'single'}
												<Check class="cf-seal-stamp h-3 w-3 text-tone-data" />
												Copied
											{:else}
												<Copy class="h-3 w-3" />
												Copy
											{/if}
										</button>
									</div>
									<pre
										class="mt-2.5 overflow-x-auto rounded-lg border border-[#26262e] bg-[#0b0b0e] p-3 font-mono text-[12.5px] text-[#f5f5f7]"><code>{dockerSingleCmd}</code></pre>
								</div>
							</div>

							<div class="rounded-xl border border-border-default bg-surface-page p-4">
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs font-semibold text-ink-primary">
										Local Development (Node.js 22 + pnpm)
									</span>
									<button
										type="button"
										onclick={() => copyCommand('dev', localDevCmd)}
										class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-card px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary"
									>
										{#if copiedCmdKey === 'dev'}
											<Check class="cf-seal-stamp h-3 w-3 text-tone-data" />
											Copied
										{:else}
											<Copy class="h-3 w-3" />
											Copy
										{/if}
									</button>
								</div>
								<pre
									class="mt-2.5 overflow-x-auto rounded-lg border border-[#26262e] bg-[#0b0b0e] p-3 font-mono text-[12.5px] text-[#f5f5f7]"><code>{localDevCmd}</code></pre>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</section>

		<!-- High-Contrast Closing CTA Strip -->
		<section class="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
			<div
				class="relative overflow-hidden rounded-[20px] border border-[#26262e] bg-[#121215] p-7 text-[#f5f5f7] shadow-lg sm:p-10"
			>
				<div
					aria-hidden="true"
					class="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
					style="background: radial-gradient(circle, #EB4A1E 0%, transparent 70%);"
				></div>
				<div class="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
					<div class="max-w-xl">
						<h2 class="font-display text-2xl font-semibold tracking-[-0.025em] text-[#f5f5f7] sm:text-3xl">
							Ready to issue your next batch of certificates?
						</h2>
						<p class="mt-2 text-sm text-[#a3a3b0]">
							Create a free account in the browser, install CertFlow on Windows or star the GitHub
							repository to follow new releases.
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<a
							href={data.user ? '/dashboard' : '/login?mode=signup'}
							class="cf-pressable inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover"
						>
							{data.user ? 'Open Dashboard' : 'Get Started Free'}
							<ArrowRight class="h-4 w-4" />
						</a>
						<a
							href={data.github.repoUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="cf-pressable group inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[#F5B942]/45 bg-[#F5B942]/12 px-4 py-2.5 text-sm font-semibold text-[#F7C95C] transition hover:border-[#F5B942]/75 hover:bg-[#F5B942]/18"
						>
							<Star class="h-4 w-4 fill-[#F5B942] text-[#F5B942] transition-transform group-hover:scale-110" />
							<span>Star on GitHub</span>
							{#if formattedStars !== null}
								<span class="rounded-md bg-[#09090b]/80 px-2 py-0.5 font-mono text-xs text-[#F7C95C] tabular-nums">
									{formattedStars}
								</span>
							{/if}
						</a>
					</div>
				</div>
			</div>
		</section>
	</main>

	<!-- 4-Column Public Landing Footer -->
	<footer class="border-t border-border-default bg-surface-card">
		<div class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
			<div class="grid grid-cols-1 gap-10 md:grid-cols-12">
				<!-- Brand Summary (4 cols) -->
				<div class="space-y-3 md:col-span-4">
					<a href="/" class="inline-flex items-center gap-2.5 text-ink-primary">
						<CertFlowLogo variant="studio" size={28} decorative />
						<span class="font-display text-[17px] font-semibold tracking-[-0.03em]">CertFlow</span>
					</a>
					<p class="max-w-xs text-xs leading-relaxed text-ink-secondary">
						Open-source certificate designer, spreadsheet router and bulk emailer for schools,
						clubs, competitions and organisations. Released under the MIT Licence.
					</p>
					<div class="flex flex-wrap items-center gap-2 pt-1">
						<a
							href={data.github.repoUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default bg-surface-subtle px-3 text-xs font-medium text-ink-primary tabular-nums transition hover:border-border-strong"
						>
							<Star class="h-3.5 w-3.5 fill-[#F5B942] text-[#F5B942]" />
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
								class="inline-flex h-8 items-center rounded-full border border-border-default bg-surface-subtle px-3 font-mono text-[11px] font-medium text-ink-secondary transition hover:text-ink-primary"
							>
								{data.github.latestVersion}
							</a>
						{/if}
					</div>
				</div>

				<!-- Product (2 cols) -->
				<div class="md:col-span-2">
					<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
						Product
					</h3>
					<ul class="mt-3 space-y-2 text-xs text-ink-secondary">
						<li>
							<a href="#tour" class="transition hover:text-ink-primary">Design Editor</a>
						</li>
						<li>
							<a href="#features" class="transition hover:text-ink-primary">Spreadsheet Routing</a>
						</li>
						<li>
							<a href="#how-it-works" class="transition hover:text-ink-primary">Bulk Export</a>
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

				<!-- Deploy (3 cols) -->
				<div class="md:col-span-3">
					<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
						Deploy
					</h3>
					<ul class="mt-3 space-y-2 text-xs text-ink-secondary">
						<li>
							<a
								href={data.github.windowsInstallerUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Windows Installer
							</a>
						</li>
						<li>
							<a
								href={data.github.releasesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Portable Bundle
							</a>
						</li>
						<li>
							<a
								href={data.github.ghcrUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Docker &amp; GHCR
							</a>
						</li>
						<li>
							<a href="#deploy" class="transition hover:text-ink-primary">Self-Host Guide</a>
						</li>
					</ul>
				</div>

				<!-- Resources (3 cols) -->
				<div class="md:col-span-3">
					<h3 class="text-[11px] font-semibold tracking-[0.07em] text-ink-muted uppercase">
						Resources
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
								Releases
							</a>
						</li>
						<li>
							<a
								href={data.github.issuesUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								Issue Tracker
							</a>
						</li>
						<li>
							<a
								href={`${data.github.repoUrl}/blob/main/LICENSE`}
								target="_blank"
								rel="noopener noreferrer"
								class="transition hover:text-ink-primary"
							>
								MIT Licence
							</a>
						</li>
					</ul>
				</div>
			</div>

			<div
				class="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-6 text-xs text-ink-muted"
			>
				<p>CertFlow — Open-source certificate studio.</p>
				<a
					href={data.github.repoUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="font-mono text-[11px] transition hover:text-ink-primary"
				>
					github.com/{data.github.repoSlug}
				</a>
			</div>
		</div>
	</footer>

	<!-- Full-size Screenshot Lightbox -->
	{#if expandedSlide}
		<div
			role="dialog"
			aria-modal="true"
			aria-label={`${expandedSlide.label} full-size preview`}
			class="cf-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-[5px]"
		>
			<div
				role="presentation"
				onclick={() => (expandedSlide = null)}
				class="fixed inset-0"
			></div>
			<div
				class="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[20px] border border-border-default bg-surface-elevated shadow-lg"
			>
				<div
					class="flex items-center justify-between gap-3 border-b border-border-default px-5 py-3.5"
				>
					<p class="font-display truncate text-sm font-semibold text-ink-primary">
						{expandedSlide.label} — {expandedSlide.title}
					</p>
					<button
						type="button"
						onclick={() => (expandedSlide = null)}
						aria-label="Close expanded preview"
						class="cf-pressable inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
					>
						<X class="h-[18px] w-[18px]" />
					</button>
				</div>
				<div class="overflow-auto bg-surface-recessed">
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
