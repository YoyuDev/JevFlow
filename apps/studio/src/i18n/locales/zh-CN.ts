/**
 * 简体中文文案（默认语言）。
 *
 * 这里的结构就是唯一的标准：`en-US.ts` 用 `MessageSchema` 标注，少一个 key
 * 都过不了类型检查。
 */
const zhCN = {
  app: {
    tagline: 'LLM 负责生成 · Jev 负责决策 · Runtime 负责执行',
  },

  preferences: {
    language: '语言',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    switchToLight: '切换到浅色',
    switchToDark: '切换到深色',
  },

  layout: {
    resizeNodes: '拖拽调整节点库宽度（双击恢复默认）',
    resizeInspector: '拖拽调整配置面板宽度（双击恢复默认）',
    resizeTrace: '拖拽调整执行轨迹高度（双击恢复默认）',
  },

  workflow: {
    select: '选择工作流',
    untitled: '未命名工作流',
    new: '新建',
    remove: '删除',
    save: '保存',
    run: '运行工作流',
    unsaved: '未保存',
    saved: '已保存',
  },

  panel: {
    nodes: '节点库',
    inspector: '配置面板',
    nodeConfig: '节点配置',
    edge: '连线',
    workflow: '工作流',
    none: '未选中',
  },

  nodes: {
    groups: {
      trigger: '触发器',
      ai: 'AI',
      tools: '工具',
      control: '控制',
    },
    start: {
      label: 'Start',
      description: '工作流入口，接收用户输入',
    },
    llm: {
      label: 'LLM',
      description: '调用大模型生成内容',
      defaultSystemPrompt: '你是一个严谨、务实的助手。回答具体、结构清晰。',
    },
    jev: {
      label: 'Jev',
      description: '对当前状态做结构化决策',
      defaultQuestion: '当前信息是否足够？',
    },
    tool: {
      label: 'Tool',
      description: '调用工具（内置 mock search）',
    },
    end: {
      label: 'End',
      description: '结束并输出结果',
    },
    hint: '拖拽到画布添加节点，也可以直接点击。选中节点后在右侧配置。',
    summary: {
      start: '入口 · 接收用户输入',
      endCustom: '自定义输出模板',
      endDefault: '输出上一个节点的结果',
      choiceCount: '{count} 个选项',
      untitledQuestion: '未命名问题',
    },
  },

  inspector: {
    nodeId: '节点 ID',
    label: '显示名称',
    provider: '连接',
    providerDefault: '跟随服务端默认',
    providerEmpty: '还没有连接配置，点右上角齿轮添加。',
    providerMissing: '节点指向的连接「{id}」已不存在，运行时会回落到服务端默认。',
    providerNoKey: '这套连接还没填 API Key，运行时会回落成 Mock。',
    providerModel: '模型：{model}（节点里留空就用它）',
    startHint: 'Start 无需配置，运行时会把用户输入作为入口数据推给下一个节点。',
    model: '模型',
    modelPlaceholder: '留空则用连接里的模型',
    systemPrompt: 'System Prompt',
    prompt: 'Prompt',
    temperature: 'Temperature',
    question: '问题',
    decisionType: '决策类型',
    choice: '选项',
    choices: '选项列表',
    addChoice: '新增选项',
    branches: '分支',
    branchesHint: 'Jev 返回哪个选项，就走对应的分支。',
    tool: '工具',
    query: '查询语句',
    outputTemplate: '输出模板',
    outputTemplatePlaceholder: '留空则输出上一个节点的结果',
    outputHint: '留空时，工作流的输出等于上一个节点的输出。',
    variables: '可用变量',
    variablesHint: '点击可追加到 Prompt / Query。',
    edge: '连线 ID',
    path: '路径',
    condition: '分支条件',
    conditionPlaceholder: '留空 = 默认分支',
    edgeHint: '普通节点的出边留空即可。Jev 节点的出边必须填写条件，取值来自该节点的选项列表。',
    name: '名称',
    namePlaceholder: '工作流名称',
    description: '描述',
    descriptionPlaceholder: '可选',
    statNodes: '节点数',
    statEdges: '连线数',
    statVersion: '版本',
    statStatus: '状态',
    workflowHint: '点击画布上的节点或连线进行配置，拖拽左侧节点即可添加。',
    removeNode: '删除节点',
    removeEdge: '删除连线',
    confirmRemoveNodeTitle: '删除节点',
    confirmRemoveNode: '删除节点 {id}？相关连线会一并移除。',
    confirmRemoveEdgeTitle: '删除连线',
    confirmRemoveEdge: '删除连线 {id}？',
    nodeRemoved: '节点已删除',
    edgeRemoved: '连线已删除',
  },

  trace: {
    title: '执行记录',
    meta: '{status} · {steps} 步 · {duration}ms',
    running: '运行中…',
    clear: '清空',
    empty: '还没有执行记录。点击右上角「运行工作流」跑一次，这里会显示每个节点的输入、输出与 Jev 决策。',
    status: '状态',
    duration: '耗时',
    nodeType: '节点类型',
    decision: '决策',
    probability: '概率',
    confidence: '置信度',
    input: '输入',
    output: '输出',
    nodeStatus: {
      success: '成功',
      failed: '失败',
      skipped: '已跳过',
    },
    runStatus: {
      running: '运行中',
      completed: '已完成',
      failed: '失败',
    },
  },

  run: {
    title: '运行工作流',
    hint: '输入会作为 Start 节点的入口数据进入工作流。',
    placeholder: '请输入你的问题…',
    defaultInput: '请介绍一下 AI Agent',
    cancel: '取消',
    run: '运行',
    presets: {
      intro: '请介绍一下 AI Agent',
      decision: 'JevFlow 的决策机制是怎么工作的？',
      scenario: '可视化工作流编排工具适合什么场景？',
    },
  },

  toast: {
    connectFailed: '无法连接服务端：{error}',
    requestFailed: '请求失败：{error}',
    saved: '已保存 · {name} (v{version})',
    saveFailed: '保存失败：{error}',
    workflowRemoved: '已删除工作流',
    workflowRemoveFailed: '删除失败：{error}',
    runCompleted: '运行完成 · {steps} 步 · {duration}ms',
    runFailed: '运行失败：{error}',
  },

  dialog: {
    unsavedTitle: '新建工作流',
    unsavedMessage: '当前修改尚未保存，继续将丢失改动。',
    continue: '继续',
    cancel: '取消',
    deleteTitle: '删除工作流',
    deleteMessage: '删除当前工作流？该操作不可撤销。',
    delete: '删除',
  },

  settings: {
    title: '连接配置',
    hint: '在这里保存多套 LLM / Jev 连接。节点用哪一套，在节点自己的「连接」下拉里选。',
    empty: '还没有配置。点下面的「新增连接」加一套。',
    incomplete: '未填 Key',
    name: '名称',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'sk-…',
    baseUrl: 'Base URL',
    baseUrlPlaceholder: 'https://api.deepseek.com/v1',
    model: '模型',
    modelPlaceholder: 'deepseek-chat',
    test: '测试连接',
    testOk: '正常 · {ms}ms · {model}',
    testFailed: '连接失败',
    add: '新增连接',
    close: '完成',
    usage: '{count} 个节点在用',
    unused: '未被使用',
    remove: '删除',
    removeTitle: '删除配置',
    removeConfirm: '删除配置「{name}」？',
    removeConfirmInUse: '配置「{name}」正被 {count} 个节点使用，删掉后这些节点会回落到服务端默认。确定删除？',
    removeAll: '清空全部',
    clearTitle: '清空全部配置',
    clearConfirm: '清空所有已保存的配置？该操作不可撤销。',
    cancel: '取消',
    tabs: {
      llm: 'LLM（生成）',
      jev: 'Jev（决策）',
    },
    hints: {
      llm: '任何 OpenAI 兼容端点都行：DeepSeek、硅基流动、OpenAI、本地 Ollama…… 不填 Base URL 默认打 api.openai.com。',
      jev: '需要你自己的 Jev 服务，它必须实现 POST /decide 接口。',
      storage: '配置只保存在这台浏览器，不会写入数据库。',
    },
    usageHint: {
      llm: 'LLM 节点在右侧「节点配置 → 连接」里选这里的某一套；留空则跟随服务端（.env / Mock）。',
      jev: 'Jev 节点在右侧「节点配置 → 连接」里选这里的某一套；留空则跟随服务端（.env / Mock）。',
    },
    toast: {
      tested: '连接正常 · {ms}ms · {provider}',
      testFailed: '连接失败：{error}',
      removed: '已删除配置「{name}」',
      cleared: '已清空全部配置',
    },
  },
};

export default zhCN;

/** 语言包的形状 —— `en-US.ts` 必须完全一致。 */
export type MessageSchema = typeof zhCN;
