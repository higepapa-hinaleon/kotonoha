<script setup lang="ts">
import type { Settings } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();
const { show } = useNotification();

const settings = ref<Settings | null>(null);
const loading = ref(true);
const saving = ref(false);

// フォーム
const formUrl = ref("");
const confidenceThreshold = ref(0.6);
const ragTopK = ref(5);
const systemPrompt = ref("");

async function fetchSettings() {
  loading.value = true;
  try {
    const data = await apiFetch<Settings>("/api/settings");
    settings.value = data;
    formUrl.value = data.googleFormUrl;
    confidenceThreshold.value = data.botConfig.confidenceThreshold;
    ragTopK.value = data.botConfig.ragTopK;
    systemPrompt.value = data.botConfig.systemPrompt;
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await apiFetch("/api/settings", {
      method: "PUT",
      body: {
        googleFormUrl: formUrl.value,
        botConfig: {
          confidenceThreshold: confidenceThreshold.value,
          ragTopK: ragTopK.value,
          systemPrompt: systemPrompt.value,
        },
      },
    });
    show("設定を保存しました", "success");
  } catch {
    // useApi が自動通知
  } finally {
    saving.value = false;
  }
}

onMounted(fetchSettings);
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-bold text-gray-900">設定</h1>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <form v-else class="max-w-2xl space-y-8" @submit.prevent="handleSave">
      <!-- Google Form URL -->
      <div class="rounded-lg border border-gray-200 bg-white p-5">
        <h2 class="mb-4 text-sm font-semibold text-gray-900">エスカレーション設定</h2>
        <div>
          <label class="block text-sm font-medium text-gray-700">Google フォーム URL</label>
          <input
            v-model="formUrl"
            type="url"
            class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="https://docs.google.com/forms/d/e/..."
          />
          <p class="mt-1 text-xs text-gray-400">サービスごとに未設定の場合のデフォルトURLです</p>
        </div>
      </div>

      <!-- ボット設定 -->
      <div class="rounded-lg border border-gray-200 bg-white p-5">
        <h2 class="mb-4 text-sm font-semibold text-gray-900">ボット設定</h2>
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="block text-sm font-medium text-gray-700">確信度しきい値</label>
              <input
                v-model.number="confidenceThreshold"
                type="number"
                min="0"
                max="1"
                step="0.05"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p class="mt-1 text-xs text-gray-400">
                この値未満の場合、自動エスカレーションします (0〜1)
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">RAG 検索件数 (Top K)</label>
              <input
                v-model.number="ragTopK"
                type="number"
                min="1"
                max="20"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <p class="mt-1 text-xs text-gray-400">回答生成時に参照するチャンク数 (1〜20)</p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">システムプロンプト</label>
            <textarea
              v-model="systemPrompt"
              rows="5"
              class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="AIアシスタントへの指示を入力..."
            />
            <p class="mt-1 text-xs text-gray-400">AIの応答方針を制御するプロンプトです</p>
          </div>
        </div>
      </div>

      <!-- 保存ボタン -->
      <div>
        <button
          type="submit"
          :disabled="saving"
          class="rounded-md bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {{ saving ? "保存中..." : "設定を保存" }}
        </button>
      </div>
    </form>
  </div>
</template>
