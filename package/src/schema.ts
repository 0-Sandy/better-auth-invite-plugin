import type { BetterAuthPluginDBSchema } from "better-auth";

export const schema = {
	invite: {
		fields: {
			token: { type: "string", unique: true },
			createdAt: { type: "date" },
			expiresAt: { type: "date", required: true },
			maxUses: { type: "number", required: true },
			infinityMaxUses: { type: "boolean", required: true, defaultValue: false },
			createdByUserId: {
				type: "string",
				references: { model: "user", field: "id", onDelete: "set null" },
			},
			redirectToAfterUpgrade: { type: "string", required: false },
			shareInviterName: { type: "boolean", required: true },
			email: { type: "string", required: false }, //! Deprecated
			emails: { type: "string[]", required: false },
			role: { type: "string", required: true },
			newAccount: { type: "boolean", required: false },
			status: {
				type: ["pending", "rejected", "canceled", "used"] as const,
				required: true,
			},
		},
	},
	inviteUse: {
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
