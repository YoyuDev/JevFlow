<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { Moon, Sunny } from '@element-plus/icons-vue';
import ExecutionTrace from '@/components/ExecutionTrace.vue';
import FlowCanvas from '@/components/FlowCanvas.vue';
import NodeConfigPanel from '@/components/NodeConfigPanel.vue';
import NodeLibrary from '@/components/NodeLibrary.vue';
import RunDialog from '@/components/RunDialog.vue';
import { LOCALE_LABELS, SUPPORTED_LOCALES, isAppLocale } from '@/i18n';
import { usePreferencesStore } from '@/stores/preferences';
import { useWorkflowStore } from '@/stores/workflow';

const store = useWorkflowStore();
const preferences = usePreferencesStore();
const { t } = useI18n();

const runDialogVisible = ref(false);

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
        <span v-if="store.runtime" class="runtime-pill" :class="{ 'is-mock': store.runtime.llm.mock }">
          {{ store.runtime.llm.provider }}
        </span>
        <span v-if="store.runtime" class="runtime-pill" :class="{ 'is-mock': store.runtime.jev.mock }">
          {{ store.runtime.jev.provider }}
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
      </div>
    </header>

    <main class="app-main">
      <NodeLibrary />
      <FlowCanvas />
      <NodeConfigPanel />
    </main>

    <ExecutionTrace />

    <RunDialog v-model="runDialogVisible" :running="store.running" @run="onRun" />
  </div>
</template>
