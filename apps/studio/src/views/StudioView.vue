<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { Moon, Setting, Sunny } from '@element-plus/icons-vue';
import ExecutionTrace from '@/components/ExecutionTrace.vue';
import FlowCanvas from '@/components/FlowCanvas.vue';
import NodeConfigPanel from '@/components/NodeConfigPanel.vue';
import NodeLibrary from '@/components/NodeLibrary.vue';
import RunDialog from '@/components/RunDialog.vue';
import SettingsDialog from '@/components/SettingsDialog.vue';
import { LOCALE_LABELS, SUPPORTED_LOCALES, isAppLocale } from '@/i18n';
import { usePreferencesStore } from '@/stores/preferences';
import { useProvidersStore } from '@/stores/providers';
import { useWorkflowStore } from '@/stores/workflow';
import type { ProviderKind } from '@/types';

const store = useWorkflowStore();
const preferences = usePreferencesStore();
const providers = useProvidersStore();
const { t } = useI18n();

const runDialogVisible = ref(false);
const settingsVisible = ref(false);

/**
 * The pills describe the *server's* own clients. Which connection a particular
 * node uses is decided on the node itself, so no single pill can summarise a
 * run any more — they answer “what does `.env` say”, and nothing more.
 */
function runtimePill(kind: ProviderKind): { text: string; mock: boolean } {
  const info = store.runtime?.[kind];
  return info ? { text: info.provider, mock: info.mock } : { text: '', mock: false };
}

const llmPill = computed(() => runtimePill('llm'));
const jevPill = computed(() => runtimePill('jev'));

/** How many connections the settings panel is holding — a hint that it is worth opening. */
const profileCount = computed(() => providers.profiles.length);

const localeOptions = computed(() =>
  SUPPORTED_LOCALES.map((code) => ({ label: LOCALE_LABELS[code], value: code })),
);
const themeActionLabel = computed(() =>
  preferences.isDark ? t('preferences.switchToLight') : t('preferences.switchToDark'),
);

onMounted(() => {
  void store.initialise();
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});

function onKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void store.save();
  }
}

function onLocaleChange(value: string | number | boolean): void {
  if (isAppLocale(value)) preferences.setLocale(value);
}

function onSelectWorkflow(id: string): void {
  if (id && id !== store.current?.id) void store.open(id);
}

async function onNew(): Promise<void> {
  if (store.dirty) {
    try {
      await ElMessageBox.confirm(t('dialog.unsavedMessage'), t('dialog.unsavedTitle'), {
        type: 'warning',
        confirmButtonText: t('dialog.continue'),
        cancelButtonText: t('dialog.cancel'),
      });
    } catch {
      return;
    }
  }
  store.createNew();
}

async function onDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm(t('dialog.deleteMessage'), t('dialog.deleteTitle'), {
      type: 'warning',
      confirmButtonText: t('dialog.delete'),
      cancelButtonText: t('dialog.cancel'),
    });
  } catch {
    return;
  }
  await store.remove();
}

function onRun(input: string): void {
  void store.run(input);
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="brand__mark">JF</span>
        <div>
          <strong>JevFlow</strong>
          <small>{{ t('app.tagline') }}</small>
        </div>
      </div>

      <div class="app-header__center">
        <el-select
          class="workflow-select"
          :model-value="store.current?.id ?? ''"
          :placeholder="t('workflow.select')"
          @change="onSelectWorkflow"
        >
          <el-option
            v-for="item in store.summaries"
            :key="item.id"
            :label="`${item.name} · v${item.version}`"
            :value="item.id"
          />
        </el-select>
        <el-button @click="onNew">{{ t('workflow.new') }}</el-button>
        <el-button :disabled="!store.hasWorkflow" @click="onDelete">
          {{ t('workflow.remove') }}
        </el-button>
      </div>

      <div class="app-header__right">
        <span v-if="llmPill.text" class="runtime-pill" :class="{ 'is-mock': llmPill.mock }">
          {{ llmPill.text }}
        </span>
        <span v-if="jevPill.text" class="runtime-pill" :class="{ 'is-mock': jevPill.mock }">
          {{ jevPill.text }}
        </span>
        <span v-if="store.dirty" class="dirty-dot">{{ t('workflow.unsaved') }}</span>
        <el-button :loading="store.saving" @click="store.save()">{{ t('workflow.save') }}</el-button>
        <el-button type="primary" :loading="store.running" @click="runDialogVisible = true">
          {{ t('workflow.run') }}
        </el-button>

        <span class="app-header__divider" />

        <el-segmented
          class="locale-switch"
          size="small"
          :model-value="preferences.locale"
          :options="localeOptions"
          :aria-label="t('preferences.language')"
          @change="onLocaleChange"
        />
        <el-tooltip :content="themeActionLabel" placement="bottom">
          <el-button
            class="theme-switch"
            circle
            :aria-label="themeActionLabel"
            @click="preferences.toggleTheme()"
          >
            <el-icon>
              <Sunny v-if="preferences.isDark" />
              <Moon v-else />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip :content="t('settings.title')" placement="bottom">
          <el-badge :value="profileCount" :hidden="profileCount === 0" class="settings-badge">
            <el-button
              class="theme-switch settings-switch"
              circle
              :aria-label="t('settings.title')"
              @click="settingsVisible = true"
            >
              <el-icon><Setting /></el-icon>
            </el-button>
          </el-badge>
        </el-tooltip>
      </div>
    </header>

    <main class="app-main">
      <NodeLibrary />
      <FlowCanvas />
      <NodeConfigPanel />
    </main>

    <ExecutionTrace />

    <RunDialog v-model="runDialogVisible" :running="store.running" @run="onRun" />
    <SettingsDialog v-model="settingsVisible" />
  </div>
</template>
