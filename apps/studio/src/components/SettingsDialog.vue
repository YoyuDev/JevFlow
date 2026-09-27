<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { Connection, Delete, Plus } from '@element-plus/icons-vue';
import { providerApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useProvidersStore } from '@/stores/providers';
import { useWorkflowStore } from '@/stores/workflow';
import { toast } from '@/utils/toast';
import type { ProviderKind, ProviderProfile, ProviderTestResult } from '@/types';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const store = useProvidersStore();
const workflow = useWorkflowStore();
const { t } = useI18n();

const KINDS: readonly ProviderKind[] = ['llm', 'jev'];

const activeTab = ref<ProviderKind>('llm');
const testingId = ref<string | null>(null);
const results = ref<Record<string, ProviderTestResult>>({});

/** Node configs, so each card can say whether any node actually points at it. */
const nodeConfigs = computed(() => workflow.nodes.map((node) => node.data.config));

/* Keys stay static: the message schema is strongly typed, so a template literal
   would not survive `vue-tsc`. */
const tabLabels = computed<Record<ProviderKind, string>>(() => ({
  llm: t('settings.tabs.llm'),
  jev: t('settings.tabs.jev'),
}));
const kindHints = computed<Record<ProviderKind, string>>(() => ({
  llm: t('settings.hints.llm'),
  jev: t('settings.hints.jev'),
}));
/** Placeholder shown in the node picker varies per layer, so explain both here. */
const kindUsage = computed<Record<ProviderKind, string>>(() => ({
  llm: t('settings.usageHint.llm'),
  jev: t('settings.usageHint.jev'),
}));

function close(): void {
  emit('update:modelValue', false);
}

function refCount(id: string): number {
  return store.usageCount(id, nodeConfigs.value);
}

function onAdd(kind: ProviderKind): void {
  store.addProfile(kind);
}

async function onTest(kind: ProviderKind, profile: ProviderProfile): Promise<void> {
  testingId.value = profile.id;
  try {
    const result = await providerApi.test({
      kind,
      apiKey: profile.apiKey,
      baseUrl: profile.baseUrl,
      model: profile.model,
    });
    results.value = { ...results.value, [profile.id]: result };
    if (result.ok) {
      toast.success('settings.toast.tested', {
        ms: result.latencyMs,
        provider: result.provider,
      });
    } else {
      toast.error('settings.toast.testFailed', { error: result.error ?? t('settings.testFailed') });
    }
  } catch (error) {
    toast.error('settings.toast.testFailed', { error: errorMessage(error) });
  } finally {
    testingId.value = null;
  }
}

async function onRemove(profile: ProviderProfile): Promise<void> {
  const used = refCount(profile.id);
  try {
    await ElMessageBox.confirm(
      used > 0
        ? t('settings.removeConfirmInUse', { name: profile.name, count: used })
        : t('settings.removeConfirm', { name: profile.name }),
      t('settings.removeTitle'),
      {
        type: 'warning',
        confirmButtonText: t('settings.remove'),
        cancelButtonText: t('settings.cancel'),
      },
    );
  } catch {
    return;
  }
  store.removeProfile(profile.id);
  toast.info('settings.toast.removed', { name: profile.name });
}

async function onRemoveAll(): Promise<void> {
  try {
    await ElMessageBox.confirm(t('settings.clearConfirm'), t('settings.clearTitle'), {
      type: 'warning',
      confirmButtonText: t('settings.removeAll'),
      cancelButtonText: t('settings.cancel'),
    });
  } catch {
    return;
  }
  store.removeAll();
  results.value = {};
  toast.info('settings.toast.cleared');
}

function resultText(id: string): string {
  const result = results.value[id];
  if (!result) return '';
  if (!result.ok) return result.error ?? t('settings.testFailed');
  return t('settings.testOk', {
    ms: result.latencyMs,
    model: result.model ?? result.provider,
  });
}

function resultOk(id: string): boolean {
  return results.value[id]?.ok === true;
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('settings.title')"
    width="720px"
    class="settings-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="dialog-hint">{{ t('settings.hint') }}</p>

    <el-tabs v-model="activeTab">
      <el-tab-pane v-for="kind in KINDS" :key="kind" :label="tabLabels[kind]" :name="kind">
        <p class="settings-note">{{ kindUsage[kind] }}</p>
        <p class="settings-note">{{ kindHints[kind] }}</p>

        <p v-if="store.profilesOf(kind).length === 0" class="settings-empty">
          {{ t('settings.empty') }}
        </p>

        <div v-for="profile in store.profilesOf(kind)" :key="profile.id" class="profile-card">
          <div class="profile-card__head">
            <el-input
              v-model="profile.name"
              class="profile-card__name"
              :placeholder="t('settings.name')"
            />
            <el-tag v-if="!profile.apiKey.trim()" size="small" type="warning">
              {{ t('settings.incomplete') }}
            </el-tag>
            <el-tag v-if="refCount(profile.id) > 0" size="small" type="success">
              {{ t('settings.usage', { count: refCount(profile.id) }) }}
            </el-tag>
            <el-tag v-else size="small" type="info">{{ t('settings.unused') }}</el-tag>
            <el-button text type="danger" :icon="Delete" @click="onRemove(profile)" />
          </div>

          <div class="profile-card__grid">
            <label class="profile-field">
              <span>{{ t('settings.apiKey') }}</span>
              <el-input
                v-model="profile.apiKey"
                type="password"
                show-password
                :placeholder="t('settings.apiKeyPlaceholder')"
              />
            </label>
            <label class="profile-field">
              <span>{{ t('settings.model') }}</span>
              <el-input v-model="profile.model" :placeholder="t('settings.modelPlaceholder')" />
            </label>
            <label class="profile-field profile-field--wide">
              <span>{{ t('settings.baseUrl') }}</span>
              <el-input v-model="profile.baseUrl" :placeholder="t('settings.baseUrlPlaceholder')" />
            </label>
          </div>

          <div class="profile-card__footer">
            <el-button
              size="small"
              :icon="Connection"
              :loading="testingId === profile.id"
              @click="onTest(kind, profile)"
            >
              {{ t('settings.test') }}
            </el-button>
            <span
              v-if="resultText(profile.id)"
              class="profile-card__result"
              :class="resultOk(profile.id) ? 'is-ok' : 'is-error'"
            >
              {{ resultText(profile.id) }}
            </span>
          </div>
        </div>

        <el-button class="settings-add" :icon="Plus" @click="onAdd(kind)">
          {{ t('settings.add') }}
        </el-button>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="settings-footer">
        <span class="settings-storage">{{ t('settings.hints.storage') }}</span>
        <div class="settings-footer__actions">
          <el-button :disabled="store.profiles.length === 0" @click="onRemoveAll">
            {{ t('settings.removeAll') }}
          </el-button>
          <el-button type="primary" @click="close">{{ t('settings.close') }}</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
