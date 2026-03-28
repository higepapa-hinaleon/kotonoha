<script setup lang="ts">
const sidebarOpen = ref(false);
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
    <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
    <div class="flex flex-1 overflow-hidden">
      <AppSidebar :mobile-open="sidebarOpen" @close="sidebarOpen = false" />
      <main class="flex-1 overflow-y-auto p-4 md:p-6">
        <slot />
      </main>
    </div>
    <ToastContainer />
  </div>
</template>
