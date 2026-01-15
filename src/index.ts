import { type BetterAuthPlugin } from "better-auth";
import { resolveInviteOptions } from "./utils";
import { ERROR_CODES, type InviteOptions } from "./types";
import type { HookEndpointContext } from "better-auth";
import { activateInvite, activateInviteCallback, createInvite } from "./routes";
import { invitesHook } from "./hooks";
import { schema } from "./schema";
import { mergeSchema } from "better-auth/db";

export const invite = <O extends InviteOptions>(opts: O) => {
  const options = resolveInviteOptions(opts);

  return {
    id: "invite",
    endpoints: {
      createInvite: createInvite(options),
      activateInvite: activateInvite(options),
      activateInviteCallback: activateInviteCallback(options),
    },
    hooks: {
      after: [invitesHook(options)],
    },
    $ERROR_CODES: ERROR_CODES,
    schema: mergeSchema(schema, opts.schema),
  } satisfies BetterAuthPlugin;
};

export * from "./client";
