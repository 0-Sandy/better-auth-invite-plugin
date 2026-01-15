import type { BetterAuthClientPlugin } from "better-auth";
import type { invite } from ".";

export const inviteClient = () => {
  return {
    id: "invite",
    $InferServerPlugin: {} as ReturnType<typeof invite>,
  } satisfies BetterAuthClientPlugin;
};
