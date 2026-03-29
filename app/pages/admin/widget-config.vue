<script setup lang="ts">
import type { Service } from "~~/shared/types/models";

definePageMeta({
  layout: "admin",
  middleware: ["auth", "admin"],
});

const { apiFetch } = useApi();

const services = ref<Service[]>([]);
const loading = ref(true);
const selectedServiceId = ref<string>("");
const copiedField = ref("");

async function fetchServices() {
  loading.value = true;
  try {
    services.value = await apiFetch<Service[]>("/api/services");
    if (services.value.length > 0 && !selectedServiceId.value) {
      selectedServiceId.value = services.value[0].id;
    }
  } catch {
    services.value = [];
  } finally {
    loading.value = false;
  }
}

const selectedService = computed(() =>
  services.value.find((s) => s.id === selectedServiceId.value) || null,
);

// 埋め込みコード生成
const baseUrl = computed(() => window.location.origin);

const scriptClose = "<" + "/script>";

const embedCodeScript = computed(() =>
  `<script type="module" src="${baseUrl.value}/embed/kotonoha-chat-widget.js">${scriptClose}`,
);

const embedCodeInline = computed(() => {
  if (!selectedService.value) return "";
  return `<!-- Kotonoha チャットウィジェット -->
<script type="module" src="${baseUrl.value}/embed/kotonoha-chat-widget.js">${scriptClose}
<kotonoha-chat-widget
  api-base-url="${baseUrl.value}"
  service-id="${selectedService.value.id}"
  placeholder="ご質問をどうぞ..."
></kotonoha-chat-widget>

<style>
  kotonoha-chat-widget {
    width: 400px;
    height: 600px;
  }
</style>`;
});

const embedCodeWithUser = computed(() => {
  if (!selectedService.value) return "";
  return `<!-- ユーザー情報付きウィジェット -->
<script type="module" src="${baseUrl.value}/embed/kotonoha-chat-widget.js">${scriptClose}
<kotonoha-chat-widget
  api-base-url="${baseUrl.value}"
  service-id="${selectedService.value.id}"
  placeholder="ご質問をどうぞ..."
  user-name="山田太郎"
  user-id="ext-user-123"
></kotonoha-chat-widget>

<style>
  kotonoha-chat-widget {
    width: 400px;
    height: 600px;
  }
</style>`;
});

const embedCodeThemed = computed(() => {
  if (!selectedService.value) return "";
  return `<!-- テーマカスタマイズ付きウィジェット -->
<script type="module" src="${baseUrl.value}/embed/kotonoha-chat-widget.js">${scriptClose}
<kotonoha-chat-widget
  api-base-url="${baseUrl.value}"
  service-id="${selectedService.value.id}"
  placeholder="何かお困りですか？"
></kotonoha-chat-widget>

<style>
  kotonoha-chat-widget {
    --kotonoha-primary: #0ea5e9;
    --kotonoha-primary-hover: #0284c7;
    --kotonoha-radius: 0.75rem;
    --kotonoha-font-size: 15px;
    width: 420px;
    height: 640px;
  }
</style>`;
});

const embedCodeIframe = computed(() => {
  if (!selectedService.value) return "";
  return `<!-- iframe 埋め込み（別オリジンでの利用時） -->
<iframe
  src="${baseUrl.value}/chat?serviceId=${selectedService.value.id}&embed=1"
  width="400"
  height="600"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  allow="clipboard-write"
></iframe>`;
});

// Widget属性一覧
const widgetAttributes = [
  { name: "api-base-url", required: true, description: "APIのベースURL", example: "https://your-domain.com" },
  { name: "service-id", required: true, description: "対象サービスのID", example: "abc123" },
  { name: "placeholder", required: false, description: "入力欄のプレースホルダー", example: "ご質問をどうぞ..." },
  { name: "user-name", required: false, description: "外部ユーザーの表示名（履歴に表示）", example: "山田太郎" },
  { name: "user-id", required: false, description: "外部ユーザーのID（履歴の識別用）", example: "ext-user-123" },
  { name: "auth-token", required: false, description: "Firebase認証トークン（認証済みユーザー向け）", example: "eyJhbG..." },
];

