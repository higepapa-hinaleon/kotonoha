export default defineNuxtRouteMiddleware(async (to) => {
  const { user, initializing, isSystemAdmin, hasConsent, hasOrganization, isPendingPayment, hasPendingApplication, fetchPendingApplication } = useAuth();

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
  // apply ページでは consent を申込時に記録するため除外
  if (!hasConsent.value && to.path !== "/consent" && to.path !== "/apply") {
    return navigateTo("/consent");
  }

  // 無所属ユーザー（organizationId が空）の処理
  // apply / pending / consent / terms / privacy ページ自体へのアクセスは許可
  const unaffiliatedAllowedPaths = ["/apply", "/pending", "/consent", "/terms", "/privacy"];
  if (!hasOrganization.value && !isSystemAdmin.value && !unaffiliatedAllowedPaths.includes(to.path)) {
    // 承認待ち申請がある場合、/admin のみ許可（承認待ちビュー表示用）
    if (to.path === "/admin") {
      await fetchPendingApplication();
      if (hasPendingApplication.value) {
        return; // /admin へのアクセスを許可
      }
    }
    return navigateTo("/apply");
  }

  // 入金待ちユーザーの制限: /admin のみ許可
  if (isPendingPayment.value && !isSystemAdmin.value) {
    if (to.path !== "/admin") {
      return navigateTo("/admin");
    }
  }

  // グループ未割当チェック（no-group ページ自体へのアクセスは許可）
  if (to.path !== "/no-group" && hasOrganization.value) {
    const { hasGroups, activeGroupId } = useGroup();
    if (!hasGroups.value && !isSystemAdmin.value) {
      return navigateTo("/no-group");
    }
    // system_admin / org_admin はグループ未割当でも全管理ページにアクセス可能
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
