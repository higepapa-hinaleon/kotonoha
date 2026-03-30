<script setup lang="ts">
import type { OrganizationType } from "~~/shared/types/models";

const organizationType = defineModel<OrganizationType>("organizationType", { required: true });
const contactName = defineModel<string>("contactName", { required: true });
const phone = defineModel<string>("phone", { required: true });
const address = defineModel<string>("address", { required: true });
const tradeName = defineModel<string>("tradeName", { required: true });
const organizationName = defineModel<string>("organizationName", { required: true });
const representativeName = defineModel<string>("representativeName", { required: true });
const corporateNumber = defineModel<string>("corporateNumber", { required: true });

const isValid = computed(() => {
  if (organizationType.value === "individual") {
    return contactName.value.trim() !== "" && phone.value.trim() !== "";
  }
  if (organizationType.value === "sole_proprietor") {
    return tradeName.value.trim() !== "" && contactName.value.trim() !== "";
  }
  // corporation
  return (
    organizationName.value.trim() !== "" &&
    address.value.trim() !== "" &&
    contactName.value.trim() !== "" &&
    phone.value.trim() !== ""
  );
});

defineExpose({ isValid });

const inputClass =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";
</script>

<template>
  <div class="space-y-6">
    <!-- 契約者区分 -->
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

    <!-- 基本情報 -->
    <div class="rounded-lg bg-white p-6 shadow-md">
      <h2 class="mb-4 text-lg font-semibold text-gray-800">基本情報</h2>
      <div class="space-y-4">
        <!-- 個人: 氏名 + 電話番号 -->
        <template v-if="organizationType === 'individual'">
          <div>
            <label for="contactName" class="block text-sm font-medium text-gray-700">
              氏名 <span class="text-red-500">*</span>
            </label>
            <input
              id="contactName"
              v-model="contactName"
              type="text"
              required
              :class="inputClass"
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label for="phone" class="block text-sm font-medium text-gray-700">
              電話番号 <span class="text-red-500">*</span>
            </label>
            <input
              id="phone"
              v-model="phone"
              type="tel"
              required
              :class="inputClass"
              placeholder="03-1234-5678"
            />
          </div>
        </template>

        <!-- 個人事業主: 屋号 + 担当名 -->
        <template v-if="organizationType === 'sole_proprietor'">
          <div>
            <label for="tradeName" class="block text-sm font-medium text-gray-700">
              屋号 <span class="text-red-500">*</span>
            </label>
            <input
              id="tradeName"
              v-model="tradeName"
              type="text"
              required
              :class="inputClass"
              placeholder="サンプル商店"
            />
            <p class="mt-1 text-xs text-gray-500">屋号がない場合は氏名を入力してください</p>
          </div>
          <div>
            <label for="contactNameSP" class="block text-sm font-medium text-gray-700">
              担当名 <span class="text-red-500">*</span>
            </label>
            <input
              id="contactNameSP"
              v-model="contactName"
              type="text"
              required
              :class="inputClass"
              placeholder="山田 太郎"
            />
          </div>
        </template>

        <!-- 法人: 会社名 + 住所 + 担当名 + 電話番号 + 代表者名(任意) + 法人番号(任意) -->
        <template v-if="organizationType === 'corporation'">
          <div>
            <label for="orgName" class="block text-sm font-medium text-gray-700">
              会社名 <span class="text-red-500">*</span>
            </label>
            <input
              id="orgName"
              v-model="organizationName"
              type="text"
              required
              :class="inputClass"
              placeholder="株式会社サンプル"
            />
          </div>
          <div>
            <label for="address" class="block text-sm font-medium text-gray-700">
              住所 <span class="text-red-500">*</span>
            </label>
            <input
              id="address"
              v-model="address"
              type="text"
              required
              :class="inputClass"
              placeholder="東京都渋谷区..."
            />
          </div>
          <div>
            <label for="contactNameCorp" class="block text-sm font-medium text-gray-700">
              担当名 <span class="text-red-500">*</span>
            </label>
            <input
              id="contactNameCorp"
              v-model="contactName"
              type="text"
              required
              :class="inputClass"
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label for="phoneCorp" class="block text-sm font-medium text-gray-700">
              電話番号 <span class="text-red-500">*</span>
            </label>
            <input
              id="phoneCorp"
              v-model="phone"
              type="tel"
              required
              :class="inputClass"
              placeholder="03-1234-5678"
            />
          </div>
          <div>
            <label for="repName" class="block text-sm font-medium text-gray-700">
              代表者名
            </label>
            <input
              id="repName"
              v-model="representativeName"
              type="text"
              :class="inputClass"
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label for="corpNum" class="block text-sm font-medium text-gray-700">
              法人番号
            </label>
            <input
              id="corpNum"
              v-model="corporateNumber"
              type="text"
              :class="inputClass"
              placeholder="1234567890123"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
