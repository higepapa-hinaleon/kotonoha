<script setup lang="ts">
const props = defineProps<{
  status: string;
  size?: "sm" | "md";
}>();

const statusConfig: Record<string, { label: string; class: string }> = {
  // 会話ステータス
  active: { label: "進行中", class: "bg-blue-100 text-blue-700" },
  resolved_by_bot: { label: "解決済み", class: "bg-green-100 text-green-700" },
  escalated: { label: "エスカレーション", class: "bg-amber-100 text-amber-700" },
  closed: { label: "クローズ", class: "bg-gray-100 text-gray-600" },
  // ドキュメントステータス
  uploading: { label: "アップロード中", class: "bg-blue-100 text-blue-700" },
  processing: { label: "処理中", class: "bg-amber-100 text-amber-700" },
  ready: { label: "準備完了", class: "bg-green-100 text-green-700" },
  error: { label: "エラー", class: "bg-red-100 text-red-700" },
  // 改善要望ステータス
  open: { label: "未着手", class: "bg-gray-100 text-gray-600" },
  in_progress: { label: "対応中", class: "bg-blue-100 text-blue-700" },
  resolved: { label: "完了", class: "bg-green-100 text-green-700" },
  dismissed: { label: "却下", class: "bg-gray-100 text-gray-400" },
  // 優先度
  high: { label: "高", class: "bg-red-100 text-red-700" },
  medium: { label: "中", class: "bg-amber-100 text-amber-700" },
  low: { label: "低", class: "bg-gray-100 text-gray-600" },
  // 公開状態
  published: { label: "公開", class: "bg-green-100 text-green-700" },
  unpublished: { label: "非公開", class: "bg-gray-100 text-gray-600" },
};

const config = computed(() => statusConfig[props.status] || { label: props.status, class: "bg-gray-100 text-gray-600" });
const sizeClass = computed(() => (props.size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-xs"));
</script>

<template>
  <span
    class="inline-flex items-center rounded-full font-medium"
    :class="[config.class, sizeClass]"
  >
    {{ config.label }}
  </span>
</template>
