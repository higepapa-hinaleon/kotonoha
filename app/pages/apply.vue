<script setup lang="ts">
import { PLAN_LIST, VALID_PLAN_IDS, type PlanId } from "~~/shared/plans";
import type { OrganizationType, PaymentMethod } from "~~/shared/types/models";
import type { ApplicationSubmitRequest } from "~~/shared/types/api";

definePageMeta({ layout: false, middleware: [] });

const route = useRoute();
const { initializing, isAuthenticated, hasOrganization, hasConsent, getIdToken, fetchUser, invalidatePendingApplicationCache } = useAuth();
const { apiFetch } = useApi();
const { show } = useNotification();

// --- Stepper ---
const STEPS = [
  { label: "アカウント" },
  { label: "基本情報" },
  { label: "プラン" },
  { label: "規約同意" },
  { label: "最終確認" },
];
const currentStep = ref(0);

function nextStep() {
  if (currentStep.value < STEPS.length - 1) currentStep.value++;
}
function prevStep() {
  // 認証済みの場合はステップ0（アカウント作成）に戻れない
  const minStep = isAuthenticated.value ? 1 : 0;
  if (currentStep.value > minStep) currentStep.value--;
}

// --- Auth guard & redirect logic ---
const hasPendingApplication = ref(false);
const checkingApplication = ref(true);
const accountCreated = ref(false);
const applicationSubmitted = ref(false);

// クエリパラメータからプラン初期値を取得
const queryPlan = route.query.plan as string | undefined;
const initialPlanId: PlanId = queryPlan && VALID_PLAN_IDS.includes(queryPlan as PlanId)
  ? (queryPlan as PlanId)
  : "free";

watch(
  [() => initializing.value, () => isAuthenticated.value],
  async ([init, authed]) => {
    if (init) return;
    if (!authed) {
      checkingApplication.value = false;
      return;
    }
    accountCreated.value = true;
    // 認証済みの場合、ステップ1（基本情報）へ
    if (currentStep.value === 0) {
      currentStep.value = 1;
    }
    if (hasOrganization.value) {
      await navigateTo("/admin");
      return;
    }
    // Check pending application
    try {
      const res = await apiFetch<{ application: { status: string } | null }>("/api/applications/mine");
      if (res?.application?.status === "pending") {
        hasPendingApplication.value = true;
        await navigateTo("/admin");
        return;
      }
    } catch {
      // No existing application — continue
    }
    checkingApplication.value = false;
  },
  { immediate: true },
);

// --- アカウント作成完了 ---
function onAccountCreated() {
  accountCreated.value = true;
  currentStep.value = 1;
}

// --- Form state ---
const organizationType = ref<OrganizationType>("individual");
const contactName = ref("");
const address = ref("");
const phone = ref("");
const tradeName = ref("");
const organizationName = ref("");
const representativeName = ref("");
const corporateNumber = ref("");
const selectedPlanId = ref<PlanId>(initialPlanId);
const paymentMethod = ref<PaymentMethod>("none");
const agreeTerms = ref(false);
const agreePrivacy = ref(false);
const submitting = ref(false);

// --- Legal document versions ---
const termsVersion = ref("1.0");
const privacyVersion = ref("1.0");

async function fetchLegalVersions() {
  try {
    const res = await $fetch<{
      terms: { version: string } | null;
      privacy: { version: string } | null;
    }>("/api/legal/current");
    if (res.terms) termsVersion.value = res.terms.version;
    if (res.privacy) privacyVersion.value = res.privacy.version;
  } catch {
    // フォールバック: デフォルト値を使用（シード未完了の場合）
  }
}

// --- Step component refs ---
const stepBasicInfoRef = ref<{ isValid: boolean } | null>(null);
const stepPlanRef = ref<{ isValid: boolean } | null>(null);
const stepTermsRef = ref<{ isValid: boolean } | null>(null);

// --- Per-step validation ---
const canProceedFromStep = computed(() => {
  switch (currentStep.value) {
    case 0: // Account - handled by StepAccount component
      return false; // Navigation handled by event
    case 1: // Basic Info
      return stepBasicInfoRef.value?.isValid ?? false;
    case 2: // Plan
      return stepPlanRef.value?.isValid ?? false;
    case 3: // Terms
      return stepTermsRef.value?.isValid ?? false;
    case 4: // Confirm - submit button handles this
      return true;
    default:
      return false;
  }
});

// --- Computed ---
const selectedPlan = computed(() => PLAN_LIST.find((p) => p.id === selectedPlanId.value));
const isPaidPlan = computed(
  () => selectedPlan.value && selectedPlan.value.priceMonthly > 0,
);

const resolvedOrganizationName = computed(() => {
  if (organizationType.value === "corporation") return organizationName.value;
  if (organizationType.value === "sole_proprietor") return tradeName.value || contactName.value;
  return `${contactName.value}の組織`;
});

// --- Beforeunload warning ---
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (accountCreated.value && !applicationSubmitted.value) {
    e.preventDefault();
  }
}

