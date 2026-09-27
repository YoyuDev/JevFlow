<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useProjectsStore } from '@/stores/projects';
import { useWorkflowStore } from '@/stores/workflow';
import type { WorkflowSummary } from '@/types';

const store = useWorkflowStore();
const projects = useProjectsStore();
const { t, locale } = useI18n();

const keyword = ref('');

const filtered = computed<WorkflowSummary[]>(() => {
  const needle = keyword.value.trim().toLowerCase();
  if (!needle) return store.summaries;
  return store.summaries.filter((item) =>
    `${item.name} ${item.description ?? ''}`.toLowerCase().includes(needle),
  );
});

/** Locale-aware, so a project list opened in English does not show Chinese dates. */
const dateFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
);

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.value.format(date);
}

function isCurrent(item: WorkflowSummary): boolean {
  return item.id === store.current?.id;
}

/** Both create and open close the panel: the canvas is where the user wants to be. */
async function onNew(): Promise<void> {
  if (await projects.create()) projects.closePanel();
}

async function onOpen(id: string): Promise<void> {
  if (await projects.open(id)) projects.closePanel();
}

async function onRename(item: WorkflowSummary): Promise<void> {
  let result;
  try {
    result = await ElMessageBox.prompt(t('projects.renamePlaceholder'), t('projects.renameTitle'), {
      cancelButtonText: t('dialog.cancel'),
      inputValue: item.name,
      inputValidator: (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return t('projects.renameEmpty');
        if (trimmed.length > 120) return t('projects.renameTooLong');
        return true;
      },
    });
  } catch {
    return;
  }
  if (!('value' in result)) return;
  await projects.rename(item.id, String(result.value));
}

async function onDuplicate(item: WorkflowSummary): Promise<void> {
  // A copy reads what the server has, so an unsaved canvas is worth flagging.
  if (isCurrent(item) && store.dirty) {
    try {
      await ElMessageBox.confirm(
        t('projects.draftCopyHint', { name: item.name }),
        t('projects.action.duplicate'),
        {
          type: 'warning',
          confirmButtonText: t('dialog.continue'),
          cancelButtonText: t('dialog.cancel'),
        },
      );
    } catch {
      return;
    }
  }
  await projects.duplicate(item.id);
}

async function onRemove(item: WorkflowSummary): Promise<void> {
  try {
    await ElMessageBox.confirm(
      t('projects.removeConfirm', { name: item.name }),
      t('projects.removeTitle'),
      {
        type: 'warning',
        confirmButtonText: t('projects.action.remove'),
        cancelButtonText: t('dialog.cancel'),
      },
    );
  } catch {
    return;
  }
  await projects.remove(item.id);
}
</script>

<template>
  <el-dialog
    v-model="projects.panelVisible"
    :title="t('projects.title')"
    width="680px"
    align-center
    append-to-body
  >
    <div class="projects-toolbar">
      <el-input v-model="keyword" :placeholder="t('projects.search')" clearable />
      <el-button type="primary" :icon="Plus" @click="onNew">{{ t('projects.new') }}</el-button>
    </div>
    <p class="projects-hint">{{ t('projects.hint') }}</p>

    <p v-if="store.hasWorkflow && !store.isPersisted" class="projects-draft">
      {{ t('projects.draftHint') }}
    </p>

    <ul v-if="filtered.length" class="project-list">
      <li
        v-for="item in filtered"
        :key="item.id"
        class="project-card"
        :class="{ 'is-current': isCurrent(item) }"
      >
        <div class="project-card__head">
          <span class="project-card__name">{{ item.name }}</span>
          <span v-if="isCurrent(item)" class="project-card__badge">{{ t('projects.current') }}</span>
          <span class="project-card__version">v{{ item.version }}</span>
        </div>
        <p v-if="item.description" class="project-card__desc">{{ item.description }}</p>
        <p class="project-card__meta">
          {{ t('projects.nodeCount', item.nodeCount) }} ·
          {{ t('projects.edgeCount', item.edgeCount) }} ·
          {{ t('projects.updatedAt', { time: formatTime(item.updatedAt) }) }}
        </p>
        <div class="project-card__actions">
          <el-button
            v-if="!isCurrent(item)"
            size="small"
            type="primary"
            plain
            @click="onOpen(item.id)"
          >
            {{ t('projects.action.open') }}
          </el-button>
          <el-button size="small" @click="onRename(item)">{{ t('projects.action.rename') }}</el-button>
          <el-button size="small" @click="onDuplicate(item)">
            {{ t('projects.action.duplicate') }}
          </el-button>
          <el-button size="small" type="danger" plain @click="onRemove(item)">
            {{ t('projects.action.remove') }}
          </el-button>
        </div>
      </li>
    </ul>
    <p v-else class="projects-empty">
      {{ keyword.trim() ? t('projects.noMatch') : t('projects.empty') }}
    </p>

    <template #footer>
      <el-button @click="projects.closePanel()">{{ t('projects.close') }}</el-button>
    </template>
  </el-dialog>
</template>
