<script setup lang="ts">
import { PLAN_LIST, type PlanId } from "~~/shared/plans";
import type { PaymentMethod } from "~~/shared/types/models";

const selectedPlanId = defineModel<PlanId>("selectedPlanId", { required: true });
const paymentMethod = defineModel<PaymentMethod>("paymentMethod", { required: true });

const selectedPlan = computed(() => PLAN_LIST.find((p) => p.id === selectedPlanId.value));
const isPaidPlan = computed(() => selectedPlan.value && selectedPlan.value.priceMonthly > 0);
const isEnterprise = computed(() => selectedPlanId.value === "enterprise");

function selectPlan(planId: PlanId) {
  selectedPlanId.value = planId;
  if (planId === "free" || planId === "enterprise") {
    paymentMethod.value = "none";
  } else if (paymentMethod.value === "none") {
    paymentMethod.value = "stripe";
  }
}

const isValid = computed(() => {
  if (isEnterprise.value) return false;
  if (isPaidPlan.value && paymentMethod.value === "none") return false;
  return true;
});

defineExpose({ isValid });
</script>

<template>
  <div class="space-y-6">
    <!-- プラン選択 -->
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
            plan.highlighted && selectedPlanId !== plan.id ? 'border-primary-300' : '',
          ]"
          @click="selectPlan(plan.id)"
        >
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

    <!-- 支払方法 (有料プランのみ) -->
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
  </div>
</template>
