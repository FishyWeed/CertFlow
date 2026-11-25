import { randomBytes, randomUUID } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { certificates, recipients, templates } from '#lib/server/db/schema.ts';
import { requireOwnedProject } from '#lib/server/projects.ts';
import { matchTemplateForRow } from '#lib/features/import/routing.ts';
import type { RequestHandler } from './$types';

function makeCertCode(index: number): string {
	const rand = randomBytes(2).toString('hex').toUpperCase();
	return `CF-${String(index + 1).padStart(4, '0')}-${rand}`;
}

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const project = await requireOwnedProject(params.projectId, locals.user.id);

	const [projectTemplates, projectRecipients] = await Promise.all([
		db
			.select()
			.from(templates)
			.where(eq(templates.projectId, project.id))
			.orderBy(asc(templates.createdAt)),
		db
			.select()
			.from(recipients)
			.where(eq(recipients.projectId, project.id))
			.orderBy(asc(recipients.rowIndex))
	]);

	if (projectTemplates.length === 0) {
		throw error(400, 'Create at least one certificate template before you generate certificates.');
	}
	if (projectRecipients.length === 0) {
		throw error(400, 'Import a CSV or Excel file or add table rows before you generate certificates.');
	}

	const standardKeys = new Set(['name', 'title', 'role', 'rank', 'ranking', 'email']);

	const generatedRows = projectRecipients
		.map((recipient, idx) => {
			const data = recipient.mappedData ?? {};
			const recipientName = (
				data.name ??
				Object.values(data).find((v) => v.trim()) ??
				''
			).trim();
			if (!recipientName) return null;

			const role = (data.role ?? '').trim() || 'Participant';
			const rank = (data.rank ?? data.ranking ?? '').trim();
			const certTitle = (data.title ?? '').trim() || project.defaultCertTitle || project.name;
			const email = (data.email ?? '').trim() || null;

			const matched = matchTemplateForRow(projectTemplates, role, rank, data);
			if (!matched) return null;

			const customProperties: Record<string, string> = {};
			for (const [k, v] of Object.entries(data)) {
				if (!standardKeys.has(k) && v) {
					customProperties[k] = v;
				}
			}

			return {
				id: randomUUID(),
				projectId: project.id,
				recipientId: recipient.id,
				templateId: matched.id,
				certCode: makeCertCode(idx),
				certName: matched.name,
				recipientName,
				certTitle,
				role,
				ranking: rank,
				email,
				customProperties,
				overrides: {},
				emailStatus: email ? ('not_sent' as const) : ('no_email' as const)
			};
		})
		.filter((row): row is NonNullable<typeof row> => row !== null);

	await db.transaction(async (tx) => {
		await tx.delete(certificates).where(eq(certificates.projectId, project.id));
		if (generatedRows.length > 0) {
			await tx.insert(certificates).values(generatedRows);
		}
	});

	return json({
		generatedCount: generatedRows.length,
		certificates: generatedRows.map((r) => ({
			id: r.id,
			certName: r.certName,
			recipientName: r.recipientName,
			role: r.role,
			ranking: r.ranking,
			email: r.email
		}))
	});
};