onMounted(() => {
  fetchLegalVersions();
  window.addEventListener("beforeunload", onBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener("beforeunload", onBeforeUnload);
});

// --- Submit ---
async function handleSubmit() {
  if (submitting.value) return;

  submitting.value = true;
  try {
    // consent 記録（未同意の場合のみ）
    if (!hasConsent.value) {
      const token = await getIdToken();
      await $fetch("/api/auth/consent", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: { consentVersion: termsVersion.value },
      });
      await fetchUser();
    }

    const body: ApplicationSubmitRequest = {
      organizationType: organizationType.value,
      organizationName: resolvedOrganizationName.value,
      contactName: contactName.value.trim(),
      planId: selectedPlanId.value,
      paymentMethod: isPaidPlan.value ? paymentMethod.value : "none",
      termsVersion: termsVersion.value,
      privacyVersion: privacyVersion.value,
    };

    // 組織区分別のフィールド追加
    if (organizationType.value === "individual") {
      body.phone = phone.value.trim();
    } else if (organizationType.value === "sole_proprietor") {
      body.tradeName = tradeName.value.trim();
    } else if (organizationType.value === "corporation") {
      body.address = address.value.trim();
      body.phone = phone.value.trim();
      if (representativeName.value.trim()) {
        body.representativeName = representativeName.value.trim();
      }
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

    applicationSubmitted.value = true;
    invalidatePendingApplicationCache();

    if (res.autoApproved) {
      show("申請が承認されました。管理画面に移動します。", "success");
      await fetchUser();
      await navigateTo("/admin");
    } else if (res.checkoutUrl) {
      window.location.href = res.checkoutUrl;
    } else {
      show("申請を受け付けました。", "success");
      await navigateTo("/admin");
    }
  } catch {
    // Error already handled by useApi
  } finally {
    submitting.value = false;
  }
}

// --- User email for confirmation step ---
const { user } = useAuth();
const userEmail = computed(() => user.value?.email ?? "");
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
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-bold text-primary-600">kotonoha AI Support</h1>
        <p class="mt-2 text-gray-600">利用申請フォーム</p>
      </div>

      <!-- Stepper -->
      <ApplyStepper :steps="STEPS" :current-step="currentStep" />

      <!-- Step 1: アカウント作成 -->
      <StepAccount
        v-if="currentStep === 0 && !isAuthenticated"
        @account-created="onAccountCreated"
      />

      <!-- Step 2: 基本情報 -->
      <template v-if="currentStep === 1">
        <StepBasicInfo
          ref="stepBasicInfoRef"
          v-model:organization-type="organizationType"
          v-model:contact-name="contactName"
          v-model:phone="phone"
          v-model:address="address"
          v-model:trade-name="tradeName"
          v-model:organization-name="organizationName"
          v-model:representative-name="representativeName"
          v-model:corporate-number="corporateNumber"
        />
      </template>

      <!-- Step 3: プラン選択 -->
      <template v-if="currentStep === 2">
        <StepPlan
          ref="stepPlanRef"
          v-model:selected-plan-id="selectedPlanId"
          v-model:payment-method="paymentMethod"
        />
      </template>

      <!-- Step 4: 利用規約・プライバシーポリシー -->
      <template v-if="currentStep === 3">
        <StepTerms
          ref="stepTermsRef"
          v-model:agree-terms="agreeTerms"
          v-model:agree-privacy="agreePrivacy"
          :terms-version="termsVersion"
          :privacy-version="privacyVersion"
        />
      </template>

      <!-- Step 5: 最終確認 -->
      <template v-if="currentStep === 4">
        <StepConfirm
          :email="userEmail"
          :organization-type="organizationType"
          :contact-name="contactName"
          :phone="phone"
          :address="address"
          :trade-name="tradeName"
          :organization-name="organizationName"
          :resolved-organization-name="resolvedOrganizationName"
          :representative-name="representativeName"
          :corporate-number="corporateNumber"
          :selected-plan-id="selectedPlanId"
          :payment-method="isPaidPlan ? paymentMethod : 'none'"
          :terms-version="termsVersion"
          :privacy-version="privacyVersion"
          :submitting="submitting"
          @submit="handleSubmit"
        />
      </template>

      <!-- Navigation buttons (Steps 2-4) -->
      <div
        v-if="currentStep >= 1 && currentStep <= 3"
        class="mt-6 flex justify-between"
      >
        <button
          type="button"
          class="rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          @click="prevStep"
        >
          戻る
        </button>
        <button
          type="button"
          :disabled="!canProceedFromStep"
          class="rounded-md bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          @click="nextStep"
        >
          次へ
        </button>
      </div>

      <!-- Back button for Step 5 -->
      <div
        v-if="currentStep === 4"
        class="mt-4 text-center"
      >
        <button
          type="button"
          class="text-sm text-gray-500 underline hover:text-gray-700"
          @click="prevStep"
        >
          入力内容を修正する
        </button>
      </div>
    </div>
  </div>
</template>
