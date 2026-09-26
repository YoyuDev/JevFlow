import { createPinia } from 'pinia';

export const pinia = createPinia();

export { usePreferencesStore } from './preferences';
export { useWorkflowStore } from './workflow';
