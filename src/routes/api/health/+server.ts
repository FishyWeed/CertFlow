import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { needsInitialSetup } from '#lib/server/runtime-config.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	if (needsInitialSetup()) {
		return json({ status: 'setup_required' });
	}
	try {
		await db.execute(sql`select 1`);
		return json({ status: 'ok' });
	} catch {
		return json({ status: 'error' }, { status: 503 });
	}
};
