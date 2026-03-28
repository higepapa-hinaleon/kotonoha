<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: [
    function () {
      return navigateTo("/chat", { replace: true });
    },
  ],
});
</script>

<template>
  <div />
</template>
