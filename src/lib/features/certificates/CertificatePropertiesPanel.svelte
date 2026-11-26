<script lang="ts">
	import { Mail, Save } from '@lucide/svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import type { CriterionDefinition } from '#lib/types/certflow.ts';
	import {
		buildCertificateFieldDefs,
		buildCertificateUpdateFromFields,
		extractCertificateFieldValues
	} from './properties.ts';

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
		customProperties: Record<string, string>;
	}

	interface TemplateOption {
		id: string;
		name: string;
	}

	interface Props {
		certificate: CertificateRecord;
		properties: CriterionDefinition[];
		templates: TemplateOption[];
		saving: boolean;
		onSave: (patch: CertificateDraft) => Promise<void>;
		onDraftChange?: (draft: CertificateDraft) => void;
	}

	let { certificate, properties, templates, saving, onSave, onDraftChange }: Props = $props();

	let templateId = $state('');
	let certName = $state('');
	let fieldValues = $state<Record<string, string>>({});

	const fields = $derived(buildCertificateFieldDefs(properties, certificate));

	$effect(() => {
		templateId = certificate.templateId;
		certName = certificate.certName;
		fieldValues = extractCertificateFieldValues(certificate, fields);
	});

	$effect(() => {
		const draft = buildCertificateUpdateFromFields(
			certificate,
			fields,
			fieldValues,
			templateId,
			certName
		);
		onDraftChange?.(draft);
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const patch = buildCertificateUpdateFromFields(
			certificate,
			fields,
			fieldValues,
			templateId,
			certName
		);
		await onSave(patch);
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

		{#if fields.length > 0}
			<div class="space-y-3 border-t border-border-default pt-3">
				{#each fields as field (field.key)}
					{@const inputId = `cert-field-${field.key}`}
					<div>
						<div class="flex items-center justify-between gap-2">
							<label for={inputId} class="block text-xs font-medium text-ink-secondary">
								{field.label}
							</label>
							<code class="text-[10px] text-ink-muted">{`{{${field.key}}}`}</code>
						</div>
						{#if field.isEmail}
							<div class="relative mt-1">
								<Mail class="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-ink-muted" />
								<input
									id={inputId}
									type="email"
									value={fieldValues[field.key] ?? ''}
									oninput={(e) => {
										fieldValues = { ...fieldValues, [field.key]: e.currentTarget.value };
									}}
									placeholder="recipient@example.org"
									class="block w-full rounded-lg border border-border-strong py-2 pr-3 pl-9 text-sm"
								/>
							</div>
						{:else}
							<input
								id={inputId}
								type="text"
								required={field.isRequired}
								value={fieldValues[field.key] ?? ''}
								oninput={(e) => {
									fieldValues = { ...fieldValues, [field.key]: e.currentTarget.value };
								}}
								placeholder={`Enter ${field.label}`}
								class="mt-1 block w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
							/>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex justify-end pt-2">
			<Button type="submit" variant="primary" disabled={saving}>
				<Save class="h-4 w-4" />
				{saving ? 'Saving...' : 'Save Properties'}
			</Button>
		</div>
	</form>
</div>
