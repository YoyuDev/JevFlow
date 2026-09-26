<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { NODE_ACCENTS } from '@/constants/nodeCatalog';
import { useWorkflowStore } from '@/stores/workflow';
import { toast } from '@/utils/toast';

const store = useWorkflowStore();
const { t } = useI18n();

const node = computed(() => store.selectedNode);
const edge = computed(() => store.selectedEdge);
const nodeType = computed(() => node.value?.data.nodeType ?? null);
const config = computed<Record<string, unknown>>(() => node.value?.data.config ?? {});
const outgoing = computed(() => store.outgoingEdgesOfSelected);
const toolOptions = computed(() => store.runtime?.tools ?? ['search']);
const edgeCondition = computed(() => {
  const raw = edge.value?.data as Record<string, unknown> | undefined;
  return typeof raw?.['condition'] === 'string' ? String(raw['condition']) : '';
});

const panelTitle = computed(() => {
  if (node.value) return t('panel.nodeConfig');
  if (edge.value) return t('panel.edge');
  return t('panel.workflow');
});

/** Read through a computed so template closures never see a `null` edge. */
const edgeKey = computed(() => edge.value?.id ?? '');

/** Available `{{token}}` templates for this workflow. */
const availableVariables = computed(() => {
  const self = node.value?.id;
  const nodeTokens = store.nodes
    .map((item) => item.id)
    .filter((id) => id !== self)
    .map((id) => `{{${id}}}`);
  return ['{{input}}', '{{last}}', ...nodeTokens, '{{lastLLM}}', '{{lastTool}}'];
});

function field(key: string): string {
  const value = config.value[key];
  return typeof value === 'string' ? value : '';
}

