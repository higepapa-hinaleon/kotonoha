<script setup lang="ts">
defineProps<{
  steps: { label: string }[];
  currentStep: number;
}>();
</script>

<template>
  <nav class="mb-8">
    <ol class="flex items-center">
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="flex items-center"
        :class="index < steps.length - 1 ? 'flex-1' : ''"
      >
        <div class="flex flex-col items-center">
          <!-- Circle -->
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors"
            :class="[
              index < currentStep
                ? 'bg-primary-600 text-white'
                : index === currentStep
                  ? 'border-2 border-primary-600 bg-white text-primary-600'
                  : 'border-2 border-gray-300 bg-white text-gray-400',
            ]"
          >
            <!-- Checkmark for completed steps -->
            <svg
              v-if="index < currentStep"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <!-- Label -->
          <span
            class="mt-1.5 whitespace-nowrap text-center text-xs font-medium"
            :class="index <= currentStep ? 'text-primary-600' : 'text-gray-400'"
          >
            {{ step.label }}
          </span>
        </div>
        <!-- Connector line -->
        <div
          v-if="index < steps.length - 1"
          class="mx-2 mt-[-1rem] h-0.5 flex-1 transition-colors"
          :class="index < currentStep ? 'bg-primary-600' : 'bg-gray-300'"
        />
      </li>
    </ol>
  </nav>
</template>
