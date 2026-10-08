<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import ProviderPicker from '@/components/ProviderPicker.vue';
import { HTTP_METHODS } from '@/constants/connections';
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

function boolField(key: string, fallback: boolean): boolean {
  const value = config.value[key];
  return typeof value === 'boolean' ? value : fallback;
}

/** GET cannot carry a body, so the field is hidden rather than silently ignored. */
const httpHasBody = computed(() => (field('method') || 'GET') !== 'GET');

/** Where a `{{token}}` click lands, per node type. */
const tokenTarget = computed(() => {
  if (nodeType.value === 'tool') return 'query';
  if (nodeType.value === 'http') return 'url';
  // End has no prompt: its one editable field is the output template, so a
  // clicked variable has to land there or the click looks like a no-op.
  if (nodeType.value === 'end') return 'output';
  return 'prompt';
});

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

/**
 * Picked by the `el-select` for one edge's branch condition.
 *
 * Written as a plain function rather than a factory on purpose — see the note
 * on event bindings below.
 */
function setBranchCondition(edgeId: string, value: unknown): void {
  store.updateEdgeCondition(edgeId, String(value ?? ''));
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
 * ---------------------------------------------------------------------------
 * 模板里的 `@update:model-value` 一律写成「直接调用」，例如
 *   @update:model-value="set('prompt', $event)"
 *
 * 千万别改回「工厂函数」写法（`fieldInput('prompt')`）。Vue 只会把**成员表达式**
 * （`onLabel`、`providerInput`）原样当 handler；带括号的调用会被编译成
 *   `$event => fieldInput('prompt')`
 * 也就是每次事件都新建一个函数然后丢掉 —— 输入框看着能用，值永远写不进去。
 * ---------------------------------------------------------------------------
 */

/** `ProviderPicker` already narrowed this to a string. */
function providerInput(value: string): void {
  set('providerId', value);
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
          <ProviderPicker
            kind="llm"
            :model-value="field('providerId')"
            @update:model-value="providerInput"
          />
          <div class="field">
            <label>{{ t('inspector.model') }}</label>
            <el-input
              :model-value="field('model')"
              :placeholder="t('inspector.modelPlaceholder')"
              @update:model-value="set('model', $event)"
            />
          </div>
          <div class="field">
            <label>{{ t('inspector.systemPrompt') }}</label>
            <el-input
              type="textarea"
              :rows="3"
              :model-value="field('systemPrompt')"
              @update:model-value="set('systemPrompt', $event)"
            />
          </div>
          <div class="field">
            <label>{{ t('inspector.prompt') }}</label>
            <el-input
              type="textarea"
              :rows="5"
              :model-value="field('prompt')"
              @update:model-value="set('prompt', $event)"
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
              @update:model-value="set('temperature', $event)"
            />
          </div>
        </template>

        <template v-else-if="nodeType === 'jev'">
          <ProviderPicker
            kind="jev"
            :model-value="field('providerId')"
            @update:model-value="providerInput"
          />
          <div class="field">
            <label>{{ t('inspector.question') }}</label>
            <el-input
              type="textarea"
              :rows="3"
              :model-value="field('question')"
              @update:model-value="set('question', $event)"
            />
          </div>
          <div class="field">
            <label>{{ t('inspector.decisionType') }}</label>
            <el-input :model-value="t('inspector.choice')" disabled />
          </div>
          <div class="field">
            <label>{{ t('inspector.choices') }}</label>
            <!-- Keyed by index on purpose: keying by the value would rebuild the
                 row (and drop focus) on the first keystroke of an edit. -->
            <div v-for="(choice, index) in choices()" :key="index" class="choice-row">
              <el-input
                :model-value="choice"
                @update:model-value="setChoice(index, String($event ?? ''))"
              />
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
                @update:model-value="setBranchCondition(item.id, $event)"
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
            <el-select
              :model-value="field('tool') || 'search'"
              @update:model-value="set('tool', $event)"
            >
              <el-option v-for="tool in toolOptions" :key="tool" :label="tool" :value="tool" />
            </el-select>
          </div>
          <div class="field">
            <label>{{ t('inspector.query') }}</label>
            <el-input
              :model-value="field('query')"
              placeholder="{{input}}"
              @update:model-value="set('query', $event)"
            />
          </div>
        </template>

        <template v-else-if="nodeType === 'http'">
          <ProviderPicker
            kind="api"
            :model-value="field('providerId')"
            @update:model-value="providerInput"
          />

          <div class="field">
            <label>{{ t('inspector.method') }}</label>
            <el-select
              :model-value="field('method') || 'GET'"
              @update:model-value="set('method', $event)"
            >
              <el-option v-for="item in HTTP_METHODS" :key="item" :label="item" :value="item" />
            </el-select>
          </div>

          <div class="field">
            <label>{{ t('inspector.url') }}</label>
            <el-input
              :model-value="field('url')"
              :placeholder="t('inspector.urlPlaceholder')"
              @update:model-value="set('url', $event)"
            />
            <p class="hint">{{ t('inspector.urlHint') }}</p>
          </div>

          <div class="field">
            <label>{{ t('inspector.headers') }}</label>
            <el-input
              type="textarea"
              :rows="3"
              :model-value="field('headers')"
              :placeholder="t('inspector.headersPlaceholder')"
              @update:model-value="set('headers', $event)"
            />
            <p class="hint">{{ t('inspector.headersHint') }}</p>
          </div>

          <div v-if="httpHasBody" class="field">
            <label>{{ t('inspector.body') }}</label>
            <el-input
              type="textarea"
              :rows="4"
              :model-value="field('body')"
              placeholder='{"query": "{{input}}"}'
              @update:model-value="set('body', $event)"
            />
            <p class="hint">{{ t('inspector.bodyHint') }}</p>
          </div>

          <div class="field">
            <label>{{ t('inspector.timeout') }}</label>
            <el-input-number
              :model-value="numberField('timeoutMs', 15000)"
              :min="1000"
              :max="120000"
              :step="1000"
              @update:model-value="set('timeoutMs', $event)"
            />
          </div>

          <div class="field">
            <label>{{ t('inspector.failOnError') }}</label>
            <el-switch
              :model-value="boolField('failOnError', true)"
              @update:model-value="set('failOnError', $event)"
            />
            <p class="hint">{{ t('inspector.failOnErrorHint') }}</p>
          </div>
        </template>

        <template v-else-if="nodeType === 'end'">
          <div class="field">
            <label>{{ t('inspector.outputTemplate') }}</label>
            <el-input
              :model-value="field('output')"
              :placeholder="t('inspector.outputTemplatePlaceholder')"
              @update:model-value="set('output', $event)"
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
              @click="appendToken(token, tokenTarget)"
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
            @update:model-value="setBranchCondition(edgeKey, $event)"
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
