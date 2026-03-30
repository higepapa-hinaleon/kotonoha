<script setup lang="ts">
import { PLAN_LIST, type PlanId } from "~~/shared/plans";
import type { OrganizationType, PaymentMethod } from "~~/shared/types/models";
import type { ApplicationSubmitRequest } from "~~/shared/types/api";

definePageMeta({ layout: false, middleware: [] });

const { initializing, isAuthenticated, hasOrganization } = useAuth();
const { apiFetch } = useApi();
const { show } = useNotification();

// --- Auth guard & redirect logic ---
const hasPendingApplication = ref(false);
const checkingApplication = ref(true);

watch(
  [() => initializing.value, () => isAuthenticated.value],
  async ([init, authed]) => {
    if (init) return;
    if (!authed) {
      await navigateTo("/login");
      return;
    }
    if (hasOrganization.value) {
      await navigateTo("/admin");
      return;
    }
    // Check pending application
    try {
      const res = await apiFetch<{ status: string } | null>("/api/applications/mine");
      if (res && res.status === "pending") {
        hasPendingApplication.value = true;
        await navigateTo("/pending");
        return;
      }
    } catch {
      // No existing application — continue
    }
    checkingApplication.value = false;
  },
  { immediate: true },
);

// --- Form state ---
const organizationType = ref<OrganizationType>("individual");
const contactName = ref("");
const address = ref("");
const phone = ref("");
const tradeName = ref("");
const organizationName = ref("");
const representativeName = ref("");
const corporateNumber = ref("");
const selectedPlanId = ref<PlanId>("free");
const paymentMethod = ref<PaymentMethod>("none");
const agreeTerms = ref(false);
const agreePrivacy = ref(false);
const submitting = ref(false);

// --- Computed ---
const selectedPlan = computed(() => PLAN_LIST.find((p) => p.id === selectedPlanId.value));
const isPaidPlan = computed(
  () => selectedPlan.value && selectedPlan.value.priceMonthly > 0,
);
const isEnterprise = computed(() => selectedPlanId.value === "enterprise");

const resolvedOrganizationName = computed(() => {
  if (organizationType.value === "corporation") return organizationName.value;
  if (organizationType.value === "sole_proprietor") return tradeName.value;
  return contactName.value;
});

const canSubmit = computed(() => {
  if (!contactName.value.trim()) return false;
  if (!address.value.trim()) return false;
  if (!phone.value.trim()) return false;
  if (organizationType.value === "sole_proprietor" && !tradeName.value.trim()) return false;
  if (organizationType.value === "corporation" && !organizationName.value.trim()) return false;
  if (organizationType.value === "corporation" && !representativeName.value.trim()) return false;
  if (isEnterprise.value) return false;
  if (!agreeTerms.value || !agreePrivacy.value) return false;
  if (isPaidPlan.value && paymentMethod.value === "none") return false;
  return true;
});

// --- Plan selection ---
function selectPlan(planId: PlanId) {
  selectedPlanId.value = planId;
  // Reset payment method when switching plans
  if (planId === "free" || planId === "enterprise") {
    paymentMethod.value = "none";
  } else if (paymentMethod.value === "none") {
    paymentMethod.value = "stripe";
  }
}

