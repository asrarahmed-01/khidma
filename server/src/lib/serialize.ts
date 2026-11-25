import type { User } from "../generated/prisma/client";

/** The user fields that are safe to send to the owner of the account. */
export function toSelf(user: User) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    locale: user.locale,
    createdAt: user.createdAt,
  };
}

/** What another party on a booking may see about a user. */
export function toContact(user: Pick<User, "id" | "name" | "phone">) {
  return { id: user.id, name: user.name, phone: user.phone };
}
