export const AUTH_COOKIE_NAME = "account_register_auth";
export const AUTH_COOKIE_VALUE = "account-register-admin-session";
export const AUTH_USERNAME = "admin";
export const AUTH_PASSWORD = "admin@123";

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12
};
