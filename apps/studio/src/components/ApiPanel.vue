<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessageBox } from 'element-plus';
import { CopyDocument, Delete, Key, VideoPause, VideoPlay } from '@element-plus/icons-vue';
import { endpointApi } from '@/api';
import { errorMessage } from '@/api/client';
import { useProvidersStore } from '@/stores/providers';
import { useWorkflowStore } from '@/stores/workflow';
import { toast } from '@/utils/toast';
import type { EndpointStatus, ProviderProfilePayload } from '@/types';

/**
 * Publishes the open workflow as an HTTP endpoint.
 *
 * Everything a caller needs is on this one card — URL, token, copy-paste
 * examples — because the whole point is handing a colleague (or another service
 * of your own) a URL and a key, not explaining this app to them.
 *
 * The connections the run needs are snapshotted here and sealed on the server:
 * a caller holds a token and nothing else, so if the snapshot is empty the run
 * falls back to the server's own `.env` credentials, and the panel says so.
 */
const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const workflow = useWorkflowStore();
const providers = useProvidersStore();
const { t } = useI18n();

type ExampleId = 'curl' | 'javascript' | 'java';

const status = ref<EndpointStatus | null>(null);
const loading = ref(false);
const busy = ref(false);
const revealToken = ref(false);
const exampleTab = ref<ExampleId>('curl');

/** Only a saved project has an id to hang an endpoint off. */
const workflowId = computed(() => (workflow.isPersisted ? (workflow.current?.id ?? '') : ''));
const canPublish = computed(() => workflowId.value.length > 0);
const isPublished = computed(() => status.value?.published === true);

async function load(): Promise<void> {
  if (!canPublish.value) {
    status.value = null;
    return;
  }
  loading.value = true;
  try {
    status.value = await endpointApi.status(workflowId.value);
  } catch (error) {
    toast.error('endpoint.toast.failed', { error: errorMessage(error) });
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    revealToken.value = false;
    void load();
  },
);

// Switching projects with the panel open should follow the canvas, not go stale.
watch(workflowId, () => {
  if (props.modelValue) void load();
});

/** The connections this workflow's nodes actually point at — resolved to keys. */
function snapshot(): ProviderProfilePayload[] {
  return providers.selectionFor(workflow.nodes.map((node) => node.data.config)).profiles;
}

/** Publish for the first time, refresh the credential snapshot, or rotate. */
async function publish(rotate = false): Promise<void> {
  if (!canPublish.value) return;
  const republishing = isPublished.value;
  busy.value = true;
  try {
    status.value = await endpointApi.publish(workflowId.value, {
      providers: snapshot(),
      ...(rotate ? { rotate: true } : {}),
      enabled: true,
    });
    if (rotate) toast.success('endpoint.toast.rotated');
    else toast.success(republishing ? 'endpoint.toast.republished' : 'endpoint.toast.published');
  } catch (error) {
    toast.error('endpoint.toast.failed', { error: errorMessage(error) });
  } finally {
    busy.value = false;
  }
}

/** Pause and resume keep the token — only `providers` is left untouched. */
async function setEnabled(enabled: boolean): Promise<void> {
  busy.value = true;
  try {
    status.value = await endpointApi.publish(workflowId.value, { enabled });
    toast.success(enabled ? 'endpoint.toast.resumed' : 'endpoint.toast.paused');
  } catch (error) {
    toast.error('endpoint.toast.failed', { error: errorMessage(error) });
  } finally {
    busy.value = false;
  }
}

async function confirmRotate(): Promise<void> {
  try {
    await ElMessageBox.confirm(t('endpoint.rotateConfirm'), t('endpoint.rotateTitle'), {
      type: 'warning',
      confirmButtonText: t('endpoint.rotate'),
      cancelButtonText: t('endpoint.cancel'),
    });
  } catch {
    return;
  }
  await publish(true);
}

