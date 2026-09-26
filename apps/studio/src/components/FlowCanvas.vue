<script setup lang="ts">
import { computed, ref } from 'vue';
import { VueFlow, type Connection, type EdgeChange, type NodeChange } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { NODE_CATALOG } from '@/constants/nodeCatalog';
import { usePreferencesStore } from '@/stores/preferences';
import { useWorkflowStore } from '@/stores/workflow';
import type { NodeType } from '@/types';
import FlowNode from './FlowNode.vue';

const store = useWorkflowStore();
const preferences = usePreferencesStore();

/** All five types map to the same component; the type is in `data`. */
const nodeTypes = {
  start: FlowNode,
  llm: FlowNode,
  jev: FlowNode,
  tool: FlowNode,
  end: FlowNode,
};

const wrapper = ref<HTMLElement | null>(null);
const viewport = ref({ x: 0, y: 0, zoom: 1 });

/** The dot grid is painted by Vue Flow, so it needs the theme's colour. */
const gridColor = computed(() => (preferences.isDark ? '#39414f' : '#dbe2ea'));

function onConnect(connection: Connection): void {
  store.connect(connection);
}

function onNodesChange(changes: NodeChange[]): void {
  store.applyNodeChanges(changes);
}

function onEdgesChange(changes: EdgeChange[]): void {
  store.applyEdgeChanges(changes);
}

function onViewportChange(transform: { x: number; y: number; zoom: number }): void {
  viewport.value = transform;
}

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

/**
 * Drop handling is done here instead of with `screenToFlowCoordinate` so this
 * component does not need a `useVueFlow()` instance from inside VueFlow.
 */
function onDrop(event: DragEvent): void {
  event.preventDefault();
  const raw = event.dataTransfer?.getData('application/jevflow-node') ?? '';
  const type = raw as NodeType;
  if (!NODE_CATALOG.some((item) => item.type === type)) return;

  const bounds = wrapper.value?.getBoundingClientRect();
  const { x, y, zoom } = viewport.value;
  const position = {
    x: (event.clientX - (bounds?.left ?? 0) - x) / zoom,
    y: (event.clientY - (bounds?.top ?? 0) - y) / zoom,
  };
  store.addNode(type, position);
}
</script>

<template>
  <div ref="wrapper" class="canvas" @drop="onDrop" @dragover="onDragOver">
    <VueFlow
      :nodes="store.nodes"
      :edges="store.edges"
      :node-types="nodeTypes"
      :min-zoom="0.2"
      :max-zoom="2.5"
      :default-viewport="{ x: 40, y: 24, zoom: 0.9 }"
      :delete-key-code="null"
      :nodes-draggable="true"
      :edges-updatable="false"
      @connect="onConnect"
      @node-click="(payload) => store.selectNode(payload.node.id)"
      @edge-click="(payload) => store.selectEdge(payload.edge.id)"
      @pane-click="store.clearSelection()"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @viewport-change="onViewportChange"
    >
      <Background :gap="20" :size="1.6" :pattern-color="gridColor" />
      <Controls position="bottom-left" />
      <MiniMap pannable zoomable />
    </VueFlow>
  </div>
</template>
