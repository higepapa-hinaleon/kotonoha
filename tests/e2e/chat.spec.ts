import { test, expect } from "@playwright/test";

test.describe("チャットフロー", () => {
  test("ログインページからアクセス可能", async ({ page }) => {
    await page.goto("/login");

    // ページが正常に読み込まれる
    await expect(page.locator("body")).toBeVisible();
  });

  test("チャット履歴ページのURLが存在する", async ({ page }) => {
    const response = await page.goto("/chat/history");

    // ページが存在する（404でない）
    expect(response?.status()).not.toBe(404);
  });
});
