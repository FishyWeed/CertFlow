<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		children: Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		type = 'button',
		class: className = '',
		children,
		...rest
	}: Props = $props();

	const variantClasses: Record<NonNullable<Props['variant']>, string> = {
		primary: 'bg-accent text-white hover:bg-accent-hover border border-transparent shadow-xs',
		secondary:
			'bg-surface-card text-ink-primary border border-border-strong hover:bg-surface-subtle',
		ghost: 'bg-transparent text-ink-secondary border border-transparent hover:bg-surface-subtle',
		danger: 'bg-red-600 text-white hover:bg-red-700 border border-transparent shadow-xs'
	};

	const sizeClasses: Record<NonNullable<Props['size']>, string> = {
		sm: 'min-h-8 px-2.5 py-1.5 text-xs gap-1.5 rounded-md',
		md: 'min-h-10 px-3.5 py-2 text-sm gap-2 rounded-lg'
	};
</script>

<button
	{type}
	class="inline-flex items-center justify-center font-medium transition disabled:cursor-not-allowed disabled:opacity-50 {variantClasses[variant]} {sizeClasses[size]} {className}"
	{...rest}
>
	{@render children()}
</button>
