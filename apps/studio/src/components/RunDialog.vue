<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflowStore } from '@/stores/workflow';

const props = defineProps<{ modelValue: boolean; running: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  run: [string];
}>();

const store = useWorkflowStore();
const { t } = useI18n();
const input = ref(store.lastInput);

const presets = computed(() => [
  t('run.presets.intro'),
  t('run.presets.decision'),
  t('run.presets.scenario'),
]);

watch(
  () => props.modelValue,
  (open) => {
    if (open) input.value = store.lastInput;
  },
);

function close(): void {
  emit('update:modelValue', false);
}

function submit(): void {
  const value = input.value.trim() || t('run.defaultInput');
  emit('update:modelValue', false);
  emit('run', value);
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('run.title')"
    width="540px"
    :close-on-click-modal="!running"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="dialog-hint">{{ t('run.hint') }} 例如 <code>{ input: "…" }</code></p>
    <el-input v-model="input" type="textarea" :rows="3" :placeholder="t('run.placeholder')" />
    <div class="dialog-presets">
      <el-tag v-for="preset in presets" :key="preset" class="preset" @click="input = preset">
        {{ preset }}
      </el-tag>
    </div>
    <template #footer>
      <el-button @click="close">{{ t('run.cancel') }}</el-button>
      <el-button type="primary" :loading="running" @click="submit">{{ t('run.run') }}</el-button>
    </template>
  </el-dialog>
</template>
