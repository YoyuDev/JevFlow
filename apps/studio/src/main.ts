import { createApp } from 'vue';
import ElementPlus from 'element-plus';

import 'element-plus/dist/index.css';
// Element Plus stores its dark palette in `html.dark` custom properties.
import 'element-plus/theme-chalk/dark/css-vars.css';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
// Imported last so the Studio's own tokens win over the library defaults.
import './styles/index.css';

import App from './App.vue';
import { i18n } from './i18n';
import { pinia } from './stores';

// Element Plus itself gets its locale from `el-config-provider` in `App.vue`,
// because that one has to react to the language switch.
createApp(App).use(pinia).use(i18n).use(ElementPlus).mount('#app');
