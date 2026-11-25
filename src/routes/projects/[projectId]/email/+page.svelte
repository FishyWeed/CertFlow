<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Check, Mail, Save, Send } from '@lucide/svelte';
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
	let progressText = $state('');
	let progressTone = $state<'info' | 'success' | 'error'>('info');

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

	function applyDefaults(defaults: ProjectEmailDefaults) {
		const validProfileId =
			defaults.senderProfileId &&
			data.senderProfiles.some((p) => p.id === defaults.senderProfileId)
				? defaults.senderProfileId
				: '';

		const nextMode: EmailSenderMode =
			defaults.senderMode ?? (validProfileId ? 'profile' : 'account');
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
		data.isLocalOutbox && !(senderMode === 'profile' && selectedProfile?.mode === 'smtp')
	);

	const withEmail = $derived(data.certificates.filter((c) => Boolean(c.email)));
	const withoutEmail = $derived(data.certificates.length - withEmail.length);

	function uint8ToBase64(bytes: Uint8Array): string {
		let binary = '';
		const chunkSize = 0x8000;
		for (let i = 0; i < bytes.length; i += chunkSize) {
			binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
		}
		return btoa(binary);
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

	async function handleSendAll() {
		if (withEmail.length === 0) return;
		if (senderMode === 'custom_reply_to' && !customSenderEmail.trim()) {
			progressTone = 'error';
			progressText = 'Enter a custom sender email address first.';
			return;
		}
		if (senderMode === 'profile' && !selectedProfileId) {
			progressTone = 'error';
			progressText = 'Select a saved sender profile first.';
			return;
		}

		sending = true;
		progressTone = 'info';
		let totalSent = 0;
		let totalFailed = 0;
		let usedLocalOutbox = false;
		let firstError: string | null = null;
		const batchSize = 10;

		try {
			for (let start = 0; start < withEmail.length; start += batchSize) {
				const slice = withEmail.slice(start, start + batchSize);
				progressText = `Rendering and sending ${start + 1}–${Math.min(start + batchSize, withEmail.length)} of ${withEmail.length}...`;

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
				if (!res.ok) throw new Error('Batch send request failed.');
				const result = await res.json();
				totalSent += result.sentCount;
				totalFailed += result.failedCount;
				if (result.deliveryMode === 'local_outbox') usedLocalOutbox = true;
				if (!firstError && result.firstError) firstError = result.firstError;
			}

			savedSnapshot = currentSnapshot;
			await invalidateAll();
			if (totalFailed > 0) {
				progressTone = 'error';
				progressText = `Completed: ${totalSent} sent, ${totalFailed} failed, ${withoutEmail} skipped.${firstError ? ` Error: ${firstError}` : ''}`;
			} else if (usedLocalOutbox) {
				progressTone = 'info';
				progressText = `Saved ${totalSent} emails to local test outbox (.local/outbox/), ${withoutEmail} skipped. Real emails require an SMTP profile or SMTP_HOST in .env.`;
			} else {
				progressTone = 'success';
				progressText = `Completed: ${totalSent} sent, ${totalFailed} failed, ${withoutEmail} skipped (no email).`;
			}
		} catch (err) {
			progressTone = 'error';
			progressText = err instanceof Error ? err.message : 'Send failed.';
		} finally {
			sending = false;
		}
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			handleSaveDraft();
		}
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<main class="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
	<div>
		<h2 class="text-lg font-bold text-ink-primary">Send Certificates by Email</h2>
		<p class="mt-1 text-sm text-ink-secondary">
			Send generated certificates to every recipient with an email address in your dataset.
		</p>
	</div>

	<!-- Readiness Strip -->
	<div class="grid gap-3 sm:grid-cols-3">
		<div class="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
			<p class="text-xs font-medium text-sky-800">Ready to Send (With Email)</p>
			<p class="mt-1 text-2xl font-bold text-sky-950">{withEmail.length}</p>
		</div>
		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<p class="text-xs font-medium text-ink-secondary">Skipped (No Email Column/Value)</p>
			<p class="mt-1 text-2xl font-bold text-ink-primary">{withoutEmail}</p>
		</div>
		<div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
			<p class="text-xs font-medium text-emerald-800">Already Sent</p>
			<p class="mt-1 text-2xl font-bold text-emerald-950">
				{data.certificates.filter((c) => c.emailStatus === 'sent').length}
			</p>
		</div>
	</div>

	{#if progressText}
		<div
			class="rounded-xl border px-4 py-3 text-sm {progressTone === 'error'
				? 'border-red-200 bg-red-50 text-red-900'
				: progressTone === 'success'
					? 'border-emerald-200 bg-emerald-50 text-emerald-900'
					: 'border-sky-200 bg-sky-50 text-sky-900'}"
		>
			{progressText}
		</div>
	{/if}

	{#if data.certificates.length === 0}
		<div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
			No certificates are generated yet. You can edit and save your email draft now, then open
			<a
				href={`/projects/${data.project.id}/certificates`}
				class="font-semibold underline"
			>Generate Certificates</a> before you send.
		</div>
	{/if}

	<div class="space-y-5 rounded-xl border border-border-default bg-surface-card p-5">
			<!-- Sender Selection -->
			<section class="space-y-3">
				<h3 class="text-sm font-semibold text-ink-primary">1. Sender Address</h3>
				<div class="grid gap-2 sm:grid-cols-3">
					<button
						type="button"
						onclick={() => (senderMode = 'account')}
						class="rounded-lg border p-3 text-left text-xs {senderMode === 'account'
							? 'border-sky-500 bg-sky-50 text-sky-950'
							: 'border-border-default bg-white text-ink-secondary'}"
					>
						<p class="font-semibold">My Account Email</p>
						<p class="mt-0.5 truncate text-[11px]">{data.user.email}</p>
					</button>

					<button
						type="button"
						onclick={() => (senderMode = 'custom_reply_to')}
						class="rounded-lg border p-3 text-left text-xs {senderMode === 'custom_reply_to'
							? 'border-sky-500 bg-sky-50 text-sky-950'
							: 'border-border-default bg-white text-ink-secondary'}"
					>
						<p class="font-semibold">Separate Sender Email</p>
						<p class="mt-0.5 text-[11px]">Custom name and Reply-To</p>
					</button>

					<button
						type="button"
						onclick={() => (senderMode = 'profile')}
						class="rounded-lg border p-3 text-left text-xs {senderMode === 'profile'
							? 'border-sky-500 bg-sky-50 text-sky-950'
							: 'border-border-default bg-white text-ink-secondary'}"
					>
						<p class="font-semibold">Saved SMTP / API Profile</p>
						<p class="mt-0.5 text-[11px]">{data.senderProfiles.length} saved in Account</p>
					</button>
				</div>

				{#if senderMode === 'custom_reply_to'}
					<div class="grid gap-3 pt-2 sm:grid-cols-2">
						<div>
							<label for="custom-name" class="block text-xs font-medium text-ink-secondary">
								Sender Display Name
							</label>
							<input
								id="custom-name"
								type="text"
								bind:value={customSenderName}
								placeholder="e.g. Event Organising Committee"
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
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
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						</div>
					</div>
				{:else if senderMode === 'profile'}
					<div class="pt-2">
						{#if data.senderProfiles.length === 0}
							<p class="text-xs text-ink-muted">
								No saved SMTP profiles yet. Add one in
								<a href="/settings" class="font-semibold text-sky-700 underline">Account Settings</a>.
							</p>
						{:else}
							<select
								bind:value={selectedProfileId}
								class="block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
							>
								<option value="">Select a saved profile</option>
								{#each data.senderProfiles as profile (profile.id)}
									{@const host = profile.smtpHost?.toLowerCase() ?? ''}
									{@const modeLabel =
										profile.mode === 'smtp' && host === 'api.brevo.com'
											? 'Brevo API'
											: profile.mode === 'smtp' && host === 'api.resend.com'
												? 'Resend API'
												: profile.mode === 'smtp'
													? 'SMTP'
													: 'Reply-To'}
									<option value={profile.id}>
										{profile.label} — {profile.senderEmail} ({modeLabel})
									</option>
								{/each}
							</select>
						{/if}
					</div>
				{/if}
				{#if usingLocalOutbox}
					<div class="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
						<p class="font-semibold">Local test mode active — emails will not reach real inboxes</p>
						<p class="mt-1">
							The server currently writes previews to <code>.local/outbox/</code>. To send real
							emails on Railway Free or Hobby plans, set <code>BREVO_API_KEY</code> (or
							<code>RESEND_API_KEY</code>) and <code>DEFAULT_FROM_EMAIL</code> in your environment
							variables, or add a <strong>Custom SMTP Server</strong> in
							<a href="/settings" class="font-semibold underline">Account Settings</a>.
						</p>
					</div>
				{/if}
			</section>

			<!-- Message & Attachment -->
			<section class="space-y-3 border-t border-border-default pt-4">
				<h3 class="text-sm font-semibold text-ink-primary">2. Email Content & Attachment</h3>
				<p class="text-xs text-ink-muted">
					Available placeholders: <code>{`{{name}}`}</code>, <code>{`{{title}}`}</code>,
					<code>{`{{role}}`}</code>, <code>{`{{rank}}`}</code>.
				</p>

				<div class="grid gap-3 sm:grid-cols-4">
					<div class="sm:col-span-3">
						<label for="email-subject" class="block text-xs font-medium text-ink-secondary">
							Subject
						</label>
						<input
							id="email-subject"
							type="text"
							bind:value={subjectTemplate}
							class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<label for="email-format" class="block text-xs font-medium text-ink-secondary">
							Attachment Format
						</label>
						<select
							id="email-format"
							bind:value={attachmentFormat}
							class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
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
						id="email-body"
						rows={5}
						bind:value={bodyTemplate}
						class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
					></textarea>
				</div>
			</section>

			<div class="flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-4">
				<div class="text-xs">
					{#if isDirty}
						<span class="font-medium text-amber-700">Unsaved draft changes</span>
					{:else}
						<span class="inline-flex items-center gap-1 font-medium text-emerald-700">
							<Check class="h-3.5 w-3.5" />
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

					<Button variant="primary" disabled={sending || withEmail.length === 0} onclick={handleSendAll}>
						<Send class="h-4 w-4" />
						{sending ? 'Sending...' : `Send to ${withEmail.length} Recipients with Email`}
					</Button>
				</div>
			</div>
		</div>

		<!-- Recent Send Jobs -->
		{#if data.emailJobs.length > 0}
			<div class="rounded-xl border border-border-default bg-surface-card p-5">
				<h3 class="flex items-center gap-2 text-sm font-semibold text-ink-primary">
					<Mail class="h-4 w-4 text-sky-600" />
					Recent Send Runs
				</h3>
				<div class="mt-3 divide-y divide-border-default text-xs">
					{#each data.emailJobs as job (job.id)}
						<div class="space-y-1.5 py-2.5">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p class="font-medium text-ink-primary">{job.subjectTemplate}</p>
									<p class="text-ink-muted">
										From: {job.senderEmailSnapshot} · Format: {job.attachmentFormat.toUpperCase()}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<Badge tone="emerald">{job.sentCount} sent</Badge>
									{#if job.failedCount > 0}
										<Badge tone="red">{job.failedCount} failed</Badge>
									{/if}
								</div>
							</div>
							{#if job.failedErrors.length > 0}
								<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-900">
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
