<script setup lang="ts">
const props = defineProps<{
  mobileOpen?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const route = useRoute();
const { isAdmin, isSystemAdmin, hasOrganization, isPendingPayment, hasPendingApplication } =
  useAuth();
const { groups, currentGroup, activeGroupId, switchGroup } = useGroup();

const showGroupDropdown = ref(false);

async function handleGroupSwitch(groupId: string) {
  showGroupDropdown.value = false;
  await switchGroup(groupId);
  emit("close");
  await navigateTo("/admin");
}

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const adminNavItems: NavItem[] = [
  { label: "ダッシュボード", to: "/admin", icon: "dashboard" },
  { label: "サービス", to: "/admin/services", icon: "services" },
  { label: "ドキュメント", to: "/admin/documents", icon: "documents" },
  { label: "サポート履歴", to: "/admin/conversations", icon: "conversations" },
  { label: "改善要望", to: "/admin/improvements", icon: "improvements" },
  { label: "FAQ", to: "/admin/faqs", icon: "faqs" },
  { label: "教育モード", to: "/admin/learning", icon: "learning" },
  { label: "レポート", to: "/admin/reports", icon: "reports" },
  { label: "RAGテスト", to: "/admin/rag-test", icon: "rag-test" },
  { label: "ウィジェット設定", to: "/admin/widget-config", icon: "widget-config" },
  { label: "マニュアル", to: "/admin/manual", icon: "manual" },
];

const memberNavItems: NavItem[] = [{ label: "チャット", to: "/chat", icon: "chat" }];

const pendingNavItems: NavItem[] = [{ label: "ダッシュボード", to: "/admin", icon: "dashboard" }];

const navItems = computed(() => {
  if (!hasOrganization.value || isPendingPayment.value) return pendingNavItems;
  return isAdmin.value ? adminNavItems : memberNavItems;
});

const systemAdminItems: NavItem[] = [
  { label: "組織管理", to: "/admin/system/organizations", icon: "organizations" },
  { label: "グループ管理", to: "/admin/system/groups", icon: "groups" },
  { label: "ユーザー管理", to: "/admin/system/users", icon: "users" },
  { label: "申請管理", to: "/admin/system/applications", icon: "applications" },
];

const contactItem: NavItem = { label: "お問い合わせ", to: "/admin/contact", icon: "contact" };
const settingsItem: NavItem = { label: "設定", to: "/admin/settings", icon: "settings" };

function isActive(path: string) {
  if (path === "/admin") return route.path === "/admin";
  return route.path.startsWith(path);
}

function handleNavClick() {
  emit("close");
}

// ルート変更時にモバイルメニューを閉じる
watch(
  () => route.path,
  () => {
    emit("close");
  },
);
</script>

<template>
  <!-- モバイルオーバーレイ -->
  <Transition
    enter-active-class="transition-opacity ease-linear duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity ease-linear duration-300"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="props.mobileOpen"
      class="fixed inset-0 z-40 bg-gray-600/75 md:hidden"
      @click="emit('close')"
    />
  </Transition>

  <!-- モバイルサイドバー -->
  <Transition
    enter-active-class="transition ease-in-out duration-300 transform"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition ease-in-out duration-300 transform"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="props.mobileOpen"
      class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl md:hidden"
    >
      <div class="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        <span class="text-lg font-bold text-primary-600">メニュー</span>
        <button class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100" @click="emit('close')">
          <svg
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <!-- モバイル: グループセレクター（承認待ちユーザーには非表示） -->
      <div
        v-if="hasOrganization && !isPendingPayment"
        class="shrink-0 border-b border-gray-200 px-3 py-3"
      >
        <p class="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          グループ
        </p>
        <div
          v-if="groups.length <= 1"
          class="flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2"
        >
          <svg
            class="h-4 w-4 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span class="truncate text-sm font-medium text-primary-700">{{
            currentGroup?.name || "グループ未選択"
          }}</span>
        </div>
        <div v-else class="space-y-1">
          <button
            v-for="group in groups"
            :key="group.id"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
            :class="
              group.id === activeGroupId
                ? 'bg-primary-50 font-medium text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            "
            @click="handleGroupSwitch(group.id)"
          >
            <svg
              v-if="group.id === activeGroupId"
              class="h-4 w-4 shrink-0 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ group.name }}</span>
          </button>
        </div>
      </div>
      <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <ul class="flex-1 space-y-1">
          <li v-for="item in navItems" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
              :class="
                isActive(item.to)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              "
              @click="handleNavClick"
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
        <!-- システム管理セクション（承認待ちユーザーには非表示） -->
        <div
          v-if="isSystemAdmin && hasOrganization && !isPendingPayment"
          class="border-t border-gray-200 pt-2"
        >
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            システム管理
          </p>
          <ul class="space-y-1">
            <li v-for="item in systemAdminItems" :key="item.to">
              <NuxtLink
                :to="item.to"
                class="flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
                :class="
                  isActive(item.to)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                "
                @click="handleNavClick"
              >
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
        <div
          v-if="isAdmin && hasOrganization && !isPendingPayment"
          class="border-t border-gray-200 pt-2"
        >
          <NuxtLink
            :to="settingsItem.to"
            class="flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
            :class="
              isActive(settingsItem.to)
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100'
            "
            @click="handleNavClick"
          >
            {{ settingsItem.label }}
          </NuxtLink>
        </div>
        <div v-if="hasOrganization || !hasPendingApplication" class="border-t border-gray-200 pt-2">
          <NuxtLink
            :to="contactItem.to"
            class="flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
            :class="
              isActive(contactItem.to)
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100'
            "
            @click="handleNavClick"
          >
            {{ contactItem.label }}
          </NuxtLink>
        </div>
      </nav>
    </aside>
  </Transition>

  <!-- デスクトップサイドバー -->
  <aside
    class="hidden w-56 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white md:flex"
  >
    <!-- デスクトップ: グループセレクター（承認待ちユーザーには非表示） -->
    <div
      v-if="hasOrganization && !isPendingPayment"
      class="shrink-0 border-b border-gray-200 px-3 py-3"
    >
      <p class="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">グループ</p>
      <div
        v-if="groups.length <= 1"
        class="flex items-center gap-2 rounded-md bg-primary-50 px-3 py-2"
      >
        <svg
          class="h-4 w-4 text-primary-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span class="truncate text-sm font-medium text-primary-700">{{
          currentGroup?.name || "グループ未選択"
        }}</span>
      </div>
      <div v-else class="relative">
        <button
          class="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          @click="showGroupDropdown = !showGroupDropdown"
        >
          <svg
            class="h-4 w-4 shrink-0 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span class="flex-1 truncate text-left font-medium text-gray-900">{{
            currentGroup?.name || "グループ未選択"
          }}</span>
          <svg
            class="h-3 w-3 shrink-0 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <Transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <div
            v-if="showGroupDropdown"
            class="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            <button
              v-for="group in groups"
              :key="group.id"
              class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
              :class="
                group.id === activeGroupId ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
              "
              @click="handleGroupSwitch(group.id)"
            >
              <svg
                v-if="group.id === activeGroupId"
                class="h-4 w-4 shrink-0 text-primary-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span v-else class="h-4 w-4 shrink-0" />
              <span class="truncate">{{ group.name }}</span>
            </button>
          </div>
        </Transition>
        <div
          v-if="showGroupDropdown"
          class="fixed inset-0 z-40"
          @click="showGroupDropdown = false"
        />
      </div>
    </div>
    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
      <ul class="flex-1 space-y-1">
        <li v-for="item in navItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
            :class="
              isActive(item.to)
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-700 hover:bg-gray-100'
            "
          >
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
      <!-- システム管理セクション（承認待ちユーザーには非表示） -->
      <div
        v-if="isSystemAdmin && hasOrganization && !isPendingPayment"
        class="border-t border-gray-200 pt-2"
      >
        <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          システム管理
        </p>
        <ul class="space-y-1">
          <li v-for="item in systemAdminItems" :key="item.to">
            <NuxtLink
              :to="item.to"
              class="flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
              :class="
                isActive(item.to)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              "
            >
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </div>
      <div
        v-if="isAdmin && hasOrganization && !isPendingPayment"
        class="border-t border-gray-200 pt-2"
      >
        <NuxtLink
          :to="settingsItem.to"
          class="flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(settingsItem.to)
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-700 hover:bg-gray-100'
          "
        >
          {{ settingsItem.label }}
        </NuxtLink>
      </div>
      <div v-if="hasOrganization || !hasPendingApplication" class="border-t border-gray-200 pt-2">
        <NuxtLink
          :to="contactItem.to"
          class="flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(contactItem.to)
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-700 hover:bg-gray-100'
          "
        >
          {{ contactItem.label }}
        </NuxtLink>
      </div>
    </nav>
  </aside>
</template>
