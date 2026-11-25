import { error } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { derivePropertiesFromHeaders } from '#lib/features/import/parser.ts';
import { db } from './db/index.ts';
import { certificates, projects, recipients, templates } from './db/schema.ts';

/**
 * Verifies the signed-in user owns the requested project and returns it.
 * Throws 404 when missing or owned by another user to avoid leaking IDs.
 */
export async function requireOwnedProject(projectId: string, userId: string) {
	const [project] = await db
		.select()
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
		.limit(1);

	if (!project) {
		throw error(404, 'Project not found');
	}
	return project;
}

export async function loadProjectWorkspace(projectId: string, userId: string) {
	const project = await requireOwnedProject(projectId, userId);

	const [projectTemplates, projectRecipients, projectCertificates] = await Promise.all([
		db
			.select()
			.from(templates)
			.where(eq(templates.projectId, project.id))
			.orderBy(asc(templates.createdAt)),
		db
			.select()
			.from(recipients)
			.where(eq(recipients.projectId, project.id))
			.orderBy(asc(recipients.rowIndex)),
		db
			.select()
			.from(certificates)
			.where(eq(certificates.projectId, project.id))
			.orderBy(asc(certificates.createdAt))
	]);

	// Keep project properties dynamically derived from the current datasheet headers.
	const derived =
		project.sourceHeaders.length > 0 ? derivePropertiesFromHeaders(project.sourceHeaders) : null;
	const syncedProject =
		derived && derived.properties.length > 0
			? { ...project, criteriaConfig: derived.properties, columnMapping: derived.mapping }
			: project;

	return {
		project: syncedProject,
		templates: projectTemplates,
		recipients: projectRecipients,
		certificates: projectCertificates
	};
}
