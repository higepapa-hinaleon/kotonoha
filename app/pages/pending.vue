<script setup lang="ts">
import type { Application } from "~~/shared/types/models";

definePageMeta({ layout: false, middleware: [] });

const { user, initializing, hasOrganization, getIdToken, logout } = useAuth();

const application = ref<Application | null>(null);
const loading = ref(true);
const error = ref("");
let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function fetchApplication() {
  try {
    const token = await getIdToken();
    const data = await $fetch<{ application: Application | null }>("/api/applications/mine", {
      headers: { Authorization: `Bearer ${token}` },
    });
    application.value = data.application;
    error.value = "";
  } catch {
    error.value = "申請情報の取得に失敗しました。";
  } finally {
    loading.value = false;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    fetchApplication();
  }, 30000);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 認証状態の監視
watch(
  [() => user.value, () => initializing.value],
  async ([u, init]) => {
    if (init) return;

    if (!u) {
      await navigateTo("/login");
      return;
    }

    if (hasOrganization.value) {
      await navigateTo("/admin");
      return;
    }

    await fetchApplication();
    startAutoRefresh();
  },
  { immediate: true },
);

// applicationの状態に応じたリダイレクト
watch(application, async (app) => {
  if (!app) return;

  if (app.status === "approved") {
    // 銀行振込の入金待ちはリダイレクトしない
    if (app.paymentMethod === "bank_transfer" && app.contractId) {
      // approvedでorg持ちなら/adminへ
      if (hasOrganization.value) {
        stopAutoRefresh();
        await navigateTo("/admin");
      }
      // bank_transfer で承認済みだが org 未所持 => 入金待ち表示のまま
      return;
    }

    // stripe / none の場合は即リダイレクト
    stopAutoRefresh();
    await navigateTo("/admin");
  }
});

// application が null（申請なし）の場合のリダイレクト
watch(
  [application, loading],
  ([app, isLoading]) => {
    if (!isLoading && app === null) {
      navigateTo("/apply");
    }
  },
);

onUnmounted(() => {
  stopAutoRefresh();
});

async function handleLogout() {
  stopAutoRefresh();
  await logout();
}

const statusDisplay = computed(() => {
  const app = application.value;
  if (!app) return null;

  if (app.status === "pending") {
    return {
      type: "pending" as const,
      title: "申請を受け付けました",
      message: "審査完了までお待ちください。",
    };
  }

  if (app.status === "approved" && app.paymentMethod === "bank_transfer") {
    return {
      type: "payment" as const,
      title: "申請が承認されました",
      message: "お振込みの確認をお待ちしています。",
    };
  }

  if (app.status === "rejected") {
    return {
      type: "rejected" as const,
      title: "申請が承認されませんでした",
      message: app.reviewNote || "審査の結果、今回はご利用いただけません。",
    };
  }

  return null;
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <!-- 初期化中 -->
    <div v-if="initializing || loading" class="text-center">
      <svg
        class="mx-auto h-8 w-8 animate-spin text-primary-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <p class="mt-3 text-sm text-gray-500">読み込み中...</p>
    </div>

    <!-- ステータス表示 -->
    <div
      v-else-if="statusDisplay"
      class="w-full max-w-md rounded-lg bg-white p-8 shadow-md"
    >
      <div class="text-center">
        <h1 class="mb-2 text-xl font-bold text-primary-600">kotonoha</h1>

        <!-- 審査待ち -->
        <template v-if="statusDisplay.type === 'pending'">
          <div class="mx-auto my-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg
              class="h-8 w-8 animate-spin text-yellow-500"
              style="animation-duration: 3s"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
          <h2 class="mb-2 text-lg font-semibold text-gray-900">{{ statusDisplay.title }}</h2>
          <p class="text-sm text-gray-600">{{ statusDisplay.message }}</p>
          <p class="mt-4 text-xs text-gray-400">ステータスは自動的に更新されます</p>
        </template>

        <!-- 入金待ち -->
        <template v-else-if="statusDisplay.type === 'payment'">
          <div class="mx-auto my-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <svg
              class="h-8 w-8 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
              />
            </svg>
          </div>
          <h2 class="mb-2 text-lg font-semibold text-gray-900">{{ statusDisplay.title }}</h2>
          <p class="text-sm text-gray-600">{{ statusDisplay.message }}</p>
          <p class="mt-4 text-xs text-gray-400">入金確認後、自動的にご利用いただけます</p>
        </template>

        <!-- 却下 -->
        <template v-else-if="statusDisplay.type === 'rejected'">
          <div class="mx-auto my-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              class="h-8 w-8 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 class="mb-2 text-lg font-semibold text-gray-900">{{ statusDisplay.title }}</h2>
          <p class="text-sm text-gray-600">{{ statusDisplay.message }}</p>
          <NuxtLink
            to="/apply"
            class="mt-6 inline-block rounded-md bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            再申請する
          </NuxtLink>
        </template>
      </div>

      <!-- ログアウトボタン -->
      <div class="mt-8 border-t border-gray-100 pt-4 text-center">
        <button
          class="text-sm text-gray-500 hover:text-gray-700"
          @click="handleLogout"
        >
          ログアウト
        </button>
      </div>
    </div>

    <!-- エラー表示 -->
    <div v-else-if="error" class="w-full max-w-md rounded-lg bg-white p-8 shadow-md text-center">
      <h1 class="mb-4 text-xl font-bold text-primary-600">kotonoha</h1>
      <div class="rounded-md bg-red-50 p-3 text-sm text-red-600">{{ error }}</div>
      <button
        class="mt-4 text-sm text-gray-500 hover:text-gray-700"
        @click="handleLogout"
      >
        ログアウト
      </button>
    </div>
  </div>
</template>
