import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.ts';

export const handle: Handle = async ({ event, resolve }) => {
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
