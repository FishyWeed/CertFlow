import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getAuth } from '#lib/server/auth.ts';
import { needsInitialSetup } from '#lib/server/runtime-config.ts';

function isSetupBypassPath(pathname: string): boolean {
	return (
		pathname === '/setup' ||
		pathname.startsWith('/setup/') ||
		pathname === '/api/health' ||
		pathname.startsWith('/_app/') ||
		pathname === '/favicon.ico' ||
		pathname === '/favicon.svg'
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!building && needsInitialSetup()) {
		event.locals.session = null;
		event.locals.user = null;
		if (!isSetupBypassPath(event.url.pathname)) {
			if (event.url.pathname.startsWith('/api/')) {
				return new Response(
					JSON.stringify({ message: 'Initial setup is required. Open /setup to configure CertFlow.' }),
					{ status: 503, headers: { 'content-type': 'application/json' } }
				);
			}
			throw redirect(302, '/setup');
		}
		return resolve(event);
	}

	const auth = getAuth();

	if (!building) {
		try {
			const sessionData = await auth.api.getSession({
				headers: event.request.headers
			});
			event.locals.session = sessionData?.session ?? null;
			event.locals.user = sessionData?.user ?? null;
		} catch {
			event.locals.session = null;
			event.locals.user = null;
		}
	} else {
		event.locals.session = null;
		event.locals.user = null;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
