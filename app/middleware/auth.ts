export default defineNuxtRouteMiddleware(async (to) => {
  const { user, initializing, isSystemAdmin, hasConsent } = useAuth();

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

  // 未認証ならログイン画面へ
  if (!user.value) {
    return navigateTo("/login");
  }

  // 利用規約・プライバシーポリシーへの同意チェック
  if (!hasConsent.value && to.path !== "/consent") {
    return navigateTo("/consent");
  }

  // グループ未割当チェック（no-group ページ自体へのアクセスは許可）
  if (to.path !== "/no-group") {
    const { hasGroups, activeGroupId } = useGroup();
    if (!hasGroups.value && !isSystemAdmin.value) {
      return navigateTo("/no-group");
    }
    // system_admin はグループ未割当でも全管理ページにアクセス可能
    // ただし activeGroupId もない場合、グループスコープページはシステム管理へリダイレクト
    if (
      isSystemAdmin.value &&
      !hasGroups.value &&
      !activeGroupId.value &&
      !to.path.startsWith("/admin/system")
    ) {
      return navigateTo("/admin/system/groups");
    }
  }
});
