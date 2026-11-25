<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		BookOpen,
		ChevronDown,
		ChevronUp,
		ExternalLink,
		HardDrive,
		KeyRound,
		Mail,
		Pencil,
		Plus,
		Save,
		Trash2,
		User,
		X
	} from '@lucide/svelte';
	import { authClient } from '#lib/auth-client.ts';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { formatBytes } from '#lib/config/limits.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let activeTab = $state<'account' | 'sender'>(
		page.url.searchParams.get('tab') === 'sender' ? 'sender' : 'account'
	);

	// Account profile & password state
	let accountName = $state('');
	let savingName = $state(false);
	let accountStatus = $state('');
	let accountStatusTone = $state<'success' | 'error'>('success');

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let revokeOtherSessions = $state(true);
	let changingPassword = $state(false);
	let passwordStatus = $state('');
	let passwordStatusTone = $state<'success' | 'error'>('success');

	// Storage cleanup state
	let cleaningStorage = $state(false);
	let cleanupStatus = $state('');
	let cleanupStatusTone = $state<'success' | 'error'>('success');

	const projectPercent = $derived(
		Math.min(100, Math.round((data.usage.projectCount / Math.max(1, data.usage.maxProjects)) * 100))
	);
	const storagePercent = $derived(
		Math.min(
			100,
			Math.round((data.usage.storageUsedBytes / Math.max(1, data.usage.maxStorageBytes)) * 100)
		)
	);

	async function handleCleanUpStorage() {
		cleaningStorage = true;
		cleanupStatus = '';
		try {
			const res = await fetch('/api/account/storage/cleanup', { method: 'POST' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Could not clean up unused files.');
			}
			const result = (await res.json()) as { deletedCount: number; freedBytes: number };
			await invalidateAll();
			cleanupStatusTone = 'success';
			cleanupStatus =
				result.deletedCount > 0
					? `Removed ${result.deletedCount} unused ${result.deletedCount === 1 ? 'file' : 'files'} and freed ${formatBytes(result.freedBytes)}.`
					: 'No unused files found. All uploaded images are in use.';
		} catch (err) {
			cleanupStatusTone = 'error';
			cleanupStatus = err instanceof Error ? err.message : 'Storage cleanup failed.';
		} finally {
			cleaningStorage = false;
		}
	}

	$effect(() => {
		if (!accountName && data.user.name) {
			accountName = data.user.name;
		}
	});

	// Sender profile guide state
	let showSetupGuide = $state(true);
	let guideProvider = $state<'brevo' | 'resend'>('brevo');

	// Sender profile CRUD state
	let editingId = $state<string | null>(null);
	let editingHasPassword = $state(false);
	let confirmDeleteId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let formSectionEl = $state<HTMLElement | null>(null);

	type ProfileFormMode = 'brevo_api' | 'resend_api' | 'smtp' | 'custom_reply_to';

	let label = $state('');
	let mode = $state<ProfileFormMode>('brevo_api');
	let senderName = $state('');
	let senderEmail = $state('');
	let smtpHost = $state('smtp.gmail.com');
	let smtpPort = $state(465);
	let smtpSecure = $state(true);
	let smtpUser = $state('');
	let smtpPassword = $state('');
	let status = $state('');
	let statusTone = $state<'success' | 'error'>('success');
	let saving = $state(false);

	function detectFormMode(profile: { mode: string; smtpHost?: string | null }): ProfileFormMode {
		const host = profile.smtpHost?.trim().toLowerCase() ?? '';
		if (profile.mode === 'smtp' && host === 'api.brevo.com') return 'brevo_api';
		if (profile.mode === 'smtp' && host === 'api.resend.com') return 'resend_api';
		if (profile.mode === 'smtp') return 'smtp';
		return 'custom_reply_to';
	}

	function profileBadgeLabel(profile: { mode: string; smtpHost?: string | null }): string {
		const kind = detectFormMode(profile);
		if (kind === 'brevo_api') return 'Brevo';
		if (kind === 'resend_api') return 'Resend';
		if (kind === 'smtp') return 'SMTP';
		return 'Reply-To';
	}

	async function handleUpdateName(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = accountName.trim();
		if (trimmed.length < 2) {
			accountStatusTone = 'error';
			accountStatus = 'Enter a full name with at least 2 characters.';
			return;
		}
		savingName = true;
		accountStatus = '';
		try {
			const res = await authClient.updateUser({ name: trimmed });
			if (res.error) {
				throw new Error(res.error.message || 'Could not update display name.');
			}
			await invalidateAll();
			accountStatusTone = 'success';
			accountStatus = 'Account display name updated.';
		} catch (err) {
			accountStatusTone = 'error';
			accountStatus = err instanceof Error ? err.message : 'Could not update display name.';
		} finally {
			savingName = false;
		}
	}

	async function handleChangePassword(event: SubmitEvent) {
		event.preventDefault();
		passwordStatus = '';

		if (newPassword.length < 8) {
			passwordStatusTone = 'error';
			passwordStatus = 'New password must be at least 8 characters.';
			return;
		}
		if (newPassword !== confirmPassword) {
			passwordStatusTone = 'error';
			passwordStatus = 'New password and confirmation do not match.';
			return;
		}
		if (currentPassword === newPassword) {
			passwordStatusTone = 'error';
			passwordStatus = 'New password must be different from your current password.';
			return;
		}

		changingPassword = true;
		try {
			const res = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions
			});
			if (res.error) {
				throw new Error(res.error.message || 'Could not change password.');
			}
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			passwordStatusTone = 'success';
			passwordStatus = 'Password changed successfully.';
		} catch (err) {
			passwordStatusTone = 'error';
			passwordStatus = err instanceof Error ? err.message : 'Could not change password.';
		} finally {
			changingPassword = false;
		}
	}

	function resetForm() {
		editingId = null;
		editingHasPassword = false;
		label = '';
		mode = 'brevo_api';
		senderName = '';
		senderEmail = '';
		smtpHost = 'smtp.gmail.com';
		smtpPort = 465;
		smtpSecure = true;
		smtpUser = '';
		smtpPassword = '';
	}

	function startEdit(profile: (typeof data.profiles)[number]) {
		editingId = profile.id;
		editingHasPassword = profile.hasSmtpPassword;
		confirmDeleteId = null;
		label = profile.label;
		mode = detectFormMode(profile);
		senderName = profile.senderName;
		senderEmail = profile.senderEmail;
		smtpHost = mode === 'smtp' ? (profile.smtpHost ?? 'smtp.gmail.com') : 'smtp.gmail.com';
		smtpPort = mode === 'smtp' ? (profile.smtpPort ?? 465) : 465;
		smtpSecure = mode === 'smtp' ? (profile.smtpSecure ?? smtpPort === 465) : true;
		smtpUser = profile.smtpUser ?? '';
		smtpPassword = '';
		status = '';
		formSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async function handleSubmitProfile(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		status = '';
		const isEditing = editingId !== null;
		const isBrevo = mode === 'brevo_api';
		const isResend = mode === 'resend_api';
		const isApiOrSmtp = isBrevo || isResend || mode === 'smtp';
		const payloadMode = isApiOrSmtp ? 'smtp' : 'custom_reply_to';
		try {
			const url = isEditing ? `/api/sender-profiles/${editingId}` : '/api/sender-profiles';
			const res = await fetch(url, {
				method: isEditing ? 'PATCH' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					label,
					mode: payloadMode,
					senderName,
					senderEmail,
					smtpHost: isBrevo
						? 'api.brevo.com'
						: isResend
							? 'api.resend.com'
							: mode === 'smtp'
								? smtpHost
								: undefined,
					smtpPort: isBrevo || isResend ? 443 : mode === 'smtp' ? Number(smtpPort) : undefined,
					smtpSecure: isBrevo || isResend ? true : mode === 'smtp' ? smtpSecure : undefined,
					smtpUser: isBrevo || isResend ? senderEmail : mode === 'smtp' ? smtpUser : undefined,
					smtpPassword: isApiOrSmtp && smtpPassword ? smtpPassword : undefined
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(
					err.message ??
						(isEditing ? 'Could not update sender profile.' : 'Could not save sender profile.')
				);
			}
			resetForm();
			await invalidateAll();
			statusTone = 'success';
			status = isEditing ? 'Sender profile updated.' : 'Sender profile saved.';
		} catch (err) {
			statusTone = 'error';
			status = err instanceof Error ? err.message : 'Save failed.';
		} finally {
			saving = false;
		}
	}

	async function handleDeleteProfile(profileId: string) {
		deletingId = profileId;
		status = '';
		try {
			const res = await fetch(`/api/sender-profiles/${profileId}`, { method: 'DELETE' });
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Could not delete sender profile.');
			}
			if (editingId === profileId) resetForm();
			confirmDeleteId = null;
			await invalidateAll();
			statusTone = 'success';
			status = 'Sender profile deleted.';
		} catch (err) {
			statusTone = 'error';
			status = err instanceof Error ? err.message : 'Delete failed.';
		} finally {
			deletingId = null;
		}
	}
</script>

<div class="min-h-screen bg-surface-page">
	<AppHeader brandHref="/dashboard">
		{#snippet actions()}
			<a
				href="/dashboard"
				class="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				Back to Projects
			</a>
		{/snippet}
	</AppHeader>

	<main class="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
		<div class="space-y-4">
			<div>
				<h1 class="text-xl font-bold text-ink-primary">Settings</h1>
				<p class="mt-1 text-sm text-ink-secondary">
					Manage your CertFlow account security and connected email sender profiles.
				</p>
			</div>

			<!-- Section Tabs -->
			<div
				role="tablist"
				aria-label="Settings sections"
				class="flex flex-wrap gap-2 border-b border-border-default pb-2"
			>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'account'}
					onclick={() => (activeTab = 'account')}
					class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition {activeTab ===
					'account'
						? 'bg-accent text-white shadow-xs'
						: 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					<User class="h-4 w-4" />
					Account
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'sender'}
					onclick={() => (activeTab = 'sender')}
					class="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition {activeTab ===
					'sender'
						? 'bg-accent text-white shadow-xs'
						: 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
				>
					<Mail class="h-4 w-4" />
					Email Sender Profiles
					<span
						class="rounded-full px-1.5 py-0.5 text-[11px] font-medium {activeTab === 'sender'
							? 'bg-white/20 text-white'
							: 'bg-surface-subtle text-ink-muted'}"
					>
						{data.profiles.length}
					</span>
				</button>
			</div>
		</div>

		{#if activeTab === 'account'}
			<!-- Account Details -->
			<section class="rounded-xl border border-border-default bg-surface-card p-5">
				<h2 class="text-sm font-semibold text-ink-primary">Account Details</h2>
				<p class="mt-1 text-xs text-ink-secondary">
					Update the display name shown across your CertFlow workspace.
				</p>

				{#if accountStatus}
					<div
						class="mt-3 rounded-lg border px-3.5 py-2.5 text-xs {accountStatusTone === 'error'
							? 'border-red-200 bg-red-50 text-red-900'
							: 'border-emerald-200 bg-emerald-50 text-emerald-800'}"
					>
						{accountStatus}
					</div>
				{/if}

				<form class="mt-4 space-y-4" onsubmit={handleUpdateName}>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<label for="acc-name" class="block text-xs font-medium text-ink-secondary">
								Full Name
							</label>
							<input
								id="acc-name"
								type="text"
								required
								minlength={2}
								bind:value={accountName}
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="acc-email" class="block text-xs font-medium text-ink-secondary">
								Email Address
							</label>
							<input
								id="acc-email"
								type="email"
								value={data.user.email}
								disabled
								class="mt-1 block w-full rounded-lg border border-border-default bg-surface-page px-3 py-2 text-sm text-ink-muted"
							/>
						</div>
					</div>

					<Button
						type="submit"
						variant="primary"
						disabled={savingName || accountName.trim() === data.user.name}
					>
						<Save class="h-4 w-4" />
						{savingName ? 'Saving...' : 'Save Name'}
					</Button>
				</form>
			</section>

			<!-- Change Password -->
			<section class="rounded-xl border border-border-default bg-surface-card p-5">
				<div class="flex items-center gap-2">
					<KeyRound class="h-4 w-4 text-accent" />
					<h2 class="text-sm font-semibold text-ink-primary">Change Password</h2>
				</div>
				<p class="mt-1 text-xs text-ink-secondary">
					Enter your current password to set a new password for your account.
				</p>

				{#if passwordStatus}
					<div
						class="mt-3 rounded-lg border px-3.5 py-2.5 text-xs {passwordStatusTone === 'error'
							? 'border-red-200 bg-red-50 text-red-900'
							: 'border-emerald-200 bg-emerald-50 text-emerald-800'}"
					>
						{passwordStatus}
					</div>
				{/if}

				<form class="mt-4 space-y-4" onsubmit={handleChangePassword}>
					<div>
						<label for="pw-current" class="block text-xs font-medium text-ink-secondary">
							Current Password
						</label>
						<input
							id="pw-current"
							type="password"
							required
							autocomplete="current-password"
							bind:value={currentPassword}
							class="mt-1 block w-full max-w-md rounded-lg border border-border-strong px-3 py-2 text-sm"
						/>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<label for="pw-new" class="block text-xs font-medium text-ink-secondary">
								New Password
							</label>
							<input
								id="pw-new"
								type="password"
								required
								minlength={8}
								autocomplete="new-password"
								placeholder="Minimum 8 characters"
								bind:value={newPassword}
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="pw-confirm" class="block text-xs font-medium text-ink-secondary">
								Confirm New Password
							</label>
							<input
								id="pw-confirm"
								type="password"
								required
								minlength={8}
								autocomplete="new-password"
								placeholder="Re-enter new password"
								bind:value={confirmPassword}
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						</div>
					</div>

					<label class="inline-flex items-center gap-2 text-xs text-ink-secondary">
						<input
							type="checkbox"
							bind:checked={revokeOtherSessions}
							class="rounded border-border-strong"
						/>
						Sign out other active devices after changing password
					</label>

					<div>
						<Button type="submit" variant="primary" disabled={changingPassword}>
							<KeyRound class="h-4 w-4" />
							{changingPassword ? 'Updating...' : 'Update Password'}
						</Button>
					</div>
				</form>
			</section>

			<!-- Account Usage & Storage -->
			<section class="rounded-xl border border-border-default bg-surface-card p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<HardDrive class="h-4 w-4 text-accent" />
						<h2 class="text-sm font-semibold text-ink-primary">Account Usage &amp; Storage</h2>
					</div>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						disabled={cleaningStorage || data.usage.assetCount === 0}
						onclick={handleCleanUpStorage}
					>
						<Trash2 class="h-3.5 w-3.5" />
						{cleaningStorage ? 'Cleaning...' : 'Clean Up Unused Files'}
					</Button>
				</div>
				<p class="mt-1 text-xs text-ink-secondary">
					Uploaded backgrounds, logos and signatures are automatically optimised to WebP and cleaned
					up when you delete a project.
				</p>

				{#if cleanupStatus}
					<div
						class="mt-3 rounded-lg border px-3.5 py-2.5 text-xs {cleanupStatusTone === 'error'
							? 'border-red-200 bg-red-50 text-red-900'
							: 'border-emerald-200 bg-emerald-50 text-emerald-800'}"
					>
						{cleanupStatus}
					</div>
				{/if}

				<div class="mt-4 grid gap-4 sm:grid-cols-2">
					<div class="rounded-lg border border-border-default bg-surface-page p-3.5">
						<div class="flex items-center justify-between text-xs">
							<span class="font-medium text-ink-secondary">Projects</span>
							<span class="font-semibold text-ink-primary">
								{data.usage.projectCount} / {data.usage.maxProjects}
							</span>
						</div>
						<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
							<div
								class="h-full rounded-full transition-all {projectPercent >= 100
									? 'bg-red-500'
									: projectPercent >= 80
										? 'bg-amber-500'
										: 'bg-accent'}"
								style="width: {projectPercent}%;"
							></div>
						</div>
						<p class="mt-1.5 text-[11px] text-ink-muted">
							Each account can keep up to {data.usage.maxProjects} active projects.
						</p>
					</div>

					<div class="rounded-lg border border-border-default bg-surface-page p-3.5">
						<div class="flex items-center justify-between text-xs">
							<span class="font-medium text-ink-secondary">
								Image Storage ({data.usage.assetCount}
								{data.usage.assetCount === 1 ? 'file' : 'files'})
							</span>
							<span class="font-semibold text-ink-primary">
								{formatBytes(data.usage.storageUsedBytes)} / {formatBytes(data.usage.maxStorageBytes)}
							</span>
						</div>
						<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
							<div
								class="h-full rounded-full transition-all {storagePercent >= 95
									? 'bg-red-500'
									: storagePercent >= 80
										? 'bg-amber-500'
										: 'bg-emerald-500'}"
								style="width: {storagePercent}%;"
							></div>
						</div>
						<p class="mt-1.5 text-[11px] text-ink-muted">
							Generated certificates render in your browser and do not count towards storage.
						</p>
					</div>
				</div>
			</section>
		{:else}
			<!-- Email Sender Profiles Tab -->
			{#if status}
				<div
					class="rounded-xl border px-4 py-3 text-sm {statusTone === 'error'
						? 'border-red-200 bg-red-50 text-red-900'
						: 'border-emerald-200 bg-emerald-50 text-emerald-800'}"
				>
					{status}
				</div>
			{/if}

			<!-- Setup Guide Card -->
			<section class="rounded-xl border border-border-default bg-surface-card p-5">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<BookOpen class="h-4 w-4 text-accent" />
						<h2 class="text-sm font-semibold text-ink-primary">Setup Guide (Brevo &amp; Resend)</h2>
					</div>
					<button
						type="button"
						onclick={() => (showSetupGuide = !showSetupGuide)}
						class="inline-flex items-center gap-1 rounded-lg border border-border-default px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
					>
						{showSetupGuide ? 'Hide Guide' : 'Show Guide'}
						{#if showSetupGuide}
							<ChevronUp class="h-3.5 w-3.5" />
						{:else}
							<ChevronDown class="h-3.5 w-3.5" />
						{/if}
					</button>
				</div>

				{#if showSetupGuide}
					<div class="mt-3 space-y-4">
						<div class="flex flex-wrap gap-1.5">
							<button
								type="button"
								onclick={() => (guideProvider = 'brevo')}
								class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition {guideProvider ===
								'brevo'
									? 'border-accent bg-indigo-50 text-accent'
									: 'border-border-default bg-white text-ink-secondary hover:bg-surface-subtle'}"
							>
								Brevo (Gmail or custom domain · Free 300/day)
							</button>
							<button
								type="button"
								onclick={() => (guideProvider = 'resend')}
								class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition {guideProvider ===
								'resend'
									? 'border-accent bg-indigo-50 text-accent'
									: 'border-border-default bg-white text-ink-secondary hover:bg-surface-subtle'}"
							>
								Resend (Custom domain · Free 100/day)
							</button>
						</div>

						{#if guideProvider === 'brevo'}
							<div class="space-y-2.5 rounded-lg border border-border-default bg-surface-page p-4 text-xs text-ink-secondary">
								<p class="font-semibold text-ink-primary">
									Brevo works with a normal Gmail address — no custom domain required.
								</p>
								<ol class="list-decimal space-y-2 pl-4">
									<li>
										Create a free account at
										<a
											href="https://www.brevo.com"
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-0.5 font-semibold text-accent underline"
										>
											brevo.com
											<ExternalLink class="h-3 w-3" />
										</a>.
									</li>
									<li>
										<strong>Verify your sender email</strong>: Open
										<strong>Senders, Domains &amp; Dedicated IPs -&gt; Senders</strong> and add or
										verify the email address you want to send from (such as your Gmail address).
									</li>
									<li>
										<strong>Create an API Key</strong>: Open
										<strong>SMTP &amp; API -&gt; API Keys</strong> (do not use the SMTP tab). Click
										<strong>Generate a new API key</strong> and copy the full key starting with
										<code>xkeysib-</code>.
									</li>
									<li>
										<strong>Deactivate Authorised IP blocking (important)</strong>: Open
										<a
											href="https://app.brevo.com/security/authorised_ips"
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-0.5 font-semibold text-accent underline"
										>
											Brevo Authorised IPs
											<ExternalLink class="h-3 w-3" />
										</a>
										and click <strong>Deactivate blocking</strong>. Brevo blocks unrecognised cloud
										server IPs by default until you disable this restriction.
									</li>
									<li>
										In <strong>Add Sender Profile</strong> below, choose
										<strong>Brevo (Gmail or custom domain)</strong>, enter your verified email and
										<code>xkeysib-...</code> API key, then click <strong>Save Sender Profile</strong>.
									</li>
								</ol>
							</div>
						{:else}
							<div class="space-y-2.5 rounded-lg border border-border-default bg-surface-page p-4 text-xs text-ink-secondary">
								<p class="font-semibold text-ink-primary">
									Resend requires your own domain name (such as <code>@yourclub.org</code>) to send
									to recipients.
								</p>
								<ol class="list-decimal space-y-2 pl-4">
									<li>
										Create a free account at
										<a
											href="https://resend.com"
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-0.5 font-semibold text-accent underline"
										>
											resend.com
											<ExternalLink class="h-3 w-3" />
										</a>.
									</li>
									<li>
										<strong>Verify your domain</strong>: Open <strong>Domains -&gt; Add Domain</strong>
										and add the DKIM and SPF DNS records shown by Resend at your domain provider. Wait
										until the status changes to <strong>Verified</strong>.
									</li>
									<li>
										<strong>Create an API Key</strong>: Open
										<strong>API Keys -&gt; Create API Key</strong>, choose
										<strong>Sending access</strong> for your verified domain and copy the key
										starting with <code>re_</code>.
									</li>
									<li>
										In <strong>Add Sender Profile</strong> below, choose
										<strong>Resend (Custom domain)</strong>, enter a sender email on your verified
										domain (for example <code>certificates@yourclub.org</code>) and your
										<code>re_...</code> API key, then click <strong>Save Sender Profile</strong>.
									</li>
								</ol>
							</div>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Add / Edit Sender Profile -->
			<section
				bind:this={formSectionEl}
				class="rounded-xl border border-border-default bg-surface-card p-5"
			>
				<div class="flex items-center justify-between gap-2">
					<h2 class="text-sm font-semibold text-ink-primary">
						{editingId ? 'Edit Sender Profile' : 'Add Sender Profile'}
					</h2>
					{#if editingId}
						<button
							type="button"
							onclick={resetForm}
							class="inline-flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-ink-primary"
						>
							<X class="h-3.5 w-3.5" />
							Cancel edit
						</button>
					{/if}
				</div>
				<form class="mt-4 space-y-4" onsubmit={handleSubmitProfile}>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<label for="sp-label" class="block text-xs font-medium text-ink-secondary">Label</label>
							<input
								id="sp-label"
								type="text"
								required
								bind:value={label}
								placeholder="e.g. Event Team Gmail"
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="sp-mode" class="block text-xs font-medium text-ink-secondary">Mode</label>
							<select
								id="sp-mode"
								bind:value={mode}
								class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
							>
								<option value="brevo_api">Brevo (Gmail or custom domain)</option>
								<option value="resend_api">Resend (Custom domain)</option>
								{#if data.mailCapabilities.allowRawSmtp || (editingId && mode === 'smtp')}
									<option value="smtp">Custom SMTP Server</option>
								{/if}
								{#if data.mailCapabilities.hasServerRelay || (editingId && mode === 'custom_reply_to')}
									<option value="custom_reply_to">Custom Reply-To</option>
								{/if}
							</select>
						</div>
					</div>

					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<label for="sp-name" class="block text-xs font-medium text-ink-secondary">
								Sender Display Name
							</label>
							<input
								id="sp-name"
								type="text"
								required
								bind:value={senderName}
								placeholder="e.g. Event Organising Committee"
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label for="sp-email" class="block text-xs font-medium text-ink-secondary">
								Sender Email
							</label>
							<input
								id="sp-email"
								type="email"
								required
								bind:value={senderEmail}
								placeholder="events@example.org"
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						</div>
					</div>

					{#if mode === 'brevo_api' || mode === 'resend_api'}
						<div class="space-y-2 rounded-lg border border-border-default bg-surface-page p-3">
							<label for="api-key-input" class="block text-xs font-medium text-ink-secondary">
								{mode === 'brevo_api'
									? 'Brevo API Key (AES-256-GCM encrypted)'
									: 'Resend API Key (AES-256-GCM encrypted)'}
							</label>
							<input
								id="api-key-input"
								type="password"
								required={!editingId || !editingHasPassword}
								autocomplete="new-password"
								placeholder={editingId && editingHasPassword
									? 'Leave blank to keep saved API key'
									: mode === 'brevo_api'
										? 'xkeysib-...'
										: 're_...'}
								bind:value={smtpPassword}
								class="block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
							/>
							<p class="text-[11px] text-ink-muted">
								{#if mode === 'brevo_api'}
									Use an API Key starting with <code>xkeysib-</code> (not an SMTP key). Keys are
									encrypted before storage.
								{:else}
									Use an API Key starting with <code>re_</code> with sending access for your
									verified domain. Keys are encrypted before storage.
								{/if}
							</p>
						</div>
					{:else if mode === 'smtp'}
						<div class="grid gap-3 rounded-lg border border-border-default bg-surface-page p-3 sm:grid-cols-2">
							<div>
								<label for="smtp-host" class="block text-xs font-medium text-ink-secondary">
									SMTP Host
								</label>
								<input
									id="smtp-host"
									type="text"
									required
									autocomplete="off"
									placeholder="smtp.gmail.com"
									bind:value={smtpHost}
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label for="smtp-port" class="block text-xs font-medium text-ink-secondary">
									SMTP Port
								</label>
								<input
									id="smtp-port"
									type="number"
									required
									bind:value={smtpPort}
									oninput={() => {
										smtpSecure = Number(smtpPort) === 465;
									}}
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
								/>
							</div>
							<div class="sm:col-span-2">
								<label class="inline-flex items-center gap-2 text-xs text-ink-secondary">
									<input type="checkbox" bind:checked={smtpSecure} class="rounded border-border-strong" />
									Use direct TLS (enabled for port 465, disabled for STARTTLS port 587)
								</label>
							</div>
							<div>
								<label for="smtp-user" class="block text-xs font-medium text-ink-secondary">
									SMTP Username
								</label>
								<input
									id="smtp-user"
									type="text"
									required
									bind:value={smtpUser}
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
								/>
							</div>
							<div>
								<label for="smtp-pass" class="block text-xs font-medium text-ink-secondary">
									SMTP Password / App Password (AES-256-GCM encrypted)
								</label>
								<input
									id="smtp-pass"
									type="password"
									required={!editingId || !editingHasPassword}
									autocomplete="new-password"
									placeholder={editingId && editingHasPassword
										? 'Leave blank to keep saved password'
										: '16-character App Password'}
									bind:value={smtpPassword}
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
								/>
							</div>
						</div>
					{/if}

					<div class="flex flex-wrap items-center gap-2">
						<Button type="submit" variant="primary" disabled={saving}>
							{#if editingId}
								<Save class="h-4 w-4" />
								{saving ? 'Updating...' : 'Update Sender Profile'}
							{:else}
								<Plus class="h-4 w-4" />
								{saving ? 'Saving...' : 'Save Sender Profile'}
							{/if}
						</Button>
						{#if editingId}
							<Button type="button" variant="secondary" disabled={saving} onclick={resetForm}>
								Cancel
							</Button>
						{/if}
					</div>
				</form>
			</section>

			<!-- Saved Profiles -->
			<section class="rounded-xl border border-border-default bg-surface-card p-5">
				<h2 class="text-sm font-semibold text-ink-primary">Saved Profiles ({data.profiles.length})</h2>
				{#if data.profiles.length === 0}
					<p class="mt-2 text-xs text-ink-muted">No sender profiles saved yet.</p>
				{:else}
					<ul class="mt-3 divide-y divide-border-default text-sm">
						{#each data.profiles as profile (profile.id)}
							<li
								class="flex flex-wrap items-center justify-between gap-3 py-2.5 {editingId ===
								profile.id
									? 'rounded-lg bg-sky-50/70 px-2.5'
									: ''}"
							>
								<div class="min-w-0">
									<p class="font-medium text-ink-primary">{profile.label}</p>
									<p class="text-xs text-ink-muted">
										{profile.senderName} &lt;{profile.senderEmail}&gt;
										{#if profile.smtpHost && !['api.brevo.com', 'api.resend.com'].includes(profile.smtpHost.toLowerCase())}
											· {profile.smtpHost}:{profile.smtpPort}
										{/if}
									</p>
								</div>
								<div class="flex flex-wrap items-center gap-2">
									<Badge tone={profile.mode === 'smtp' ? 'sky' : 'neutral'}>
										{profileBadgeLabel(profile)}
									</Badge>
									<Button
										type="button"
										size="sm"
										variant="secondary"
										onclick={() => startEdit(profile)}
									>
										<Pencil class="h-3.5 w-3.5" />
										Edit
									</Button>
									{#if confirmDeleteId === profile.id}
										<Button
											type="button"
											size="sm"
											variant="danger"
											disabled={deletingId === profile.id}
											onclick={() => handleDeleteProfile(profile.id)}
										>
											{deletingId === profile.id ? 'Deleting...' : 'Confirm'}
										</Button>
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onclick={() => (confirmDeleteId = null)}
										>
											Cancel
										</Button>
									{:else}
										<Button
											type="button"
											size="sm"
											variant="ghost"
											onclick={() => (confirmDeleteId = profile.id)}
										>
											<Trash2 class="h-3.5 w-3.5" />
											Delete
										</Button>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</main>
</div>
