import { test, expect } from "@playwright/test";

test.describe("管理者フロー", () => {
  const adminPages = [
    { path: "/admin", name: "ダッシュボード" },
    { path: "/admin/services", name: "サービス管理" },
    { path: "/admin/documents", name: "ドキュメント管理" },
    { path: "/admin/conversations", name: "会話一覧" },
    { path: "/admin/improvements", name: "改善要望管理" },
    { path: "/admin/faqs", name: "FAQ管理" },
    { path: "/admin/reports", name: "週次レポート" },
    { path: "/admin/settings", name: "設定" },
  ];

  for (const { path, name } of adminPages) {
    test(`${name}ページ (${path}) が存在する`, async ({ page }) => {
      const response = await page.goto(path);

      // ページが存在する（404でない）
      expect(response?.status()).not.toBe(404);
    });
  }
});
