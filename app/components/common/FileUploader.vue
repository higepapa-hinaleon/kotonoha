<script setup lang="ts">
const props = defineProps<{
  accept?: string;
  maxSize?: number; // bytes
  multiple?: boolean;
}>();

const emit = defineEmits<{
  select: [file: File];
  selectMultiple: [files: File[]];
}>();

const dragOver = ref(false);
const error = ref("");
const fileInput = ref<HTMLInputElement>();

const acceptTypes = computed(() => props.accept || ".pdf,.md,.txt");
const maxSizeMB = computed(() => (props.maxSize || 10 * 1024 * 1024) / (1024 * 1024));

function validateFile(file: File): string | null {
  // 拡張子チェック
  const extensions = acceptTypes.value.split(",").map((s) => s.trim().toLowerCase());
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!extensions.includes(ext)) {
    return `対応形式: ${acceptTypes.value}`;
  }

  // サイズチェック
  const maxBytes = props.maxSize || 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    return `ファイルサイズは${maxSizeMB.value}MB以内にしてください`;
  }

  return null;
}

function validateAndEmit(file: File) {
  error.value = "";
  const validationError = validateFile(file);
  if (validationError) {
    error.value = validationError;
    return;
  }
  emit("select", file);
}

function validateAndEmitMultiple(files: File[]) {
  error.value = "";
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const validationError = validateFile(file);
    if (validationError) {
      errors.push(`${file.name}: ${validationError}`);
    } else {
      validFiles.push(file);
    }
  }

  if (errors.length > 0) {
    error.value = errors.join("\n");
  }

  if (validFiles.length > 0) {
    emit("selectMultiple", validFiles);
  }
}

function handleDrop(e: DragEvent) {
  dragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  if (props.multiple && files.length > 1) {
    validateAndEmitMultiple(Array.from(files));
  } else {
    const file = files[0];
    if (file) validateAndEmit(file);
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  if (props.multiple && files.length > 1) {
    validateAndEmitMultiple(Array.from(files));
  } else {
    const file = files[0];
    if (file) validateAndEmit(file);
  }
  target.value = "";
}
</script>

<template>
  <div>
    <div
      class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors"
      :class="dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="handleDrop"
      @click="fileInput?.click()"
    >
      <svg class="mb-2 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p class="text-sm text-gray-600">
        ファイルをドラッグ&ドロップ または <span class="text-primary-600">クリック</span>
      </p>
      <p class="mt-1 text-xs text-gray-400">
        {{ acceptTypes }} (最大{{ maxSizeMB }}MB)
        <template v-if="multiple"> - 複数選択可</template>
      </p>
    </div>
    <p v-if="error" class="mt-2 whitespace-pre-wrap text-sm text-red-600">{{ error }}</p>
    <input
      ref="fileInput"
      type="file"
      :accept="acceptTypes"
      :multiple="multiple"
      class="hidden"
      @change="handleFileSelect"
    />
  </div>
</template>
