<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const confirmButtonClass = computed(() => {
  if (props.variant === "danger") {
    return "bg-red-600 text-white hover:bg-red-700";
  }
  return "bg-primary-600 text-white hover:bg-primary-700";
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/75 p-4"
        @click.self="emit('cancel')"
      >
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
          <p class="mt-2 text-sm text-gray-600">{{ message }}</p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              @click="emit('cancel')"
            >
              {{ cancelLabel || "キャンセル" }}
            </button>
            <button
              class="rounded-md px-4 py-2 text-sm font-medium"
              :class="confirmButtonClass"
              @click="emit('confirm')"
            >
              {{ confirmLabel || "確認" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
