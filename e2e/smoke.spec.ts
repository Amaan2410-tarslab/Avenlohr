import { expect, test } from "@playwright/test";

test("home page exposes primary navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Talent intelligence. Human decisions." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Join Avenlo" })).toHaveAttribute("href", "/join");
});

test("login page exposes accessible credentials and recovery", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
});

test("join page only offers public account roles", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Build your place in the talent network." })).toBeVisible();
  const accountType = page.getByLabel("Account type");
  await expect(accountType.locator("option")).toHaveCount(2);
  await expect(accountType.locator("option[value='candidate']")).toHaveCount(1);
  await expect(accountType.locator("option[value='company']")).toHaveCount(1);
  await expect(accountType.locator("option[value='staff']")).toHaveCount(0);
  await expect(accountType.locator("option[value='founder']")).toHaveCount(0);
});

test("account recovery and suspension pages render", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();

  await page.goto("/account-suspended");
  await expect(page.getByRole("heading", { name: /access is temporarily suspended/ })).toBeVisible();
});
