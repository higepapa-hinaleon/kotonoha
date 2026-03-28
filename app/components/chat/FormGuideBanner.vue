<script setup lang="ts">
defineProps<{
  formUrl: string;
}>();
</script>

<template>
  <div v-if="formUrl" class="border-t border-gray-200 bg-gray-50 px-4 py-2">
    <a
      :href="formUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-primary-600"
    >
      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      解決しない場合は お問い合わせフォーム へ
    </a>
  </div>
</template>
