import type { ProjectEmailDefaults } from '#lib/types/certflow.ts';

export function createDefaultEmailSettings(): ProjectEmailDefaults {
	return {
		senderMode: 'account',
		senderProfileId: null,
		customSenderName: '',
		customSenderEmail: '',
		subjectTemplate: 'Your Certificate — {{title}}',
		bodyTemplate:
			'Hi {{name}},\n\nThank you for joining {{title}} as {{role}}. Your certificate is attached.\n\nBest regards,\nEvent Organiser',
		attachmentFormat: 'pdf'
	};
}
