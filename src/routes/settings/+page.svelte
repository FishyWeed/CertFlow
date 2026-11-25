<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from '@lucide/svelte';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let editingId = $state<string | null>(null);
	let editingHasPassword = $state(false);
	let confirmDeleteId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let formSectionEl = $state<HTMLElement | null>(null);

	let label = $state('');
	let mode = $state<'custom_reply_to' | 'smtp'>('custom_reply_to');
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

	function resetForm() {
		editingId = null;
		editingHasPassword = false;
		label = '';
		mode = 'custom_reply_to';
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
		mode = profile.mode === 'smtp' ? 'smtp' : 'custom_reply_to';
		senderName = profile.senderName;
		senderEmail = profile.senderEmail;
		smtpHost = profile.smtpHost ?? 'smtp.gmail.com';
		smtpPort = profile.smtpPort ?? 465;
		smtpSecure = profile.smtpSecure ?? smtpPort === 465;
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
		try {
			const url = isEditing ? `/api/sender-profiles/${editingId}` : '/api/sender-profiles';
			const res = await fetch(url, {
				method: isEditing ? 'PATCH' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					label,
					mode,
					senderName,
					senderEmail,
					smtpHost: mode === 'smtp' ? smtpHost : undefined,
					smtpPort: mode === 'smtp' ? Number(smtpPort) : undefined,
					smtpSecure: mode === 'smtp' ? smtpSecure : undefined,
					smtpUser: mode === 'smtp' ? smtpUser : undefined,
					smtpPassword: mode === 'smtp' && smtpPassword ? smtpPassword : undefined
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(
					err.message ?? (isEditing ? 'Could not update sender profile.' : 'Could not save sender profile.')
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
		<section class="rounded-xl border border-border-default bg-surface-card p-5">
			<h1 class="text-lg font-bold text-ink-primary">Account & Email Sender Profiles</h1>
			<p class="mt-1 text-sm text-ink-secondary">
				Signed in as <strong>{data.user.name}</strong> ({data.user.email}). Add an optional Reply-To
				or custom SMTP sender profile below.
			</p>
		</section>

		{#if status}
			<div
				class="rounded-xl border px-4 py-3 text-sm {statusTone === 'error'
					? 'border-red-200 bg-red-50 text-red-900'
					: 'border-emerald-200 bg-emerald-50 text-emerald-800'}"
			>
				{status}
			</div>
		{/if}

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
							<option value="custom_reply_to">Custom Reply-To (uses default mail relay)</option>
							<option value="smtp">Custom SMTP Server (true From: address)</option>
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

				{#if mode === 'smtp'}
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

		<section class="rounded-xl border border-border-default bg-surface-card p-5">
			<h2 class="text-sm font-semibold text-ink-primary">Saved Profiles ({data.profiles.length})</h2>
			{#if data.profiles.length === 0}
				<p class="mt-2 text-xs text-ink-muted">No custom sender profiles saved yet.</p>
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
									{#if profile.smtpHost}
										· {profile.smtpHost}:{profile.smtpPort}
									{/if}
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<Badge tone={profile.mode === 'smtp' ? 'sky' : 'neutral'}>{profile.mode}</Badge>
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
	</main>
</div>
