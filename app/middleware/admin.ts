export default defineNuxtRouteMiddleware(async () => {
  const { isAdmin, hasOrganization, initializing } = useAuth();

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

  // 無所属ユーザーは利用申し込みへ
  if (!hasOrganization.value) {
    return navigateTo("/apply");
  }

  // 管理者でなければチャット画面へリダイレクト
  if (!isAdmin.value) {
    return navigateTo("/chat");
  }
});
