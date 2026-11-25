export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'certflow-theme';

function readInitialTheme(): ThemeMode {
	if (typeof document !== 'undefined') {
		if (document.documentElement.classList.contains('dark')) return 'dark';
	}
	if (typeof window !== 'undefined') {
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (stored === 'dark' || stored === 'light') return stored;
		} catch {
			// Ignore storage restrictions in private browsing modes.
		}
		if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
	}
	return 'light';
}

function applyThemeToDocument(next: ThemeMode) {
	if (typeof document === 'undefined') return;
	const isDark = next === 'dark';
	document.documentElement.classList.toggle('dark', isDark);
	document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

class ThemeStore {
	mode = $state<ThemeMode>(readInitialTheme());
	isDark = $derived(this.mode === 'dark');
	private initialised = false;

	init() {
		if (this.initialised || typeof window === 'undefined') return;
		this.initialised = true;
		const resolved = readInitialTheme();
		this.mode = resolved;
		applyThemeToDocument(resolved);

		window.addEventListener('storage', (event) => {
			if (event.key !== STORAGE_KEY) return;
			if (event.newValue === 'dark' || event.newValue === 'light') {
				this.mode = event.newValue;
				applyThemeToDocument(event.newValue);
			}
		});
	}

	set(next: ThemeMode) {
		this.mode = next;
		applyThemeToDocument(next);
		if (typeof window !== 'undefined') {
			try {
				window.localStorage.setItem(STORAGE_KEY, next);
			} catch {
				// Ignore storage write errors.
			}
		}
	}

	toggle() {
		this.set(this.mode === 'dark' ? 'light' : 'dark');
	}
}

export const theme = new ThemeStore();
