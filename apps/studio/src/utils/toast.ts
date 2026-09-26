import { ElMessage } from 'element-plus';
import { translate } from '@/i18n';

type Params = Record<string, unknown>;

/**
 * Thin `ElMessage` wrapper that takes a message key instead of a string, so a
 * toast fired from a store or an async action still lands in the active
 * language at the moment it is shown.
 */
export const toast = {
  success(key: string, params?: Params): void {
    ElMessage.success(translate(key, params));
  },
  error(key: string, params?: Params): void {
    ElMessage.error(translate(key, params));
  },
  warning(key: string, params?: Params): void {
    ElMessage.warning(translate(key, params));
  },
  info(key: string, params?: Params): void {
    ElMessage.info(translate(key, params));
  },
};