async function confirmRevoke(): Promise<void> {
  try {
    await ElMessageBox.confirm(t('endpoint.revokeConfirm'), t('endpoint.revokeTitle'), {
      type: 'warning',
      confirmButtonText: t('endpoint.revoke'),
      cancelButtonText: t('endpoint.cancel'),
    });
  } catch {
    return;
  }

  busy.value = true;
  try {
    await endpointApi.revoke(workflowId.value);
    status.value = await endpointApi.status(workflowId.value);
    revealToken.value = false;
    toast.success('endpoint.toast.revoked');
  } catch (error) {
    toast.error('endpoint.toast.failed', { error: errorMessage(error) });
  } finally {
    busy.value = false;
  }
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('endpoint.toast.copied');
  } catch {
    // Clipboard access needs a secure context; http://localhost qualifies, a
    // LAN IP over plain http does not.
    toast.error('endpoint.toast.copyFailed');
  }
}

/* ------------------------------ presentation ------------------------------ */

const shownToken = computed(() => {
  const current = status.value;
  if (!current?.token) return '';
  return revealToken.value ? current.token : (current.tokenHint ?? '');
});

const fullToken = computed(() => status.value?.token ?? '');

const callSummary = computed(() => {
  const current = status.value;
  if (!current) return '';
  return t('endpoint.callCount', { count: current.callCount });
});

const errorSummary = computed(() => {
  const current = status.value;
  if (!current || current.errorCount === 0) return '';
  return t('endpoint.errorCount', { count: current.errorCount });
});

const lastCalledText = computed(() => {
  const at = status.value?.lastCalledAt;
  return at ? t('endpoint.lastCalled', { time: formatTime(at) }) : t('endpoint.neverCalled');
});

const credentialText = computed(() => {
  const current = status.value;
  if (!current) return '';
  if (current.credentialsUnreadable) return t('endpoint.credentialsUnreadable');
  if (current.providers.count > 0) {
    return t('endpoint.credentialsCount', {
      count: current.providers.count,
      names: current.providers.labels.join(' · '),
    });
  }
  return current.serverFallback.offline ? t('endpoint.fallbackMock') : t('endpoint.credentialsEmpty');
});

const sampleInput = computed(() => workflow.lastInput || t('run.defaultInput'));

const examples = computed<Record<ExampleId, string>>(() => {
  const url = status.value?.runUrl ?? 'http://127.0.0.1:3000/api/v1/run';
  const token = fullToken.value || 'jf_your_token';
  const input = sampleInput.value;

  return {
    curl: [
      `curl -X POST "${url}" \\`,
      `  -H "x-api-key: ${token}" \\`,
      '  -H "Content-Type: application/json" \\',
      `  -d '{"input":"${input}"}'`,
    ].join('\n'),
    javascript: [
      `const res = await fetch("${url}", {`,
      '  method: "POST",',
      `  headers: { "x-api-key": "${token}", "Content-Type": "application/json" },`,
      `  body: JSON.stringify({ input: "${input}" }),`,
      '});',
      '',
      'const { output, status, steps, durationMs } = await res.json();',
      'console.log(output);',
    ].join('\n'),
    java: [
      'HttpClient client = HttpClient.newHttpClient();',
      'HttpRequest request = HttpRequest.newBuilder()',
      `    .uri(URI.create("${url}"))`,
      `    .header("x-api-key", "${token}")`,
      '    .header("Content-Type", "application/json")',
      `    .POST(HttpRequest.BodyPublishers.ofString("{\\"input\\":\\"${input}\\"}"))`,
      '    .build();',
      '',
      'HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
      'System.out.println(response.body());',
    ].join('\n'),
  };
});

const exampleTabs: readonly ExampleId[] = ['curl', 'javascript', 'java'];
const exampleLabels: Record<ExampleId, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  java: 'Java',
};
/** Built once rather than inline in the template, where it would be a new array
 *  on every render and make the segmented control re-diff itself each keystroke. */
