<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import { NODE_ACCENTS, summarizeNode } from '@/constants/nodeCatalog';
import { useProvidersStore } from '@/stores/providers';
import type { FlowNodeData } from '@/types';

/**
 * One component renders all five node types — the type lives in `data`, so the
 * only thing that changes per type is the accent colour and the summary line.
 */
const props = defineProps<NodeProps<FlowNodeData>>();

const { t } = useI18n();
const providers = useProvidersStore();

const accent = computed(() => NODE_ACCENTS[props.data.nodeType]);
// The summary names the connection, so a canvas with two different LLM
// connections is readable at a glance.
const summary = computed(() =>
  summarizeNode(props.data.nodeType, props.data.config, t, (id) => providers.nameOf(id)),
);
const status = computed(() => props.data.runStatus ?? null);
const isStart = computed(() => props.data.nodeType === 'start');
const isEnd = computed(() => props.data.nodeType === 'end');
</script>

<template>
  <div
    class="jev-node"
    :class="[`node-${data.nodeType}`, status ? `run-${status}` : '', { 'is-selected': selected }]"
  >
    <Handle v-if="!isStart" type="target" :position="Position.Top" />
    <div class="jev-node__head">
      <span class="jev-node__dot" :style="{ background: accent }" />
      <span class="jev-node__title">{{ data.label }}</span>
      <span class="jev-node__type">{{ data.nodeType }}</span>
    </div>
    <p class="jev-node__summary">{{ summary }}</p>
    <span v-if="status === 'success'" class="jev-node__badge is-ok">✓</span>
    <span v-else-if="status === 'failed'" class="jev-node__badge is-fail">✕</span>
    <Handle v-if="!isEnd" type="source" :position="Position.Bottom" />
  </div>
</template>
