export default defineNuxtRouteMiddleware(async (to) => {
  const { isAdmin, hasOrganization, initializing, hasPendingApplication, fetchPendingApplication } = useAuth();

  // 認証状態の初期化完了を待つ
  if (initializing.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(initializing, (v) => {
        if (!v) {
          stop();
          resolve();
        }
      });
    });
  }

  // 無所属ユーザー: 承認待ち申請がある場合、/admin のみ許可
  if (!hasOrganization.value) {
    await fetchPendingApplication();
    if (hasPendingApplication.value) {
      // /admin ルートのみ許可、サブページは /admin へリダイレクト
      if (to.path !== "/admin") {
        return navigateTo("/admin");
      }
      return; // /admin へのアクセスを許可
    }
    return navigateTo("/apply");
  }

  // 管理者でなければチャット画面へリダイレクト
  if (!isAdmin.value) {
    return navigateTo("/chat");
  }
});
