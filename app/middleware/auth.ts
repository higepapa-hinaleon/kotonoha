export default defineNuxtRouteMiddleware(async (to) => {
  const { user, initializing, isSystemAdmin, hasConsent, hasOrganization } = useAuth();

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

  // 無所属ユーザー（organizationId が空）は利用申し込みまたは待機画面へ
  // apply / pending / consent / terms / privacy ページ自体へのアクセスは許可
  const unaffiliatedAllowedPaths = ["/apply", "/pending", "/consent", "/terms", "/privacy"];
  if (!hasOrganization.value && !isSystemAdmin.value && !unaffiliatedAllowedPaths.includes(to.path)) {
    return navigateTo("/apply");
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
