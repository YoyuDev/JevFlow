<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProvidersStore } from '@/stores/providers';
import type { ProviderKind } from '@/types';

/**
 * Picks which saved connection a node talks to.
 *
 * The empty option means “follow the server default”, which is `.env` when the
 * server has credentials and the offline mock otherwise — so a workflow that
 * never opens this dropdown keeps working exactly as before.
 *
 * For `api` that empty option reads differently: a connection is what supplies
 * the base URL, so without one the node's path has to be a full URL.
 */
const props = defineProps<{ kind: ProviderKind; modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();

const providers = useProvidersStore();
const { t } = useI18n();

const options = computed(() => providers.profilesOf(props.kind));
const selected = computed(() => providers.byId(props.modelValue));
/** A node can outlive the connection it points at — deleted in the settings panel. */
const missing = computed(() => props.modelValue.length > 0 && selected.value === undefined);
const incomplete = computed(() => providers.isIncomplete(props.modelValue));

function onChange(value: unknown): void {
  emit('update:modelValue', typeof value === 'string' ? value : '');
}
</script>

<template>
  <div class="field">
    <label>{{ t('inspector.provider') }}</label>
    <el-select
      :model-value="modelValue"
      :placeholder="kind === 'api' ? t('inspector.connectionDefault') : t('inspector.providerDefault')"
      @update:model-value="onChange"
    >
      <el-option
        :label="kind === 'api' ? t('inspector.connectionDefault') : t('inspector.providerDefault')"
        value=""
      />
      <el-option v-for="item in options" :key="item.id" :label="item.name" :value="item.id" />
    </el-select>

    <p v-if="missing" class="hint hint--warn">
      {{ t('inspector.providerMissing', { id: modelValue }) }}
    </p>
    <p v-else-if="incomplete" class="hint hint--warn">
      {{ kind === 'api' ? t('inspector.connectionNoUrl') : t('inspector.providerNoKey') }}
    </p>
    <p v-else-if="options.length === 0" class="hint">
      {{ kind === 'api' ? t('inspector.connectionEmpty') : t('inspector.providerEmpty') }}
    </p>
    <p v-else-if="kind === 'api' && selected?.baseUrl" class="hint">
      {{ t('inspector.connectionBaseUrl', { baseUrl: selected.baseUrl }) }}
    </p>
    <p v-else-if="selected?.model" class="hint">
      {{ t('inspector.providerModel', { model: selected.model }) }}
    </p>
  </div>
</template>
