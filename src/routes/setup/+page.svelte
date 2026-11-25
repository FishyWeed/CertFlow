<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		Award,
		Database,
		KeyRound,
		Loader2,
		Mail,
		RefreshCw,
		ShieldCheck,
		UserPlus
	} from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ThemeToggle from '#lib/components/ui/ThemeToggle.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let appUrl = $state(untrack(() => data.suggestedAppUrl));
	let betterAuthSecret = $state(untrack(() => data.suggestedAuthSecret));
	let encryptionKey = $state(untrack(() => data.suggestedEncryptionKey));

	let databaseMode = $state<'embedded' | 'postgres'>(
		untrack(() => (data.detectedPostgresUrl ? 'postgres' : 'embedded'))
	);
	let databaseUrl = $state(untrack(() => data.detectedPostgresUrl));

	let emailProvider = $state<'none' | 'brevo' | 'resend' | 'smtp'>('none');
	let brevoApiKey = $state('');
	let resendApiKey = $state('');
	let smtpHost = $state('');
	let smtpPort = $state(587);
	let smtpSecure = $state(false);
	let smtpUser = $state('');
	let smtpPass = $state('');
	let defaultFromName = $state('CertFlow');
	let defaultFromEmail = $state('');

	let adminName = $state('');
	let adminEmail = $state('');
	let adminPassword = $state('');

	let submitting = $state(false);

	function generateHexBytes(byteCount = 32): string {
		const bytes = new Uint8Array(byteCount);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	}
</script>

<svelte:head>
	<title>CertFlow Setup — Initial Configuration</title>
</svelte:head>

