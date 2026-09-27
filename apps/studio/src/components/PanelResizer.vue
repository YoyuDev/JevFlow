<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Which way the handle splits the layout:
     * `vertical` stands upright between two columns (drag left/right),
     * `horizontal` lies flat between two rows (drag up/down).
     * Matches `aria-orientation`.
     */
    orientation: 'vertical' | 'horizontal';
    /** Size of the pane this handle controls, in px. */
    modelValue: number;
    min: number;
    max: number;
    /**
     * Set when the pane sits *after* the handle (right column, bottom row): there
     * dragging right/down must shrink it, so the deltas are negated.
     */
    invert?: boolean;
    /** Named in the ARIA label, e.g. “节点库”. */
    label: string;
  }>(),
  { invert: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: number];
  reset: [];
}>();

const KEY_STEP = 16;
const KEY_STEP_COARSE = 64;

const isColumn = computed(() => props.orientation === 'vertical');
/** Positive drag along the axis (right / down) grows the pane when not inverted. */
const sign = computed(() => (props.invert ? -1 : 1));
const valueNow = computed(() => Math.round(props.modelValue));

const dragging = ref(false);
let pointerId: number | null = null;
let startSize = 0;
let startPos = 0;

function clampSize(value: number): number {
  return Math.min(Math.max(value, props.min), props.max);
}

function axisPosition(event: PointerEvent): number {
  return isColumn.value ? event.clientX : event.clientY;
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || pointerId !== null) return;

  // Pointer capture keeps the drag alive over the canvas and the trace, which
  // would otherwise swallow the moves.
  const handle = event.currentTarget as HTMLElement;
  dragging.value = true;
  pointerId = event.pointerId;
  startSize = props.modelValue;
  startPos = axisPosition(event);
  handle.setPointerCapture(event.pointerId);
  document.body.classList.add(isColumn.value ? 'is-resizing-col' : 'is-resizing-row');
  event.preventDefault();
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || event.pointerId !== pointerId) return;
  const delta = axisPosition(event) - startPos;
  emit('update:modelValue', clampSize(startSize + sign.value * delta));
}

function endDrag(event: PointerEvent): void {
  if (pointerId === null || event.pointerId !== pointerId) return;
  releasePointer(event.currentTarget as HTMLElement, event.pointerId);
  dragging.value = false;
  pointerId = null;
  clearBodyCursor();
}

/** Arrow keys follow the handle's own direction, so “left” always means “shrink a left pane”. */
function onKeydown(event: KeyboardEvent): void {
  const { key } = event;
  const backKey = isColumn.value ? 'ArrowLeft' : 'ArrowUp';
  const forwardKey = isColumn.value ? 'ArrowRight' : 'ArrowDown';

  if (key === 'Home' || key === 'End' || key === 'Enter') {
    event.preventDefault();
    if (key === 'Home') emit('update:modelValue', props.min);
    else if (key === 'End') emit('update:modelValue', props.max);
    else emit('reset');
    return;
  }

  if (key !== backKey && key !== forwardKey) return;
  event.preventDefault();

  const step = (event.shiftKey ? KEY_STEP_COARSE : KEY_STEP) * sign.value;
  const delta = key === backKey ? -step : step;
  emit('update:modelValue', clampSize(props.modelValue + delta));
}

function onDoubleClick(): void {
  emit('reset');
}

function releasePointer(element: HTMLElement, id: number): void {
  if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
}

function clearBodyCursor(): void {
  document.body.classList.remove('is-resizing-col', 'is-resizing-row');
}

onBeforeUnmount(() => {
  if (pointerId !== null) clearBodyCursor();
});
</script>

<template>
  <div
    class="resizer"
    :class="[isColumn ? 'resizer--col' : 'resizer--row', { 'is-dragging': dragging }]"
    role="separator"
    :aria-orientation="orientation"
    :aria-label="label"
    :aria-valuenow="valueNow"
    :aria-valuemin="min"
    :aria-valuemax="max"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @keydown="onKeydown"
    @dblclick="onDoubleClick"
  >
    <span class="resizer__grip" aria-hidden="true" />
  </div>
</template>
