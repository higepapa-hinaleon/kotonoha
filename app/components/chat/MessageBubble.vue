<script setup lang="ts">
import type { MessageSource } from "~~/shared/types/models";

defineProps<{
  role: "user" | "assistant";
  content: string;
  sources?: MessageSource[];
  confidence?: number | null;
  formUrl?: string;
  messageId?: string;
  feedback?: "positive" | "negative" | null;
}>();

const emit = defineEmits<{
  feedback: [value: "positive" | "negative"];
}>();

const showSources = ref(false);
</script>

<template>
  <div class="flex" :class="role === 'user' ? 'justify-end' : 'justify-start'">
    <div
      class="max-w-[85%] rounded-lg px-4 py-3 sm:max-w-[75%]"
      :class="
        role === 'user'
          ? 'bg-primary-600 text-white'
          : 'border border-gray-200 bg-white text-gray-900'
      "
    >
      <!-- メッセージ本文 -->
      <MarkdownContent v-if="role === 'assistant'" :content="content" />
      <div v-else class="whitespace-pre-wrap text-sm leading-relaxed">{{ content }}</div>

      <!-- アシスタントのみ: ソース + 確信度 -->
      <template v-if="role === 'assistant'">
        <!-- 参照元ドキュメント -->
        <div v-if="sources && sources.length > 0" class="mt-3 border-t border-gray-100 pt-2">
          <button
            class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            @click="showSources = !showSources"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            参照元 ({{ sources.length }}件)
            <svg
              class="h-3 w-3 transition-transform"
              :class="showSources ? 'rotate-180' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div v-if="showSources" class="mt-2 space-y-2">
            <div
              v-for="(source, i) in sources"
              :key="i"
              class="rounded-md bg-gray-50 px-3 py-2 text-xs"
            >
              <div class="font-medium text-gray-700">{{ source.documentTitle }}</div>
              <div class="mt-1 text-gray-500">{{ source.chunkContent }}...</div>
              <div class="mt-1 text-gray-400">
                類似度: {{ (source.similarity * 100).toFixed(0) }}%
              </div>
            </div>
          </div>
        </div>

        <!-- 確信度が低い場合のフォーム案内 -->
        <div v-if="formUrl" class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>より詳しいサポートが必要な場合は、こちらからお問い合わせください：</p>
          <a
            :href="formUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-flex items-center gap-1 font-medium text-amber-700 underline hover:text-amber-900"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            お問い合わせフォーム
          </a>
        </div>

        <!-- フィードバック -->
        <div v-if="messageId" class="mt-3 border-t border-gray-100 pt-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">この回答は役に立ちましたか？</span>
            <button
              aria-label="この回答は役に立った"
              class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
              :class="
                feedback === 'positive'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
              "
              :disabled="!!feedback"
              @click="emit('feedback', 'positive')"
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"
                />
              </svg>
              はい
            </button>
            <button
              aria-label="この回答は役に立たなかった"
              class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
              :class="
                feedback === 'negative'
                  ? 'bg-red-100 text-red-700'
                  : 'text-gray-400 hover:bg-red-50 hover:text-red-600'
              "
              :disabled="!!feedback"
              @click="emit('feedback', 'negative')"
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"
                />
              </svg>
              いいえ
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
