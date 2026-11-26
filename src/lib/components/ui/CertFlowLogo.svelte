<script lang="ts">
	interface Props {
		variant?: 'badge' | 'studio' | 'mono' | 'micro';
		size?: number;
		class?: string;
		decorative?: boolean;
	}

	let {
		variant = 'studio',
		size = 28,
		class: className = '',
		decorative = false
	}: Props = $props();

	const uid = $props.id();
	const vermilionId = `${uid}-cf-vermilion`;
	const bevelId = `${uid}-cf-bevel`;
</script>

{#if variant === 'badge'}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 32 32"
		fill="none"
		role={decorative ? undefined : 'img'}
		aria-label={decorative ? undefined : 'CertFlow'}
		aria-hidden={decorative ? 'true' : undefined}
		class="shrink-0 {className}"
	>
		<defs>
			<linearGradient id={vermilionId} x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
				<stop offset="0%" stop-color="#F05228" />
				<stop offset="100%" stop-color="#BA3210" />
			</linearGradient>
			<linearGradient id={bevelId} x1="16" y1="0" x2="16" y2="12" gradientUnits="userSpaceOnUse">
				<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28" />
				<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
			</linearGradient>
		</defs>
		<rect width="32" height="32" rx="8" fill="url(#{vermilionId})" />
		<rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="url(#{bevelId})" />
		<path
			d="M10 6.5H21.5L25 10H10V22H25L21.5 25.5H10A3.5 3.5 0 0 1 6.5 22V10A3.5 3.5 0 0 1 10 6.5Z"
			fill="#FFFFFF"
		/>
		<rect x="13" y="14.25" width="5.5" height="3.5" rx="1.75" fill="#FFFFFF" fill-opacity="0.72" />
		<circle cx="23" cy="16" r="2.5" fill="#FFFFFF" />
	</svg>
{:else if variant === 'micro'}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 16 16"
		fill="none"
		role={decorative ? undefined : 'img'}
		aria-label={decorative ? undefined : 'CertFlow'}
		aria-hidden={decorative ? 'true' : undefined}
		class="shrink-0 {className}"
	>
		<rect width="16" height="16" rx="4" fill="#D13B15" />
		<path
			d="M5 3H11.5L13 4.5H5.5V11.5H13L11.5 13H5A2 2 0 0 1 3 11V5A2 2 0 0 1 5 3Z"
			fill="#FFFFFF"
		/>
		<circle cx="11.25" cy="8" r="1.75" fill="#FFFFFF" />
	</svg>
{:else if variant === 'mono'}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 32 32"
		fill="none"
		role={decorative ? undefined : 'img'}
		aria-label={decorative ? undefined : 'CertFlow'}
		aria-hidden={decorative ? 'true' : undefined}
		class="shrink-0 {className}"
	>
		<path
			d="M10 6.5H21.5L25 10H10V22H25L21.5 25.5H10A3.5 3.5 0 0 1 6.5 22V10A3.5 3.5 0 0 1 10 6.5Z"
			fill="currentColor"
		/>
		<rect x="13" y="14.25" width="5.5" height="3.5" rx="1.75" fill="currentColor" fill-opacity="0.55" />
		<circle cx="23" cy="16" r="2.5" fill="currentColor" />
	</svg>
{:else}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 32 32"
		fill="none"
		role={decorative ? undefined : 'img'}
		aria-label={decorative ? undefined : 'CertFlow'}
		aria-hidden={decorative ? 'true' : undefined}
		class="shrink-0 {className}"
	>
		<path
			d="M10 6.5H21.5L25 10H10V22H25L21.5 25.5H10A3.5 3.5 0 0 1 6.5 22V10A3.5 3.5 0 0 1 10 6.5Z"
			fill="currentColor"
		/>
		<rect x="13" y="14.25" width="5.5" height="3.5" rx="1.75" fill="currentColor" fill-opacity="0.45" />
		<circle cx="23" cy="16" r="2.5" fill="var(--color-accent-vivid, #EB4A1E)" />
	</svg>
{/if}
