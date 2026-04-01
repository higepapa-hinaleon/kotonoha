export default defineNuxtRouteMiddleware(async (to) => {
  const { isAdmin, isSystemAdmin, hasOrganization, isPendingPayment, initializing, hasPendingApplication, fetchPendingApplication } = useAuth();

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

  // 入金待ちユーザー: /admin と /admin/contact のみ許可（role チェックをスキップ、システム管理者は除外）
  if (isPendingPayment.value && !isSystemAdmin.value) {
    if (to.path !== "/admin" && to.path !== "/admin/contact") {
      return navigateTo("/admin");
    }
    return;
  }

  // お問い合わせページは全ての認証済みユーザーがアクセス可能
  if (to.path === "/admin/contact") {
    return;
  }

  // 管理者でなければチャット画面へリダイレクト
  if (!isAdmin.value) {
    return navigateTo("/chat");
  }
});
