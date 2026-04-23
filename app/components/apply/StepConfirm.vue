<script setup lang="ts">
import { PLAN_DEFINITIONS, type PlanId } from "~~/shared/plans";
import type { OrganizationType, PaymentMethod } from "~~/shared/types/models";

const props = defineProps<{
  email: string;
  organizationType: OrganizationType;
  contactName: string;
  phone: string;
  address: string;
  tradeName: string;
  organizationName: string;
  resolvedOrganizationName: string;
  representativeName: string;
  corporateNumber: string;
  selectedPlanId: PlanId;
  paymentMethod: PaymentMethod;
  termsVersion: string;
  privacyVersion: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (e: "submit"): void;
}>();

const orgTypeLabel = computed(() => {
  const map: Record<OrganizationType, string> = {
    individual: "個人",
    sole_proprietor: "個人事業主",
    corporation: "法人",
  };
  return map[props.organizationType];
});

const planName = computed(
  () => PLAN_DEFINITIONS[props.selectedPlanId]?.displayName ?? props.selectedPlanId,
);

const paymentMethodLabel = computed(() => {
  const map: Record<PaymentMethod, string> = {
    stripe: "クレジットカード（Stripe）",
    bank_transfer: "銀行振込",
    none: "なし",
  };
  return map[props.paymentMethod];
});
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg bg-white p-6 shadow-md">
      <h2 class="mb-4 text-lg font-semibold text-gray-800">最終確認</h2>
      <p class="mb-6 text-sm text-gray-600">
        入力内容をご確認ください。問題がなければ「申請を送信」ボタンを押してください。
      </p>

      <dl class="divide-y divide-gray-100">
        <!-- アカウント -->
        <div class="grid grid-cols-3 gap-4 py-3">
          <dt class="text-sm font-medium text-gray-500">メールアドレス</dt>
          <dd class="col-span-2 text-sm text-gray-900">{{ email }}</dd>
        </div>

        <!-- 契約者区分 -->
        <div class="grid grid-cols-3 gap-4 py-3">
          <dt class="text-sm font-medium text-gray-500">契約者区分</dt>
          <dd class="col-span-2 text-sm text-gray-900">{{ orgTypeLabel }}</dd>
        </div>

        <!-- 組織名 -->
        <div class="grid grid-cols-3 gap-4 py-3">
          <dt class="text-sm font-medium text-gray-500">組織名</dt>
          <dd class="col-span-2 text-sm text-gray-900">{{ props.resolvedOrganizationName }}</dd>
        </div>

        <!-- 個人: 氏名 + 電話番号 -->
        <template v-if="organizationType === 'individual'">
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">氏名</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ contactName }}</dd>
          </div>
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">電話番号</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ phone }}</dd>
          </div>
        </template>

        <!-- 個人事業主: 屋号 + 担当名 -->
        <template v-if="organizationType === 'sole_proprietor'">
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">屋号</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ tradeName }}</dd>
          </div>
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">担当名</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ contactName }}</dd>
          </div>
        </template>

        <!-- 法人: 会社名 + 住所 + 担当名 + 電話番号 + 代表者名 + 法人番号 -->
        <template v-if="organizationType === 'corporation'">
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">会社名</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ organizationName }}</dd>
          </div>
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">住所</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ address }}</dd>
          </div>
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">担当名</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ contactName }}</dd>
          </div>
          <div class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">電話番号</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ phone }}</dd>
          </div>
          <div v-if="representativeName" class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">代表者名</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ representativeName }}</dd>
          </div>
          <div v-if="corporateNumber" class="grid grid-cols-3 gap-4 py-3">
            <dt class="text-sm font-medium text-gray-500">法人番号</dt>
            <dd class="col-span-2 text-sm text-gray-900">{{ corporateNumber }}</dd>
          </div>
        </template>

        <!-- プラン -->
        <div class="grid grid-cols-3 gap-4 py-3">
          <dt class="text-sm font-medium text-gray-500">契約プラン</dt>
          <dd class="col-span-2 text-sm text-gray-900">{{ planName }}</dd>
        </div>

        <!-- 支払方法 -->
        <div v-if="paymentMethod !== 'none'" class="grid grid-cols-3 gap-4 py-3">
          <dt class="text-sm font-medium text-gray-500">支払方法</dt>
          <dd class="col-span-2 text-sm text-gray-900">{{ paymentMethodLabel }}</dd>
        </div>

        <!-- 利用規約・プライバシーポリシー同意 -->
        <div class="grid grid-cols-3 gap-4 py-3">
          <dt class="text-sm font-medium text-gray-500">規約同意</dt>
          <dd class="col-span-2 text-sm text-gray-900">
            利用規約 v{{ termsVersion }}、プライバシーポリシー v{{ privacyVersion }} に同意済み
          </dd>
        </div>
      </dl>
    </div>

    <!-- 送信ボタン -->
    <div class="text-center">
      <button
        type="button"
        :disabled="submitting"
        class="inline-flex items-center justify-center rounded-md bg-primary-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        @click="emit('submit')"
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
        {{ submitting ? "送信中..." : "確定して利用開始" }}
      </button>
    </div>
  </div>
</template>
