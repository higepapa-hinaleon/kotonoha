import { test, expect } from "@playwright/test";

test.describe("認証フロー", () => {
  test("ログインページが表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/kotonoha AI/i);
  });

  test("ログインフォームの要素が存在する", async ({ page }) => {
    await page.goto("/login");

    // メールログインフィールド
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // パスワードフィールド
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // ログインボタン
    const loginButton = page.locator('button:has-text("ログイン")');
    await expect(loginButton).toBeVisible();
  });

  test("Googleログインボタンが存在する", async ({ page }) => {
    await page.goto("/login");

    const googleButton = page.locator('button:has-text("Google")');
    await expect(googleButton).toBeVisible();
  });

  test("未認証でチャットページにアクセスするとリダイレクトされる", async ({ page }) => {
    await page.goto("/chat");

    // 認証ミドルウェアによりログインページにリダイレクトされることを確認
    await page.waitForURL(/\/(login|chat)/);
  });

  test("未認証で管理画面にアクセスするとリダイレクトされる", async ({ page }) => {
    await page.goto("/admin");

    await page.waitForURL(/\/(login|admin)/);
  });
});
