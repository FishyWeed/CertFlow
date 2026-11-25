import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { db } from './db/index.ts';
import * as schema from './db/schema.ts';

const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
	? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
	: null;

const resolvedBaseUrl =
	BETTER_AUTH_URL && BETTER_AUTH_URL !== 'http://localhost:5678'
		? BETTER_AUTH_URL
		: (railwayUrl ?? BETTER_AUTH_URL);

const trustedOrigins = Array.from(
	new Set([resolvedBaseUrl, railwayUrl].filter((value): value is string => Boolean(value)))
);

export const auth = betterAuth({
	baseURL: resolvedBaseUrl,
	secret: BETTER_AUTH_SECRET,
	trustedOrigins,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	emailAndPassword: {
		enabled: true,
		autoSignIn: true
	},
	advanced: {
		ipAddress: {
			ipAddressHeaders: ['x-forwarded-for', 'x-real-ip']
		}
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});