// CSSカスタムプロパティ一覧
const cssProperties = [
  { name: "--kotonoha-primary", default: "#2563eb", description: "プライマリカラー" },
  { name: "--kotonoha-primary-hover", default: "#1d4ed8", description: "プライマリカラー（ホバー時）" },
  { name: "--kotonoha-bg", default: "#ffffff", description: "背景色" },
  { name: "--kotonoha-bg-secondary", default: "#f9fafb", description: "セカンダリ背景色" },
  { name: "--kotonoha-border", default: "#e5e7eb", description: "ボーダー色" },
  { name: "--kotonoha-text", default: "#111827", description: "テキスト色" },
  { name: "--kotonoha-text-secondary", default: "#6b7280", description: "セカンダリテキスト色" },
  { name: "--kotonoha-text-on-primary", default: "#ffffff", description: "プライマリ上のテキスト色" },
  { name: "--kotonoha-radius", default: "0.5rem", description: "角丸の半径" },
  { name: "--kotonoha-font", default: "system-ui, -apple-system, sans-serif", description: "フォントファミリー" },
  { name: "--kotonoha-font-size", default: "14px", description: "フォントサイズ" },
];

async function copyToClipboard(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedField.value = field;
    setTimeout(() => { copiedField.value = ""; }, 2000);
  } catch {
    // フォールバック不要 — ブラウザがクリップボード非対応の場合は無視
  }
}

