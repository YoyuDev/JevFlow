<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  NODE_ACCENTS,
  NODE_CATALOG,
  NODE_CATALOG_GROUPS,
  nodeDescriptionKey,
  nodeGroupKey,
  nodeLabelKey,
  type NodeGroup,
} from '@/constants/nodeCatalog';
import { useWorkflowStore } from '@/stores/workflow';
import type { NodeType } from '@/types';

const store = useWorkflowStore();
const { t } = useI18n();

function itemsIn(group: NodeGroup) {
  return NODE_CATALOG.filter((item) => item.group === group);
}

function onDragStart(event: DragEvent, type: NodeType): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData('application/jevflow-node', type);
  event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <aside class="panel node-library">
    <header class="panel__head">
      <h2>{{ t('panel.nodes') }}</h2>
    </header>
    <div class="panel__body">
      <section v-for="group in NODE_CATALOG_GROUPS" :key="group" class="node-group">
        <h3>{{ t(nodeGroupKey(group)) }}</h3>
        <button
          v-for="item in itemsIn(group)"
          :key="item.type"
          class="node-item"
          type="button"
          draggable="true"
          @dragstart="onDragStart($event, item.type)"
          @click="store.addNode(item.type)"
        >
          <span class="node-item__dot" :style="{ background: NODE_ACCENTS[item.type] }" />
          <span class="node-item__body">
            <strong>{{ t(nodeLabelKey(item.type)) }}</strong>
            <small>{{ t(nodeDescriptionKey(item.type)) }}</small>
          </span>
        </button>
      </section>
      <p class="hint">{{ t('nodes.hint') }}</p>
    </div>
  </aside>
</template>
