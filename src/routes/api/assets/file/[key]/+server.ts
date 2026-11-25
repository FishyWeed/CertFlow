import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { LOCAL_UPLOAD_DIR } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { assets } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const decodedKey = decodeURIComponent(params.key);
	const [record] = await db
		.select()
		.from(assets)
		.where(eq(assets.storageKey, decodedKey))
		.limit(1);

	if (!record || record.userId !== locals.user.id) {
		throw error(404, 'Asset not found');
	}

	const safeKey = record.storageKey.replace(/^\/+/, '').replace(/\.\./g, '');
	const baseDir = resolve(LOCAL_UPLOAD_DIR);
	const fullPath = resolve(join(baseDir, safeKey));

	// Prevent path traversal outside LOCAL_UPLOAD_DIR.
	if (!fullPath.startsWith(baseDir)) {
		throw error(403, 'Forbidden');
	}

	try {
		const buffer = await readFile(fullPath);
		return new Response(buffer, {
			headers: {
				'content-type': record.mimeType,
				'cache-control': 'private, max-age=31536000, immutable'
			}
		});
	} catch {
		throw error(404, 'Asset file missing on disk');
	}
};
