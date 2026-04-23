<script setup lang="ts">
definePageMeta({ layout: false, middleware: [] });

const { user, initializing } = useAuth();

// 認証状態の監視: 認証済みなら /admin、未認証なら /login へリダイレクト
watch(
  [() => user.value, () => initializing.value],
  async ([u, init]) => {
    if (init) return;
    if (u) {
      await navigateTo("/admin");
    } else {
      await navigateTo("/login");
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
    <div class="text-center">
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
      <p class="mt-3 text-sm text-gray-500">リダイレクト中...</p>
    </div>
  </div>
</template>
