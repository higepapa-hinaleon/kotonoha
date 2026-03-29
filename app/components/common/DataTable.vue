<script setup lang="ts" generic="T extends Record<string, unknown>">
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  class?: string;
}

const props = defineProps<{
  columns: Column<T>[];
  items: T[];
  loading?: boolean;
  emptyMessage?: string;
}>();

defineEmits<{
  rowClick: [item: T];
}>();

const sortKey = ref<string>("");
const sortOrder = ref<"asc" | "desc">("asc");

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortOrder.value = "asc";
  }
}

const sortedItems = computed(() => {
  if (!sortKey.value) return props.items;

  return [...props.items].sort((a, b) => {
    const aVal = a[sortKey.value];
    const bVal = b[sortKey.value];
    const modifier = sortOrder.value === "asc" ? 1 : -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * modifier;
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * modifier;
    }
    return 0;
  });
});
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-gray-200">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
            :class="[col.class, col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : '']"
            @click="col.sortable && toggleSort(col.key)"
          >
            <div class="flex items-center gap-1">
              {{ col.label }}
              <span v-if="col.sortable && sortKey === col.key" class="text-primary-600">
                {{ sortOrder === "asc" ? "↑" : "↓" }}
              </span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white">
        <!-- ローディング -->
        <tr v-if="loading">
          <td :colspan="columns.length" class="px-4 py-12 text-center">
            <div class="flex items-center justify-center gap-2 text-gray-400">
              <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
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
              読み込み中...
            </div>
          </td>
        </tr>
        <!-- 空状態 -->
        <tr v-else-if="sortedItems.length === 0">
          <td :colspan="columns.length" class="px-4 py-12 text-center text-sm text-gray-400">
            {{ emptyMessage || "データがありません" }}
          </td>
        </tr>
        <!-- データ行 -->
        <tr
          v-for="(item, index) in sortedItems"
          v-else
          :key="index"
          class="cursor-pointer hover:bg-gray-50"
          @click="$emit('rowClick', item)"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="whitespace-nowrap px-4 py-3 text-sm text-gray-900"
            :class="col.class"
          >
            <slot :name="`cell-${col.key}`" :item="item" :value="item[col.key]">
              {{ item[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
