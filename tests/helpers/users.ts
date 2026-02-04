import type { DBAdapter } from "better-auth";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { createAccessControl } from "better-auth/plugins";
import {
	adminAc,
	defaultStatements,
	userAc,
} from "better-auth/plugins/admin/access";

export const statement = { ...defaultStatements } as const;
export const ac = createAccessControl(statement);
export const user = ac.newRole({ ...userAc.statements });
export const admin = ac.newRole({ ...userAc.statements });
export const owner = ac.newRole({ ...adminAc.statements });

export const createUser = async (
	user: {
		email: string;
		role: string;
		name: string;
		password: string;
	},
	db: DBAdapter,
) => {
	const { id: userId } = await db.create({
		model: "user",
		data: user,
	});
	await db.create({
		model: "account",
		data: {
			password: await hashPassword(user.password),
			accountId: generateRandomString(16),
			providerId: "credential",
			userId,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
};
