import type { AuthContext, DBAdapter } from "better-auth";
import type { UserWithRole } from "better-auth/plugins";
import type { CreateInvite } from "./body";
import type {
	InviteTypeWithId,
	InviteUseType,
	InviteUseTypeWithId,
	NewInviteOptions,
} from "./types";
import { getDate, resolveInvitePayload, resolveTokenGenerator } from "./utils";

export const getInviteAdapter = (
	context: AuthContext,
	options: NewInviteOptions,
) => {
	const baseAdapter = context.adapter;
	const inviteTable = "invite";
	const inviteUseTable = "inviteUse";

	return {
		createInvite: (invite: CreateInvite, user: UserWithRole) => {
			const payload = resolveInvitePayload(invite, options);
			const generateToken = resolveTokenGenerator(payload.tokenType, options);

			const expiresAt = getDate(payload.expiresIn, "sec");
			const token = generateToken();
			const now = options.getDate();
			const newMaxUses =
				invite.maxUses ??
				options.defaultMaxUses ??
				(invite.email ? 1 : Infinity);

			return baseAdapter.create<InviteTypeWithId>({
				model: inviteTable,
				data: {
					token,
					createdByUserId: user.id,
					createdAt: now,
					expiresAt,
					maxUses: newMaxUses,
					redirectToAfterUpgrade: payload.redirectToAfterUpgrade,
					shareInviterName: payload.shareInviterName,
					email: invite.email,
					role: invite.role,
				},
			});
		},
		findInvitation: (
			token: string,
			data?: Omit<Parameters<DBAdapter["findOne"]>[0], "model">,
		) => {
			const { where, ...rest } = data ?? {};

			const invitation = baseAdapter.findOne<InviteTypeWithId>({
				model: inviteTable,
				where: [
					{
						field: "token",
						value: token,
					},
					...(where ?? []),
				],
				...rest,
			});

			return invitation;
		},
		deleteInvitation: (token: string) =>
			baseAdapter.delete({
				model: inviteTable,
				where: [
					{
						field: "token",
						value: token,
					},
				],
			}),
		createInviteUse: (data: InviteUseType) =>
			baseAdapter.create<InviteUseTypeWithId>({
				model: inviteUseTable,
				data,
			}),
		countInvitationUses: (inviteId: string) =>
			baseAdapter.count({
				model: inviteUseTable,
				where: [
					{
						field: "inviteId",
						value: inviteId,
					},
				],
			}),
		deleteInviteUses: (inviteId: string) =>
			baseAdapter.deleteMany({
				model: inviteUseTable,
				where: [
					{
						field: "inviteId",
						value: inviteId,
					},
				],
			}),
	};
};

export type InviteAdapter = ReturnType<typeof getInviteAdapter>;
