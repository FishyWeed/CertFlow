<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		AlertCircle,
		ArrowDown,
		ArrowUp,
		ArrowUpDown,
		Check,
		CheckCircle2,
		Clock,
		Mail,
		RotateCw,
		Save,
		Search,
		Send,
		Square
	} from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatMimeType, renderCertificateBytes } from '#lib/features/certificates/renderer.ts';
	import type { EmailSenderMode, ExportFormat, ProjectEmailDefaults } from '#lib/types/certflow.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let senderMode = $state<EmailSenderMode>('account');
	let selectedProfileId = $state('');
	let customSenderName = $state('');
	let customSenderEmail = $state('');
	let subjectTemplate = $state('');
	let bodyTemplate = $state('');
	let attachmentFormat = $state<ExportFormat>('pdf');

	let hydratedProjectId = $state<string | null>(null);
	let savedSnapshot = $state('');

	let savingDraft = $state(false);
	let sending = $state(false);
	let sendingSingleId = $state<string | null>(null);
	let stopRequested = $state(false);
	let sendProgress = $state<{
		total: number;
		processed: number;
		sent: number;
		failed: number;
	} | null>(null);
	let progressText = $state('');
	let progressTone = $state<'info' | 'success' | 'error'>('info');

	// Recipient tracker filter, search & click-to-sort cycle (asc -> desc -> default)
	type TrackerSortColumn = 'index' | 'recipient' | 'email' | 'status' | 'details';
	let statusFilter = $state<'all' | 'remaining' | 'sent' | 'failed' | 'no_email'>('all');
	let trackerSearch = $state('');
	let trackerSort = $state<{ column: TrackerSortColumn; direction: 'asc' | 'desc' } | null>(null);

	function cycleTrackerSort(column: TrackerSortColumn) {
		if (!trackerSort || trackerSort.column !== column) {
			trackerSort = { column, direction: 'asc' };
		} else if (trackerSort.direction === 'asc') {
			trackerSort = { column, direction: 'desc' };
		} else {
			trackerSort = null;
		}
	}

	function buildDraftSnapshot(draft: {
		senderMode: EmailSenderMode;
		selectedProfileId: string;
		customSenderName: string;
		customSenderEmail: string;
		subjectTemplate: string;
		bodyTemplate: string;
		attachmentFormat: ExportFormat;
	}): string {
		return JSON.stringify(draft);
	}

	const canUseServerRelay = $derived(
		data.mailCapabilities.hasServerRelay || data.mailCapabilities.isLocalOutbox
	);

	function applyDefaults(defaults: ProjectEmailDefaults) {
		const validProfileId =
			defaults.senderProfileId &&
			data.senderProfiles.some((p) => p.id === defaults.senderProfileId)
				? defaults.senderProfileId
				: !canUseServerRelay
					? (data.senderProfiles[0]?.id ?? '')
					: '';

		const nextMode: EmailSenderMode = !canUseServerRelay
			? 'profile'
			: (defaults.senderMode ?? (validProfileId ? 'profile' : 'account'));
		const nextCustomName = defaults.customSenderName || data.user.name;
		const nextCustomEmail = defaults.customSenderEmail ?? '';

		senderMode = nextMode;
		selectedProfileId = validProfileId;
		customSenderName = nextCustomName;
		customSenderEmail = nextCustomEmail;
		subjectTemplate = defaults.subjectTemplate;
		bodyTemplate = defaults.bodyTemplate;
		attachmentFormat = defaults.attachmentFormat;

		savedSnapshot = buildDraftSnapshot({
			senderMode: nextMode,
			selectedProfileId: validProfileId,
			customSenderName: nextCustomName,
			customSenderEmail: nextCustomEmail,
			subjectTemplate: defaults.subjectTemplate,
			bodyTemplate: defaults.bodyTemplate,
			attachmentFormat: defaults.attachmentFormat
		});
	}

	$effect(() => {
		if (hydratedProjectId !== data.project.id) {
			applyDefaults(data.project.emailDefaults);
			hydratedProjectId = data.project.id;
		}
	});

	const currentSnapshot = $derived(
		buildDraftSnapshot({
			senderMode,
			selectedProfileId,
			customSenderName,
			customSenderEmail,
			subjectTemplate,
			bodyTemplate,
			attachmentFormat
		})
	);

	const isDirty = $derived(savedSnapshot !== '' && currentSnapshot !== savedSnapshot);

	const selectedProfile = $derived(
		data.senderProfiles.find((p) => p.id === selectedProfileId) ?? null
	);
	const usingLocalOutbox = $derived(
		data.mailCapabilities.isLocalOutbox &&
			!(senderMode === 'profile' && selectedProfile?.mode === 'smtp')
	);

	const withEmail = $derived(data.certificates.filter((c) => Boolean(c.email)));
	const withoutEmailCerts = $derived(data.certificates.filter((c) => !c.email));
	const sentCerts = $derived(withEmail.filter((c) => c.emailStatus === 'sent'));
	const failedCerts = $derived(withEmail.filter((c) => c.emailStatus === 'failed'));
	const remainingCerts = $derived(withEmail.filter((c) => c.emailStatus !== 'sent'));

	const filteredTrackerCerts = $derived.by(() => {
		const q = trackerSearch.trim().toLowerCase();
		const rows = data.certificates
			.map((cert, index) => ({ cert, rowNumber: index + 1 }))
			.filter(({ cert }) => {
				if (statusFilter === 'remaining' && (!cert.email || cert.emailStatus === 'sent')) return false;
				if (statusFilter === 'sent' && cert.emailStatus !== 'sent') return false;
				if (statusFilter === 'failed' && cert.emailStatus !== 'failed') return false;
				if (statusFilter === 'no_email' && Boolean(cert.email)) return false;
				if (!q) return true;
				return (
					cert.recipientName.toLowerCase().includes(q) ||
					(cert.email ?? '').toLowerCase().includes(q) ||
					cert.role.toLowerCase().includes(q)
				);
			});

		if (!trackerSort) return rows;

		const { column, direction } = trackerSort;
		const mult = direction === 'asc' ? 1 : -1;

		const statusRank = (cert: (typeof data.certificates)[number]) => {
			if (!cert.email) return 3;
			if (cert.emailStatus === 'failed') return 0;
			if (cert.emailStatus === 'sent') return 2;
			return 1;
		};

		const detailsText = (cert: (typeof data.certificates)[number]) => {
			if (!cert.email) return 'Skipped';
			const log = data.latestLogByCertId[cert.id];
			if (cert.emailStatus === 'failed') return log?.errorMessage ?? 'Delivery failed';
			if (cert.emailStatus === 'sent') {
				const raw = cert.lastSentAt ?? log?.sentAt;
				return raw ? new Date(raw).toISOString() : 'Sent';
			}
			return 'Pending send';
		};

		return [...rows].sort((a, b) => {
			let cmp = 0;
			if (column === 'index') {
				cmp = a.rowNumber - b.rowNumber;
			} else if (column === 'recipient') {
				cmp = a.cert.recipientName.localeCompare(b.cert.recipientName, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			} else if (column === 'email') {
				const ea = (a.cert.email ?? '').trim();
				const eb = (b.cert.email ?? '').trim();
				if (!ea && eb) return 1;
				if (ea && !eb) return -1;
				cmp = ea.localeCompare(eb, undefined, { numeric: true, sensitivity: 'base' });
			} else if (column === 'status') {
				cmp = statusRank(a.cert) - statusRank(b.cert);
			} else if (column === 'details') {
				cmp = detailsText(a.cert).localeCompare(detailsText(b.cert), undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			}
			return cmp !== 0 ? cmp * mult : a.rowNumber - b.rowNumber;
		});
	});

	function uint8ToBase64(bytes: Uint8Array): string {
		let binary = '';
		const chunkSize = 0x8000;
		for (let i = 0; i < bytes.length; i += chunkSize) {
			binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
		}
		return btoa(binary);
	}

	function formatSentTime(iso: string | Date | null | undefined): string {
		if (!iso) return '';
		const date = iso instanceof Date ? iso : new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleString(undefined, {
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function handleSaveDraft() {
		if (savingDraft || sending) return;
		savingDraft = true;
		progressText = '';
		try {
			const res = await fetch(`/api/projects/${data.project.id}/email/draft`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					senderMode,
					senderProfileId: selectedProfileId || null,
					customSenderName: customSenderName.trim(),
					customSenderEmail: customSenderEmail.trim(),
					subjectTemplate,
					bodyTemplate,
					attachmentFormat
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Could not save email draft.');
			}
			const body = (await res.json()) as { emailDefaults: ProjectEmailDefaults };
			applyDefaults(body.emailDefaults);
			await invalidateAll();
			progressTone = 'success';
			progressText = 'Saved email draft and sender settings.';
		} catch (err) {
			progressTone = 'error';
			progressText = err instanceof Error ? err.message : 'Could not save email draft.';
		} finally {
			savingDraft = false;
		}
	}

	function validateSenderReady(): boolean {
		if (senderMode === 'custom_reply_to' && !customSenderEmail.trim()) {
			progressTone = 'error';
			progressText = 'Enter a custom sender email address first.';
			return false;
		}
		if (senderMode === 'profile' && !selectedProfileId) {
			progressTone = 'error';
			progressText = 'Select a saved sender profile first.';
			return false;
		}
		if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
			progressTone = 'error';
			progressText = 'Enter both an email subject and message body first.';
			return false;
		}
		return true;
	}

	async function sendCertificates(
		targets: typeof data.certificates,
		singleCertId: string | null = null
	) {
		const validTargets = targets.filter((c) => Boolean(c.email));
		if (validTargets.length === 0 || sending) return;
		if (!validateSenderReady()) return;

		sending = true;
		sendingSingleId = singleCertId;
		stopRequested = false;
		progressTone = 'info';
		let totalSent = 0;
		let totalFailed = 0;
		let processed = 0;
		let usedLocalOutbox = false;
		let firstError: string | null = null;
		const batchSize = 5;

		sendProgress = {
			total: validTargets.length,
			processed: 0,
			sent: 0,
			failed: 0
		};

		try {
			for (let start = 0; start < validTargets.length; start += batchSize) {
				if (stopRequested) break;

				const slice = validTargets.slice(start, start + batchSize);
				progressText =
					validTargets.length === 1
						? `Sending certificate to ${slice[0].recipientName}...`
						: `Rendering and sending ${start + 1}–${Math.min(start + batchSize, validTargets.length)} of ${validTargets.length}...`;

				const items = [];
				for (const cert of slice) {
					const tpl = data.templates.find((t) => t.id === cert.templateId);
					if (!tpl) continue;
					const bytes = await renderCertificateBytes({
						width: tpl.width,
						height: tpl.height,
						canvasState: tpl.canvasState,
						data: {
							name: cert.recipientName,
							title: cert.certTitle,
							role: cert.role,
							rank: cert.ranking,
							ranking: cert.ranking,
							email: cert.email ?? '',
							...(cert.customProperties ?? {})
						},
						format: attachmentFormat
					});
					const safe = cert.recipientName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
					items.push({
						certificateId: cert.id,
						fileName: `${safe}-${cert.certCode}.${attachmentFormat}`,
						mimeType: formatMimeType(attachmentFormat),
						base64Data: uint8ToBase64(bytes)
					});
				}

				if (items.length === 0) continue;

				const res = await fetch(`/api/projects/${data.project.id}/email/send`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						senderMode,
						senderProfileId: senderMode === 'profile' ? selectedProfileId : undefined,
						customSenderName: senderMode === 'custom_reply_to' ? customSenderName : undefined,
						customSenderEmail: senderMode === 'custom_reply_to' ? customSenderEmail : undefined,
						subjectTemplate,
						bodyTemplate,
						attachmentFormat,
						items
					})
				});
				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					throw new Error(err.message ?? `Batch send request failed (${res.status}).`);
				}
				const result = await res.json();
				totalSent += result.sentCount;
				totalFailed += result.failedCount;
				processed += slice.length;
				sendProgress = {
					total: validTargets.length,
					processed,
					sent: totalSent,
					failed: totalFailed
				};
				if (result.deliveryMode === 'local_outbox') usedLocalOutbox = true;
				if (!firstError && result.firstError) firstError = result.firstError;

				// Refresh tracker statuses after every batch so progress is visible immediately.
				await invalidateAll();
			}

			savedSnapshot = currentSnapshot;
			const leftCount = validTargets.length - processed;

			if (stopRequested && leftCount > 0) {
				progressTone = 'info';
				progressText = `Stopped after ${processed} of ${validTargets.length}: ${totalSent} sent, ${totalFailed} failed, ${leftCount} not attempted. Switch sender profile and click Send Remaining to continue.`;
			} else if (totalFailed > 0) {
				progressTone = 'error';
				progressText = `Finished batch: ${totalSent} sent, ${totalFailed} failed.${firstError ? ` Error: ${firstError}` : ''} You can switch sender profiles and click Send Remaining to send the unsent certificates.`;
			} else if (usedLocalOutbox) {
				progressTone = 'info';
				progressText = `Saved ${totalSent} emails to local test outbox (.local/outbox/).`;
			} else {
				progressTone = 'success';
				progressText =
					validTargets.length === 1
						? `Sent certificate to ${validTargets[0].recipientName} (${validTargets[0].email}).`
						: `Completed: ${totalSent} sent, 0 failed.`;
			}
		} catch (err) {
			progressTone = 'error';
			progressText = err instanceof Error ? err.message : 'Send failed.';
		} finally {
			sending = false;
			sendingSingleId = null;
			stopRequested = false;
		}
	}

	let bodyEl = $state<HTMLTextAreaElement | null>(null);
	let previewIndex = $state(0);

	const previewCert = $derived(data.certificates[previewIndex] ?? data.certificates[0] ?? null);

	function interpolatePreview(template: string): string {
		const sample = previewCert
			? {
					name: previewCert.recipientName,
					title: previewCert.certTitle,
					role: previewCert.role,
					rank: previewCert.ranking,
					ranking: previewCert.ranking,
					email: previewCert.email ?? '',
					...(previewCert.customProperties ?? {})
				}
			: {
					name: 'Aiman Hakim',
					title: data.project.defaultCertTitle || data.project.name,
					role: 'Participant',
					rank: '1st Place',
					ranking: '1st Place',
					email: 'recipient@example.org'
				};
		return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey: string) => {
			const key = rawKey.toLowerCase();
			return (sample as Record<string, string>)[key] ?? `{{${rawKey}}}`;
		});
	}

	function insertTokenIntoBody(token: string) {
		const el = bodyEl;
		if (el) {
			const start = el.selectionStart ?? bodyTemplate.length;
			const end = el.selectionEnd ?? bodyTemplate.length;
			bodyTemplate = bodyTemplate.slice(0, start) + token + bodyTemplate.slice(end);
			requestAnimationFrame(() => {
				el.focus();
				const caret = start + token.length;
				el.setSelectionRange(caret, caret);
			});
			return;
		}
		bodyTemplate = bodyTemplate ? `${bodyTemplate} ${token}` : token;
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			handleSaveDraft();
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<main class="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
	<div>
		<h2 class="font-display text-lg font-semibold tracking-tight text-ink-primary">
			Send Certificates by Email
		</h2>
		<p class="mt-0.5 text-sm text-ink-secondary">
			Send generated certificates to recipients and track delivery status per person. If an email
			quota runs out, switch sender profiles and send the remainder without duplicating sent emails.
		</p>
	</div>

	<!-- Delivery Progress Strip -->
	<div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-2xl border border-tone-email-border bg-tone-email-soft p-4">
			<p class="text-xs font-medium text-tone-email-ink">Remaining to Send</p>
			<p class="mt-1 font-mono text-2xl font-bold text-tone-email-ink tabular-nums">
				{remainingCerts.length}
			</p>
		</div>
		<div class="rounded-2xl border border-tone-data-border bg-tone-data-soft p-4">
			<p class="text-xs font-medium text-tone-data-ink">Sent</p>
			<p class="mt-1 font-mono text-2xl font-bold text-tone-data-ink tabular-nums">
				{sentCerts.length}
			</p>
		</div>
		<div
			class="rounded-2xl border p-4 {failedCerts.length > 0
				? 'border-tone-danger-border bg-tone-danger-soft'
				: 'border-border-default bg-surface-card'}"
		>
			<p
				class="text-xs font-medium {failedCerts.length > 0
					? 'text-tone-danger-ink'
					: 'text-ink-secondary'}"
			>
				Failed
			</p>
			<p
				class="mt-1 font-mono text-2xl font-bold tabular-nums {failedCerts.length > 0
					? 'text-tone-danger-ink'
					: 'text-ink-primary'}"
			>
				{failedCerts.length}
			</p>
		</div>
		<div class="rounded-2xl border border-border-default bg-surface-card p-4">
			<p class="text-xs font-medium text-ink-secondary">Skipped (No Email)</p>
			<p class="mt-1 font-mono text-2xl font-bold text-ink-primary tabular-nums">
				{withoutEmailCerts.length}
			</p>
		</div>
	</div>

	{#if sending && sendProgress}
		{@const pct = sendProgress.total > 0 ? Math.round((sendProgress.processed / sendProgress.total) * 100) : 0}
		<div class="space-y-2.5 rounded-2xl border border-tone-email-border bg-tone-email-soft p-4">
			<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-tone-email-ink">
				<span class="font-semibold">
					{progressText || `Sending ${sendProgress.processed} of ${sendProgress.total}...`}
				</span>
				<div class="flex items-center gap-3 font-mono tabular-nums">
					<span>
						<strong>{sendProgress.sent}</strong> sent · <strong>{sendProgress.failed}</strong> failed ·
						<strong>{pct}%</strong>
					</span>
					<button
						type="button"
						disabled={stopRequested}
						onclick={() => (stopRequested = true)}
						class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-tone-danger-border bg-surface-card px-2.5 py-1 font-sans text-[11px] font-semibold text-tone-danger-ink hover:bg-tone-danger-soft disabled:opacity-50"
					>
						<Square class="h-3 w-3" />
						{stopRequested ? 'Stopping after batch...' : 'Stop'}
					</button>
				</div>
			</div>
			<div class="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
				<div
					class="cf-progress-sheen h-full rounded-full bg-tone-email transition-all duration-300"
					style="width: {pct}%;"
				></div>
			</div>
		</div>
	{:else if progressText}
		<div
			class="rounded-xl border px-4 py-3 text-sm font-medium {progressTone === 'error'
				? 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink'
				: progressTone === 'success'
					? 'border-tone-data-border bg-tone-data-soft text-tone-data-ink'
					: 'border-tone-email-border bg-tone-email-soft text-tone-email-ink'}"
		>
			{progressText}
		</div>
	{/if}

	{#if data.certificates.length === 0}
		<div
			class="rounded-xl border border-tone-warning-border bg-tone-warning-soft px-4 py-3 text-sm text-tone-warning-ink"
		>
			No certificates are generated yet. You can edit and save your email draft now, then open
			<a href={`/projects/${data.project.id}/certificates`} class="font-semibold underline">
				Generate Certificates
			</a> before you send.
		</div>
	{/if}

	<!-- Composer + Live Rendered Preview Split -->
	<div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
		<div class="space-y-5 rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs lg:col-span-7">
			<!-- Sender Selection -->
			<section class="space-y-3">
				<h3 class="font-display text-sm font-semibold text-ink-primary">1. Sender Address</h3>
				{#if canUseServerRelay}
					<div class="grid gap-2 sm:grid-cols-3">
						<button
							type="button"
							onclick={() => (senderMode = 'account')}
							class="cf-pressable cursor-pointer rounded-xl border p-3 text-left text-xs {senderMode === 'account'
								? 'border-tone-email-border bg-tone-email-soft text-tone-email-ink'
								: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle'}"
						>
							<p class="font-semibold">My Account Email</p>
							<p class="mt-0.5 truncate text-[11px] opacity-85">{data.user.email}</p>
						</button>

						<button
							type="button"
							onclick={() => (senderMode = 'custom_reply_to')}
							class="cf-pressable cursor-pointer rounded-xl border p-3 text-left text-xs {senderMode === 'custom_reply_to'
								? 'border-tone-email-border bg-tone-email-soft text-tone-email-ink'
								: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle'}"
						>
							<p class="font-semibold">Separate Sender Email</p>
							<p class="mt-0.5 text-[11px] opacity-85">Custom name and Reply-To</p>
						</button>

						<button
							type="button"
							onclick={() => (senderMode = 'profile')}
							class="cf-pressable cursor-pointer rounded-xl border p-3 text-left text-xs {senderMode === 'profile'
								? 'border-tone-email-border bg-tone-email-soft text-tone-email-ink'
								: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle'}"
						>
							<p class="font-semibold">Saved Sender Profile</p>
							<p class="mt-0.5 text-[11px] opacity-85">{data.senderProfiles.length} saved in Settings</p>
						</button>
					</div>
				{/if}

				{#if canUseServerRelay && senderMode === 'custom_reply_to'}
					<div class="grid gap-3 pt-1 sm:grid-cols-2">
						<div>
							<label for="custom-name" class="block text-xs font-medium text-ink-secondary">
								Sender Display Name
							</label>
							<input
								id="custom-name"
								type="text"
								bind:value={customSenderName}
								placeholder="e.g. Event Organising Committee"
								class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
							/>
						</div>
						<div>
							<label for="custom-email" class="block text-xs font-medium text-ink-secondary">
								Sender Email Address
							</label>
							<input
								id="custom-email"
								type="email"
								bind:value={customSenderEmail}
								placeholder="organiser@event.org"
								class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
							/>
						</div>
					</div>
				{:else if !canUseServerRelay || senderMode === 'profile'}
					<div class={canUseServerRelay ? 'pt-1' : ''}>
						{#if data.senderProfiles.length === 0}
							<div class="rounded-xl border border-border-default bg-surface-page px-3.5 py-3 text-xs text-ink-secondary">
								<p>
									No sender profile connected yet. Add a Brevo or Resend sender profile in
									<a href="/settings?tab=sender" class="font-semibold text-accent-ink underline">
										Account Settings
									</a>
									to send certificates by email.
								</p>
							</div>
						{:else}
							<div class="flex flex-wrap items-center gap-2">
								<select
									aria-label="Saved sender profile"
									bind:value={selectedProfileId}
									class="h-[38px] min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
								>
									<option value="">Select a saved profile</option>
									{#each data.senderProfiles as profile (profile.id)}
										{@const host = profile.smtpHost?.toLowerCase() ?? ''}
										{@const modeLabel =
											profile.mode === 'smtp' && host === 'api.brevo.com'
												? 'Brevo'
												: profile.mode === 'smtp' && host === 'api.resend.com'
													? 'Resend'
													: profile.mode === 'smtp'
														? 'SMTP'
														: 'Reply-To'}
										<option value={profile.id}>
											{profile.label} — {profile.senderEmail} ({modeLabel})
										</option>
									{/each}
								</select>
								<a
									href="/settings?tab=sender"
									class="cf-pressable inline-flex h-[38px] shrink-0 items-center rounded-lg border border-border-strong bg-surface-card px-3 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle"
								>
									Manage Profiles
								</a>
							</div>
						{/if}
					</div>
				{/if}

				{#if usingLocalOutbox}
					<div class="rounded-xl border border-tone-warning-border bg-tone-warning-soft px-3.5 py-2.5 text-xs text-tone-warning-ink">
						<p class="font-semibold">Local development mode</p>
						<p class="mt-1">
							Emails are written to <code class="font-mono">.local/outbox/</code> instead of real inboxes. Add a sender
							profile in
							<a href="/settings?tab=sender" class="font-semibold underline">Account Settings</a> to
							send real emails.
						</p>
					</div>
				{/if}
			</section>

			<!-- Message & Attachment -->
			<section class="space-y-3 border-t border-border-subtle pt-4">
				<h3 class="font-display text-sm font-semibold text-ink-primary">
					2. Email Content &amp; Attachment
				</h3>

				<div class="flex flex-wrap items-center gap-1.5">
					<span class="text-xs text-ink-muted">Insert token:</span>
					{#each ['{{name}}', '{{title}}', '{{role}}', '{{rank}}'] as token (token)}
						<button
							type="button"
							onclick={() => insertTokenIntoBody(token)}
							class="cf-pressable cursor-pointer rounded-md border border-border-default bg-surface-subtle px-2 py-0.5 font-mono text-xs text-ink-primary hover:border-accent-border hover:bg-accent-soft hover:text-accent-ink"
						>
							{token}
						</button>
					{/each}
				</div>

				<div class="grid gap-3 sm:grid-cols-4">
					<div class="sm:col-span-3">
						<label for="email-subject" class="block text-xs font-medium text-ink-secondary">
							Subject
						</label>
						<input
							id="email-subject"
							type="text"
							bind:value={subjectTemplate}
							class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary outline-none focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
						/>
					</div>
					<div>
						<label for="email-format" class="block text-xs font-medium text-ink-secondary">
							Attachment
						</label>
						<select
							id="email-format"
							bind:value={attachmentFormat}
							class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
						>
							<option value="pdf">PDF</option>
							<option value="png">PNG</option>
							<option value="jpg">JPG</option>
						</select>
					</div>
				</div>

				<div>
					<label for="email-body" class="block text-xs font-medium text-ink-secondary">
						Message Body
					</label>
					<textarea
						bind:this={bodyEl}
						id="email-body"
						rows={6}
						bind:value={bodyTemplate}
						class="mt-1.5 block w-full rounded-lg border border-border-strong bg-surface-card px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
					></textarea>
				</div>
			</section>

			<div class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
				<div class="text-xs">
					{#if isDirty}
						<span class="font-medium text-tone-warning-ink">Unsaved draft changes</span>
					{:else}
						<span class="inline-flex items-center gap-1.5 font-medium text-tone-data-ink">
							<Check class="cf-seal-stamp h-3.5 w-3.5" />
							Draft saved
						</span>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<Button
						variant="secondary"
						disabled={savingDraft || sending || !isDirty}
						onclick={handleSaveDraft}
					>
						<Save class="h-4 w-4" />
						{savingDraft ? 'Saving...' : 'Save Draft'}
					</Button>

					{#if sentCerts.length > 0}
						<Button
							variant="secondary"
							disabled={sending || withEmail.length === 0}
							onclick={() => sendCertificates(withEmail)}
						>
							<RotateCw class="h-4 w-4" />
							Resend All ({withEmail.length})
						</Button>
					{/if}

					<Button
						variant="primary"
						disabled={sending || remainingCerts.length === 0}
						onclick={() => sendCertificates(remainingCerts)}
					>
						<Send class="h-4 w-4" />
						{#if sending}
							Sending...
						{:else if remainingCerts.length === 0 && sentCerts.length > 0}
							All {sentCerts.length} Sent
						{:else if sentCerts.length > 0}
							Send Remaining ({remainingCerts.length})
						{:else}
							Send to {remainingCerts.length} Recipients
						{/if}
					</Button>
				</div>
			</div>
		</div>

		<!-- Live Rendered Email Preview Card -->
		<aside class="flex flex-col rounded-2xl border border-border-default bg-surface-card shadow-xs lg:col-span-5">
			<div class="flex items-center justify-between gap-2 border-b border-border-default px-5 py-3.5">
				<div>
					<p class="text-[11px] font-semibold tracking-[0.07em] text-tone-email-ink uppercase">
						Live Email Preview
					</p>
					<p class="text-xs text-ink-muted">Rendered with actual recipient tokens</p>
				</div>
				<Badge tone="sky">{attachmentFormat.toUpperCase()}</Badge>
			</div>

			{#if data.certificates.length > 1}
				<div class="border-b border-border-subtle bg-surface-page px-5 py-2.5">
					<label for="preview-recipient" class="sr-only">Preview recipient</label>
					<select
						id="preview-recipient"
						bind:value={previewIndex}
						class="h-[30px] w-full rounded-md border border-border-strong bg-surface-card px-2.5 text-xs text-ink-primary outline-none focus:border-accent-vivid dark:bg-surface-recessed"
					>
						{#each data.certificates as cert, idx (cert.id)}
							<option value={idx}>
								{idx + 1}. {cert.recipientName} {cert.email ? `(${cert.email})` : '(No email)'}
							</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="flex flex-1 flex-col space-y-3 p-5 text-sm">
				<div class="space-y-1.5 border-b border-border-subtle pb-3 text-xs">
					<div class="flex gap-2">
						<span class="w-14 shrink-0 text-ink-muted">To:</span>
						<span class="truncate font-mono text-ink-primary">
							{previewCert?.email || 'recipient@example.org'}
						</span>
					</div>
					<div class="flex gap-2">
						<span class="w-14 shrink-0 text-ink-muted">Subject:</span>
						<span class="font-semibold text-ink-primary">
							{interpolatePreview(subjectTemplate) || '(No subject)'}
						</span>
					</div>
				</div>

				<div class="flex-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-secondary">
					{interpolatePreview(bodyTemplate) || '(No message body)'}
				</div>

				<div
					class="flex items-center justify-between gap-2 rounded-xl border border-border-default bg-surface-page px-3 py-2 text-xs"
				>
					<span class="truncate font-mono text-[11px] text-ink-primary">
						{(previewCert?.recipientName ?? 'recipient')
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, '-')}-{previewCert?.certCode ?? 'CF-001'}.{attachmentFormat}
					</span>
					<Badge tone="neutral">{attachmentFormat.toUpperCase()}</Badge>
				</div>
			</div>
		</aside>
	</div>

	<!-- Per-Recipient Delivery Tracker -->
	{#if data.certificates.length > 0}
		<section class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 class="font-display text-sm font-semibold text-ink-primary">
						Recipient Delivery Tracker
					</h3>
					<p class="mt-0.5 text-xs text-ink-muted">
						Track who received their certificate and retry failed or unsent recipients with another
						sender profile.
					</p>
				</div>
				<div class="relative w-full sm:w-64">
					<Search class="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-ink-muted" />
					<input
						type="text"
						bind:value={trackerSearch}
						placeholder="Search recipient or email..."
						class="h-[34px] w-full rounded-lg border border-border-strong bg-surface-card py-1.5 pr-3 pl-8 text-xs text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-vivid dark:bg-surface-recessed"
					/>
				</div>
			</div>

			<!-- Status Filter Pills -->
			<div class="mt-3 flex flex-wrap gap-1.5 tabular-nums">
				<button
					type="button"
					onclick={() => (statusFilter = 'all')}
					class="cf-pressable cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium {statusFilter === 'all'
						? 'border-accent-border bg-accent-soft font-semibold text-accent-ink'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					All ({data.certificates.length})
				</button>
				<button
					type="button"
					onclick={() => (statusFilter = 'remaining')}
					class="cf-pressable cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium {statusFilter ===
					'remaining'
						? 'border-tone-email-border bg-tone-email-soft font-semibold text-tone-email-ink'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					Remaining ({remainingCerts.length})
				</button>
				<button
					type="button"
					onclick={() => (statusFilter = 'sent')}
					class="cf-pressable cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium {statusFilter === 'sent'
						? 'border-tone-data-border bg-tone-data-soft font-semibold text-tone-data-ink'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					Sent ({sentCerts.length})
				</button>
				<button
					type="button"
					onclick={() => (statusFilter = 'failed')}
					class="cf-pressable cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium {statusFilter ===
					'failed'
						? 'border-tone-danger-border bg-tone-danger-soft font-semibold text-tone-danger-ink'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					Failed ({failedCerts.length})
				</button>
				<button
					type="button"
					onclick={() => (statusFilter = 'no_email')}
					class="cf-pressable cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium {statusFilter ===
					'no_email'
						? 'border-border-strong bg-surface-subtle font-semibold text-ink-primary'
						: 'border-border-default bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					No Email ({withoutEmailCerts.length})
				</button>
			</div>

			<div class="mt-3 max-h-[460px] overflow-auto rounded-xl border border-border-default">
				<table class="min-w-full divide-y divide-border-subtle text-left text-xs">
					<thead
						class="sticky top-0 z-20 bg-surface-subtle text-[11px] font-semibold tracking-wide text-ink-secondary uppercase shadow-[inset_0_-1px_0_0_var(--color-border-default)]"
					>
						<tr>
							{#each [
								{ id: 'index' as const, label: '#' },
								{ id: 'recipient' as const, label: 'Recipient' },
								{ id: 'email' as const, label: 'Email' },
								{ id: 'status' as const, label: 'Status' },
								{ id: 'details' as const, label: 'Details' }
							] as col (col.id)}
								{@const activeDir = trackerSort?.column === col.id ? trackerSort.direction : null}
								<th
									aria-sort={activeDir === 'asc'
										? 'ascending'
										: activeDir === 'desc'
											? 'descending'
											: 'none'}
									class="sticky top-0 z-20 bg-surface-subtle px-3 py-2.5"
								>
									<button
										type="button"
										onclick={() => cycleTrackerSort(col.id)}
										class="group inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-ink-primary {activeDir
											? 'text-accent-ink'
											: ''}"
									>
										<span>{col.label}</span>
										{#if activeDir === 'asc'}
											<ArrowUp class="h-3 w-3 shrink-0" />
										{:else if activeDir === 'desc'}
											<ArrowDown class="h-3 w-3 shrink-0" />
										{:else}
											<ArrowUpDown class="h-3 w-3 shrink-0 opacity-40 transition group-hover:opacity-85" />
										{/if}
									</button>
								</th>
							{/each}
							<th class="sticky top-0 z-20 bg-surface-subtle px-3 py-2.5 text-right">Action</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border-subtle bg-surface-card">
						{#if filteredTrackerCerts.length === 0}
							<tr>
								<td colspan={6} class="px-4 py-6 text-center text-ink-muted">
									No recipients match this filter.
								</td>
							</tr>
						{:else}
							{#each filteredTrackerCerts as { cert, rowNumber } (cert.id)}
								{@const log = data.latestLogByCertId[cert.id]}
								{@const hasAddr = Boolean(cert.email)}
								{@const statusTone =
									!hasAddr
										? 'neutral'
										: cert.emailStatus === 'sent'
											? 'emerald'
											: cert.emailStatus === 'failed'
												? 'danger'
												: 'amber'}
								{@const statusLabel =
									!hasAddr
										? 'No Email'
										: cert.emailStatus === 'sent'
											? 'Sent'
											: cert.emailStatus === 'failed'
												? 'Failed'
												: 'Not Sent'}
								<tr class="hover:bg-surface-subtle/45">
									<td class="px-3 py-2.5 font-mono text-ink-muted tabular-nums">{rowNumber}</td>
									<td class="px-3 py-2.5">
										<p class="font-medium text-ink-primary">{cert.recipientName}</p>
										<p class="text-[11px] text-ink-muted">{cert.role}</p>
									</td>
									<td class="px-3 py-2.5 font-mono text-[11px] text-ink-secondary">
										{cert.email ?? '—'}
									</td>
									<td class="px-3 py-2.5">
										<Badge tone={statusTone}>
											<span class="inline-flex items-center gap-1">
												{#if cert.emailStatus === 'sent' && hasAddr}
													<CheckCircle2 class="h-3 w-3" />
												{:else if cert.emailStatus === 'failed' && hasAddr}
													<AlertCircle class="h-3 w-3" />
												{:else if hasAddr}
													<Clock class="h-3 w-3" />
												{/if}
												{statusLabel}
											</span>
										</Badge>
									</td>
									<td class="max-w-xs px-3 py-2.5 text-[11px]">
										{#if !hasAddr}
											<span class="text-ink-muted">Skipped (no email address)</span>
										{:else if cert.emailStatus === 'failed'}
											<span class="break-words text-tone-danger-ink">
												{log?.errorMessage ?? 'Delivery failed'}
											</span>
										{:else if cert.emailStatus === 'sent'}
											<span class="text-tone-data-ink">
												Sent {formatSentTime(cert.lastSentAt ?? log?.sentAt)}
											</span>
										{:else}
											<span class="text-ink-muted">Pending send</span>
										{/if}
									</td>
									<td class="px-3 py-2.5 text-right">
										{#if hasAddr}
											<Button
												type="button"
												size="sm"
												variant={cert.emailStatus === 'sent' ? 'ghost' : 'secondary'}
												disabled={sending}
												onclick={() => sendCertificates([cert], cert.id)}
											>
												{#if sendingSingleId === cert.id}
													Sending...
												{:else if cert.emailStatus === 'sent'}
													Resend
												{:else if cert.emailStatus === 'failed'}
													Retry
												{:else}
													Send
												{/if}
											</Button>
										{:else}
											<span class="text-[11px] text-ink-muted">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- Recent Send Jobs -->
	{#if data.emailJobs.length > 0}
		<div class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
			<h3 class="font-display flex items-center gap-2 text-sm font-semibold text-ink-primary">
				<Mail class="h-4 w-4 text-tone-email" />
				Recent Send Runs
			</h3>
			<div class="mt-3 divide-y divide-border-subtle text-xs">
				{#each data.emailJobs as job (job.id)}
					<div class="space-y-1.5 py-2.5">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<p class="font-medium text-ink-primary">{job.subjectTemplate}</p>
								<p class="text-ink-muted">
									From: <span class="font-mono">{job.senderEmailSnapshot}</span> · Format: {job.attachmentFormat.toUpperCase()}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<Badge tone="emerald">{job.sentCount} sent</Badge>
								{#if job.failedCount > 0}
									<Badge tone="danger">{job.failedCount} failed</Badge>
								{/if}
							</div>
						</div>
						{#if job.failedErrors.length > 0}
							<div
								class="rounded-lg border border-tone-danger-border bg-tone-danger-soft px-3 py-2 text-[11px] text-tone-danger-ink"
							>
								{#each job.failedErrors as err, idx (`${job.id}-err-${idx}`)}
									<p class="break-words">
										<span class="font-semibold">{err.toEmail}:</span>
										{err.errorMessage}
									</p>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</main>
