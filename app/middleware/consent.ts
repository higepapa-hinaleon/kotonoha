export default defineNuxtRouteMiddleware(async () => {
  const { user, initializing, hasConsent } = useAuth();

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

  // 未認証の場合はスキップ（auth middleware が処理する）
  if (!user.value) return;

  // 未同意の場合は同意画面へリダイレクト
  if (!hasConsent.value) {
    return navigateTo("/consent");
  }
});
