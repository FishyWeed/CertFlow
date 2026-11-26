<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'primary' | 'contrast' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
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
		primary:
			'bg-accent text-white border border-transparent shadow-[var(--shadow-accent-glow)] hover:bg-accent-hover active:bg-accent-active disabled:shadow-none',
		contrast:
			'bg-contrast text-ink-inverted border border-transparent shadow-xs hover:bg-contrast-hover disabled:shadow-none',
		secondary:
			'bg-surface-card text-ink-primary border border-border-strong shadow-xs hover:bg-surface-subtle hover:border-ink-muted/40 active:bg-surface-recessed disabled:shadow-none',
		ghost:
			'bg-transparent text-ink-secondary border border-transparent hover:bg-surface-subtle hover:text-ink-primary active:bg-surface-recessed',
		danger:
			'bg-tone-danger text-white border border-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.2)] hover:bg-[#ac1729] active:bg-[#901222] disabled:shadow-none'
	};

	const sizeClasses: Record<NonNullable<Props['size']>, string> = {
		sm: 'min-h-[30px] px-2.5 py-1 text-xs gap-1.5 rounded-md',
		md: 'min-h-[38px] px-3.5 py-2 text-[13.5px] gap-2 rounded-lg',
		lg: 'min-h-11 px-5 py-2.5 text-sm gap-2 rounded-[10px]'
	};
</script>

<button
	{type}
	class="cf-pressable inline-flex cursor-pointer items-center justify-center font-medium select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 {variant ===
	'danger'
		? 'focus-visible:outline-tone-danger'
		: 'focus-visible:outline-accent-vivid'} disabled:cursor-not-allowed disabled:opacity-45 {variantClasses[variant]} {sizeClasses[size]} {className}"
	{...rest}
>
	{@render children()}
</button>
