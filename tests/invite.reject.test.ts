import { beforeEach, expect, vi } from "vitest";
import { ERROR_CODES } from "../src/constants";
import type { InviteTypeWithId } from "../src/types";
import { defaultOptions, test } from "./helpers/better-auth";
import mock from "./helpers/mocks";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// Reject Invite Tests

test("invitee can reject their own invite", async ({ createAuth }) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: () => {},
		},
	});

	const invitee = {
		email: "invitee@test.com",
		role: "user",
		name: "Invitee User",
		password: "12345678",
	};

	await createUser(invitee, db);

	const { headers: creatorHeaders } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "admin",
		email: invitee.email,
		fetchOptions: { headers: creatorHeaders },
	});

	expect(created.error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "email", value: invitee.email }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}
	const token = invite.token;

	const { headers: inviteeHeaders } = await signInWithUser(
		invitee.email,
		invitee.password,
	);

	const rejected = await client.invite.reject({
		token,
		fetchOptions: { headers: inviteeHeaders },
	});

	expect(rejected.error).toBe(null);
	expect(rejected.data).toStrictEqual({
		status: true,
		message: "Invite rejected successfully",
	});

	const inviteCount = await db.count({
		model: "invite",
		where: [{ field: "token", value: token }],
	});
	expect(inviteCount).toBe(0);
});

test("non-invitee cannot reject invite", async ({ createAuth }) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: () => {},
		},
	});

	const inviteeEmail = "invitee@test.com";
	const otherUser = {
		email: "other@test.com",
		role: "user",
		name: "Other User",
		password: "12345678",
	};

	await createUser(otherUser, db);

	const { headers: creatorHeaders } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "admin",
		email: inviteeEmail,
		fetchOptions: { headers: creatorHeaders },
	});

	expect(created.error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "email", value: inviteeEmail }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}
	const token = invite.token;

	const { headers: otherHeaders } = await signInWithUser(
		otherUser.email,
		otherUser.password,
	);

	const rejected = await client.invite.reject({
		token,
		fetchOptions: { headers: otherHeaders },
	});

	expect(rejected.data).toBeNull();
	expect(rejected.error).toEqual(
		expect.objectContaining({
			errorCode: "CANT_REJECT_INVITE",
			message: ERROR_CODES.CANT_REJECT_INVITE,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);

	const inviteCount = await db.count({
		model: "invite",
		where: [{ field: "token", value: token }],
	});
	expect(inviteCount).toBe(1);
});

test("rejecting with an invalid token returns error", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	const rejected = await client.invite.reject({
		token: "invalid_token",
		fetchOptions: { headers },
	});

	expect(rejected.data).toBeNull();
	expect(rejected.error).toEqual(
		expect.objectContaining({
			errorCode: "INVALID_TOKEN",
			message: ERROR_CODES.INVALID_TOKEN,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);
});

test("public invite cannot be rejected", async ({ createAuth }) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "user",
		senderResponse: "token",
		fetchOptions: { headers },
	});

	expect(created.error).toBe(null);

	const token = created.data?.message;
	if (!token) {
		throw new Error("Token value is undefined");
	}

	const rejected = await client.invite.reject({
		token,
		fetchOptions: { headers },
	});

	expect(rejected.data).toBeNull();
	expect(rejected.error).toEqual(
		expect.objectContaining({
			errorCode: "CANT_REJECT_INVITE",
			message: ERROR_CODES.CANT_REJECT_INVITE,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);
});

test("canRejectInvite is called and can block rejection", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: () => {},
			canRejectInvite: mock.canRejectInvite,
		},
	});

	const invitee = {
		email: "invitee@test.com",
		role: "user",
		name: "Invitee User",
		password: "12345678",
	};

	await createUser(invitee, db);

	const { headers: creatorHeaders } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "admin",
		email: invitee.email,
		fetchOptions: { headers: creatorHeaders },
	});

	expect(created.error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "email", value: invitee.email }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}
	const token = invite.token;

	const { headers: inviteeHeaders } = await signInWithUser(
		invitee.email,
		invitee.password,
	);

	const rejected = await client.invite.reject({
		token,
		fetchOptions: { headers: inviteeHeaders },
	});

	expect(mock.canRejectInvite).toHaveBeenCalledOnce();
	expect(rejected.data).toBeNull();
	expect(rejected.error).toEqual(
		expect.objectContaining({
			errorCode: "CANT_REJECT_INVITE",
			message: ERROR_CODES.CANT_REJECT_INVITE,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);

	const inviteCount = await db.count({
		model: "invite",
		where: [{ field: "token", value: token }],
	});
	expect(inviteCount).toBe(1);
});

test("reject invite hooks run in the correct order with the expected arguments", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: () => {},
			inviteHooks: {
				beforeRejectInvite: mock.beforeRejectInvite,
				afterRejectInvite: mock.afterRejectInvite,
			},
		},
	});

	const invitee = {
		email: "invitee@test.com",
		role: "user",
		name: "Invitee User",
		password: "12345678",
	};

	await createUser(invitee, db);

	const { headers: creatorHeaders } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "admin",
		email: invitee.email,
		fetchOptions: { headers: creatorHeaders },
	});

	expect(created.error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "email", value: invitee.email }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}
	const token = invite.token;

	const { headers: inviteeHeaders } = await signInWithUser(
		invitee.email,
		invitee.password,
	);

	const { error } = await client.invite.reject({
		token,
		fetchOptions: { headers: inviteeHeaders },
	});

	expect(error).toBe(null);

	expect(mock.beforeRejectInvite).toHaveBeenCalledTimes(1);
	expect(mock.afterRejectInvite).toHaveBeenCalledTimes(1);

	const beforeOrder = mock.beforeRejectInvite.mock.invocationCallOrder[0];
	const afterOrder = mock.afterRejectInvite.mock.invocationCallOrder[0];
	expect(beforeOrder).toBeLessThan(afterOrder);

	expect(mock.beforeRejectInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			ctx: expect.objectContaining({
				path: "/invite/reject",
				method: "POST",
				body: expect.objectContaining({ token }),
				headers: expect.any(Headers),
			}),
			invitation: expect.objectContaining({
				id: expect.any(String),
				token,
				role: "admin",
				email: invitee.email,
				createdAt: expect.any(Date),
				expiresAt: expect.any(Date),
			}),
		}),
	);
	expect(mock.afterRejectInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			ctx: expect.objectContaining({
				path: "/invite/reject",
				method: "POST",
				body: expect.objectContaining({ token }),
				headers: expect.any(Headers),
			}),
			invitation: expect.objectContaining({
				id: expect.any(String),
				token,
				role: "admin",
				email: invitee.email,
				createdAt: expect.any(Date),
				expiresAt: expect.any(Date),
			}),
		}),
	);
});
