import { beforeEach, expect, vi } from "vitest";
import { ERROR_CODES } from "../src/constants";
import type { InviteTypeWithId } from "../src/types";
import { defaultOptions, test } from "./helpers/better-auth";
import mock from "./helpers/mocks";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// Cancel Invite Tests

test("invite creator can cancel their own invite", async ({ createAuth }) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "user",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(created.error).toBe(null);

	const token = created.data?.message;
	if (!token) {
		throw new Error("Token value is undefined");
	}

	// Ensure invite exists before cancelling
	const inviteBefore = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: token }],
	});

	expect(inviteBefore).not.toBeNull();

	const cancelled = await client.invite.cancel({
		token,
		fetchOptions: {
			headers,
		},
	});

	expect(cancelled.error).toBe(null);
	expect(cancelled.data).toStrictEqual({
		status: true,
		message: "Invite cancelled successfully",
	});

	const inviteCount = await db.count({
		model: "invite",
		where: [{ field: "token", value: token }],
	});

	if (!inviteBefore) {
		throw new Error("Invite not found");
	}

	const inviteUseCount = await db.count({
		model: "inviteUse",
		where: [{ field: "inviteId", value: inviteBefore.id }],
	});

	expect(inviteCount).toBe(0);
	expect(inviteUseCount).toBe(0);
});

test("non-creator cannot cancel invite", async ({ createAuth }) => {
	const { client, db, signInWithTestUser, signInWithUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "user",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(created.error).toBe(null);

	const token = created.data?.message;
	if (!token) {
		throw new Error("Token value is undefined");
	}

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: token }],
	});

	expect(invite).not.toBeNull();

	const otherUser = {
		email: "other@test.com",
		role: "user",
		name: "Other User",
		password: "12345678",
	};

	await createUser(otherUser, db);

	const { headers: otherHeaders } = await signInWithUser(
		otherUser.email,
		otherUser.password,
	);

	const cancelled = await client.invite.cancel({
		token,
		fetchOptions: {
			headers: otherHeaders,
		},
	});

	expect(cancelled.data).toBeNull();
	expect(cancelled.error).toEqual(
		expect.objectContaining({
			errorCode: "INSUFFICIENT_PERMISSIONS",
			message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);

	// Invite should still exist
	const inviteAfter = await db.count({
		model: "invite",
		where: [{ field: "token", value: token }],
	});

	expect(inviteAfter).toBe(1);
});

test("cancelling with an invalid token returns error", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const { headers } = await signInWithTestUser();

	const cancelled = await client.invite.cancel({
		token: "invalid_token",
		fetchOptions: {
			headers,
		},
	});

	expect(cancelled.data).toBeNull();
	expect(cancelled.error).toEqual(
		expect.objectContaining({
			errorCode: "INVALID_TOKEN",
			message: ERROR_CODES.INVALID_TOKEN,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);
});

test("canCancelInvite is called and can block cancellation", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			canCancelInvite: mock.canCancelInvite,
		},
	});

	const { headers } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "user",
		senderResponse: "token",
		fetchOptions: {
			headers,
		},
	});

	expect(created.error).toBe(null);

	const token = created.data?.message;
	if (!token) {
		throw new Error("Token value is undefined");
	}

	const cancelled = await client.invite.cancel({
		token,
		fetchOptions: {
			headers,
		},
	});

	expect(mock.canCancelInvite).toHaveBeenCalledOnce();
	expect(cancelled.data).toBeNull();
	expect(cancelled.error).toEqual(
		expect.objectContaining({
			errorCode: "INSUFFICIENT_PERMISSIONS",
			message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);

	const inviteAfter = await db.count({
		model: "invite",
		where: [{ field: "token", value: token }],
	});
	expect(inviteAfter).toBe(1);
});

test("cancel invite hooks run in the correct order with the expected arguments", async ({
	createAuth,
}) => {
	const { client, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			inviteHooks: {
				beforeCancelInvite: mock.beforeCancelInvite,
				afterCancelInvite: mock.afterCancelInvite,
			},
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

	const { error } = await client.invite.cancel({
		token,
		fetchOptions: { headers },
	});

	expect(error).toBe(null);

	expect(mock.beforeCancelInvite).toHaveBeenCalledTimes(1);
	expect(mock.afterCancelInvite).toHaveBeenCalledTimes(1);

	const beforeOrder = mock.beforeCancelInvite.mock.invocationCallOrder[0];
	const afterOrder = mock.afterCancelInvite.mock.invocationCallOrder[0];
	expect(beforeOrder).toBeLessThan(afterOrder);

	expect(mock.beforeCancelInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			ctx: expect.objectContaining({
				path: "/invite/cancel",
				method: "POST",
				body: expect.objectContaining({ token }),
				headers: expect.any(Headers),
			}),
			invitation: expect.objectContaining({
				id: expect.any(String),
				token,
				role: "user",
				createdAt: expect.any(Date),
				expiresAt: expect.any(Date),
			}),
		}),
	);
	expect(mock.afterCancelInvite).toHaveBeenCalledWith(
		expect.objectContaining({
			ctx: expect.objectContaining({
				path: "/invite/cancel",
				method: "POST",
				body: expect.objectContaining({ token }),
				headers: expect.any(Headers),
			}),
			invitation: expect.objectContaining({
				id: expect.any(String),
				token,
				role: "user",
				createdAt: expect.any(Date),
				expiresAt: expect.any(Date),
			}),
		}),
	);
});
