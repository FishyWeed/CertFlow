<script lang="ts">
	import { Mail, Save } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	export interface CertificateRecord {
		id: string;
		templateId: string;
		certCode: string;
		certName: string;
		recipientName: string;
		certTitle: string;
		role: string;
		ranking: string;
		email: string | null;
		customProperties: Record<string, string>;
		emailStatus: 'no_email' | 'not_sent' | 'queued' | 'sent' | 'failed';
	}

	export interface CertificateDraft {
		templateId: string;
		certName: string;
		recipientName: string;
		certTitle: string;
		role: string;
		ranking: string;
		email: string | null;
	}

	interface TemplateOption {
		id: string;
		name: string;
	}

	interface Props {
		certificate: CertificateRecord;
		templates: TemplateOption[];
		saving: boolean;
		onSave: (patch: CertificateDraft) => Promise<void>;
		onDraftChange?: (draft: CertificateDraft) => void;
	}

	let { certificate, templates, saving, onSave, onDraftChange }: Props = $props();

	let templateId = $state('');
	let certName = $state('');
	let recipientName = $state('');
	let certTitle = $state('');
	let role = $state('');
	let ranking = $state('');
	let email = $state('');

	$effect(() => {
		templateId = certificate.templateId;
		certName = certificate.certName;
		recipientName = certificate.recipientName;
		certTitle = certificate.certTitle;
		role = certificate.role;
		ranking = certificate.ranking;
		email = certificate.email ?? '';
	});

	$effect(() => {
		onDraftChange?.({
			templateId,
			certName,
			recipientName,
			certTitle,
			role,
			ranking,
			email: email.trim() || null
		});
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		await onSave({
			templateId,
			certName: certName.trim(),
			recipientName: recipientName.trim(),
			certTitle: certTitle.trim(),
			role: role.trim(),
			ranking: ranking.trim(),
			email: email.trim() || null
		});
	}

	const statusTone = $derived(
		certificate.emailStatus === 'sent'
			? 'emerald'
			: certificate.emailStatus === 'failed'
				? 'red'
				: certificate.emailStatus === 'no_email'
					? 'neutral'
					: 'amber'
	);
</script>

<div class="rounded-xl border border-border-default bg-surface-card p-5">
	<div class="flex flex-wrap items-start justify-between gap-3 border-b border-border-default pb-4">
		<div>
			<p class="text-xs font-semibold tracking-wide text-amber-700 uppercase">
				Certificate Properties
			</p>
			<h2 class="mt-0.5 text-lg font-semibold text-ink-primary">{certificate.recipientName}</h2>
			<p class="text-xs font-mono text-ink-muted">{certificate.certCode}</p>
		</div>
		<Badge tone={statusTone}>{certificate.emailStatus.replace('_', ' ')}</Badge>
	</div>

	<form class="mt-4 space-y-3.5" onsubmit={handleSubmit}>
		<div>
			<label for="prop-template" class="block text-xs font-medium text-ink-secondary">
				Assigned Template
			</label>
			<select
				id="prop-template"
				bind:value={templateId}
				onchange={() => {
					const found = templates.find((t) => t.id === templateId);
					if (found) certName = found.name;
				}}
				class="mt-1 block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm"
			>
				{#each templates as tpl (tpl.id)}
					<option value={tpl.id}>{tpl.name}</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="prop-cert-name" class="block text-xs font-medium text-ink-secondary">
				Certificate Name
			</label>
			<input
				id="prop-cert-name"
				type="text"
				required
				bind:value={certName}
				class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
			/>
		</div>

		<div>
			<label for="prop-recipient" class="block text-xs font-medium text-ink-secondary">
				Name on Certificate
			</label>
			<input
				id="prop-recipient"
				type="text"
				required
				bind:value={recipientName}
				class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
			/>
		</div>

		<div>
			<label for="prop-title" class="block text-xs font-medium text-ink-secondary">
				Certificate / Event Title
			</label>
			<input
				id="prop-title"
				type="text"
				bind:value={certTitle}
				placeholder="e.g. Annual Conference 2026"
				class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
			/>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div>
				<label for="prop-role" class="block text-xs font-medium text-ink-secondary">Role</label>
				<input
					id="prop-role"
					type="text"
					bind:value={role}
					placeholder="Participant / Organiser"
					class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="prop-ranking" class="block text-xs font-medium text-ink-secondary">
					Rank
				</label>
				<input
					id="prop-ranking"
					type="text"
					bind:value={ranking}
					placeholder="Empty for template default, or e.g. Champion"
					class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
				/>
			</div>
		</div>

		<div>
			<label for="prop-email" class="block text-xs font-medium text-ink-secondary">
				Recipient Email (Optional)
			</label>
			<div class="relative mt-1">
				<Mail class="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-ink-muted" />
				<input
					id="prop-email"
					type="email"
					bind:value={email}
					placeholder="No email attached"
					class="block w-full rounded-lg border border-border-strong py-2 pr-3 pl-9 text-sm"
				/>
			</div>
		</div>

		<div class="flex items-center justify-end gap-2 border-t border-border-default pt-4">
			<Button type="submit" variant="primary" size="sm" disabled={saving}>
				<Save class="h-3.5 w-3.5" />
				{saving ? 'Saving...' : 'Save Properties'}
			</Button>
		</div>
	</form>
</div>