<div class="min-h-screen bg-surface-page px-4 py-8 sm:px-6 sm:py-12">
	<div class="fixed top-4 right-4 z-10">
		<ThemeToggle />
	</div>

	<div class="mx-auto max-w-2xl space-y-6">
		<div class="text-center">
			<div
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-xs"
			>
				<Award class="h-6 w-6" />
			</div>
			<h1 class="mt-4 text-2xl font-bold tracking-tight text-ink-primary">
				Set Up Your CertFlow Instance
			</h1>
			<p class="mt-1.5 text-sm text-ink-secondary">
				Enter your instance URL, security keys, database and first account. Settings are saved to
				your persistent Docker volume.
			</p>
		</div>

		{#if form?.error}
			<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			action="?/completeSetup"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
			class="space-y-5"
		>
			<!-- 1. App URL & Security Secrets -->
			<section class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div class="flex items-center gap-2">
					<KeyRound class="h-4 w-4 text-accent" />
					<h2 class="text-sm font-semibold text-ink-primary">1. App URL &amp; Security Secrets</h2>
				</div>
				<p class="mt-1 text-xs text-ink-secondary">
					Random cryptographic keys are pre-generated for you. Keep them safe if you back up your
					database.
				</p>

				<div class="mt-4 space-y-3.5">
					<div>
						<label for="setup-url" class="block text-xs font-medium text-ink-secondary">
							Public App URL
						</label>
						<input
							id="setup-url"
							name="appUrl"
							type="url"
							required
							bind:value={appUrl}
							placeholder="http://localhost:3000"
							class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
						/>
					</div>

					<div>
						<div class="flex items-center justify-between">
							<label for="setup-auth-secret" class="text-xs font-medium text-ink-secondary">
								Session Secret (BETTER_AUTH_SECRET)
							</label>
							<button
								type="button"
								onclick={() => (betterAuthSecret = generateHexBytes(32))}
								class="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
							>
								<RefreshCw class="h-3 w-3" />
								Regenerate
							</button>
						</div>
						<input
							id="setup-auth-secret"
							name="betterAuthSecret"
							type="text"
							required
							minlength={32}
							bind:value={betterAuthSecret}
							class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 font-mono text-xs text-ink-primary outline-none focus:border-accent"
						/>
					</div>

					<div>
						<div class="flex items-center justify-between">
							<label for="setup-enc-key" class="text-xs font-medium text-ink-secondary">
								AES-256 Encryption Key (64-char hex)
							</label>
							<button
								type="button"
								onclick={() => (encryptionKey = generateHexBytes(32))}
								class="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
							>
								<RefreshCw class="h-3 w-3" />
								Regenerate
							</button>
						</div>
						<input
							id="setup-enc-key"
							name="encryptionKey"
							type="text"
							required
							pattern="[0-9a-fA-F]{64}"
							bind:value={encryptionKey}
							class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 font-mono text-xs text-ink-primary outline-none focus:border-accent"
						/>
						<p class="mt-1 text-[11px] text-ink-muted">
							Encrypts saved Brevo, Resend and SMTP credentials in your database.
						</p>
					</div>
				</div>
			</section>

			<!-- 2. Database -->
			<section class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div class="flex items-center gap-2">
					<Database class="h-4 w-4 text-accent" />
					<h2 class="text-sm font-semibold text-ink-primary">2. Database</h2>
				</div>
				<p class="mt-1 text-xs text-ink-secondary">
					Use embedded storage for single-container setups, or connect to PostgreSQL for larger
					deployments.
				</p>

				<div class="mt-3 grid gap-2 sm:grid-cols-2">
					<label
						class="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition {databaseMode ===
						'embedded'
							? 'border-accent bg-indigo-50/70'
							: 'border-border-default bg-surface-page hover:bg-surface-subtle'}"
					>
						<input
							type="radio"
							name="databaseMode"
							value="embedded"
							bind:group={databaseMode}
							class="mt-0.5 accent-accent"
						/>
						<span>
							<span class="block font-semibold text-ink-primary">Embedded PostgreSQL</span>
							<span class="mt-0.5 block text-[11px] text-ink-muted">
								Zero external services. Stored in <code>{data.defaultEmbeddedDbPath}</code>.
							</span>
						</span>
					</label>

					<label
						class="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition {databaseMode ===
						'postgres'
							? 'border-accent bg-indigo-50/70'
							: 'border-border-default bg-surface-page hover:bg-surface-subtle'}"
					>
						<input
							type="radio"
							name="databaseMode"
							value="postgres"
							bind:group={databaseMode}
							class="mt-0.5 accent-accent"
						/>
						<span>
							<span class="block font-semibold text-ink-primary">PostgreSQL Server</span>
							<span class="mt-0.5 block text-[11px] text-ink-muted">
								Recommended with Docker Compose or an external Postgres instance.
							</span>
						</span>
					</label>
				</div>

				{#if databaseMode === 'postgres'}
					<div class="mt-3">
						<label for="setup-db-url" class="block text-xs font-medium text-ink-secondary">
							PostgreSQL Connection URL
						</label>
						<input
							id="setup-db-url"
							name="databaseUrl"
							type="text"
							required
							bind:value={databaseUrl}
							placeholder="postgresql://certflow:password@postgres:5432/certflow"
							class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 font-mono text-xs text-ink-primary outline-none focus:border-accent"
						/>
					</div>
				{:else}
					<input type="hidden" name="databaseUrl" value="" />
				{/if}
			</section>

			<!-- 3. Optional Default Email Provider -->
			<section class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div class="flex items-center gap-2">
					<Mail class="h-4 w-4 text-accent" />
					<h2 class="text-sm font-semibold text-ink-primary">
						3. Email Delivery (Optional)
					</h2>
				</div>
				<p class="mt-1 text-xs text-ink-secondary">
					Set a server-wide email relay now, or skip and let each user add their own Brevo, Resend
					or SMTP profile in Account Settings.
				</p>

				<div class="mt-3">
					<label for="setup-mail-provider" class="block text-xs font-medium text-ink-secondary">
						Default Provider
					</label>
					<select
						id="setup-mail-provider"
						name="emailProvider"
						bind:value={emailProvider}
						class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
					>
						<option value="none">Configure later per user in Settings (Recommended)</option>
						<option value="brevo">Brevo API Key (Free 300/day · Gmail or custom domain)</option>
						<option value="resend">Resend API Key (Free 100/day · Custom domain)</option>
						<option value="smtp">Custom SMTP Server</option>
					</select>
				</div>

				{#if emailProvider !== 'none'}
					<div class="mt-3 space-y-3 rounded-xl border border-border-default bg-surface-page p-3.5">
						<div class="grid gap-3 sm:grid-cols-2">
							<div>
								<label for="setup-from-name" class="block text-xs font-medium text-ink-secondary">
									Default Sender Name
								</label>
								<input
									id="setup-from-name"
									name="defaultFromName"
									type="text"
									bind:value={defaultFromName}
									placeholder="CertFlow"
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
								/>
							</div>
							<div>
								<label for="setup-from-email" class="block text-xs font-medium text-ink-secondary">
									Verified From Email
								</label>
								<input
									id="setup-from-email"
									name="defaultFromEmail"
									type="email"
									bind:value={defaultFromEmail}
									placeholder="certificates@yourorg.org"
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
								/>
							</div>
						</div>

						{#if emailProvider === 'brevo'}
							<div>
								<label for="setup-brevo" class="block text-xs font-medium text-ink-secondary">
									Brevo API Key
								</label>
								<input
									id="setup-brevo"
									name="brevoApiKey"
									type="password"
									required
									bind:value={brevoApiKey}
									placeholder="xkeysib-..."
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
								/>
							</div>
						{:else if emailProvider === 'resend'}
							<div>
								<label for="setup-resend" class="block text-xs font-medium text-ink-secondary">
									Resend API Key
								</label>
								<input
									id="setup-resend"
									name="resendApiKey"
									type="password"
									required
									bind:value={resendApiKey}
									placeholder="re_..."
									class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
								/>
							</div>
						{:else if emailProvider === 'smtp'}
							<div class="grid gap-3 sm:grid-cols-2">
								<div>
									<label for="setup-smtp-host" class="block text-xs font-medium text-ink-secondary">
										SMTP Host
									</label>
									<input
										id="setup-smtp-host"
										name="smtpHost"
										type="text"
										required
										bind:value={smtpHost}
										placeholder="smtp.gmail.com"
										class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
									/>
								</div>
								<div>
									<label for="setup-smtp-port" class="block text-xs font-medium text-ink-secondary">
										SMTP Port
									</label>
									<input
										id="setup-smtp-port"
										name="smtpPort"
										type="number"
										required
										bind:value={smtpPort}
										oninput={() => (smtpSecure = Number(smtpPort) === 465)}
										class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
									/>
								</div>
								<div class="sm:col-span-2">
									<label class="inline-flex items-center gap-2 text-xs text-ink-secondary">
										<input
											type="checkbox"
											name="smtpSecure"
											bind:checked={smtpSecure}
											class="rounded border-border-strong"
										/>
										Use direct TLS (enabled for port 465, disabled for STARTTLS port 587)
									</label>
								</div>
								<div>
									<label for="setup-smtp-user" class="block text-xs font-medium text-ink-secondary">
										SMTP Username
									</label>
									<input
										id="setup-smtp-user"
										name="smtpUser"
										type="text"
										bind:value={smtpUser}
										class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
									/>
								</div>
								<div>
									<label for="setup-smtp-pass" class="block text-xs font-medium text-ink-secondary">
										SMTP Password
									</label>
									<input
										id="setup-smtp-pass"
										name="smtpPass"
										type="password"
										bind:value={smtpPass}
										class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary"
									/>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</section>

			<!-- 4. First Account -->
			<section class="rounded-2xl border border-border-default bg-surface-card p-5 shadow-xs">
				<div class="flex items-center gap-2">
					<UserPlus class="h-4 w-4 text-accent" />
					<h2 class="text-sm font-semibold text-ink-primary">4. Create Your First Account</h2>
				</div>
				<p class="mt-1 text-xs text-ink-secondary">
					CertFlow will initialise the database, create this account and sign you in immediately.
				</p>

				<div class="mt-4 space-y-3">
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<label for="setup-admin-name" class="block text-xs font-medium text-ink-secondary">
								Full Name
							</label>
							<input
								id="setup-admin-name"
								name="adminName"
								type="text"
								required
								minlength={2}
								bind:value={adminName}
								placeholder="e.g. Alex Tan"
								class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
							/>
						</div>
						<div>
							<label for="setup-admin-email" class="block text-xs font-medium text-ink-secondary">
								Email Address
							</label>
							<input
								id="setup-admin-email"
								name="adminEmail"
								type="email"
								required
								bind:value={adminEmail}
								placeholder="you@organisation.org"
								class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
							/>
						</div>
					</div>
					<div>
						<label for="setup-admin-pw" class="block text-xs font-medium text-ink-secondary">
							Password
						</label>
						<input
							id="setup-admin-pw"
							name="adminPassword"
							type="password"
							required
							minlength={8}
							autocomplete="new-password"
							bind:value={adminPassword}
							placeholder="Minimum 8 characters"
							class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent"
						/>
					</div>
				</div>
			</section>

			<div class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
				<p class="flex items-center gap-1.5 text-xs text-ink-muted">
					<ShieldCheck class="h-4 w-4 shrink-0 text-emerald-600" />
					<span>This setup page locks permanently once completed.</span>
				</p>
				<Button type="submit" variant="primary" disabled={submitting} class="min-h-11 px-6">
					{#if submitting}
						<Loader2 class="h-4 w-4 animate-spin" />
						Initialising CertFlow...
					{:else}
						Save Configuration &amp; Start
					{/if}
				</Button>
			</div>
		</form>
	</div>
</div>
