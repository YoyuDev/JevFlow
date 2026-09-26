<script setup lang="ts">
import { usePreferencesStore } from '@/stores/preferences';
import StudioView from './views/StudioView.vue';

/**
 * The store is created here so `el-config-provider` can hand Element Plus the
 * matching message table — that is what makes its built-in texts (select
 * placeholders, empty states, pagination) follow the language switch.
 */
const preferences = usePreferencesStore();
</script>

<template>
  <el-config-provider :locale="preferences.elementLocale">
    <StudioView />
  </el-config-provider>
</template>
