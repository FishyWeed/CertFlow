<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Loader2, OctagonAlert } from '@lucide/svelte';
	import { authClient } from '#lib/auth-client.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import CertFlowLogo from '#lib/components/ui/CertFlowLogo.svelte';

	let mode = $state<'signin' | 'signup'>(
		page.url.searchParams.get('mode') === 'signup' ? 'signup' : 'signin'
	);
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let submitting = $state(false);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		submitting = true;

		try {
			if (mode === 'signup') {
				const res = await authClient.signUp.email({
					name: name.trim(),
					email: email.trim(),
					password
				});
				if (res.error) {
					errorMessage =
						res.error.message || res.error.statusText || 'Could not create account.';
					return;
				}
			} else {
				const res = await authClient.signIn.email({
					email: email.trim(),
					password
				});
				if (res.error) {
					errorMessage =
						res.error.message || res.error.statusText || 'Invalid email or password.';
					return;
				}
			}
			await goto('/dashboard', { invalidateAll: true });
		} catch (err) {
			errorMessage =
				err instanceof Error ? err.message : 'Unable to connect to authentication server.';
		} finally {
			submitting = false;
		}
	}
</script>

<div
	class="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-page px-4 py-8 sm:py-12"
>
	<div aria-hidden="true" class="cf-drafting-grid pointer-events-none absolute inset-0"></div>

	<div
		class="relative z-10 w-full max-w-[420px] rounded-[20px] border border-border-default bg-surface-elevated p-6 shadow-lg sm:p-8"
	>
		<div class="flex flex-col items-center text-center">
			<a
				href="/"
				aria-label="CertFlow Home"
				class="cf-pressable inline-flex rounded-xl transition-opacity hover:opacity-90"
			>
				<CertFlowLogo variant="badge" size={40} decorative />
			</a>
			<h1 class="font-display mt-4 text-2xl font-semibold tracking-[-0.03em] text-ink-primary">
				{mode === 'signup' ? 'Create your account' : 'Sign in to CertFlow'}
			</h1>
			<p class="mt-1.5 text-sm text-ink-secondary">
				{mode === 'signup'
					? 'Save projects, design templates and send certificates.'
					: 'Open your saved certificate projects and datasets.'}
			</p>
		</div>

		<!-- Gliding Segmented Mode Switcher -->
		<div
			role="tablist"
			aria-label="Account mode"
			class="mt-6 grid grid-cols-2 rounded-[10px] border border-border-default bg-surface-subtle p-[3px] dark:bg-surface-recessed"
		>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'signin'}
				onclick={() => {
					mode = 'signin';
					errorMessage = '';
				}}
				class="cf-glide-thumb cursor-pointer rounded-[7px] py-1.5 text-xs transition {mode === 'signin'
					? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
					: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
			>
				Sign In
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'signup'}
				onclick={() => {
					mode = 'signup';
					errorMessage = '';
				}}
				class="cf-glide-thumb cursor-pointer rounded-[7px] py-1.5 text-xs transition {mode === 'signup'
					? 'border border-border-default/80 bg-surface-card font-semibold text-ink-primary shadow-xs dark:bg-surface-elevated'
					: 'border border-transparent font-medium text-ink-secondary hover:text-ink-primary'}"
			>
				Create Account
			</button>
		</div>

		<form class="mt-5 space-y-4" onsubmit={handleSubmit}>
			{#if mode === 'signup'}
				<div>
					<label for="name" class="block text-[13px] font-medium text-ink-secondary">
						Full Name
					</label>
					<input
						id="name"
						type="text"
						required
						bind:value={name}
						placeholder="e.g. Aiman Hakim"
						class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
					/>
				</div>
			{/if}

			<div>
				<label for="email" class="block text-[13px] font-medium text-ink-secondary">
					Email Address
				</label>
				<input
					id="email"
					type="email"
					required
					autocomplete="email"
					bind:value={email}
					placeholder="you@organisation.org"
					class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
				/>
			</div>

			<div>
				<label for="password" class="block text-[13px] font-medium text-ink-secondary">
					Password
				</label>
				<input
					id="password"
					type="password"
					required
					minlength={8}
					autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
					bind:value={password}
					placeholder="Minimum 8 characters"
					class="mt-1.5 block h-[38px] w-full rounded-lg border border-border-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition hover:border-ink-muted/60 focus:border-accent-vivid focus:ring-3 focus:ring-accent-vivid/18 dark:bg-surface-recessed"
				/>
			</div>

			{#if errorMessage}
				<div
					role="alert"
					class="flex items-start gap-2.5 rounded-lg border border-tone-danger-border bg-tone-danger-soft px-3.5 py-2.5 text-xs text-tone-danger-ink sm:text-sm"
				>
					<OctagonAlert class="mt-0.5 h-4 w-4 shrink-0" />
					<span>{errorMessage}</span>
				</div>
			{/if}

			<Button type="submit" variant="primary" size="lg" disabled={submitting} class="w-full">
				{#if submitting}
					<Loader2 class="h-4 w-4 animate-spin" />
				{/if}
				{mode === 'signup' ? 'Create Account' : 'Sign In'}
			</Button>
		</form>

		<div class="mt-5 border-t border-border-subtle pt-4 text-center text-xs text-ink-muted">
			<a href="/" class="font-medium text-ink-secondary transition hover:text-accent-ink">
				Return to CertFlow overview
			</a>
		</div>
	</div>
</div>
