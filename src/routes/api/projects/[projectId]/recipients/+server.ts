import { randomUUID } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { MAX_RECIPIENTS_PER_PROJECT } from '#lib/config/limits.ts';
import { db } from '#lib/server/db/index.ts';
import { projects, recipients } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import { isLocalAppRuntime } from '#lib/server/runtime-config.ts';
import { applyColumnMapping, derivePropertiesFromHeaders } from '#lib/features/import/parser.ts';
import type { RequestHandler } from './$types';

const importRecipientsSchema = z.object({
	fileName: z.string().trim().min(1).max(255).optional(),
	headers: z.array(z.string()),
	columnMapping: z.record(z.string(), z.string()),
	rows: z.array(z.record(z.string(), z.string()))
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const body = await request.json();
	const parsed = importRecipientsSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, parsed.error.issues[0]?.message ?? 'Invalid spreadsheet payload');
	}

	const { fileName, headers, rows } = parsed.data;
	if (!isLocalAppRuntime() && rows.length > MAX_RECIPIENTS_PER_PROJECT) {
		throw error(
			400,
			`A project can hold up to ${MAX_RECIPIENTS_PER_PROJECT.toLocaleString()} recipients on hosted deployments.`
		);
	}
	const { properties: derivedProperties, mapping: derivedMapping } =
		derivePropertiesFromHeaders(headers);
	const nextCriteriaConfig =
		derivedProperties.length > 0 ? derivedProperties : project.criteriaConfig;

	await db.transaction(async (tx) => {
		await tx
			.update(projects)
			.set({
				sourceFileName: fileName ?? project.sourceFileName,
				sourceHeaders: headers,
				columnMapping: derivedMapping,
				criteriaConfig: nextCriteriaConfig,
				updatedAt: new Date()
			})
			.where(eq(projects.id, project.id));

		await tx.delete(recipients).where(eq(recipients.projectId, project.id));

		if (rows.length > 0) {
			const values = rows.map((rawRow, index) => ({
				id: randomUUID(),
				projectId: project.id,
				rowIndex: index + 1,
				rawRow,
				mappedData: applyColumnMapping(
					rawRow,
					derivedMapping,
					nextCriteriaConfig,
					project.defaultCertTitle
				)
			}));
			await tx.insert(recipients).values(values);
		}
	});

	return json({ importedCount: rows.length });
};
