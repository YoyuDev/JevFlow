<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { NODE_ACCENTS } from '@/constants/nodeCatalog';
import { useWorkflowStore } from '@/stores/workflow';
import type { TraceEntry } from '@/types';

const store = useWorkflowStore();
const { t } = useI18n();

const trace = computed<TraceEntry[]>(() => store.trace);
const active = computed<TraceEntry | null>(() => store.activeTrace);
const execution = computed(() => store.execution);

const summary = computed(() => {
  const record = execution.value;
  if (!record) return '';
  return t('trace.meta', {
    status: t(`trace.runStatus.${record.status}`),
    steps: record.steps,
    duration: record.durationMs ?? 0,
  });
});

function pretty(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function num(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toFixed(2) : '—';
}

function iconClass(entry: TraceEntry): string {
  if (entry.status === 'failed') return 'is-fail';
  if (entry.status === 'skipped') return 'is-skip';
  return 'is-ok';
}

function iconText(entry: TraceEntry): string {
  if (entry.status === 'failed') return '✕';
  if (entry.status === 'skipped') return '–';
  return '✓';
}
</script>

<template>
  <section class="trace">
    <header class="trace__head">
      <h2>{{ t('trace.title') }}</h2>
      <span v-if="summary" class="trace__meta">{{ summary }}</span>
      <span class="trace__spacer" />
      <span v-if="store.running" class="trace__meta">{{ t('trace.running') }}</span>
      <el-button v-if="trace.length" size="small" text @click="store.clearTrace()">
        {{ t('trace.clear') }}
      </el-button>
    </header>

    <div v-if="!trace.length" class="trace-empty">
      {{ t('trace.empty') }}
    </div>

    <div v-else class="trace__body">
      <div class="trace__list">
        <button
          v-for="(entry, index) in trace"
          :key="`${entry.nodeId}-${index}`"
          class="trace-item"
          :class="{ 'is-active': store.activeTraceIndex === index }"
          type="button"
          @click="store.selectTrace(index)"
        >
          <span class="trace-item__icon" :class="iconClass(entry)">{{ iconText(entry) }}</span>
          <span class="trace-item__label">{{ entry.label }}</span>
          <span class="trace-item__type">{{ entry.nodeType }}</span>
          <span class="trace-item__time">{{ entry.durationMs }}ms</span>
        </button>
      </div>

      <div v-if="active" class="trace__detail">
        <p v-if="active.error" class="error-note">{{ active.error }}</p>

        <div class="detail-grid">
          <div class="stat">
            <span>{{ t('trace.status') }}</span>
            <strong>{{ t(`trace.nodeStatus.${active.status}`) }}</strong>
          </div>
          <div class="stat">
            <span>{{ t('trace.duration') }}</span>
            <strong>{{ active.durationMs }}ms</strong>
          </div>
          <div class="stat">
            <span>{{ t('trace.nodeType') }}</span>
            <strong>
              <span class="badge" :style="{ background: NODE_ACCENTS[active.nodeType] }">
                {{ active.nodeType }}
              </span>
            </strong>
          </div>
          <div v-if="active.decision" class="stat">
            <span>{{ t('trace.decision') }}</span>
            <strong>
              <span class="decision-chip">
                {{ active.decision.choice }}
                <template v-if="active.decision.reason">· {{ active.decision.reason }}</template>
              </span>
            </strong>
          </div>
          <div v-if="active.probability !== undefined" class="stat">
            <span>{{ t('trace.probability') }}</span>
            <strong>{{ num(active.probability) }}</strong>
          </div>
          <div v-if="active.confidence !== undefined" class="stat">
            <span>{{ t('trace.confidence') }}</span>
            <strong>{{ num(active.confidence) }}</strong>
          </div>
        </div>

        <div class="detail-block">
          <h4>{{ t('trace.input') }}</h4>
          <pre>{{ pretty(active.input) }}</pre>
        </div>
        <div class="detail-block">
          <h4>{{ t('trace.output') }}</h4>
          <pre>{{ pretty(active.output) }}</pre>
        </div>
      </div>
    </div>
  </section>
</template>
