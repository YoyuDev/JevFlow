import { ref } from 'vue';
import { defineStore } from 'pinia';
import { ElMessageBox } from 'element-plus';
import { workflowApi } from '@/api';
import { errorMessage } from '@/api/client';
import { translate } from '@/i18n';
import { useWorkflowStore } from '@/stores/workflow';
import { toast } from '@/utils/toast';

/**
 * Project lifecycle: create, open, rename, duplicate, delete.
 *
 * The canvas itself belongs to the workflow store — this one owns what you do
 * *to* a project from the outside, plus the guard that keeps a project switch
 * from silently discarding unsaved work.
 */
export const useProjectsStore = defineStore('projects', () => {
  const workflow = useWorkflowStore();

  /** Panel visibility lives here so the header button and the dialog agree. */
  const panelVisible = ref(false);

  function openPanel(): void {
    panelVisible.value = true;
  }

  function closePanel(): void {
    panelVisible.value = false;
  }

  /**
   * Everything that throws the canvas away goes through here first.
   * `false` means the user backed out — the caller must not proceed.
   */
  async function confirmDiscard(titleKey: string): Promise<boolean> {
    if (!workflow.dirty) return true;
    try {
      await ElMessageBox.confirm(translate('dialog.unsavedMessage'), translate(titleKey), {
        type: 'warning',
        confirmButtonText: translate('dialog.continue'),
        cancelButtonText: translate('dialog.cancel'),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Switches to another project. A no-op when it is already the open one. */
  async function open(id: string): Promise<boolean> {
    if (!id || id === workflow.current?.id) return false;
    if (!(await confirmDiscard('dialog.switchTitle'))) return false;
    await workflow.open(id);
    return true;
  }

  /** Starts a blank project (a single Start node on an empty canvas). */
  async function create(): Promise<boolean> {
    if (!(await confirmDiscard('dialog.unsavedTitle'))) return false;
    workflow.createNew();
    return true;
  }

  async function rename(id: string, nextName: string): Promise<boolean> {
    const name = nextName.trim();
    if (!name) return false;
    try {
      await workflowApi.rename(id, name);
      // The open project keeps its own copy of the name; refresh it in place so
      // the canvas header does not need a reload.
      const current = workflow.current;
      if (current && current.id === id) current.name = name;
      await workflow.refreshList();
      toast.success('toast.renamed', { name });
      return true;
    } catch (error) {
      toast.error('toast.renameFailed', { error: errorMessage(error) });
      return false;
    }
  }

  /**
   * Copies a project. It reads the *saved* version — anything still unsaved on
   * the canvas is deliberately not included, which is why the caller warns
   * about it when the project being copied is the open, dirty one.
   */
  async function duplicate(id: string): Promise<boolean> {
    try {
      const source = await workflowApi.get(id);
      const created = await workflowApi.create({
        name: `${source.name} ${translate('projects.copySuffix')}`,
        ...(source.description ? { description: source.description } : {}),
        nodes: source.nodes,
        edges: source.edges,
      });
      await workflow.refreshList();
      toast.success('toast.duplicated', { name: created.name });
      return true;
    } catch (error) {
      toast.error('toast.duplicateFailed', { error: errorMessage(error) });
      return false;
    }
  }

  /** Deletes any project. Deleting the open one falls back to the next in list. */
  async function remove(id: string): Promise<boolean> {
    if (workflow.current?.id === id) {
      await workflow.remove();
      return true;
    }
    try {
      await workflowApi.remove(id);
      await workflow.refreshList();
      toast.success('toast.workflowRemoved');
      return true;
    } catch (error) {
      toast.error('toast.workflowRemoveFailed', { error: errorMessage(error) });
      return false;
    }
  }

  return {
    panelVisible,
    openPanel,
    closePanel,
    confirmDiscard,
    open,
    create,
    rename,
    duplicate,
    remove,
  };
});