// --- Submit ---
async function handleSubmit() {
  if (!canSubmit.value || submitting.value) return;

  submitting.value = true;
  try {
    const body: ApplicationSubmitRequest = {
      organizationType: organizationType.value,
      organizationName: resolvedOrganizationName.value,
      contactName: contactName.value.trim(),
      address: address.value.trim(),
      phone: phone.value.trim(),
      planId: selectedPlanId.value,
      paymentMethod: isPaidPlan.value ? paymentMethod.value : "none",
    };

    if (organizationType.value === "sole_proprietor") {
      body.tradeName = tradeName.value.trim();
    }
    if (organizationType.value === "corporation") {
      body.representativeName = representativeName.value.trim();
      if (corporateNumber.value.trim()) {
        body.corporateNumber = corporateNumber.value.trim();
      }
    }

    const res = await apiFetch<{
      application: unknown;
      autoApproved?: boolean;
      checkoutUrl?: string;
    }>("/api/applications", {
      method: "POST",
      body,
    });

    if (res.autoApproved) {
      show("申請が承認されました。管理画面に移動します。", "success");
      await navigateTo("/admin");
    } else if (res.checkoutUrl) {
      window.location.href = res.checkoutUrl;
    } else {
      await navigateTo("/pending");
    }
  } catch {
    // Error already handled by useApi
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4">
    <!-- Loading -->
    <div
      v-if="initializing || checkingApplication"
      class="flex min-h-[60vh] items-center justify-center"
    >
      <div class="text-center">
        <svg
          class="mx-auto h-8 w-8 animate-spin text-primary-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
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
        <p class="mt-3 text-sm text-gray-500">読み込み中...</p>
      </div>
    </div>

    <!-- Form -->
    <div v-else class="mx-auto max-w-2xl">
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-primary-600">kotonoha AI Support</h1>
        <p class="mt-2 text-gray-600">利用申請フォーム</p>
      </div>

      <form class="space-y-8" @submit.prevent="handleSubmit">
        <!-- Section 1: 契約者区分 -->
        <div class="rounded-lg bg-white p-6 shadow-md">
          <h2 class="mb-4 text-lg font-semibold text-gray-800">契約者区分</h2>
          <div class="flex flex-wrap gap-4">
            <label
              v-for="opt in ([
                { value: 'individual', label: '個人' },
                { value: 'sole_proprietor', label: '個人事業主' },
                { value: 'corporation', label: '法人' },
              ] as const)"
              :key="opt.value"
              class="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 transition-colors"
              :class="
                organizationType === opt.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              "
            >
              <input
                v-model="organizationType"
                type="radio"
                name="organizationType"
                :value="opt.value"
                class="sr-only"
              />
              {{ opt.label }}
            </label>
          </div>
        </div>

        <!-- Section 2: 契約者情報 -->
        <div class="rounded-lg bg-white p-6 shadow-md">
          <h2 class="mb-4 text-lg font-semibold text-gray-800">契約者情報</h2>
          <div class="space-y-4">
            <!-- 法人名 (corporation only) -->
            <div v-if="organizationType === 'corporation'">
              <label for="orgName" class="block text-sm font-medium text-gray-700">
                法人名 <span class="text-red-500">*</span>
              </label>
              <input
                id="orgName"
                v-model="organizationName"
                type="text"
                required
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="株式会社サンプル"
              />
            </div>

            <!-- 屋号 (sole_proprietor only) -->
            <div v-if="organizationType === 'sole_proprietor'">
              <label for="tradeName" class="block text-sm font-medium text-gray-700">
                屋号 <span class="text-red-500">*</span>
              </label>
              <input
                id="tradeName"
                v-model="tradeName"
                type="text"
                required
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="サンプル商店"
              />
            </div>

            <!-- 代表者名 (corporation only) -->
            <div v-if="organizationType === 'corporation'">
              <label for="repName" class="block text-sm font-medium text-gray-700">
                代表者名 <span class="text-red-500">*</span>
              </label>
              <input
                id="repName"
                v-model="representativeName"
                type="text"
                required
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="山田 太郎"
              />
            </div>

            <!-- 法人番号 (corporation only, optional) -->
            <div v-if="organizationType === 'corporation'">
              <label for="corpNum" class="block text-sm font-medium text-gray-700">
                法人番号
              </label>
              <input
                id="corpNum"
                v-model="corporateNumber"
                type="text"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="1234567890123"
              />
            </div>

            <!-- 担当者名 (all types) -->
            <div>
              <label for="contactName" class="block text-sm font-medium text-gray-700">
                担当者名 <span class="text-red-500">*</span>
              </label>
              <input
                id="contactName"
                v-model="contactName"
                type="text"
                required
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="山田 太郎"
              />
            </div>

            <!-- 住所 -->
            <div>
              <label for="address" class="block text-sm font-medium text-gray-700">
                住所 <span class="text-red-500">*</span>
              </label>
              <input
                id="address"
                v-model="address"
                type="text"
                required
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="東京都渋谷区..."
              />
            </div>

            <!-- 電話番号 -->
            <div>
              <label for="phone" class="block text-sm font-medium text-gray-700">
                電話番号 <span class="text-red-500">*</span>
              </label>
              <input
                id="phone"
                v-model="phone"
                type="tel"
                required
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="03-1234-5678"
              />
            </div>
          </div>
        </div>

        <!-- Section 3: プラン選択 -->
        <div class="rounded-lg bg-white p-6 shadow-md">
          <h2 class="mb-4 text-lg font-semibold text-gray-800">プラン選択</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <button
              v-for="plan in PLAN_LIST"
              :key="plan.id"
              type="button"
              class="relative rounded-lg border-2 p-4 text-left transition-all"
              :class="[
                selectedPlanId === plan.id
                  ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                  : 'border-gray-200 bg-white hover:border-gray-300',
                plan.highlighted && selectedPlanId !== plan.id
                  ? 'border-primary-300'
                  : '',
              ]"
              @click="selectPlan(plan.id)"
            >
              <!-- Recommended badge -->
              <span
                v-if="plan.highlighted"
                class="absolute -top-2.5 right-3 rounded-full bg-primary-600 px-2 py-0.5 text-xs font-medium text-white"
              >
                おすすめ
              </span>

              <div class="mb-2 flex items-baseline justify-between">
                <h3 class="text-base font-semibold text-gray-900">{{ plan.displayName }}</h3>
                <span class="text-sm font-medium text-gray-700">
                  <template v-if="plan.priceMonthly === 0">無料</template>
                  <template v-else-if="plan.priceMonthly === -1">個別見積</template>
                  <template v-else>&#165;{{ plan.price }}/月</template>
                </span>
              </div>
              <p class="mb-3 text-xs text-gray-500">{{ plan.description }}</p>
              <ul class="space-y-1">
                <li
                  v-for="(feature, i) in plan.landingFeatures.slice(0, 4)"
                  :key="i"
                  class="flex items-start gap-1.5 text-xs text-gray-600"
                >
                  <svg
                    class="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ feature }}
                </li>
              </ul>
            </button>
          </div>

          <!-- Enterprise message -->
          <div
            v-if="isEnterprise"
            class="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800"
          >
            Enterpriseプランは個別見積となります。お問い合わせください。
            <br />
            <a href="mailto:support@kotonoha.ai" class="font-medium underline">
              support@kotonoha.ai
            </a>
          </div>
        </div>

        <!-- Section 4: 支払方法 (paid plans only) -->
        <div v-if="isPaidPlan && !isEnterprise" class="rounded-lg bg-white p-6 shadow-md">
          <h2 class="mb-4 text-lg font-semibold text-gray-800">支払方法</h2>
          <div class="flex flex-wrap gap-4">
            <label
              v-for="opt in ([
                { value: 'stripe', label: 'クレジットカード（Stripe）' },
                { value: 'bank_transfer', label: '銀行振込' },
              ] as const)"
              :key="opt.value"
              class="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 transition-colors"
              :class="
                paymentMethod === opt.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              "
            >
              <input
                v-model="paymentMethod"
                type="radio"
                name="paymentMethod"
                :value="opt.value"
                class="sr-only"
              />
              {{ opt.label }}
            </label>
          </div>
        </div>

        <!-- Section 5: 利用規約・プライバシーポリシー同意 -->
        <div class="rounded-lg bg-white p-6 shadow-md">
          <h2 class="mb-4 text-lg font-semibold text-gray-800">利用規約・プライバシーポリシー</h2>
          <div class="space-y-3">
            <label class="flex items-start gap-2 text-sm text-gray-700">
              <input
                v-model="agreeTerms"
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                <NuxtLink to="/terms" target="_blank" class="text-primary-600 underline hover:text-primary-700">
                  利用規約
                </NuxtLink>
                に同意する
              </span>
            </label>
            <label class="flex items-start gap-2 text-sm text-gray-700">
              <input
                v-model="agreePrivacy"
                type="checkbox"
                class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                <NuxtLink to="/privacy" target="_blank" class="text-primary-600 underline hover:text-primary-700">
                  プライバシーポリシー
                </NuxtLink>
                に同意する
              </span>
            </label>
          </div>
        </div>

        <!-- Submit -->
        <div class="text-center">
          <button
            type="submit"
            :disabled="!canSubmit || submitting"
            class="inline-flex items-center justify-center rounded-md bg-primary-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              v-if="submitting"
              class="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
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
            {{ submitting ? "送信中..." : "申請を送信" }}
          </button>
          <p v-if="!agreeTerms || !agreePrivacy" class="mt-2 text-xs text-gray-500">
            利用規約とプライバシーポリシーへの同意が必要です
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
