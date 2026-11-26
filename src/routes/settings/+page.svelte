<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		BookOpen,
		ChevronDown,
		ChevronUp,
		Download,
		ExternalLink,
		HardDrive,
		KeyRound,
		Loader2,
		LogOut,
		Mail,
		Pencil,
		Plus,
		RefreshCw,
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

	type SettingsSection = 'profile' | 'security' | 'storage' | 'updates' | 'sender';

	function resolveInitialSection(): SettingsSection {
		const tab = page.url.searchParams.get('tab');
		if (
			tab === 'profile' ||
			tab === 'security' ||
			tab === 'storage' ||
			tab === 'sender' ||
			(tab === 'updates' && data.portableInfo?.canShowUpdates)
		) {
			return tab;
		}
		return 'profile';
	}

	let activeSection = $state<SettingsSection>(resolveInitialSection());
	let signingOut = $state(false);

	async function handleSignOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await goto('/', { invalidateAll: true });
		} finally {
			signingOut = false;
		}
	}

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

	// Portable app self-updater state
	interface PortableUpdateCheck {
		currentVersion: string;
		latestVersion: string;
		updateAvailable: boolean;
		releaseUrl: string;
		releaseNotes: string;
		publishedAt: string | null;
		assetName: string | null;
		assetUrl: string | null;
		assetSizeBytes: number;
		stagedVersion: string | null;
	}
	interface PortableUpdateProgress {
		stage:
			| 'idle'
			| 'checking'
			| 'downloading'
			| 'extracting'
			| 'downloaded'
			| 'applying'
			| 'restarting'
			| 'error';
		version: string;
		stagedVersion: string | null;
		downloadedBytes: number;
		totalBytes: number;
		percent: number | null;
		message: string;
		error: string | null;
	}
	let checkingUpdates = $state(false);
	let downloadingUpdate = $state(false);
	let installingUpdate = $state(false);
	let autoInstallAfterDownload = $state(false);
	let stagedVersion = $state<string | null>(null);
	let updateCheckResult = $state<PortableUpdateCheck | null>(null);
	let updateProgress = $state<PortableUpdateProgress | null>(null);
	let updateMessage = $state('');
	let updateMessageTone = $state<'info' | 'success' | 'error'>('info');

	$effect(() => {
		if (stagedVersion === null && data.portableInfo?.stagedVersion) {
			stagedVersion = data.portableInfo.stagedVersion;
		}
	});

	async function handleCheckPortableUpdates() {
		checkingUpdates = true;
		updateMessage = '';
		try {
			const res = await fetch('/api/portable/update');
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Could not check GitHub for updates.');
			}
			const result = (await res.json()) as PortableUpdateCheck;
			updateCheckResult = result;
			stagedVersion = result.stagedVersion;
			if (!data.portableInfo?.isPortable) {
				updateMessageTone = 'info';
				updateMessage = `Latest GitHub release is ${result.latestVersion}.`;
			} else if (!result.updateAvailable) {
				updateMessageTone = 'success';
				updateMessage = `You are running the latest version (${result.currentVersion}).`;
			} else {
				updateMessageTone = 'info';
				updateMessage = `Version ${result.latestVersion} is available.`;
			}
		} catch (err) {
			updateMessageTone = 'error';
			updateMessage = err instanceof Error ? err.message : 'Update check failed.';
		} finally {
			checkingUpdates = false;
		}
	}

	async function waitForServerRestartAndReload() {
		// Wait briefly for the old process to exit and hand off to the updater script.
		await new Promise((r) => setTimeout(r, 2500));
		const deadline = Date.now() + 90_000;
		while (Date.now() < deadline) {
			try {
				const res = await fetch('/api/health', { cache: 'no-store' });
				if (res.ok) {
					window.location.reload();
					return;
				}
			} catch {
				// Server is restarting; keep polling until it comes back online.
			}
			await new Promise((r) => setTimeout(r, 1500));
		}
		downloadingUpdate = false;
		installingUpdate = false;
		updateMessageTone = 'info';
		updateMessage =
			'Update installed. If this page did not reload automatically, refresh your browser or start CertFlow again.';
	}

	async function pollPortableUpdateProgress(initialStage: PortableUpdateProgress['stage']) {
		let lastStage: PortableUpdateProgress['stage'] = initialStage;
		while (true) {
			await new Promise((r) => setTimeout(r, 400));
			let statusRes: Response;
			try {
				statusRes = await fetch('/api/portable/update?status=1', { cache: 'no-store' });
			} catch {
				if (
					lastStage === 'extracting' ||
					lastStage === 'applying' ||
					lastStage === 'restarting'
				) {
					updateMessage = 'Restarting CertFlow... This page will reload automatically.';
					await waitForServerRestartAndReload();
					return;
				}
				throw new Error('Lost connection to CertFlow while updating.');
			}

			if (!statusRes.ok) {
				if (lastStage === 'applying' || lastStage === 'restarting') {
					await waitForServerRestartAndReload();
					return;
				}
				throw new Error('Could not read update progress.');
			}

			const progress = (await statusRes.json()) as PortableUpdateProgress;
			updateProgress = progress;
			lastStage = progress.stage;
			if (progress.stagedVersion) {
				stagedVersion = progress.stagedVersion;
			}

			if (progress.stage === 'downloading') {
				const downloadedLabel = formatBytes(progress.downloadedBytes);
				const totalLabel = progress.totalBytes > 0 ? formatBytes(progress.totalBytes) : '';
				updateMessage = totalLabel
					? `Downloading ${progress.version || 'update'}: ${downloadedLabel} / ${totalLabel} (${progress.percent ?? 0}%)`
					: `Downloading ${progress.version || 'update'}: ${downloadedLabel}...`;
			} else if (progress.stage === 'extracting') {
				updateMessage = `Extracting ${progress.version || 'update'} files...`;
			} else if (progress.stage === 'downloaded') {
				downloadingUpdate = false;
				installingUpdate = false;
				updateMessageTone = 'success';
				updateMessage =
					progress.message ||
					`Downloaded ${progress.stagedVersion || progress.version}. Click Install to apply and restart CertFlow.`;
				return;
			} else if (progress.stage === 'applying') {
				downloadingUpdate = false;
				installingUpdate = true;
				updateMessage = `Applying ${progress.version || 'update'} files...`;
			} else if (progress.stage === 'restarting') {
				downloadingUpdate = false;
				installingUpdate = true;
				updateMessage =
					progress.message ||
					`Installing ${progress.version} and restarting CertFlow... This page will reload automatically.`;
				await waitForServerRestartAndReload();
				return;
			} else if (progress.stage === 'error') {
				throw new Error(progress.error || progress.message || 'Update failed.');
			}
		}
	}

	async function handleDownloadPortableUpdate() {
		downloadingUpdate = true;
		updateMessageTone = 'info';
		updateMessage = autoInstallAfterDownload
			? 'Starting update download and automatic install from GitHub...'
			: 'Starting update download from GitHub...';
		updateProgress = null;
		try {
			const res = await fetch('/api/portable/update', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'download',
					autoInstall: autoInstallAfterDownload
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Could not download the update.');
			}
			const started = (await res.json()) as { progress?: PortableUpdateProgress };
			if (started.progress) {
				updateProgress = started.progress;
				updateMessage = started.progress.message || updateMessage;
			}
			await pollPortableUpdateProgress(started.progress?.stage ?? 'checking');
		} catch (err) {
			downloadingUpdate = false;
			installingUpdate = false;
			updateProgress = null;
			updateMessageTone = 'error';
			updateMessage = err instanceof Error ? err.message : 'Could not download the update.';
		}
	}

	async function handleInstallPortableUpdate() {
		if (!stagedVersion) return;
		installingUpdate = true;
		updateMessageTone = 'info';
		updateMessage = `Installing ${stagedVersion} and restarting CertFlow...`;
		updateProgress = null;
		try {
			const res = await fetch('/api/portable/update', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'install' })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message ?? 'Could not install the downloaded update.');
			}
			const started = (await res.json()) as { progress?: PortableUpdateProgress };
			if (started.progress) {
				updateProgress = started.progress;
				updateMessage = started.progress.message || updateMessage;
			}
			await pollPortableUpdateProgress(started.progress?.stage ?? 'applying');
		} catch (err) {
			installingUpdate = false;
			updateProgress = null;
			updateMessageTone = 'error';
			updateMessage = err instanceof Error ? err.message : 'Could not install the update.';
		}
	}

	const projectPercent = $derived(
		data.usage.maxProjects === null
			? 0
			: Math.min(100, Math.round((data.usage.projectCount / Math.max(1, data.usage.maxProjects)) * 100))
	);
	const storagePercent = $derived(
		data.usage.maxStorageBytes === null
			? 0
			: Math.min(
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

	type ProfileFormMode = 'brevo_api' | 'resend_api' | 'smtp' | 'custom_reply_to';

	// Sender profile guide state
	let showSetupGuide = $state(true);
	let guideMode = $state<ProfileFormMode>('brevo_api');

	// Sender profile CRUD state
	let editingId = $state<string | null>(null);
	let editingHasPassword = $state(false);
	let confirmDeleteId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let formSectionEl = $state<HTMLElement | null>(null);

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
	const inputClass =
		'mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed';

	let contentPaneEl = $state<HTMLDivElement | null>(null);

	function navigateSection(section: SettingsSection) {
		activeSection = section;
		contentPaneEl?.scrollTo({ top: 0 });
	}
</script>

<div class="flex min-h-screen flex-col bg-surface-page md:h-dvh md:overflow-hidden">
	<AppHeader brandHref="/" maxWidthClass="max-w-5xl">
		{#snippet actions()}
			<a
				href="/dashboard"
				class="cf-pressable inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-primary shadow-xs hover:bg-surface-subtle"
			>
				<ArrowLeft class="h-3.5 w-3.5 text-ink-secondary" />
				Dashboard
			</a>
		{/snippet}
	</AppHeader>

	<main
		class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-8 pb-8 sm:px-6 md:min-h-0 md:overflow-hidden md:pb-0"
	>
		<div class="mb-6 shrink-0">
			<h1 class="font-display text-[28px] leading-tight font-semibold tracking-[-0.03em] text-ink-primary">
				Settings
			</h1>
			<p class="mt-1 text-sm text-ink-secondary">
				Manage your CertFlow account security, local storage and connected email sender profiles.
			</p>
		</div>

		<div class="grid flex-1 grid-cols-1 gap-8 md:min-h-0 md:grid-cols-12">
			<!-- Left Pinned Section Nav with Bottom-Anchored Sign Out -->
			<aside class="flex flex-col md:col-span-3 md:min-h-0 md:pb-6">
				<nav
					aria-label="Settings sections"
					class="flex flex-1 gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-y-auto md:pb-0"
				>
					<button
						type="button"
						aria-current={activeSection === 'profile' ? 'page' : undefined}
						onclick={() => navigateSection('profile')}
						class="cf-pressable flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition md:w-full {activeSection ===
						'profile'
							? 'border border-border-default bg-surface-card font-semibold text-ink-primary shadow-xs'
							: 'border border-transparent font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
					>
						<User class="h-4 w-4 shrink-0" />
						Profile
					</button>
					<button
						type="button"
						aria-current={activeSection === 'security' ? 'page' : undefined}
						onclick={() => navigateSection('security')}
						class="cf-pressable flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition md:w-full {activeSection ===
						'security'
							? 'border border-border-default bg-surface-card font-semibold text-ink-primary shadow-xs'
							: 'border border-transparent font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
					>
						<KeyRound class="h-4 w-4 shrink-0" />
						Security
					</button>
					<button
						type="button"
						aria-current={activeSection === 'storage' ? 'page' : undefined}
						onclick={() => navigateSection('storage')}
						class="cf-pressable flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition md:w-full {activeSection ===
						'storage'
							? 'border border-border-default bg-surface-card font-semibold text-ink-primary shadow-xs'
							: 'border border-transparent font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
					>
						<HardDrive class="h-4 w-4 shrink-0" />
						Usage &amp; Storage
					</button>
					{#if data.portableInfo?.canShowUpdates}
						<button
							type="button"
							aria-current={activeSection === 'updates' ? 'page' : undefined}
							onclick={() => navigateSection('updates')}
							class="cf-pressable flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition md:w-full {activeSection ===
							'updates'
								? 'border border-border-default bg-surface-card font-semibold text-ink-primary shadow-xs'
								: 'border border-transparent font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
						>
							<Download class="h-4 w-4 shrink-0" />
							App Updates
						</button>
					{/if}
					<div class="my-1 hidden border-t border-border-subtle md:block"></div>
					<button
						type="button"
						aria-current={activeSection === 'sender' ? 'page' : undefined}
						onclick={() => navigateSection('sender')}
						class="cf-pressable flex shrink-0 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition md:w-full {activeSection ===
						'sender'
							? 'border border-border-default bg-surface-card font-semibold text-ink-primary shadow-xs'
							: 'border border-transparent font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'}"
					>
						<span class="inline-flex items-center gap-2">
							<Mail class="h-4 w-4 shrink-0" />
							Sender Profiles
						</span>
						<span
							class="rounded-full border border-border-default bg-surface-subtle px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-ink-secondary tabular-nums"
						>
							{data.profiles.length}
						</span>
					</button>
				</nav>

				<div class="mt-3 shrink-0 border-t border-border-subtle pt-3 md:mt-auto md:pt-4">
					<Button
						type="button"
						variant="danger"
						size="sm"
						disabled={signingOut}
						onclick={handleSignOut}
						class="w-full justify-start"
					>
						<LogOut class="h-4 w-4 shrink-0" />
						<span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
					</Button>
				</div>
			</aside>

			<!-- Right Independently Scrollable Active Section -->
			<div
				bind:this={contentPaneEl}
				class="space-y-6 md:col-span-9 md:min-h-0 md:overflow-y-auto md:pr-1 md:pb-10"
			>
				{#if activeSection === 'profile'}
					<!-- Account Details -->
					<section
						id="settings-profile"
						class="scroll-mt-20 rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs sm:p-6"
					>
						<h2 class="font-display text-[15px] font-semibold text-ink-primary">Account Details</h2>
						<p class="mt-1 text-xs text-ink-secondary">
							Update the display name shown across your CertFlow workspace.
						</p>

						{#if accountStatus}
							<div
								class="mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium {accountStatusTone === 'error'
									? 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink'
									: 'border-tone-data-border bg-tone-data-soft text-tone-data-ink'}"
							>
								{accountStatus}
							</div>
						{/if}

						<form class="mt-4 space-y-4" onsubmit={handleUpdateName}>
							<div class="grid gap-3.5 sm:grid-cols-2">
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
										class={inputClass}
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
										class="mt-1.5 block h-[38px] w-full cursor-not-allowed rounded-lg border border-border-default bg-surface-subtle px-3 text-sm text-ink-muted opacity-75"
									/>
								</div>
							</div>

							<Button
								type="submit"
								variant="contrast"
								disabled={savingName || accountName.trim() === data.user.name}
							>
								<Save class="h-4 w-4" />
								{savingName ? 'Saving...' : 'Save Name'}
							</Button>
						</form>
					</section>
				{:else if activeSection === 'security'}
					<!-- Change Password -->
					<section
						id="settings-security"
						class="scroll-mt-20 rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs sm:p-6"
					>
						<div class="flex items-center gap-2">
							<KeyRound class="h-4 w-4 text-accent-vivid" />
							<h2 class="font-display text-[15px] font-semibold text-ink-primary">
								Change Password
							</h2>
						</div>
						<p class="mt-1 text-xs text-ink-secondary">
							Enter your current password to set a new password for your account.
						</p>

						{#if passwordStatus}
							<div
								class="mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium {passwordStatusTone === 'error'
									? 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink'
									: 'border-tone-data-border bg-tone-data-soft text-tone-data-ink'}"
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
									class="{inputClass} max-w-md"
								/>
							</div>

							<div class="grid gap-3.5 sm:grid-cols-2">
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
										class={inputClass}
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
										class={inputClass}
									/>
								</div>
							</div>

							<label class="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
								<input
									type="checkbox"
									bind:checked={revokeOtherSessions}
									class="h-4 w-4 rounded-[4px] border-border-strong accent-accent"
								/>
								Sign out other active devices after changing password
							</label>

							<div>
								<Button type="submit" variant="contrast" disabled={changingPassword}>
									<KeyRound class="h-4 w-4" />
									{changingPassword ? 'Updating...' : 'Update Password'}
								</Button>
							</div>
						</form>
					</section>
				{:else if activeSection === 'storage'}
					<!-- Account Usage & Storage -->
					<section
						id="settings-storage"
						class="scroll-mt-20 rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs sm:p-6"
					>
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="flex flex-wrap items-center gap-2">
								<HardDrive class="h-4 w-4 text-tone-data" />
								<h2 class="font-display text-[15px] font-semibold text-ink-primary">
									Account Usage &amp; Storage
								</h2>
								{#if data.usage.maxProjects === null && data.usage.maxStorageBytes === null}
									<Badge tone="emerald" dot>Unlimited — Local Runtime</Badge>
								{/if}
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
							Uploaded backgrounds, logos and signatures are automatically optimised to WebP and
							cleaned up when you delete a project.
						</p>

						{#if cleanupStatus}
							<div
								class="mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium {cleanupStatusTone === 'error'
									? 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink'
									: 'border-tone-data-border bg-tone-data-soft text-tone-data-ink'}"
							>
								{cleanupStatus}
							</div>
						{/if}

						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div class="rounded-xl border border-border-default bg-surface-page p-4">
								<div class="flex items-center justify-between text-xs">
									<span class="font-medium text-ink-secondary">Projects</span>
									<span class="font-mono font-semibold text-ink-primary tabular-nums">
										{#if data.usage.maxProjects !== null}
											{data.usage.projectCount} / {data.usage.maxProjects}
										{:else}
											{data.usage.projectCount} · Unlimited
										{/if}
									</span>
								</div>
								{#if data.usage.maxProjects !== null}
									<div class="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
										<div
											class="h-full rounded-full transition-all {projectPercent >= 100
												? 'bg-tone-danger'
												: projectPercent >= 80
													? 'bg-tone-warning'
													: 'bg-accent-vivid'}"
											style="width: {projectPercent}%;"
										></div>
									</div>
									<p class="mt-1.5 text-[11px] text-ink-muted">
										Each account can keep up to {data.usage.maxProjects} active projects.
									</p>
								{:else}
									<p class="mt-2 text-[11px] text-ink-muted">
										No project limit applies on local installations.
									</p>
								{/if}
							</div>

							<div class="rounded-xl border border-border-default bg-surface-page p-4">
								<div class="flex items-center justify-between text-xs">
									<span class="font-medium text-ink-secondary">
										Image Storage ({data.usage.assetCount}
										{data.usage.assetCount === 1 ? 'file' : 'files'})
									</span>
									<span class="font-mono font-semibold text-ink-primary tabular-nums">
										{#if data.usage.maxStorageBytes !== null}
											{formatBytes(data.usage.storageUsedBytes)} / {formatBytes(data.usage.maxStorageBytes)}
										{:else}
											{formatBytes(data.usage.storageUsedBytes)} · Unlimited
										{/if}
									</span>
								</div>
								{#if data.usage.maxStorageBytes !== null}
									<div class="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
										<div
											class="h-full rounded-full transition-all {storagePercent >= 95
												? 'bg-tone-danger'
												: storagePercent >= 80
													? 'bg-tone-warning'
													: 'bg-tone-data'}"
											style="width: {storagePercent}%;"
										></div>
									</div>
									<p class="mt-1.5 text-[11px] text-ink-muted">
										Generated certificates render in your browser and do not count towards storage.
									</p>
								{:else}
									<p class="mt-2 text-[11px] text-ink-muted">
										No storage limit applies on local installations. Generated certificates render in
										your browser.
									</p>
								{/if}
							</div>
						</div>
					</section>
				{:else if activeSection === 'updates' && data.portableInfo?.canShowUpdates}
					<!-- App Updates -->
					<section
						id="settings-updates"
						class="scroll-mt-20 rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs sm:p-6"
					>
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="flex flex-wrap items-center gap-2">
								<Download class="h-4 w-4 text-accent-vivid" />
								<h2 class="font-display text-[15px] font-semibold text-ink-primary">
									App Updates
								</h2>
								<Badge tone="indigo">
									<span class="font-mono">{data.portableInfo.currentVersion}</span>
								</Badge>
								{#if data.portableInfo.target}
									<Badge tone="neutral">
										<span class="font-mono">{data.portableInfo.target}</span>
									</Badge>
								{/if}
								{#if stagedVersion}
									<Badge tone="emerald" dot>
										Downloaded {stagedVersion}
									</Badge>
								{/if}
							</div>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								disabled={checkingUpdates || downloadingUpdate || installingUpdate}
								onclick={handleCheckPortableUpdates}
							>
								{#if checkingUpdates}
									<Loader2 class="h-3.5 w-3.5 animate-spin" />
									Checking...
								{:else}
									<RefreshCw class="h-3.5 w-3.5" />
									Check for Updates
								{/if}
							</Button>
						</div>
						<p class="mt-1 text-xs text-ink-secondary">
							Check GitHub Releases for newer CertFlow versions, download the update archive and
							install it in place. Your projects, database and uploaded images inside
							<code class="font-mono">data/</code> stay untouched.
						</p>

						{#if !data.portableInfo.isPortable}
							<div
								class="mt-3 rounded-xl border border-tone-email-border bg-tone-email-soft px-3.5 py-2.5 text-xs text-tone-email-ink"
							>
								Running from local development source. You can check GitHub Releases here; in-place
								Download and Install are active in the packaged Windows Desktop or Portable build.
							</div>
						{/if}

						{#if updateMessage}
							<div
								class="mt-3 space-y-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium {updateMessageTone === 'error'
									? 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink'
									: updateMessageTone === 'success'
										? 'border-tone-data-border bg-tone-data-soft text-tone-data-ink'
										: 'border-tone-email-border bg-tone-email-soft text-tone-email-ink'}"
							>
								<p>{updateMessage}</p>
								{#if (downloadingUpdate || installingUpdate) && updateProgress}
									<div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
										{#if updateProgress.percent !== null}
											<div
												class="cf-progress-sheen h-full rounded-full bg-accent-vivid transition-all duration-200"
												style="width: {updateProgress.percent}%;"
											></div>
										{:else}
											<div class="cf-progress-sheen h-full w-2/5 rounded-full bg-accent-vivid"></div>
										{/if}
									</div>
								{/if}
							</div>
						{/if}

						{#if updateCheckResult?.updateAvailable}
							<div class="mt-4 space-y-3 rounded-xl border border-tone-email-border bg-surface-page p-4">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<div>
										<p class="text-xs font-semibold text-ink-primary">
											New release ready: <span class="font-mono">{updateCheckResult.latestVersion}</span>
										</p>
										{#if updateCheckResult.assetName}
											<p class="mt-0.5 font-mono text-[11px] text-ink-muted">
												{updateCheckResult.assetName}
												{#if updateCheckResult.assetSizeBytes > 0}
													({formatBytes(updateCheckResult.assetSizeBytes)})
												{/if}
											</p>
										{/if}
									</div>
									<a
										href={updateCheckResult.releaseUrl}
										target="_blank"
										rel="noopener noreferrer"
										class="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline"
									>
										Release Notes
										<ExternalLink class="h-3 w-3" />
									</a>
								</div>

								{#if updateCheckResult.releaseNotes}
									<pre
										class="max-h-32 overflow-y-auto rounded-lg border border-border-default bg-surface-card p-2.5 font-mono text-[11px] whitespace-pre-wrap text-ink-secondary"
									>{updateCheckResult.releaseNotes}</pre>
								{/if}

								{#if !updateCheckResult.assetUrl && data.portableInfo.isPortable}
									<p class="text-[11px] text-tone-warning-ink">
										No matching archive for {data.portableInfo.target} was found in this release yet.
									</p>
								{/if}
							</div>
						{/if}

						<div class="mt-4 space-y-3 border-t border-border-subtle pt-4">
							<label class="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
								<input
									type="checkbox"
									bind:checked={autoInstallAfterDownload}
									disabled={downloadingUpdate || installingUpdate}
									class="h-4 w-4 rounded-[4px] border-border-strong accent-accent"
								/>
								Automatically install and restart after download completes
							</label>

							<div class="flex flex-wrap items-center gap-2.5">
								<Button
									type="button"
									size="sm"
									variant="contrast"
									disabled={!data.portableInfo.isPortable ||
										downloadingUpdate ||
										installingUpdate ||
										!updateCheckResult?.updateAvailable ||
										!updateCheckResult?.assetUrl}
									onclick={handleDownloadPortableUpdate}
								>
									{#if downloadingUpdate}
										<Loader2 class="h-3.5 w-3.5 animate-spin" />
										Downloading...
									{:else}
										<Download class="h-3.5 w-3.5" />
										{stagedVersion ? 'Re-download' : 'Download'}
									{/if}
								</Button>

								<Button
									type="button"
									size="sm"
									variant="primary"
									disabled={!data.portableInfo.isPortable ||
										!stagedVersion ||
										downloadingUpdate ||
										installingUpdate}
									onclick={handleInstallPortableUpdate}
								>
									{#if installingUpdate}
										<Loader2 class="h-3.5 w-3.5 animate-spin" />
										Installing...
									{:else}
										<RefreshCw class="h-3.5 w-3.5" />
										{stagedVersion ? `Install ${stagedVersion}` : 'Install'}
									{/if}
								</Button>

								{#if !stagedVersion}
									<span class="text-[11px] text-ink-muted">
										Download an update first to enable Install.
									</span>
								{/if}
							</div>
						</div>
					</section>
				{:else}
					<!-- Email Sender Profiles Tab -->
					{#if status}
						<div
							class="rounded-xl border px-4 py-3 text-sm font-medium {statusTone === 'error'
								? 'border-tone-danger-border bg-tone-danger-soft text-tone-danger-ink'
								: 'border-tone-data-border bg-tone-data-soft text-tone-data-ink'}"
						>
							{status}
						</div>
					{/if}

					<!-- Setup Guide Card -->
					<section class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs sm:p-6">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<BookOpen class="h-4 w-4 text-accent-vivid" />
								<h2 class="font-display text-[15px] font-semibold text-ink-primary">
									Sender Profile Setup Guide
								</h2>
							</div>
							<button
								type="button"
								onclick={() => (showSetupGuide = !showSetupGuide)}
								class="cf-pressable inline-flex cursor-pointer items-center gap-1 rounded-md border border-border-default bg-surface-card px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary"
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
							<div class="mt-4 space-y-4">
								<!-- Gliding Segmented 4-Tab Switcher -->
								<div
									class="inline-flex flex-wrap items-center gap-1 rounded-[10px] border border-border-default bg-surface-subtle p-[3px] dark:bg-surface-recessed"
								>
									{#each [
										{ id: 'brevo_api' as const, label: 'Brevo (Free 300/day)' },
										{ id: 'resend_api' as const, label: 'Resend (Custom domain)' },
										{ id: 'smtp' as const, label: 'Custom SMTP' },
										{ id: 'custom_reply_to' as const, label: 'Custom Reply-To' }
									] as tab (tab.id)}
										<button
											type="button"
											onclick={() => (guideMode = tab.id)}
											class="cf-glide-thumb cursor-pointer rounded-[7px] px-3 py-1 text-xs transition {guideMode ===
											tab.id
												? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
												: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
										>
											{tab.label}
										</button>
									{/each}
								</div>

								{#if guideMode === 'brevo_api'}
									<div
										class="space-y-2.5 rounded-xl border border-border-default bg-surface-page p-4 text-xs text-ink-secondary"
									>
										<p class="font-semibold text-ink-primary">
											Brevo sends over HTTPS (port 443) and works with a normal Gmail address — no
											custom domain required. Works on both cloud hosts and local apps.
										</p>
										<ol class="list-decimal space-y-2 pl-4">
											<li>
												<strong>Create an account</strong>: Sign up for free at
												<a
													href="https://www.brevo.com"
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-0.5 font-semibold text-accent-ink underline"
												>
													brevo.com
													<ExternalLink class="h-3 w-3" />
												</a>
												and confirm your email address.
											</li>
											<li>
												<strong>Verify your sender address</strong>: Click your account menu
												(top-right) → <strong>Senders, Domains &amp; Dedicated IPs</strong> →
												<strong>Senders</strong> → <strong>Add a sender</strong>. Enter your From Name
												and From Email, click <strong>Save</strong> and click the verification link Brevo
												emails you.
											</li>
											<li>
												<strong>Create an API key</strong>: Open your account menu →
												<strong>SMTP &amp; API</strong> → <strong>API Keys</strong> tab (do not use the
												SMTP tab). Click <strong>Generate a new API key</strong>, name it
												<code class="font-mono">CertFlow</code>, click <strong>Generate</strong> and copy
												the key starting with <code class="font-mono">xkeysib-</code>.
											</li>
											<li>
												<strong>Disable Authorised IP blocking (important)</strong>: Open
												<a
													href="https://app.brevo.com/security/authorised_ips"
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-0.5 font-semibold text-accent-ink underline"
												>
													Brevo Authorised IPs
													<ExternalLink class="h-3 w-3" />
												</a>
												and click <strong>Deactivate blocking</strong>. Brevo blocks unrecognised IPs by
												default until you disable this setting.
											</li>
											<li>
												<strong>Fill in Add Sender Profile below</strong>: Choose
												<strong>Mode</strong> = <code class="font-mono">Brevo (Gmail or custom domain)</code>,
												enter a <strong>Label</strong>, your <strong>Sender Display Name</strong>, the
												verified <strong>Sender Email</strong> and paste your
												<code class="font-mono">xkeysib-...</code> key, then click
												<strong>Save Sender Profile</strong>.
											</li>
										</ol>
										<p class="pt-1 text-[11px] text-ink-muted">
											Tip: Free Brevo accounts allow 300 emails per day. CertFlow encrypts your API key
											with AES-256-GCM before saving it.
										</p>
									</div>
								{:else if guideMode === 'resend_api'}
									<div
										class="space-y-2.5 rounded-xl border border-border-default bg-surface-page p-4 text-xs text-ink-secondary"
									>
										<p class="font-semibold text-ink-primary">
											Resend sends over HTTPS (port 443) and requires a domain you own (such as
											<code class="font-mono">@yourclub.org</code>). Personal Gmail addresses cannot be
											verified in Resend.
										</p>
										<ol class="list-decimal space-y-2 pl-4">
											<li>
												<strong>Create an account</strong>: Sign up for free at
												<a
													href="https://resend.com"
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-0.5 font-semibold text-accent-ink underline"
												>
													resend.com
													<ExternalLink class="h-3 w-3" />
												</a>.
											</li>
											<li>
												<strong>Add your domain</strong>: Open <strong>Domains</strong> →
												<strong>Add Domain</strong>, enter your domain or subdomain (for example
												<code class="font-mono">mail.yourclub.org</code>), choose the nearest region and
												click <strong>Add</strong>.
											</li>
											<li>
												<strong>Verify DNS records</strong>: Copy the <strong>MX</strong>,
												<strong>TXT (SPF)</strong> and <strong>TXT (DKIM)</strong> records into your DNS
												provider, then click <strong>Verify DNS Records</strong>.
											</li>
											<li>
												<strong>Create a sending API key</strong>: Open <strong>API Keys</strong> →
												<strong>Create API Key</strong>, set <strong>Name</strong> to
												<code class="font-mono">CertFlow</code>, grant <strong>Sending access</strong> to
												your verified domain and copy the <code class="font-mono">re_...</code> key.
											</li>
											<li>
												<strong>Fill in Add Sender Profile below</strong>: Choose
												<strong>Mode</strong> = <code class="font-mono">Resend (Custom domain)</code>,
												enter your sender details and paste your <code class="font-mono">re_...</code>
												key, then click <strong>Save Sender Profile</strong>.
											</li>
										</ol>
										<p class="pt-1 text-[11px] text-ink-muted">
											Tip: Free Resend accounts allow 100 emails per day (3,000 per month). CertFlow
											encrypts your API key with AES-256-GCM before saving it.
										</p>
									</div>
								{:else if guideMode === 'smtp'}
									<div
										class="space-y-3 rounded-xl border border-border-default bg-surface-page p-4 text-xs text-ink-secondary"
									>
										<p class="font-semibold text-ink-primary">
											Custom SMTP connects directly to your own mailbox server (Gmail, Outlook, Zoho or
											a private mail server) with zero third-party relay.
										</p>
										{#if !data.mailCapabilities.allowRawSmtp}
											<div
												class="rounded-lg border border-tone-warning-border bg-tone-warning-soft px-3 py-2 text-[11px] text-tone-warning-ink"
											>
												Raw SMTP is disabled on this cloud deployment because most free cloud hosts
												block outbound SMTP ports (465 and 587). Use <strong>Brevo</strong> or
												<strong>Resend</strong> here, or run CertFlow Portable / Docker locally (or set
												<code class="font-mono">ALLOW_CUSTOM_SMTP=true</code> on a server with open SMTP
												ports).
											</div>
										{/if}

										<div class="overflow-x-auto rounded-lg border border-border-default bg-surface-card">
											<table class="w-full text-left text-[11px]">
												<thead class="border-b border-border-default bg-surface-subtle text-ink-primary">
													<tr>
														<th class="px-2.5 py-1.5 font-semibold">Provider</th>
														<th class="px-2.5 py-1.5 font-semibold">SMTP Host</th>
														<th class="px-2.5 py-1.5 font-semibold">Port</th>
														<th class="px-2.5 py-1.5 font-semibold">Use direct TLS</th>
													</tr>
												</thead>
												<tbody class="divide-y divide-border-subtle">
													<tr>
														<td class="px-2.5 py-1.5 font-medium text-ink-primary">Gmail / Workspace</td>
														<td class="px-2.5 py-1.5 font-mono">smtp.gmail.com</td>
														<td class="px-2.5 py-1.5 font-mono">465 / 587</td>
														<td class="px-2.5 py-1.5">Checked for 465 · Unchecked for 587</td>
													</tr>
													<tr>
														<td class="px-2.5 py-1.5 font-medium text-ink-primary">Outlook / M365</td>
														<td class="px-2.5 py-1.5 font-mono">smtp.office365.com</td>
														<td class="px-2.5 py-1.5 font-mono">587</td>
														<td class="px-2.5 py-1.5">Unchecked (STARTTLS)</td>
													</tr>
													<tr>
														<td class="px-2.5 py-1.5 font-medium text-ink-primary">Zoho Mail</td>
														<td class="px-2.5 py-1.5 font-mono">smtp.zoho.com</td>
														<td class="px-2.5 py-1.5 font-mono">465</td>
														<td class="px-2.5 py-1.5">Checked</td>
													</tr>
												</tbody>
											</table>
										</div>

										<div>
											<p class="font-semibold text-ink-primary">
												Step-by-step for Gmail (App Password required — normal password will fail):
											</p>
											<ol class="mt-1.5 list-decimal space-y-2 pl-4">
												<li>
													<strong>Enable 2-Step Verification</strong>: Open
													<a
														href="https://myaccount.google.com/security"
														target="_blank"
														rel="noopener noreferrer"
														class="inline-flex items-center gap-0.5 font-semibold text-accent-ink underline"
													>
														Google Account Security
														<ExternalLink class="h-3 w-3" />
													</a>
													and turn on <strong>2-Step Verification</strong>.
												</li>
												<li>
													<strong>Generate a 16-character App Password</strong>: Open
													<a
														href="https://myaccount.google.com/apppasswords"
														target="_blank"
														rel="noopener noreferrer"
														class="inline-flex items-center gap-0.5 font-semibold text-accent-ink underline"
													>
														Google App Passwords
														<ExternalLink class="h-3 w-3" />
													</a>, enter <code class="font-mono">CertFlow</code> and click
													<strong>Create</strong>.
												</li>
												<li>
													<strong>Copy the App Password</strong>: Copy all 16 characters Google displays.
												</li>
												<li>
													<strong>Fill in Add Sender Profile below</strong>: Choose
													<strong>Mode</strong> = <code class="font-mono">Custom SMTP Server</code>, enter
													your Gmail address in both <strong>Sender Email</strong> and
													<strong>SMTP Username</strong>.
												</li>
												<li>
													<strong>Enter server fields</strong>: Set <strong>SMTP Host</strong> to
													<code class="font-mono">smtp.gmail.com</code>, <strong>SMTP Port</strong> to
													<code class="font-mono">465</code> (with <strong>Use direct TLS</strong> checked),
													paste the 16-character App Password and click
													<strong>Save Sender Profile</strong>.
												</li>
											</ol>
										</div>
									</div>
								{:else}
									<div
										class="space-y-2.5 rounded-xl border border-border-default bg-surface-page p-4 text-xs text-ink-secondary"
									>
										<p class="font-semibold text-ink-primary">
											Custom Reply-To sends through the CertFlow server's shared mail relay while
											directing recipient replies to your chosen email address.
										</p>
										{#if !data.mailCapabilities.hasServerRelay}
											<div
												class="rounded-lg border border-tone-warning-border bg-tone-warning-soft px-3 py-2 text-[11px] text-tone-warning-ink"
											>
												No server-wide mail relay is configured on this instance yet, so Custom
												Reply-To is hidden in the Mode list. Set <code class="font-mono">BREVO_API_KEY</code>,
												<code class="font-mono">RESEND_API_KEY</code> or
												<code class="font-mono">SMTP_HOST</code> to enable it — or use
												<strong>Brevo</strong>, <strong>Resend</strong> or
												<strong>Custom SMTP Server</strong> directly.
											</div>
										{/if}
										<ol class="list-decimal space-y-2 pl-4">
											<li>
												<strong>Check server relay prerequisite</strong>: Ensure a server-wide
												<code class="font-mono">BREVO_API_KEY</code>,
												<code class="font-mono">RESEND_API_KEY</code> or
												<code class="font-mono">SMTP_HOST</code> and
												<code class="font-mono">DEFAULT_FROM_EMAIL</code> are configured.
											</li>
											<li>
												<strong>Choose when to use it</strong>: Ideal when one shared organisation relay
												sends certificates for several events and each committee needs replies routed to
												its own inbox.
											</li>
											<li>
												<strong>Fill in Add Sender Profile below</strong>: Choose
												<strong>Mode</strong> = <code class="font-mono">Custom Reply-To</code>, enter a
												label, display name and the inbox that should receive replies.
											</li>
											<li>
												<strong>Save and select in a project</strong>: Click
												<strong>Save Sender Profile</strong>, then select this profile on any project's
												<strong>Send Email</strong> tab.
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
						class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs sm:p-6"
					>
						<div class="flex items-center justify-between gap-2">
							<h2 class="font-display text-[15px] font-semibold text-ink-primary">
								{editingId ? 'Edit Sender Profile' : 'Add Sender Profile'}
							</h2>
							{#if editingId}
								<button
									type="button"
									onclick={resetForm}
									class="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-secondary hover:text-ink-primary"
								>
									<X class="h-3.5 w-3.5" />
									Cancel edit
								</button>
							{/if}
						</div>
						<form class="mt-4 space-y-4" onsubmit={handleSubmitProfile}>
							<div class="grid gap-3.5 sm:grid-cols-2">
								<div>
									<label for="sp-label" class="block text-xs font-medium text-ink-secondary">
										Label
									</label>
									<input
										id="sp-label"
										type="text"
										required
										bind:value={label}
										placeholder="e.g. Event Team Gmail"
										class={inputClass}
									/>
								</div>
								<div>
									<label for="sp-mode" class="block text-xs font-medium text-ink-secondary">
										Mode
									</label>
									<select
										id="sp-mode"
										bind:value={mode}
										onchange={() => {
											guideMode = mode;
										}}
										class={inputClass}
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

							<div class="grid gap-3.5 sm:grid-cols-2">
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
										class={inputClass}
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
										class={inputClass}
									/>
								</div>
							</div>

							{#if mode === 'brevo_api' || mode === 'resend_api'}
								<div class="space-y-2 rounded-xl border border-border-default bg-surface-page p-3.5">
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
										class={inputClass}
									/>
									<p class="text-[11px] text-ink-muted">
										{#if mode === 'brevo_api'}
											Use an API Key starting with <code class="font-mono">xkeysib-</code> (not an SMTP
											key). Keys are encrypted before storage.
										{:else}
											Use an API Key starting with <code class="font-mono">re_</code> with sending
											access for your verified domain. Keys are encrypted before storage.
										{/if}
									</p>
								</div>
							{:else if mode === 'smtp'}
								<div
									class="grid gap-3.5 rounded-xl border border-border-default bg-surface-page p-3.5 sm:grid-cols-2"
								>
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
											class={inputClass}
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
											class={inputClass}
										/>
									</div>
									<div class="sm:col-span-2">
										<label class="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
											<input
												type="checkbox"
												bind:checked={smtpSecure}
												class="h-4 w-4 rounded-[4px] border-border-strong accent-accent"
											/>
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
											class={inputClass}
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
											class={inputClass}
										/>
									</div>
								</div>
							{/if}

							<div class="flex flex-wrap items-center gap-2 pt-1">
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
					<section class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs sm:p-6">
						<h2 class="font-display text-[15px] font-semibold text-ink-primary tabular-nums">
							Saved Profiles ({data.profiles.length})
						</h2>
						{#if data.profiles.length === 0}
							<p class="mt-2 text-xs text-ink-muted">No sender profiles saved yet.</p>
						{:else}
							<ul class="mt-3 divide-y divide-border-subtle text-sm">
								{#each data.profiles as profile (profile.id)}
									<li
										class="flex flex-wrap items-center justify-between gap-3 py-3 {editingId ===
										profile.id
											? 'rounded-xl bg-tone-email-soft px-3'
											: ''}"
									>
										<div class="min-w-0">
											<p class="font-medium text-ink-primary">{profile.label}</p>
											<p class="font-mono text-xs text-ink-muted">
												{profile.senderName} &lt;{profile.senderEmail}&gt;
												{#if profile.smtpHost && !['api.brevo.com', 'api.resend.com'].includes(profile.smtpHost.toLowerCase())}
													· {profile.smtpHost}:{profile.smtpPort}
												{/if}
											</p>
										</div>
										<div class="flex flex-wrap items-center gap-2">
											<Badge tone={profile.mode === 'smtp' ? 'sky' : 'neutral'} dot>
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
			</div>
		</div>
	</main>
</div>
