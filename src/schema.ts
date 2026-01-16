import type { BetterAuthPluginDBSchema } from "better-auth";

export const schema = {
	invite: {
		fields: {
			token: { type: "string", unique: true },
			createdAt: { type: "date" },
			expiresAt: { type: "date", required: true },
			maxUses: { type: "number", required: true },
			createdByUserId: {
				type: "string",
				references: { model: "user", field: "id", onDelete: "set null" },
			},
			redirectToAfterUpgrade: { type: "string", required: true },
			shareInviterName: { type: "boolean", required: true },
			email: { type: "string", required: false },
			role: { type: "string", required: true },
		},
	},
	invite_use: {
		fields: {
			inviteId: {
				type: "string",
				required: true,
				references: { model: "invite", field: "id", onDelete: "set null" },
			},
			usedAt: { type: "date", required: true },
			usedByUserId: {
				type: "string",
				required: false,
				references: { model: "user", field: "id", onDelete: "set null" },
			},
		},
	},
} satisfies BetterAuthPluginDBSchema;

export type InviteSchema = typeof schema;
