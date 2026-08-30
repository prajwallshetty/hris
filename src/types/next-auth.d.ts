import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    coordinatorId: string | null;
    clientId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      coordinatorId: string | null;
      clientId: string | null;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt.d.ts only re-exports `JWT` from @auth/core/jwt (`export *`)
// rather than declaring it locally, so augmenting "next-auth/jwt" directly
// does not merge — augment the module that actually declares the interface.
declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    coordinatorId: string | null;
    clientId: string | null;
  }
}
