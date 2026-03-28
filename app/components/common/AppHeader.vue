<script setup lang="ts">
const { user, isAdmin, isSystemAdmin, logout } = useAuth();
const route = useRoute();

const emit = defineEmits<{
  toggleSidebar: [];
}>();

const showUserMenu = ref(false);
const isAdminPage = computed(() => route.path.startsWith("/admin"));

function handleLogout() {
  showUserMenu.value = false;
  logout();
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-gray-200 bg-white">
    <div class="flex h-14 items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <!-- モバイル: サイドバートグル（管理者のみ） -->
        <button
          v-if="isAdmin"
          class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
          aria-label="メニューを開く"
          @click="emit('toggleSidebar')"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <NuxtLink
          :to="isAdmin ? '/admin' : '/chat'"
          class="text-lg font-bold text-primary-600"
        >
          kotonoha AI Support
        </NuxtLink>
      </div>

      <NuxtLink
        v-if="!user"
        to="/login"
        class="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
      >
        ログイン
      </NuxtLink>

      <div v-else class="relative flex items-center gap-2">
        <button
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          @click="showUserMenu = !showUserMenu"
        >
          <div class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700">
            {{ user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase() }}
          </div>
          <span class="hidden sm:inline">{{ user.displayName || user.email }}</span>
          <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- ドロップダウンメニュー -->
        <Transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <div
            v-if="showUserMenu"
            class="absolute right-0 top-full mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div class="border-b border-gray-100 px-4 py-2">
              <p class="text-sm font-medium text-gray-900">{{ user.displayName || user.email }}</p>
              <p class="text-xs text-gray-500">{{ user.email }}</p>
              <span
                class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                :class="isSystemAdmin ? 'bg-red-100 text-red-700' : isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'"
              >
                {{ isSystemAdmin ? "システム管理者" : isAdmin ? "管理者" : "メンバー" }}
              </span>
            </div>
            <NuxtLink
              v-if="isAdminPage"
              to="/chat"
              class="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click="showUserMenu = false"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              チャット
            </NuxtLink>
            <NuxtLink
              v-else-if="isAdmin"
              to="/admin"
              class="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click="showUserMenu = false"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              管理画面
            </NuxtLink>
            <button
              class="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click="handleLogout"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ログアウト
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <!-- メニュー外クリックで閉じる -->
    <div
      v-if="showUserMenu"
      class="fixed inset-0 z-[-1]"
      @click="showUserMenu = false"
    />
  </header>
</template>
