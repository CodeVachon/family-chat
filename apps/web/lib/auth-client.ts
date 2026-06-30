"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "./auth";

export const authClient = createAuthClient({
    plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient(), passkeyClient()]
});

export const { signIn, signUp, signOut, useSession } = authClient;