function numberField(key: string, fallback: number): number {
  const value = config.value[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function choices(): string[] {
  const value = config.value['choices'];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function set(key: string, value: unknown): void {
  if (!node.value) return;
  store.updateNodeConfig(node.value.id, { [key]: value });
}

function setChoice(index: number, value: string): void {
  const next = [...choices()];
  next[index] = value;
  set('choices', next);
}

function addChoice(): void {
  set('choices', [...choices(), `choice-${choices().length + 1}`]);
}

function removeChoice(index: number): void {
  const next = [...choices()];
  next.splice(index, 1);
  set('choices', next);
}

function onLabel(value: string): void {
  if (node.value) store.updateNodeLabel(node.value.id, value);
}

function appendToken(token: string, key: string): void {
  set(key, `${field(key)}${token}`);
}

/**
 * Element Plus emits `string` from `el-input` and `number | undefined` from
 * `el-input-number`. These factories keep the template free of inline arrow
 * functions, which Vue cannot type-check without an inline annotation.
 */
function fieldInput(key: string): (value: string | number | undefined) => void {
  return (value) => set(key, value);
}

function choiceInput(index: number): (value: string | number | undefined) => void {
  return (value) => setChoice(index, String(value ?? ''));
}

function conditionInput(edgeId: string): (value: string | number | undefined) => void {
  return (value) => store.updateEdgeCondition(edgeId, String(value ?? ''));
}

async function confirmRemoveNode(): Promise<void> {
  if (!node.value) return;
  const id = node.value.id;
  try {
    await ElMessageBox.confirm(
      t('inspector.confirmRemoveNode', { id }),
      t('inspector.confirmRemoveNodeTitle'),
      {
        type: 'warning',
        confirmButtonText: t('dialog.delete'),
        cancelButtonText: t('dialog.cancel'),
      },
    );
  } catch {
    return;
  }
  store.removeNode(id);
  toast.success('inspector.nodeRemoved');
}

async function confirmRemoveEdge(): Promise<void> {
  if (!edge.value) return;
  const id = edge.value.id;
  try {
    await ElMessageBox.confirm(
      t('inspector.confirmRemoveEdge', { id }),
      t('inspector.confirmRemoveEdgeTitle'),
      {
        type: 'warning',
        confirmButtonText: t('dialog.delete'),
        cancelButtonText: t('dialog.cancel'),
      },
    );
  } catch {
    return;
  }
  store.removeEdge(id);
  toast.success('inspector.edgeRemoved');
}
</script>

<template>
  <aside class="panel inspector">
    <header class="panel__head">
      <h2>{{ panelTitle }}</h2>
      <span v-if="nodeType" class="badge" :style="{ background: NODE_ACCENTS[nodeType] }">
        {{ nodeType }}
      </span>
    </header>

    <div class="panel__body">
      <!-- ---------------------------- node ---------------------------- -->
      <template v-if="node">
        <div class="field">
          <label>{{ t('inspector.nodeId') }}</label>
          <code>{{ node.id }}</code>
        </div>
        <div class="field">
          <label>{{ t('inspector.label') }}</label>
          <el-input :model-value="node.data.label" @update:model-value="onLabel" />
        </div>

        <template v-if="nodeType === 'start'">
          <p class="hint">{{ t('inspector.startHint') }}</p>
        </template>

        <template v-else-if="nodeType === 'llm'">
          <div class="field">
            <label>{{ t('inspector.model') }}</label>
            <el-input
              :model-value="field('model')"
              placeholder="mock-model"
              @update:model-value="fieldInput('model')"
            />
          </div>
          <div class="field">
            <label>{{ t('inspector.systemPrompt') }}</label>
            <el-input
              type="textarea"
              :rows="3"
              :model-value="field('systemPrompt')"
              @update:model-value="fieldInput('systemPrompt')"
            />
          </div>
          <div class="field">
            <label>{{ t('inspector.prompt') }}</label>
            <el-input
              type="textarea"
              :rows="5"
              :model-value="field('prompt')"
              @update:model-value="fieldInput('prompt')"
            />
          </div>
          <div class="field">
            <label>{{ t('inspector.temperature') }}</label>
            <el-input-number
              :model-value="numberField('temperature', 0.7)"
              :min="0"
              :max="2"
              :step="0.1"
              :precision="1"
              @update:model-value="fieldInput('temperature')"
            />
          </div>
        </template>

        <template v-else-if="nodeType === 'jev'">
          <div class="field">
            <label>{{ t('inspector.question') }}</label>
            <el-input
              type="textarea"
              :rows="3"
              :model-value="field('question')"
              @update:model-value="fieldInput('question')"
            />
          </div>
          <div class="field">
            <label>{{ t('inspector.decisionType') }}</label>
            <el-input :model-value="t('inspector.choice')" disabled />
          </div>
          <div class="field">
            <label>{{ t('inspector.choices') }}</label>
            <div v-for="(choice, index) in choices()" :key="`${index}-${choice}`" class="choice-row">
              <el-input :model-value="choice" @update:model-value="choiceInput(index)" />
              <el-button text type="danger" @click="removeChoice(index)">×</el-button>
            </div>
            <el-button size="small" @click="addChoice">{{ t('inspector.addChoice') }}</el-button>
          </div>

          <div v-if="outgoing.length" class="field">
            <label>{{ t('inspector.branches') }}</label>
            <div v-for="item in outgoing" :key="item.id" class="choice-row">
              <code class="edge-target">→ {{ item.target }}</code>
              <el-select
                :model-value="String(item.data?.condition ?? '')"
                :placeholder="t('inspector.condition')"
                @update:model-value="conditionInput(item.id)"
              >
                <el-option v-for="choice in choices()" :key="choice" :label="choice" :value="choice" />
              </el-select>
            </div>
            <p class="hint">{{ t('inspector.branchesHint') }}</p>
          </div>
        </template>

        <template v-else-if="nodeType === 'tool'">
          <div class="field">
            <label>{{ t('inspector.tool') }}</label>
            <el-select :model-value="field('tool') || 'search'" @update:model-value="fieldInput('tool')">
              <el-option v-for="tool in toolOptions" :key="tool" :label="tool" :value="tool" />
            </el-select>
          </div>
          <div class="field">
            <label>{{ t('inspector.query') }}</label>
            <el-input
              :model-value="field('query')"
              placeholder="{{input}}"
              @update:model-value="fieldInput('query')"
            />
          </div>
        </template>

        <template v-else-if="nodeType === 'end'">
          <div class="field">
            <label>{{ t('inspector.outputTemplate') }}</label>
            <el-input
              :model-value="field('output')"
              :placeholder="t('inspector.outputTemplatePlaceholder')"
              @update:model-value="fieldInput('output')"
            />
          </div>
          <p class="hint">{{ t('inspector.outputHint') }}</p>
        </template>

        <div class="field">
          <label>{{ t('inspector.variables') }}</label>
          <div class="variable-list">
            <span
              v-for="token in availableVariables"
              :key="token"
              class="variable-token"
              @click="appendToken(token, nodeType === 'tool' ? 'query' : 'prompt')"
            >
              {{ token }}
            </span>
          </div>
          <p class="hint">{{ t('inspector.variablesHint') }}</p>
        </div>
      </template>

      <!-- ---------------------------- edge ---------------------------- -->
      <template v-else-if="edge">
        <div class="field">
          <label>{{ t('inspector.edge') }}</label>
          <code>{{ edge.id }}</code>
        </div>
        <div class="field">
          <label>{{ t('inspector.path') }}</label>
          <code>{{ edge.source }} → {{ edge.target }}</code>
        </div>
        <div class="field">
          <label>{{ t('inspector.condition') }}</label>
          <el-input
            :model-value="edgeCondition"
            :placeholder="t('inspector.conditionPlaceholder')"
            @update:model-value="conditionInput(edgeKey)"
          />
        </div>
        <p class="hint">{{ t('inspector.edgeHint') }}</p>
      </template>

      <!-- -------------------------- workflow -------------------------- -->
      <template v-else>
        <div class="field">
          <label>{{ t('inspector.name') }}</label>
          <el-input v-model="store.name" :placeholder="t('inspector.namePlaceholder')" />
        </div>
        <div class="field">
          <label>{{ t('inspector.description') }}</label>
          <el-input
            v-model="store.description"
            type="textarea"
            :rows="3"
            :placeholder="t('inspector.descriptionPlaceholder')"
          />
        </div>
        <div class="workflow-meta">
          <div class="stat">
            <span>{{ t('inspector.statNodes') }}</span>
            <strong>{{ store.nodes.length }}</strong>
          </div>
          <div class="stat">
            <span>{{ t('inspector.statEdges') }}</span>
            <strong>{{ store.edges.length }}</strong>
          </div>
          <div class="stat">
            <span>{{ t('inspector.statVersion') }}</span>
            <strong>{{ store.current?.version ?? 0 }}</strong>
          </div>
          <div class="stat">
            <span>{{ t('inspector.statStatus') }}</span>
            <strong>{{ store.dirty ? t('workflow.unsaved') : t('workflow.saved') }}</strong>
          </div>
        </div>
        <p class="hint">{{ t('inspector.workflowHint') }}</p>
      </template>
    </div>

    <footer v-if="node || edge" class="inspector__footer">
      <el-button v-if="node" type="danger" plain style="width: 100%" @click="confirmRemoveNode">
        {{ t('inspector.removeNode') }}
      </el-button>
      <el-button v-else type="danger" plain style="width: 100%" @click="confirmRemoveEdge">
        {{ t('inspector.removeEdge') }}
      </el-button>
    </footer>
  </aside>
</template>
