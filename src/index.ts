import type { BetterAuthPlugin } from "better-auth";
import { mergeSchema } from "better-auth/db";
import { ERROR_CODES } from "./constants";
import { invitesHooks } from "./hooks";
import {
	activateInvite,
	activateInviteCallback,
	cancelInvite,
	createInvite,
	getInvite,
	rejectInvite,
} from "./routes";
import { schema } from "./schema";
import type { InviteOptions } from "./types";
import { resolveInviteOptions } from "./utils";

export const invite = <O extends InviteOptions>(opts: O) => {
	const options = resolveInviteOptions(opts);

	return {
		id: "invite",
		endpoints: {
			createInvite: createInvite(options),
			activateInvite: activateInvite(options),
			activateInviteCallback: activateInviteCallback(options),
			cancelInvite: cancelInvite(options),
			getInvite: getInvite(options),
			rejectInvite: rejectInvite(options),
		},
		hooks: {
			...invitesHooks(options),
		},
		$ERROR_CODES: ERROR_CODES,
		schema: mergeSchema(schema, opts.schema),
	} satisfies BetterAuthPlugin;
};

export * from "./client";
