import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin as adminPlugin, twoFactor } from "better-auth/plugins";
import { db } from "@/database/db";
import * as schema from "@/database/schema";
import { sendEmailVerification, sendPasswordReset } from "./mail";

export const auth = betterAuth({
	appName: "Better Invite Starter",
	database: drizzleAdapter(db, {
		provider: "pg",
		usePlural: true,
		schema,
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) =>
			void sendPasswordReset({ name: user.name, email: user.email, url }),
		maxPasswordLength: 64,
		minPasswordLength: 8,
	},
	emailVerification: {
		autoSignInAfterVerification: true,
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url }) =>
			void sendEmailVerification({ name: user.name, email: user.email, url }),
	},
	socialProviders: {
		github: {
			clientId: process.env.GITHUB_CLIENT_ID as string,
			clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
		},
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID as string,
			clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
		},
	},
	plugins: [twoFactor(), adminPlugin()],
});
