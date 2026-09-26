import type { MessageSchema } from './zh-CN';

/** English messages. Typed against the zh-CN schema so keys can never drift. */
const enUS: MessageSchema = {
  app: {
    tagline: 'LLM generates · Jev decides · Runtime executes',
  },

  preferences: {
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    switchToLight: 'Switch to light',
    switchToDark: 'Switch to dark',
  },

  workflow: {
    select: 'Select workflow',
    untitled: 'Untitled workflow',
    new: 'New',
    remove: 'Delete',
    save: 'Save',
    run: 'Run workflow',
    unsaved: 'Unsaved',
    saved: 'Saved',
  },

  panel: {
    nodes: 'Nodes',
    inspector: 'Inspector',
    nodeConfig: 'Node config',
    edge: 'Edge',
    workflow: 'Workflow',
    none: 'Nothing selected',
  },

  nodes: {
    groups: {
      trigger: 'Trigger',
      ai: 'AI',
      tools: 'Tools',
      control: 'Control',
    },
    start: {
      label: 'Start',
      description: 'Workflow entry point, receives user input',
    },
    llm: {
      label: 'LLM',
      description: 'Generate content with a language model',
      defaultSystemPrompt: 'You are a rigorous, pragmatic assistant. Be concrete and well structured.',
    },
    jev: {
      label: 'Jev',
      description: 'Make a structured decision about the current state',
      defaultQuestion: 'Is the current information sufficient?',
    },
    tool: {
      label: 'Tool',
      description: 'Call a tool (built-in mock search)',
    },
    end: {
      label: 'End',
      description: 'Finish and return the result',
    },
    hint: 'Drag a node onto the canvas, or just click it. Select a node to configure it on the right.',
    summary: {
      start: 'entry · takes user input',
      endCustom: 'custom output template',
      endDefault: 'returns the last output',
      choiceCount: '{count} choices',
      untitledQuestion: 'untitled question',
    },
  },

  inspector: {
    nodeId: 'Node ID',
    label: 'Label',
    startHint:
      'Start needs no config. At runtime the user input is pushed to the next node as the entry payload.',
    model: 'Model',
    systemPrompt: 'System prompt',
    prompt: 'Prompt',
    temperature: 'Temperature',
    question: 'Question',
    decisionType: 'Decision type',
    choice: 'Choice',
    choices: 'Choices',
    addChoice: 'Add choice',
    branches: 'Branches',
    branchesHint: 'Whichever choice Jev returns, the matching branch is taken.',
    tool: 'Tool',
    query: 'Query',
    outputTemplate: 'Output template',
    outputTemplatePlaceholder: 'Empty = return the last node output',
    outputHint: 'When left empty, the workflow output equals the last node output.',
    variables: 'Available variables',
    variablesHint: 'Click to append to Prompt / Query.',
    edge: 'Edge ID',
    path: 'Path',
    condition: 'Condition',
    conditionPlaceholder: 'Empty = default branch',
    edgeHint:
      'Leave outgoing edges of ordinary nodes empty. An edge out of a Jev node must carry a condition taken from that node\u2019s choices.',
    name: 'Name',
    namePlaceholder: 'Workflow name',
    description: 'Description',
    descriptionPlaceholder: 'Optional',
    statNodes: 'Nodes',
    statEdges: 'Edges',
    statVersion: 'Version',
    statStatus: 'Status',
    workflowHint: 'Click a node or edge on the canvas to configure it. Drag nodes in from the left.',
    removeNode: 'Delete node',
    removeEdge: 'Delete edge',
    confirmRemoveNodeTitle: 'Delete node',
    confirmRemoveNode: 'Delete node {id}? Its edges will be removed too.',
    confirmRemoveEdgeTitle: 'Delete edge',
    confirmRemoveEdge: 'Delete edge {id}?',
    nodeRemoved: 'Node deleted',
    edgeRemoved: 'Edge deleted',
  },

  trace: {
    title: 'Execution Trace',
    meta: '{status} · {steps} steps · {duration}ms',
    running: 'running…',
    clear: 'Clear',
    empty:
      'No execution yet. Hit “Run workflow” in the top right and every node’s input, output and Jev decision shows up here.',
    status: 'Status',
    duration: 'Duration',
    nodeType: 'Node type',
    decision: 'Decision',
    probability: 'Probability',
    confidence: 'Confidence',
    input: 'Input',
    output: 'Output',
    nodeStatus: {
      success: 'success',
      failed: 'failed',
      skipped: 'skipped',
    },
    runStatus: {
      running: 'running',
      completed: 'completed',
      failed: 'failed',
    },
  },

  run: {
    title: 'Run workflow',
    hint: 'The input becomes the entry payload of the Start node.',
    placeholder: 'Type your question…',
    defaultInput: 'Give me an introduction to AI agents',
    cancel: 'Cancel',
    run: 'Run',
    presets: {
      intro: 'Give me an introduction to AI agents',
      decision: 'How does the Jev decision mechanism work?',
      scenario: 'What is a visual workflow orchestrator good for?',
    },
  },

  toast: {
    connectFailed: 'Cannot reach the server: {error}',
    requestFailed: 'Request failed: {error}',
    saved: 'Saved · {name} (v{version})',
    saveFailed: 'Save failed: {error}',
    workflowRemoved: 'Workflow deleted',
    workflowRemoveFailed: 'Delete failed: {error}',
    runCompleted: 'Finished · {steps} steps · {duration}ms',
    runFailed: 'Run failed: {error}',
  },

  dialog: {
    unsavedTitle: 'New workflow',
    unsavedMessage: 'Your changes are not saved yet. Continuing will discard them.',
    continue: 'Continue',
    cancel: 'Cancel',
    deleteTitle: 'Delete workflow',
    deleteMessage: 'Delete the current workflow? This cannot be undone.',
    delete: 'Delete',
  },
};

export default enUS;
