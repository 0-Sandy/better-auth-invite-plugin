import type { AuthContext, DBAdapter, Where } from "better-auth";
import type { UserWithRole } from "better-auth/plugins";
import type { CreateInvite } from "./routes/create-invite";
import type {
	InvitationStatus,
	InviteTypeWithId,
	InviteUseType,
	InviteUseTypeWithId,
	NewInviteOptions,
} from "./types";
import {
	getDate,
	normalizeEmails,
	resolveInvitePayload,
	resolveTokenGenerator,
} from "./utils";

export const getInviteAdapter = (
	context: AuthContext,
	options: NewInviteOptions,
) => {
	const baseAdapter = context.adapter;
	const inviteTable = "invite";
	const inviteUseTable = "inviteUse";

	return {
		createInvite: (
			invite: CreateInvite,
			user: UserWithRole,
			newAccount?: boolean,
		) => {
			const payload = resolveInvitePayload(invite, options);
			const generateToken = resolveTokenGenerator(payload.tokenType, options);

			const emails = normalizeEmails<string[]>(invite.email, []);
			const isPrivate = emails.length > 0;

			const expiresAt = getDate(payload.expiresIn, "sec");
			const token = generateToken();
			const now = options.getDate();
			const hasExplicitMaxUses =
				invite.maxUses !== undefined && invite.maxUses !== null;

			const newMaxUses = invite.maxUses ?? options.defaultMaxUses;

			const isUnlimited = !isPrivate && !hasExplicitMaxUses;

			return baseAdapter.create<InviteTypeWithId>({
				model: inviteTable,
				data: {
					token,
					createdByUserId: user.id,
					createdAt: now,
					expiresAt,
					maxUses: isUnlimited ? 1 : (newMaxUses ?? 1),
					infinityMaxUses: isUnlimited,
					redirectToAfterUpgrade: payload.redirectToAfterUpgrade,
					shareInviterName: payload.shareInviterName,
					emails: normalizeEmails(invite.email),
					role: invite.role,
					newAccount,
					status: "pending",
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
		countInvitations: (data?: { where?: Where[] }) =>
			baseAdapter.count({
				model: inviteTable,
				...data,
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
		deleteInvitations: (ids: string[]) =>
			baseAdapter.deleteMany({
				model: inviteTable,
				where: [
					{
						field: "id",
						value: ids,
						operator: "in",
					},
				],
			}),
		updateInvitation: (id: string, status: InvitationStatus) =>
			baseAdapter.update<InviteTypeWithId>({
				model: inviteTable,
				where: [
					{
						field: "id",
						value: id,
					},
				],
				update: {
					status,
				},
			}),
		listInvitations: (data?: {
			limit?: number;
			offset?: number;
			sortBy?: {
				field: string;
				direction: "asc" | "desc";
			};
			where?: Where[];
		}) =>
			baseAdapter.findMany<InviteTypeWithId>({
				model: inviteTable,
				...data,
			}),
	};
};

export type InviteAdapter = ReturnType<typeof getInviteAdapter>;
