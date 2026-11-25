import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from './db/index.ts';
import * as schema from './db/schema.ts';
import { getRuntimeConfig } from './runtime-config.ts';

function createAuthInstance() {
	const cfg = getRuntimeConfig();
	const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
		? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
		: null;
	const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim() || null;

	const trustedOrigins = Array.from(
		new Set(
			[cfg.betterAuthUrl, railwayUrl, renderUrl].filter((value): value is string => Boolean(value))
		)
	);

	return betterAuth({
		baseURL: cfg.betterAuthUrl,
		secret: cfg.betterAuthSecret,
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
}

type AuthInstance = ReturnType<typeof createAuthInstance>;

let cachedKey = '';
let cachedAuth: AuthInstance | null = null;

export function getAuth(): AuthInstance {
	const cfg = getRuntimeConfig();
	const key = `${cfg.betterAuthUrl}|${cfg.betterAuthSecret}|${cfg.databaseUrl}`;
	if (cachedAuth && cachedKey === key) {
		return cachedAuth;
	}
	cachedAuth = createAuthInstance();
	cachedKey = key;
	return cachedAuth;
}

export function resetAuthInstance(): void {
	cachedAuth = null;
	cachedKey = '';
}

export const auth: AuthInstance = new Proxy({} as AuthInstance, {
	get(_target, prop, receiver) {
		const instance = getAuth();
		const value = Reflect.get(instance as object, prop, receiver);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
