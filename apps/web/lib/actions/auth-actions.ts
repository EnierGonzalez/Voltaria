"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authenticateUser,
  changePassword,
  clearSessionCookieOptions,
  createUserSession,
  loadDatabaseEnv,
  logoutSession,
  SESSION_COOKIE_NAME
} from "@voltaria/db";
import { changePasswordSchema, loginSchema } from "@voltaria/shared";
import {
  getActionRequestMeta,
  getCurrentUser,
  getSessionCookieValue,
  withDbContext
} from "@/lib/auth";

loadDatabaseEnv();

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || "/dashboard"
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const meta = await getActionRequestMeta();
  const result = await withDbContext(async ({ db }) => {
    const authResult = await authenticateUser(db, parsed.data.email, parsed.data.password, meta);

    if (!authResult.ok) {
      return authResult;
    }

    const session = await createUserSession(db, authResult.user.id, meta);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, session.token, session.cookieOptions);

    return authResult;
  });

  if (!result.ok) {
    redirect("/login?error=invalid");
  }

  const nextPath = sanitizeNextPath(parsed.data.next);

  if (result.user.mustChangePassword) {
    redirect(`/change-password?next=${encodeURIComponent(nextPath)}`);
  }

  redirect(nextPath);
}

export async function logoutAction() {
  const token = await getSessionCookieValue();

  if (token) {
    await withDbContext(async ({ db }) => {
      await logoutSession(db, token);
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", clearSessionCookieOptions());
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const next = sanitizeNextPath(String(formData.get("next") || "/dashboard"));
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") || undefined,
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    redirect(`/change-password?error=weak&next=${encodeURIComponent(next)}`);
  }

  try {
    await withDbContext(async ({ db }) => {
      await changePassword(
        db,
        user.id,
        parsed.data.currentPassword,
        parsed.data.newPassword
      );
    });
  } catch {
    redirect(`/change-password?error=current&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

function sanitizeNextPath(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }

  if (path.startsWith("/login") || path.startsWith("/change-password")) {
    return "/dashboard";
  }

  return path;
}
