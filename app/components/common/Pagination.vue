<script setup lang="ts">
const props = defineProps<{
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}>();

const emit = defineEmits<{
  pageChange: [page: number];
}>();

const startItem = computed(() => (props.currentPage - 1) * props.itemsPerPage + 1);
const endItem = computed(() => Math.min(props.currentPage * props.itemsPerPage, props.totalItems));

const visiblePages = computed(() => {
  const pages: number[] = [];
  const total = props.totalPages;
  const current = props.currentPage;

  let start = Math.max(1, current - 2);
  let end = Math.min(total, current + 2);

  if (end - start < 4) {
    if (start === 1) end = Math.min(total, start + 4);
    else start = Math.max(1, end - 4);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});
</script>

<template>
  <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-gray-200 pt-4">
    <p class="text-sm text-gray-500">
      {{ totalItems }}件中 {{ startItem }}〜{{ endItem }}件
    </p>
    <nav class="flex gap-1">
      <button
        :disabled="currentPage <= 1"
        class="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
        @click="emit('pageChange', currentPage - 1)"
      >
        前へ
      </button>
      <button
        v-for="page in visiblePages"
        :key="page"
        class="rounded-md px-3 py-1.5 text-sm"
        :class="
          page === currentPage
            ? 'bg-primary-600 text-white'
            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
        "
        @click="emit('pageChange', page)"
      >
        {{ page }}
      </button>
      <button
        :disabled="currentPage >= totalPages"
        class="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
        @click="emit('pageChange', currentPage + 1)"
      >
        次へ
      </button>
    </nav>
  </div>
</template>
