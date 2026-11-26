<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		Check,
		ChevronDown,
		ChevronUp,
		Database,
		KeyRound,
		Loader2,
		Mail,
		OctagonAlert,
		RefreshCw,
		ShieldCheck,
		SlidersHorizontal,
		UserPlus
	} from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import CertFlowLogo from '#lib/components/ui/CertFlowLogo.svelte';
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

	let showAdvanced = $state(false);
	let submitting = $state(false);

	function generateHexBytes(byteCount = 32): string {
		const bytes = new Uint8Array(byteCount);
		crypto.getRandomValues(bytes);
		return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	}

	const inputClass =
		'mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed';
</script>

<svelte:head>
	<title>CertFlow Setup — Quick Start</title>
</svelte:head>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-page px-4 py-10 sm:px-6"
>
	<div aria-hidden="true" class="cf-drafting-grid pointer-events-none absolute inset-0"></div>

	<div class="relative z-10 w-full max-w-2xl space-y-6">
		<div class="text-center">
			<div class="mx-auto inline-flex">
				<CertFlowLogo variant="badge" size={44} decorative />
			</div>
			<h1 class="font-display mt-4 text-[28px] font-semibold tracking-[-0.03em] text-ink-primary">
				Welcome to CertFlow
			</h1>
			<p class="mt-1.5 text-sm text-ink-secondary">
				Create your administrator account to finish setup. Security keys and database settings are
				prepared automatically.
			</p>
		</div>

		<!-- 3-Step Indicator & Runtime Diagnostics -->
		<div class="grid grid-cols-3 gap-2.5">
			<div
				class="flex items-center gap-2.5 rounded-xl border border-tone-data-border bg-surface-card p-3 shadow-xs"
			>
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tone-data-soft text-tone-data-ink"
				>
					<Check class="h-3.5 w-3.5" />
				</span>
				<div class="min-w-0">
					<p class="font-mono text-[10px] font-semibold text-tone-data-ink uppercase">Step 1</p>
					<p class="truncate text-xs font-semibold text-ink-primary">Runtime Ready</p>
				</div>
			</div>

			<div
				class="flex items-center gap-2.5 rounded-xl border border-accent-border bg-surface-card p-3 shadow-xs"
			>
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white"
				>
					2
				</span>
				<div class="min-w-0">
					<p class="font-mono text-[10px] font-semibold text-accent-ink uppercase">Step 2</p>
					<p class="truncate text-xs font-semibold text-ink-primary">Admin Account</p>
				</div>
			</div>

			<div
				class="flex items-center gap-2.5 rounded-xl border border-border-default bg-surface-card/70 p-3"
			>
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-subtle font-mono text-xs font-semibold text-ink-muted"
				>
					3
				</span>
				<div class="min-w-0">
					<p class="font-mono text-[10px] font-semibold text-ink-muted uppercase">Step 3</p>
					<p class="truncate text-xs font-medium text-ink-secondary">Launch Studio</p>
				</div>
			</div>
		</div>

		{#if form?.error}
			<div
				role="alert"
				class="flex items-start gap-2.5 rounded-xl border border-tone-danger-border bg-tone-danger-soft px-4 py-3 text-sm text-tone-danger-ink"
			>
				<OctagonAlert class="mt-0.5 h-4 w-4 shrink-0" />
				<span>{form.error}</span>
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
			class="space-y-4"
		>
			<!-- Primary Card: Admin Account Creation -->
			<section class="rounded-[20px] border border-border-default bg-surface-elevated p-6 shadow-lg">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<UserPlus class="h-4 w-4 text-accent-vivid" />
						<h2 class="font-display text-[15px] font-semibold text-ink-primary">
							Create Your Administrator Account
						</h2>
					</div>
					<Badge tone="emerald" dot>
						{databaseMode === 'postgres' ? 'PostgreSQL Detected' : 'Embedded DB Ready'}
					</Badge>
				</div>
				<p class="mt-1 text-xs text-ink-secondary">
					Use this account to sign in, design certificates and send emails. You can connect Brevo or
					Resend inside Settings at any time.
				</p>

				<div class="mt-4 space-y-3.5">
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
							class={inputClass}
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
							autocomplete="email"
							bind:value={adminEmail}
							placeholder="you@organisation.org"
							class={inputClass}
						/>
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
							class={inputClass}
						/>
					</div>
				</div>

				<div class="mt-5">
					<Button type="submit" variant="primary" size="lg" disabled={submitting} class="w-full">
						{#if submitting}
							<Loader2 class="h-4 w-4 animate-spin" />
							Setting Up CertFlow...
						{:else}
							Start CertFlow
						{/if}
					</Button>
				</div>

				<p class="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
					<ShieldCheck class="h-3.5 w-3.5 shrink-0 text-tone-data" />
					<span>Random security keys are generated automatically and this setup page locks once done.</span>
				</p>
			</section>

			<!-- Collapsible Advanced Configuration -->
			<section class="rounded-2xl border border-border-default bg-surface-card shadow-xs">
				<button
					type="button"
					onclick={() => (showAdvanced = !showAdvanced)}
					aria-expanded={showAdvanced}
					class="flex w-full cursor-pointer items-center justify-between gap-2 px-5 py-3.5 text-left text-xs font-semibold text-ink-secondary transition hover:text-ink-primary"
				>
					<span class="inline-flex items-center gap-2">
						<SlidersHorizontal class="h-3.5 w-3.5 text-accent-vivid" />
						<span>Advanced Settings (App URL, Secrets, Database &amp; Email Relay)</span>
					</span>
					{#if showAdvanced}
						<ChevronUp class="h-4 w-4 shrink-0" />
					{:else}
						<ChevronDown class="h-4 w-4 shrink-0" />
					{/if}
				</button>

				{#if !showAdvanced}
					<input type="hidden" name="appUrl" value={appUrl} />
					<input type="hidden" name="betterAuthSecret" value={betterAuthSecret} />
					<input type="hidden" name="encryptionKey" value={encryptionKey} />
					<input type="hidden" name="databaseMode" value={databaseMode} />
					<input type="hidden" name="databaseUrl" value={databaseMode === 'postgres' ? databaseUrl : ''} />
					<input type="hidden" name="emailProvider" value={emailProvider} />
					<input type="hidden" name="defaultFromName" value={defaultFromName} />
					<input type="hidden" name="defaultFromEmail" value={defaultFromEmail} />
				{:else}
					<div class="space-y-5 border-t border-border-default p-5">
						<!-- App URL & Secrets -->
						<div class="space-y-3">
							<div class="flex items-center gap-1.5 text-xs font-semibold text-ink-primary">
								<KeyRound class="h-3.5 w-3.5 text-accent-vivid" />
								<span>App URL &amp; Security Secrets</span>
							</div>

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
									class={inputClass}
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
										class="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
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
									class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 font-mono text-xs text-ink-primary outline-none transition focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
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
										class="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-accent-ink hover:underline"
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
									pattern={'[0-9a-fA-F]{64}'}
									title="Enter a 64-character hexadecimal key (0-9, a-f)"
									bind:value={encryptionKey}
									class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 font-mono text-xs text-ink-primary outline-none transition focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
								/>
							</div>
						</div>

						<!-- Database -->
						<div class="space-y-3 border-t border-border-subtle pt-4">
							<div class="flex items-center gap-1.5 text-xs font-semibold text-ink-primary">
								<Database class="h-3.5 w-3.5 text-tone-data" />
								<span>Database</span>
							</div>

							<div class="grid gap-2.5 sm:grid-cols-2">
								<label
									class="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition {databaseMode ===
									'embedded'
										? 'border-accent-border bg-accent-soft'
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
											Stored inside <code class="font-mono">{data.defaultEmbeddedDbPath}</code>.
										</span>
									</span>
								</label>

								<label
									class="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs transition {databaseMode ===
									'postgres'
										? 'border-accent-border bg-accent-soft'
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
											Docker Compose or external Postgres.
										</span>
									</span>
								</label>
							</div>

							{#if databaseMode === 'postgres'}
								<div>
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
										class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 font-mono text-xs text-ink-primary outline-none transition focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
									/>
								</div>
							{:else}
								<input type="hidden" name="databaseUrl" value="" />
							{/if}
						</div>

						<!-- Optional Server Email Relay -->
						<div class="space-y-3 border-t border-border-subtle pt-4">
							<div class="flex items-center gap-1.5 text-xs font-semibold text-ink-primary">
								<Mail class="h-3.5 w-3.5 text-tone-email" />
								<span>Default Email Relay (Optional)</span>
							</div>

							<div>
								<label for="setup-mail-provider" class="block text-xs font-medium text-ink-secondary">
									Provider
								</label>
								<select
									id="setup-mail-provider"
									name="emailProvider"
									bind:value={emailProvider}
									class={inputClass}
								>
									<option value="none">Configure later per user in Settings</option>
									<option value="brevo">Brevo API Key (Free 300/day · Gmail or domain)</option>
									<option value="resend">Resend API Key (Free 100/day · Custom domain)</option>
									<option value="smtp">Custom SMTP Server</option>
								</select>
							</div>

							{#if emailProvider !== 'none'}
								<div class="space-y-3 rounded-xl border border-border-default bg-surface-page p-3.5">
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
												class={inputClass}
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
												class={inputClass}
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
												class={inputClass}
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
												class={inputClass}
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
													class={inputClass}
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
													class={inputClass}
												/>
											</div>
											<div class="sm:col-span-2">
												<label class="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
													<input
														type="checkbox"
														name="smtpSecure"
														bind:checked={smtpSecure}
														class="h-4 w-4 rounded-[4px] border-border-strong accent-accent"
													/>
													Use direct TLS (port 465)
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
													class={inputClass}
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
													class={inputClass}
												/>
											</div>
										</div>
									{/if}
								</div>
							{:else}
								<input type="hidden" name="defaultFromName" value={defaultFromName} />
								<input type="hidden" name="defaultFromEmail" value={defaultFromEmail} />
							{/if}
						</div>
					</div>
				{/if}
			</section>
		</form>
	</div>
</div>
