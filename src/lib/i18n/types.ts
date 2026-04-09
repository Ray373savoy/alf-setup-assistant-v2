export type Locale = "ja" | "ko" | "en";

export interface Translations {
  // ── Common ──
  common: {
    processing: string;
    retry: string;
    back: string;
    next: string;
    required: string;
    optional: string;
    error: string;
  };

  // ── Sidebar ──
  sidebar: {
    title: string;
    subtitle: string;
    brand: string;
    stepIncomplete: string;
    steps: string[];
  };

  // ── Login ──
  login: {
    title: string;
    description: string;
    googleButton: string;
  };

  // ── Step 1: Input ──
  input: {
    heading: string;
    description: string;
    dataEntry: string;
    transcript: string;
    document: string;
    textareaLabel: string;
    textareaPlaceholder: string;
    uploadText: string;
    uploadHint: string;
    systems: string;
    systemsOptional: string;
    cart: string;
    cartLabel: string;
    wms: string;
    wmsLabel: string;
    oms: string;
    omsLabel: string;
    noSelection: string;
    other: string;
    systemsNote: string;
    nextButton: string;
  };

  // ── Step 2: Analysis ──
  analysis: {
    heading: string;
    description: string;
    analyzing: string;
    analyzingDetail: string;
    requirementsCheck: string;
    requiredCount: string;
    answerPlaceholder: string;
    optionalPlaceholder: string;
    needsConfirmation: string;
    needsConfirmationMarker: string;
    confirmLaterHint: string;
    nextButton: string;
  };

  // ── Step 3: Flow ──
  flow: {
    heading: string;
    generating: string;
    regenerate: string;
    mermaidPreview: string;
    generatingJson: string;
    generatePrompt: string;
    chatTitle: string;
    chatInitial: string;
    modifying: string;
    suggestions: string[];
    modifySuccess: string;
    modifyFail: string;
    chatPlaceholder: string;
    nextButton: string;
    stepLabel: string;
  };

  // ── Step 4: Validation ──
  validation: {
    heading: string;
    description: string;
    checks: string[];
    checkTitle: string;
    allPassed: string;
    errorDetails: string;
    goToStep3: string;
    goToStep5: string;
    warnings: string;
    stepLabel: string;
  };

  // ── Step 5: Editor ──
  editor: {
    heading: string;
    noJson: string;
    goToFlow: string;
    stepHeading: string;
    goToValidation: string;
    nodeListNote: string;
    chatTitle: string;
    chatDescription: string;
    modifying: string;
    chatPlaceholder: string;
    modifyFail: string;
    unknownError: string;
    nextButton: string;
    stepLabel: string;
  };

  // ── Step 6: Download ──
  download: {
    heading: string;
    noJson: string;
    startOver: string;
    description: string;
    taskNameSection: string;
    taskNameLabel: string;
    taskNamePlaceholder: string;
    charCount: string;
    summary: string;
    nodeCount: string;
    memoryVars: string;
    jsonPreview: string;
    chars: string;
    truncated: string;
    importSteps: string;
    importStep1: string;
    importStep2: string;
    importStep3: string;
    importStep4: string;
    downloaded: string;
    downloadButton: string;
    stepLabel: string;
    pendingConfirmation: string;
    pendingConfirmationNote: string;
  };
}
