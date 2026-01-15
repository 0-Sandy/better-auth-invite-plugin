import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import {
  ERROR_CODES,
  type NewInviteOptions,
  type InviteType,
  type InviteTypeWithId,
} from "./types";
import type { UserWithRole } from "better-auth/plugins";
import {
  getDate,
  redirectCallback,
  consumeInvite,
  redirectToAfterUpgrade,
  resolveInvitePayload,
  canUserCreateInvite,
  resolveTokenGenerator,
  redirectError,
  getCookieName,
} from "./utils";
import { createInviteBodySchema } from "./body";
import * as z from "zod";

export const createInvite = (options: NewInviteOptions) => {
  return createAuthEndpoint(
    "/invite/create",
    {
      method: "POST",
      body: createInviteBodySchema,
      use: [sessionMiddleware],
      metadata: {
        openapi: {
          operationId: "createInvitation",
          description: "Create an invitation",
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: {
                        type: "boolean",
                      },
                      message: {
                        type: "string",
                      },
                      token: {
                        type: "string",
                      },
                    },
                    required: ["status", "message"],
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const inviterUser = ctx.context.session.user as UserWithRole;

      const { email, role } = ctx.body;
      const {
        tokenType,
        redirectToAfterUpgrade,
        redirectToSignUp,
        redirectToSignIn,
        maxUses,
        expiresIn,
        shareInviterName,
        senderResponse,
        senderResponseRedirect,
      } = resolveInvitePayload(ctx.body, options);

      if (!canUserCreateInvite(options, inviterUser, { email, role })) {
        throw ctx.error("BAD_REQUEST", {
          message: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        });
      }

      let generateToken = resolveTokenGenerator(tokenType, options);

      const invitedUser =
        email &&
        (await ctx.context.internalAdapter.findUserByEmail(email, {
          includeAccounts: true,
        }));

      // If the user already exists they should sign in, else they should sign up
      const callbackURL = invitedUser ? redirectToSignIn : redirectToSignUp;
      const token = generateToken();
      const now = options.getDate();
      const expiresAt = getDate(expiresIn, "sec");

      await ctx.context.adapter.create({
        model: "invite",
        data: {
          token,
          createdByUserId: inviterUser.id,
          createdAt: now,
          expiresAt,
          maxUses,
          redirectToAfterUpgrade,
          shareInviterName,
          email,
          role,
        } satisfies InviteType,
      });

      const url = `${ctx.context.baseURL}/invite/${token}`;
      const redirectURLEmail = `${url}?callbackURL=${callbackURL}?`;

      // If an email is provided, send the invitation or role upgrade using the configured function
      if (email) {
        const sendFn = invitedUser
          ? options.sendUserRoleUpgrade ?? options.sendUserInvitation
          : options.sendUserInvitation;

        if (!sendFn) {
          throw ctx.error("INTERNAL_SERVER_ERROR", {
            message: "No invitation sending function configured",
          });
        }

        await sendFn(
          {
            email,
            role,
            url: redirectURLEmail,
            token,
          },
          ctx.request
        ).catch((e) => {
          ctx.context.logger.error("Error sending the invitation email", e);
        });

        return ctx.json({
          status: true,
          message: "The invitation was sent",
        });
      }

      const redirectTo =
        senderResponseRedirect === "signUp"
          ? redirectToSignUp
          : redirectToSignIn;
      const redirectURL = `${url}?callbackURL=${redirectTo}`;
      const returnToken = senderResponse === "token" ? token : redirectURL;

      return ctx.json({
        status: true,
        message: "The invitation token was generated",
        token: returnToken,
      });
    }
  );
};

/**
 * Can be used calling it form better auth
 * Ex: auth.api.activateInvite()
 */
export const activateInvite = (options: NewInviteOptions) => {
  return createAuthEndpoint(
    "/invite/activate",
    {
      method: "POST",
      body: z.object({
        /**
         * Where to redirect the user after sing in/up
         */
        callbackURL: z
          .string()
          .describe("Where to redirect the user after sing in/up"),
        /**
         * The invite token.
         */
        token: z.string().describe("The invite token"),
      }),
      metadata: {
        openapi: {
          operationId: "activateInvite",
          description:
            "Redirects the user to the callback URL with the token in a cookie",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              description: "The invitation token",
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const { token, callbackURL } = ctx.body;

      await activateInviteLogic({ ctx, options, token, callbackURL });
    }
  );
};

/**
 * Only used for invite links
 */
export const activateInviteCallback = (options: NewInviteOptions) => {
  return createAuthEndpoint(
    "/invite/:token",
    {
      method: "GET",
      query: z.object({
        /**
         * Where to redirect the user after sing in/up
         */
        callbackURL: z
          .string()
          .describe("Where to redirect the user after sing in/up"),
      }),
      metadata: {
        openapi: {
          operationId: "activateInviteCallback",
          description:
            "Redirects the user to the callback URL with the token in a cookie",
          parameters: [
            {
              name: "token",
              in: "path",
              required: true,
              description: "The invitation token",
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (ctx) => {
      const { token } = ctx.params;
      const { callbackURL } = ctx.query;

      await activateInviteLogic({ ctx, options, token, callbackURL });
    }
  );
};

const activateInviteLogic = async ({
  ctx,
  options,
  token,
  callbackURL,
}: {
  ctx: any;
  options: NewInviteOptions;
  token: string;
  callbackURL: string;
}) => {
  if (!token) {
    throw ctx.redirect(
      redirectError(ctx.context, callbackURL, { error: "INVALID_TOKEN" })
    );
  }

  const invite = (await ctx.context.adapter.findOne({
    model: "invite",
    where: [{ field: "token", value: token }],
  })) as InviteTypeWithId | null;

  if (invite === null) {
    throw ctx.redirect(
      redirectError(ctx.context, callbackURL, { error: "INVALID_TOKEN" })
    );
  }

  const timesUsed = await ctx.context.adapter.count({
    model: "invite_use",
    where: [{ field: "inviteId", value: invite.id }],
  });

  if (!(timesUsed < invite.maxUses)) {
    throw ctx.redirect(
      redirectError(ctx.context, callbackURL, { error: "INVALID_TOKEN" })
    );
  }

  if (options.getDate() > invite.expiresAt) {
    throw ctx.redirect(
      redirectError(ctx.context, callbackURL, { error: "INVALID_TOKEN" })
    );
  }

  const sessionObject = ctx.context.session;
  const session = sessionObject?.session;
  const userId = sessionObject?.user.id;
  const user = userId
    ? ((await ctx.context.internalAdapter.findUserById(userId)) as UserWithRole)
    : undefined;

  if (user) {
    // Upgrade existing user's role instead of redirecting if user already exists
    if (!session || !userId) {
      throw ctx.redirect(
        redirectError(ctx.context, callbackURL, {
          error: "INTERNAL_SERVER_ERROR",
        })
      );
    }

    await consumeInvite({
      ctx,
      invite,
      user,
      options,
      userId,
      timesUsed,
      token,
      session,
      newAccount: false,
    });

    await redirectToAfterUpgrade({
      shareInviterName: invite.shareInviterName,
      ctx,
      invite,
      signUp: true,
    });
  }

  // If user doesn't already exist, we set a cookie and redirect them to the sign in/up page

  // Get cookie name (customizable)
  const cookie = getCookieName({ ctx, options });

  ctx.setCookie(cookie, token, {
    httpOnly: true,
    path: "/",
    expires: invite.expiresAt,
  });

  // Redirects the user to sign in/up
  throw ctx.redirect(redirectCallback(ctx.context, callbackURL));
};
