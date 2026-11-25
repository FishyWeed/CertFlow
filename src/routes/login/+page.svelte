<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Award, Loader2 } from '@lucide/svelte';
	import { authClient } from '#lib/auth-client.ts';
	import ThemeToggle from '#lib/components/ui/ThemeToggle.svelte';

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

<div class="relative flex min-h-screen items-center justify-center bg-surface-page px-4 py-8 sm:py-12">
	<div class="fixed top-4 right-4 z-10">
		<ThemeToggle />
	</div>
	<div
		class="w-full max-w-md rounded-2xl border border-border-default bg-surface-card p-6 shadow-xs sm:p-8"
	>
		<div class="flex flex-col items-center text-center">
			<a
				href="/"
				aria-label="CertFlow Home"
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white shadow-xs"
			>
				<Award class="h-6 w-6" />
			</a>
			<h1 class="mt-4 text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
				{mode === 'signup' ? 'Create your CertFlow account' : 'Sign in to CertFlow'}
			</h1>
			<p class="mt-1.5 text-sm text-ink-secondary">
				{mode === 'signup'
					? 'Save projects, design templates and send certificates.'
					: 'Sign in to open your saved projects.'}
			</p>
		</div>

		<form class="mt-6 space-y-4" onsubmit={handleSubmit}>
			{#if mode === 'signup'}
				<div>
					<label for="name" class="block text-sm font-medium text-ink-primary">Full Name</label>
					<input
						id="name"
						type="text"
						required
						bind:value={name}
						placeholder="e.g. Aiman Hakim"
						class="mt-1 block min-h-11 w-full rounded-lg border border-border-strong bg-white px-3.5 py-2.5 text-sm text-ink-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
					/>
				</div>
			{/if}

			<div>
				<label for="email" class="block text-sm font-medium text-ink-primary">Email Address</label>
				<input
					id="email"
					type="email"
					required
					autocomplete="email"
					bind:value={email}
					placeholder="you@organisation.org"
					class="mt-1 block min-h-11 w-full rounded-lg border border-border-strong bg-white px-3.5 py-2.5 text-sm text-ink-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-ink-primary">Password</label>
				<input
					id="password"
					type="password"
					required
					minlength={8}
					autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
					bind:value={password}
					placeholder="Minimum 8 characters"
					class="mt-1 block min-h-11 w-full rounded-lg border border-border-strong bg-white px-3.5 py-2.5 text-sm text-ink-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
				/>
			</div>

			{#if errorMessage}
				<div class="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
					{errorMessage}
				</div>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
			>
				{#if submitting}
					<Loader2 class="h-4 w-4 animate-spin" />
				{/if}
				{mode === 'signup' ? 'Create Account' : 'Sign In'}
			</button>
		</form>

		<div class="mt-5 text-center text-sm text-ink-secondary">
			{#if mode === 'signup'}
				Already have an account?
				<button
					type="button"
					class="inline-flex min-h-9 items-center rounded-md px-2 py-1 font-semibold text-accent hover:bg-accent-soft"
					onclick={() => {
						mode = 'signin';
						errorMessage = '';
					}}
				>
					Sign in
				</button>
			{:else}
				New to CertFlow?
				<button
					type="button"
					class="inline-flex min-h-9 items-center rounded-md px-2 py-1 font-semibold text-accent hover:bg-accent-soft"
					onclick={() => {
						mode = 'signup';
						errorMessage = '';
					}}
				>
					Create an account
				</button>
			{/if}
		</div>
	</div>
</div>