const exampleOptions = exampleTabs.map((id) => ({ label: exampleLabels[id], value: id }));

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('endpoint.title')"
    width="760px"
    class="endpoint-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="dialog-hint">{{ t('endpoint.hint') }}</p>

    <p v-if="!canPublish" class="settings-empty">{{ t('endpoint.draftHint') }}</p>

    <template v-else>
      <!-- `data-*` mirrors the state so acceptance scripts can read it without
           guessing at Element Plus' internals. -->
      <div
        class="endpoint-status"
        :data-published="isPublished"
        :data-enabled="status?.enabled === true"
        :data-loading="loading"
      >
        <el-tag v-if="!isPublished" type="info">{{ t('endpoint.notPublished') }}</el-tag>
        <el-tag v-else-if="status?.enabled" type="success">{{ t('endpoint.published') }}</el-tag>
        <el-tag v-else type="warning">{{ t('endpoint.paused') }}</el-tag>

        <span v-if="isPublished" class="endpoint-status__meta">
          {{ callSummary }}
          <template v-if="errorSummary"> · {{ errorSummary }}</template>
          <template v-if="loading"> · {{ t('endpoint.loading') }}</template>
        </span>
      </div>

      <!-- Not published yet: one button and an honest explanation of the model. -->
      <div v-if="!isPublished" class="endpoint-intro">
        <p class="endpoint-note">{{ t('endpoint.introNote') }}</p>
        <el-button type="primary" :loading="busy" @click="publish(false)">
          {{ t('endpoint.publish') }}
        </el-button>
      </div>

      <template v-else>
        <div class="endpoint-row" data-role="url">
          <span class="endpoint-row__label">{{ t('endpoint.url') }}</span>
          <code class="endpoint-row__value">{{ status?.runUrl }}</code>
          <el-button text :icon="CopyDocument" @click="copy(status?.runUrl ?? '')" />
        </div>

        <div class="endpoint-row" data-role="token">
          <span class="endpoint-row__label">{{ t('endpoint.token') }}</span>
          <code class="endpoint-row__value">{{ shownToken }}</code>
          <el-button text :icon="Key" @click="revealToken = !revealToken">
            {{ revealToken ? t('endpoint.hide') : t('endpoint.show') }}
          </el-button>
          <el-button text :icon="CopyDocument" @click="copy(fullToken)" />
        </div>

        <div class="endpoint-row endpoint-row--stack">
          <span class="endpoint-row__label">{{ t('endpoint.credentials') }}</span>
          <span class="endpoint-row__text" :class="{ 'is-warn': status?.credentialsUnreadable }">
            {{ credentialText }}
          </span>
        </div>

        <div class="endpoint-row endpoint-row--stack">
          <span class="endpoint-row__label">{{ t('endpoint.usedAt') }}</span>
          <span class="endpoint-row__text">{{ lastCalledText }}</span>
        </div>

        <p class="endpoint-note">{{ t('endpoint.syncHint') }}</p>

        <div class="endpoint-examples">
          <div class="endpoint-examples__head">
            <span class="endpoint-row__label">{{ t('endpoint.examples') }}</span>
            <el-segmented v-model="exampleTab" size="small" :options="exampleOptions" />
          </div>
          <div class="endpoint-code">
            <pre>{{ examples[exampleTab] }}</pre>
            <el-button text :icon="CopyDocument" class="endpoint-code__copy" @click="copy(examples[exampleTab])" />
          </div>
        </div>

        <p class="endpoint-note endpoint-note--warn">{{ t('endpoint.securityNote') }}</p>
      </template>
    </template>

    <template #footer>
      <div class="settings-footer">
        <span class="settings-storage">{{ t('endpoint.storage') }}</span>
        <div class="settings-footer__actions">
          <template v-if="isPublished">
            <el-button :icon="Key" :disabled="busy" @click="confirmRotate">
              {{ t('endpoint.rotate') }}
            </el-button>
            <el-button
              :icon="status?.enabled ? VideoPause : VideoPlay"
              :disabled="busy"
              @click="setEnabled(!status?.enabled)"
            >
              {{ status?.enabled ? t('endpoint.pause') : t('endpoint.resume') }}
            </el-button>
            <el-button type="primary" :disabled="busy" @click="publish(false)">
              {{ t('endpoint.republish') }}
            </el-button>
            <el-button type="danger" plain :icon="Delete" :disabled="busy" @click="confirmRevoke">
              {{ t('endpoint.revoke') }}
            </el-button>
          </template>
          <el-button @click="emit('update:modelValue', false)">{{ t('endpoint.close') }}</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>
