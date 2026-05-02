export type ParserType = "json" | "raw" | "regex" | string;

export type SecurityMode = "none" | "header" | "query" | string;

export type PipelineParserConfig = {
  type: ParserType;
  pattern?: string;
  regex?: string;
};

export type PipelineDefaultsConfig = {
  source: string;
  host?: string;
  env?: string;
  service?: string;
};

export type PipelinePublishConfig = {
  subject: string;
};

export type PipelineSecurityConfig = {
  mode: SecurityMode;
  token?: string;
};

export type PipelineRuntimeConfig = {
  parser: PipelineParserConfig;
  defaults: PipelineDefaultsConfig;
  publish: PipelinePublishConfig;
  security: PipelineSecurityConfig;
  input?: string;
};

export type PipelineDocument = PipelineRuntimeConfig & {
  id?: string;
  source?: string;
  enabled?: boolean;
};

export type ValidationIssueSeverity = "error" | "warning";

export type ValidationIssueCode =
  | "JSON_INVALID"
  | "ROOT_MUST_BE_OBJECT"
  | "UNSUPPORTED_TOP_LEVEL_KEY"
  | "REQUIRED_OBJECT_MISSING"
  | "REQUIRED_FIELD_MISSING"
  | "FIELD_MUST_BE_OBJECT"
  | "FIELD_MUST_BE_STRING"
  | "FIELD_MUST_BE_BOOLEAN"
  | "UNSUPPORTED_NESTED_KEY"
  | "REGEX_PATTERN_REQUIRED"
  | "REGEX_PATTERN_INVALID"
  | "SOURCE_MISMATCH";

export type ValidationIssue = {
  severity: ValidationIssueSeverity;
  code: ValidationIssueCode;
  path: string;
  message: string;
};

export type ValidationResult<T = unknown> = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  value?: T;
};

export type ValidatePipelineOptions = {
  /**
   * Validate a full pipeline document with id/source/enabled allowed at the top level.
   * When false, only the runtime JSON block is accepted.
   */
  document?: boolean;

  /**
   * Require id/source/enabled for full pipeline documents.
   */
  requireDocumentFields?: boolean;

  /**
   * Add a warning when document source and defaults.source differ.
   */
  warnOnSourceMismatch?: boolean;
};
