<script setup lang="ts">
const props = defineProps<{
  id: string;
  alt: string;
  height?: string;
}>();

const hasError = ref(false);
const src = computed(() => `/images/manual/screenshot-${props.id}.png`);
</script>

<template>
  <div class="mb-4">
    <img
      v-if="!hasError"
      :src="src"
      :alt="alt"
      class="max-w-full rounded-lg border border-gray-200"
      @error="hasError = true"
    />
    <div
      v-else
      :class="height ?? 'h-48'"
      class="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50"
    >
      <p class="text-sm text-gray-400">[スクリーンショット: {{ alt }}]</p>
    </div>
  </div>
</template>
