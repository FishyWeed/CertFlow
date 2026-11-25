import { isLocalAppRuntime } from '#lib/server/runtime-config.ts';
import type { PageServerLoad } from './$types';

const REPO_SLUG = 'FishyWeed/CertFlow';
const REPO_URL = `https://github.com/${REPO_SLUG}`;
const RELEASES_URL = `${REPO_URL}/releases/latest`;
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface LandingGithubMeta {
	repoSlug: string;
	repoUrl: string;
	releasesUrl: string;
	issuesUrl: string;
	ghcrUrl: string;
	stars: number | null;
	forks: number | null;
	latestVersion: string | null;
	windowsInstallerUrl: string;
	windowsInstallerName: string | null;
}

let cachedMeta: { fetchedAt: number; value: LandingGithubMeta } | null = null;

function buildFallbackMeta(): LandingGithubMeta {
	return {
		repoSlug: REPO_SLUG,
		repoUrl: REPO_URL,
		releasesUrl: RELEASES_URL,
		issuesUrl: `${REPO_URL}/issues`,
		ghcrUrl: 'https://github.com/FishyWeed/CertFlow/pkgs/container/certflow',
		stars: null,
		forks: null,
		latestVersion: null,
		windowsInstallerUrl: RELEASES_URL,
		windowsInstallerName: null
	};
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 2500): Promise<T | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': 'CertFlow-Landing'
			},
			signal: controller.signal
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function getGithubMeta(): Promise<LandingGithubMeta> {
	if (cachedMeta && Date.now() - cachedMeta.fetchedAt < CACHE_TTL_MS) {
		return cachedMeta.value;
	}

	const fallback = cachedMeta?.value ?? buildFallbackMeta();

	const [repoData, releaseData] = await Promise.all([
		fetchJsonWithTimeout<{ stargazers_count?: number; forks_count?: number }>(
			`https://api.github.com/repos/${REPO_SLUG}`
		),
		fetchJsonWithTimeout<{
			tag_name?: string;
			html_url?: string;
			assets?: Array<{ name?: string; browser_download_url?: string }>;
		}>(`https://api.github.com/repos/${REPO_SLUG}/releases/latest`)
	]);

	const next: LandingGithubMeta = {
		...fallback,
		stars:
			typeof repoData?.stargazers_count === 'number' ? repoData.stargazers_count : fallback.stars,
		forks: typeof repoData?.forks_count === 'number' ? repoData.forks_count : fallback.forks,
		latestVersion: releaseData?.tag_name?.trim() || fallback.latestVersion,
		releasesUrl: releaseData?.html_url?.trim() || fallback.releasesUrl
	};

	const exeAsset = releaseData?.assets?.find(
		(a) =>
			a.name?.toLowerCase().endsWith('-win-x64-setup.exe') &&
			a.browser_download_url?.startsWith(`https://github.com/${REPO_SLUG}/releases/download/`)
	);
	if (exeAsset?.browser_download_url && exeAsset.name) {
		next.windowsInstallerUrl = exeAsset.browser_download_url;
		next.windowsInstallerName = exeAsset.name;
	}

	cachedMeta = { fetchedAt: Date.now(), value: next };
	return next;
}

export const load: PageServerLoad = async () => {
	const github = await getGithubMeta();
	return {
		github,
		isLocalApp: isLocalAppRuntime()
	};
};
