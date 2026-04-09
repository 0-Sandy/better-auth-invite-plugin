import { beforeEach, expect, vi } from "vitest";
import { ERROR_CODES } from "../src/constants";
import type { InviteTypeWithId } from "../src/types";
import { defaultOptions, test } from "./helpers/better-auth";
import { createUser } from "./helpers/users";

beforeEach(() => {
	vi.clearAllMocks();
});

// Get Invite Tests

test("public invite returns inviter info without session", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
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

	const tokenValue = created.data?.message;
	if (!tokenValue) {
		throw new Error("Token value is undefined");
	}

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "token", value: tokenValue }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	const res = await client.invite.get({
		query: {
			token: tokenValue,
		},
	});

	expect(res.error).toBe(null);
	expect(res.data).toEqual({
		status: true,
		inviter: expect.objectContaining({
			email: expect.any(String),
			name: expect.any(String),
		}),
		invitation: expect.objectContaining({
			email: null,
			emails: [],
			createdAt: expect.any(Date),
			role: "user",
		}),
	});
});

test("private invite returns inviter info only to the correct invitee", async ({
	createAuth,
}) => {
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
		where: [{ field: "emails", value: JSON.stringify([invitee.email]) }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	const tokenValue = invite.token;

	const { headers: inviteeHeaders } = await signInWithUser(
		invitee.email,
		invitee.password,
	);

	const res = await client.invite.get({
		query: {
			token: tokenValue,
		},
		fetchOptions: { headers: inviteeHeaders },
	});

	expect(res.error).toBe(null);
	expect(res.data).toEqual({
		status: true,
		inviter: expect.objectContaining({
			email: expect.any(String),
			name: expect.any(String),
		}),
		invitation: expect.objectContaining({
			email: null,
			emails: [invitee.email],
			createdAt: expect.any(Date),
			role: "admin",
			newAccount: expect.any(Boolean),
		}),
	});
});

test("private invite returns INVALID_TOKEN for non-invitee", async ({
	createAuth,
}) => {
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
	const otherUser = {
		email: "other@test.com",
		role: "user",
		name: "Other User",
		password: "12345678",
	};

	await createUser(invitee, db);
	await createUser(otherUser, db);

	const { headers: creatorHeaders } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "admin",
		email: invitee.email,
		fetchOptions: { headers: creatorHeaders },
	});

	expect(created.error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "emails", value: JSON.stringify([invitee.email]) }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	const tokenValue = invite.token;

	const { headers: otherHeaders } = await signInWithUser(
		otherUser.email,
		otherUser.password,
	);

	const res = await client.invite.get({
		query: {
			token: tokenValue,
		},
		fetchOptions: { headers: otherHeaders },
	});

	expect(res.data).toBeNull();
	expect(res.error).toEqual(
		expect.objectContaining({
			code: "INVALID_TOKEN",
			message: ERROR_CODES.INVALID_TOKEN.message,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);
});

test("private invite returns INVALID_TOKEN when unauthenticated", async ({
	createAuth,
}) => {
	const { client, db, signInWithTestUser } = await createAuth({
		pluginOptions: {
			...defaultOptions,
			sendUserInvitation: () => {},
		},
	});

	const inviteeEmail = "invitee@test.com";

	const { headers: creatorHeaders } = await signInWithTestUser();

	const created = await client.invite.create({
		role: "admin",
		email: inviteeEmail,
		fetchOptions: { headers: creatorHeaders },
	});

	expect(created.error).toBe(null);

	const invite = await db.findOne<InviteTypeWithId>({
		model: "invite",
		where: [{ field: "emails", value: JSON.stringify([inviteeEmail]) }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	const tokenValue = invite.token;

	const res = await client.invite.get({
		query: {
			token: tokenValue,
		},
	});

	expect(res.data).toBeNull();
	expect(res.error).toEqual(
		expect.objectContaining({
			code: "INVALID_TOKEN",
			message: ERROR_CODES.INVALID_TOKEN.message,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);
});

test("getInvite with invalid token returns INVALID_TOKEN", async ({
	createAuth,
}) => {
	const { client } = await createAuth({
		pluginOptions: {
			...defaultOptions,
		},
	});

	const res = await client.invite.get({
		query: {
			token: "invalid_token",
		},
	});

	expect(res.data).toBeNull();
	expect(res.error).toEqual(
		expect.objectContaining({
			code: "INVALID_TOKEN",
			message: ERROR_CODES.INVALID_TOKEN.message,
			status: 400,
			statusText: "BAD_REQUEST",
		}),
	);
});

test("works with old email field in db", async ({ createAuth }) => {
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
		where: [{ field: "emails", value: JSON.stringify([invitee.email]) }],
	});

	if (!invite) {
		throw new Error("Invite not found");
	}

	await db.update({
		model: "invite",
		where: [{ field: "id", value: invite.id }],
		update: {
			email: invitee.email,
			emails: undefined,
		},
	});

	const tokenValue = invite.token;

	const { headers: inviteeHeaders } = await signInWithUser(
		invitee.email,
		invitee.password,
	);

	const res = await client.invite.get({
		query: {
			token: tokenValue,
		},
		fetchOptions: { headers: inviteeHeaders },
	});

	expect(res.error).toBe(null);
	expect(res.data).toEqual({
		status: true,
		inviter: expect.objectContaining({
			email: expect.any(String),
			name: expect.any(String),
		}),
		invitation: expect.objectContaining({
			emails: [invitee.email],
			createdAt: expect.any(Date),
			role: "admin",
			newAccount: expect.any(Boolean),
		}),
	});
});
