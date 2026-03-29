<script setup lang="ts">
definePageMeta({ middleware: ["auth"] });

const { user, logout, isSystemAdmin } = useAuth();
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
      <div
        class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100"
      >
        <svg
          class="h-8 w-8 text-yellow-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>

      <h1 class="mb-2 text-xl font-bold text-gray-900">グループに未割当です</h1>
      <p class="mb-6 text-sm text-gray-500">
        システム管理者にグループへの割り当てを依頼してください。<br />
        割り当てが完了すると、ダッシュボードやチャット機能をご利用いただけます。
      </p>

      <p class="mb-4 text-xs text-gray-400">ログイン中: {{ user?.email }}</p>

      <div class="flex flex-col gap-2">
        <NuxtLink
          v-if="isSystemAdmin"
          to="/admin/system/groups"
          class="inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          グループ管理へ
        </NuxtLink>
        <button
          class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          @click="logout()"
        >
          ログアウト
        </button>
      </div>
    </div>
  </div>
</template>