onMounted(fetchServices);
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-bold text-gray-900">ウィジェット設定</h1>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-400">読み込み中...</div>

    <div v-else-if="services.length === 0" class="rounded-lg border border-gray-200 px-4 py-12 text-center text-sm text-gray-400">
      サービスが登録されていません。先に<NuxtLink to="/admin/services" class="text-primary-600 hover:underline">サービス管理</NuxtLink>からサービスを作成してください。
    </div>

    <div v-else class="space-y-6">
      <!-- サービス選択 -->
      <div class="rounded-lg border border-gray-200 bg-white p-5">
        <h2 class="mb-3 text-sm font-semibold text-gray-900">対象サービス</h2>
        <select
          v-model="selectedServiceId"
          class="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option v-for="s in services" :key="s.id" :value="s.id">
            {{ s.name }}{{ s.isActive ? "" : "（無効）" }}
          </option>
        </select>
      </div>

      <template v-if="selectedService">
        <!-- サービス情報 -->
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="mb-3 text-sm font-semibold text-gray-900">サービス情報</h2>
          <dl class="grid gap-3 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-medium text-gray-500">サービスID</dt>
              <dd class="mt-0.5 flex items-center gap-2">
                <code class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">{{ selectedService.id }}</code>
                <button
                  class="text-xs text-primary-600 hover:text-primary-800"
                  @click="copyToClipboard(selectedService.id, 'serviceId')"
                >
                  {{ copiedField === "serviceId" ? "コピー済" : "コピー" }}
                </button>
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-gray-500">状態</dt>
              <dd class="mt-0.5">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="selectedService.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ selectedService.isActive ? "有効" : "無効" }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-gray-500">サービス名</dt>
              <dd class="mt-0.5 text-sm text-gray-900">{{ selectedService.name }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-gray-500">説明</dt>
              <dd class="mt-0.5 text-sm text-gray-900">{{ selectedService.description || "—" }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-gray-500">APIベースURL</dt>
              <dd class="mt-0.5 flex items-center gap-2">
                <code class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800">{{ baseUrl }}</code>
                <button
                  class="text-xs text-primary-600 hover:text-primary-800"
                  @click="copyToClipboard(baseUrl, 'baseUrl')"
                >
                  {{ copiedField === "baseUrl" ? "コピー済" : "コピー" }}
                </button>
              </dd>
            </div>
            <div v-if="selectedService.googleFormUrl">
              <dt class="text-xs font-medium text-gray-500">Google フォーム URL</dt>
              <dd class="mt-0.5 text-sm text-gray-900 break-all">{{ selectedService.googleFormUrl }}</dd>
            </div>
          </dl>
        </div>

        <!-- 埋め込みコードサンプル -->
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-gray-900">埋め込みコードサンプル</h2>

          <!-- 基本埋め込み -->
          <div class="mb-6">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-700">1. 基本埋め込み（Web Components）</h3>
              <button
                class="text-xs text-primary-600 hover:text-primary-800"
                @click="copyToClipboard(embedCodeInline, 'inline')"
              >
                {{ copiedField === "inline" ? "コピー済" : "コードをコピー" }}
              </button>
            </div>
            <p class="mb-2 text-xs text-gray-500">最もシンプルな導入方法です。HTMLに以下を貼り付けるだけで動作します。</p>
            <pre class="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"><code>{{ embedCodeInline }}</code></pre>
          </div>

          <!-- ユーザー情報付き -->
          <div class="mb-6">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-700">2. ユーザー情報付き埋め込み</h3>
              <button
                class="text-xs text-primary-600 hover:text-primary-800"
                @click="copyToClipboard(embedCodeWithUser, 'withUser')"
              >
                {{ copiedField === "withUser" ? "コピー済" : "コードをコピー" }}
              </button>
            </div>
            <p class="mb-2 text-xs text-gray-500">ログインユーザーの情報を渡すことで、管理画面のサポート履歴にユーザー名が表示されます。</p>
            <pre class="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"><code>{{ embedCodeWithUser }}</code></pre>
          </div>

          <!-- テーマカスタマイズ付き -->
          <div class="mb-6">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-700">3. テーマカスタマイズ付き</h3>
              <button
                class="text-xs text-primary-600 hover:text-primary-800"
                @click="copyToClipboard(embedCodeThemed, 'themed')"
              >
                {{ copiedField === "themed" ? "コピー済" : "コードをコピー" }}
              </button>
            </div>
            <p class="mb-2 text-xs text-gray-500">CSS Custom Properties を使って見た目をカスタマイズできます。</p>
            <pre class="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"><code>{{ embedCodeThemed }}</code></pre>
          </div>

          <!-- iframe 埋め込み -->
          <div>
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-700">4. iframe 埋め込み</h3>
              <button
                class="text-xs text-primary-600 hover:text-primary-800"
                @click="copyToClipboard(embedCodeIframe, 'iframe')"
              >
                {{ copiedField === "iframe" ? "コピー済" : "コードをコピー" }}
              </button>
            </div>
            <p class="mb-2 text-xs text-gray-500">Web Components が利用できない環境では iframe で埋め込めます。CSSカスタマイズは制限されます。</p>
            <pre class="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"><code>{{ embedCodeIframe }}</code></pre>
          </div>
        </div>

        <!-- 導入手順 -->
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-gray-900">導入手順</h2>
          <ol class="space-y-3 text-sm text-gray-700">
            <li class="flex gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">1</span>
              <div>
                <p class="font-medium">CORS設定の確認</p>
                <p class="mt-0.5 text-xs text-gray-500">環境変数 <code class="rounded bg-gray-100 px-1">NUXT_CORS_ALLOWED_ORIGINS</code> に埋め込み先のオリジンを追加してください（カンマ区切り）。</p>
              </div>
            </li>
            <li class="flex gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">2</span>
              <div>
                <p class="font-medium">ウィジェットスクリプトの読み込み</p>
                <p class="mt-0.5 text-xs text-gray-500">埋め込み先HTMLの <code class="rounded bg-gray-100 px-1">&lt;head&gt;</code> または <code class="rounded bg-gray-100 px-1">&lt;body&gt;</code> 末尾にスクリプトタグを追加します。</p>
                <pre class="mt-1 overflow-x-auto rounded bg-gray-100 p-2 text-xs text-gray-800"><code>{{ embedCodeScript }}</code></pre>
              </div>
            </li>
            <li class="flex gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">3</span>
              <div>
                <p class="font-medium">ウィジェットタグの配置</p>
                <p class="mt-0.5 text-xs text-gray-500">チャットを表示したい位置に <code class="rounded bg-gray-100 px-1">&lt;kotonoha-chat-widget&gt;</code> タグを配置し、必須属性を設定します。</p>
              </div>
            </li>
            <li class="flex gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">4</span>
              <div>
                <p class="font-medium">サイズとテーマの調整</p>
                <p class="mt-0.5 text-xs text-gray-500">CSSで <code class="rounded bg-gray-100 px-1">width</code> / <code class="rounded bg-gray-100 px-1">height</code> を指定し、必要に応じてCSS Custom Properties でテーマを調整します。</p>
              </div>
            </li>
            <li class="flex gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">5</span>
              <div>
                <p class="font-medium">動作確認</p>
                <p class="mt-0.5 text-xs text-gray-500">埋め込み先でウィジェットが表示され、質問に対してAIが応答することを確認してください。管理画面のサポート履歴にも会話が記録されます。</p>
              </div>
            </li>
          </ol>
        </div>

        <!-- 属性リファレンス -->
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-gray-900">属性リファレンス</h2>
          <!-- モバイル: カード -->
          <div class="space-y-3 md:hidden">
            <div
              v-for="attr in widgetAttributes"
              :key="attr.name"
              class="rounded-md border border-gray-100 bg-gray-50 p-3"
            >
              <div class="flex items-center gap-2">
                <code class="text-xs font-semibold text-gray-900">{{ attr.name }}</code>
                <span
                  v-if="attr.required"
                  class="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700"
                >必須</span>
              </div>
              <p class="mt-1 text-xs text-gray-600">{{ attr.description }}</p>
              <p class="mt-1 text-xs text-gray-400">例: {{ attr.example }}</p>
            </div>
          </div>
          <!-- PC: テーブル -->
          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">属性名</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">必須</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">説明</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">例</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-for="attr in widgetAttributes" :key="attr.name">
                  <td class="whitespace-nowrap px-3 py-2"><code class="text-xs">{{ attr.name }}</code></td>
                  <td class="px-3 py-2">
                    <span v-if="attr.required" class="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">必須</span>
                    <span v-else class="text-xs text-gray-400">任意</span>
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-600">{{ attr.description }}</td>
                  <td class="px-3 py-2"><code class="text-xs text-gray-500">{{ attr.example }}</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- CSSカスタムプロパティ -->
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-gray-900">CSS Custom Properties（テーマ変数）</h2>
          <p class="mb-3 text-xs text-gray-500">
            <code class="rounded bg-gray-100 px-1">kotonoha-chat-widget</code> セレクタに対してCSS変数を指定することで、ウィジェットの外観をカスタマイズできます。
          </p>
          <!-- モバイル: カード -->
          <div class="space-y-2 md:hidden">
            <div
              v-for="prop in cssProperties"
              :key="prop.name"
              class="rounded-md border border-gray-100 bg-gray-50 p-3"
            >
              <code class="text-xs font-semibold text-gray-900">{{ prop.name }}</code>
              <p class="mt-0.5 text-xs text-gray-600">{{ prop.description }}</p>
              <p class="mt-0.5 text-xs text-gray-400">デフォルト: <code>{{ prop.default }}</code></p>
            </div>
          </div>
          <!-- PC: テーブル -->
          <div class="hidden overflow-x-auto md:block">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">プロパティ名</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">デフォルト</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">説明</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr v-for="prop in cssProperties" :key="prop.name">
                  <td class="whitespace-nowrap px-3 py-2"><code class="text-xs">{{ prop.name }}</code></td>
                  <td class="px-3 py-2">
                    <span class="inline-flex items-center gap-1.5">
                      <span
                        v-if="prop.default.startsWith('#')"
                        class="inline-block h-3 w-3 rounded border border-gray-300"
                        :style="{ backgroundColor: prop.default }"
                      />
                      <code class="text-xs text-gray-500">{{ prop.default }}</code>
                    </span>
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-600">{{ prop.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Public API -->
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-semibold text-gray-900">JavaScript API</h2>
          <p class="mb-3 text-xs text-gray-500">ウィジェット要素を取得して、プログラムから操作できます。</p>
          <pre class="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100"><code>const widget = document.querySelector('kotonoha-chat-widget');

// 会話をリセット
widget.resetConversation();

// プログラムからメッセージを送信
await widget.send('パスワードをリセットしたい');</code></pre>
        </div>
      </template>
    </div>
  </div>
</template>
