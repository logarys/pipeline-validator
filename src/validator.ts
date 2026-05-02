import type {
  PipelineDocument,
  PipelineRuntimeConfig,
  ValidationIssue,
  ValidationResult,
  ValidatePipelineOptions,
  PipelineParserConfig,
} from "./types.js";

const RUNTIME_TOP_LEVEL_KEYS = new Set([
  "parser",
  "mapping",
  "defaults",
  "publish",
  "security",
  "input",
]);

const DOCUMENT_TOP_LEVEL_KEYS = new Set([
  ...RUNTIME_TOP_LEVEL_KEYS,
  "id",
  "source",
  "enabled",
]);

const ALLOWED_PARSER_KEYS = new Set(["type", "pattern", "regex"]);
const ALLOWED_MAPPING_KEYS = new Set([
  "timestamp",
  "level",
  "message",
  "source",
  "host",
  "service",
  "env",
]);
const ALLOWED_PARSER_TYPES = new Set(["raw", "json", "regex", "loki"]);
const ALLOWED_DEFAULTS_KEYS = new Set(["source", "host", "env", "service"]);
const ALLOWED_PUBLISH_KEYS = new Set(["subject"]);
const ALLOWED_SECURITY_KEYS = new Set(["mode", "token"]);
const ALLOWED_SECURITY_MODES = new Set(["none", "header", "query"]);

export function parsePipelineJson(
  json: string,
  options: ValidatePipelineOptions = {},
): ValidationResult<PipelineRuntimeConfig | PipelineDocument> {
  try {
    const value = JSON.parse(json) as unknown;
    return validatePipelineConfig(value, options);
  } catch (error) {
    return result([
      {
        severity: "error",
        code: "JSON_INVALID",
        path: "$",
        message: `Invalid JSON: ${formatError(error)}`,
      },
    ]);
  }
}

export function validatePipelineConfig(
  value: unknown,
  options: ValidatePipelineOptions = {},
): ValidationResult<PipelineRuntimeConfig | PipelineDocument> {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(value)) {
    issues.push({
      severity: "error",
      code: "ROOT_MUST_BE_OBJECT",
      path: "$",
      message: "Pipeline configuration must be a JSON object.",
    });
    return result(issues);
  }

  const object = value as Record<string, unknown>;
  const allowedTopLevelKeys = options.document
    ? DOCUMENT_TOP_LEVEL_KEYS
    : RUNTIME_TOP_LEVEL_KEYS;

  for (const key of Object.keys(object)) {
    if (!allowedTopLevelKeys.has(key)) {
      issues.push({
        severity: "error",
        code: "UNSUPPORTED_TOP_LEVEL_KEY",
        path: `$.${key}`,
        message: `Unsupported top-level field: ${key}.`,
      });
    }
  }

  for (const key of ["parser", "publish"] as const) {
    if (!(key in object)) {
      issues.push({
        severity: "error",
        code: "REQUIRED_OBJECT_MISSING",
        path: `$.${key}`,
        message: `Required object is missing: ${key}.`,
      });
      continue;
    }

    if (!isPlainObject(object[key])) {
      issues.push({
        severity: "error",
        code: "FIELD_MUST_BE_OBJECT",
        path: `$.${key}`,
        message: `${key} must be an object.`,
      });
    }
  }

  if (options.document && options.requireDocumentFields) {
    requireString(object, "id", "$.id", issues);
    requireString(object, "source", "$.source", issues);

    if (typeof object.enabled !== "boolean") {
      issues.push({
        severity: "error",
        code: "FIELD_MUST_BE_BOOLEAN",
        path: "$.enabled",
        message: "enabled must be a boolean.",
      });
    }
  } else if (options.document) {
    optionalString(object, "id", "$.id", issues);
    optionalString(object, "source", "$.source", issues);

    if ("enabled" in object && typeof object.enabled !== "boolean") {
      issues.push({
        severity: "error",
        code: "FIELD_MUST_BE_BOOLEAN",
        path: "$.enabled",
        message: "enabled must be a boolean.",
      });
    }
  }

  optionalString(object, "input", "$.input", issues);

  if (isPlainObject(object.parser)) {
    validateObjectKeys(object.parser, ALLOWED_PARSER_KEYS, "$.parser", issues);
    requireString(object.parser, "type", "$.parser.type", issues);

    const parser = object.parser as Record<string, unknown>;
    optionalString(parser, "pattern", "$.parser.pattern", issues);
    optionalString(parser, "regex", "$.parser.regex", issues);

    const parserType = parser.type;
    if (typeof parserType === "string" && parserType.trim() !== "") {
      validateParserType(parserType, issues);
    }

    if (parserType === "regex") {
      const pattern =
        stringOrUndefined(parser.pattern) ?? stringOrUndefined(parser.regex);

      if (!pattern) {
        issues.push({
          severity: "error",
          code: "REGEX_PATTERN_REQUIRED",
          path: "$.parser.pattern",
          message: "parser.pattern is required when parser.type is regex.",
        });
      } else {
        validateRegexPattern(pattern, "$.parser.pattern", issues);
      }
    }
  }

  if ("mapping" in object) {
    if (!isPlainObject(object.mapping)) {
      issues.push({
        severity: "error",
        code: "FIELD_MUST_BE_OBJECT",
        path: "$.mapping",
        message: "mapping must be an object.",
      });
    } else {
      validateObjectKeys(object.mapping, ALLOWED_MAPPING_KEYS, "$.mapping", issues);
      optionalString(object.mapping, "timestamp", "$.mapping.timestamp", issues);
      optionalString(object.mapping, "level", "$.mapping.level", issues);
      optionalString(object.mapping, "message", "$.mapping.message", issues);
      optionalString(object.mapping, "source", "$.mapping.source", issues);
      optionalString(object.mapping, "host", "$.mapping.host", issues);
      optionalString(object.mapping, "service", "$.mapping.service", issues);
      optionalString(object.mapping, "env", "$.mapping.env", issues);
    }
  }

  if ("defaults" in object) {
    if (!isPlainObject(object.defaults)) {
      issues.push({
        severity: "error",
        code: "FIELD_MUST_BE_OBJECT",
        path: "$.defaults",
        message: "defaults must be an object.",
      });
    } else {
      validateObjectKeys(object.defaults, ALLOWED_DEFAULTS_KEYS, "$.defaults", issues);
      optionalString(object.defaults, "source", "$.defaults.source", issues);
      optionalString(object.defaults, "host", "$.defaults.host", issues);
      optionalString(object.defaults, "env", "$.defaults.env", issues);
      optionalString(object.defaults, "service", "$.defaults.service", issues);
    }
  }

  if (isPlainObject(object.publish)) {
    validateObjectKeys(object.publish, ALLOWED_PUBLISH_KEYS, "$.publish", issues);
    requireString(object.publish, "subject", "$.publish.subject", issues);
  }

  if ("security" in object) {
    if (!isPlainObject(object.security)) {
      issues.push({
        severity: "error",
        code: "FIELD_MUST_BE_OBJECT",
        path: "$.security",
        message: "security must be an object.",
      });
    } else {
      validateObjectKeys(object.security, ALLOWED_SECURITY_KEYS, "$.security", issues);
      requireString(object.security, "mode", "$.security.mode", issues);
      optionalString(object.security, "token", "$.security.token", issues);

      const securityMode = object.security.mode;
      if (typeof securityMode === "string" && securityMode.trim() !== "") {
        validateSecurityMode(securityMode, issues);
      }
    }
  }

  if (
    options.warnOnSourceMismatch !== false &&
    typeof object.source === "string" &&
    isPlainObject(object.defaults) &&
    typeof object.defaults.source === "string" &&
    object.source !== object.defaults.source
  ) {
    issues.push({
      severity: "warning",
      code: "SOURCE_MISMATCH",
      path: "$.defaults.source",
      message: "defaults.source differs from the top-level source field.",
    });
  }

  const validation = result<PipelineRuntimeConfig | PipelineDocument>(issues);

  if (validation.valid) {
    validation.value = normalizePipelineConfig(
      object as PipelineRuntimeConfig | PipelineDocument,
    );
  }

  return validation;
}

export function normalizePipelineConfig<T extends PipelineRuntimeConfig | PipelineDocument>(
  config: T,
): T {
  const pattern = config.parser.pattern ?? config.parser.regex;
  const parser: PipelineParserConfig = {
    type: config.parser.type,
  };

  if (pattern !== undefined) {
    parser.pattern = pattern;
  }

  const normalized: PipelineRuntimeConfig | PipelineDocument = {
    ...config,
    parser,
    publish: { ...config.publish },
  };

  if (config.mapping !== undefined) {
    normalized.mapping = { ...config.mapping };
  }

  if (config.defaults !== undefined) {
    normalized.defaults = { ...config.defaults };
  }

  if (config.security !== undefined) {
    normalized.security = { ...config.security };
  }

  delete normalized.parser.regex;

  return normalized as T;
}

export function isValidPipelineConfig(
  value: unknown,
  options: ValidatePipelineOptions = {},
): boolean {
  return validatePipelineConfig(value, options).valid;
}

function validateObjectKeys(
  object: Record<string, unknown>,
  allowedKeys: Set<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        severity: "error",
        code: "UNSUPPORTED_NESTED_KEY",
        path: `${path}.${key}`,
        message: `Unsupported field: ${path}.${key}.`,
      });
    }
  }
}

function requireString(
  object: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const value = object[key];

  if (typeof value !== "string" || value.trim() === "") {
    issues.push({
      severity: "error",
      code: "REQUIRED_FIELD_MISSING",
      path,
      message: `${path} is required and must be a non-empty string.`,
    });
  }
}

function optionalString(
  object: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!(key in object)) {
    return;
  }

  if (typeof object[key] !== "string") {
    issues.push({
      severity: "error",
      code: "FIELD_MUST_BE_STRING",
      path,
      message: `${path} must be a string.`,
    });
  }
}

function validateParserType(
  parserType: string,
  issues: ValidationIssue[],
): void {
  if (!ALLOWED_PARSER_TYPES.has(parserType)) {
    issues.push({
      severity: "error",
      code: "UNSUPPORTED_PARSER_TYPE",
      path: "$.parser.type",
      message: `Unsupported parser type: ${parserType}. Expected one of: ${[
        ...ALLOWED_PARSER_TYPES,
      ].join(", ")}.`,
    });
  }
}

function validateSecurityMode(
  securityMode: string,
  issues: ValidationIssue[],
): void {
  if (!ALLOWED_SECURITY_MODES.has(securityMode)) {
    issues.push({
      severity: "error",
      code: "UNSUPPORTED_SECURITY_MODE",
      path: "$.security.mode",
      message: `Unsupported security mode: ${securityMode}. Expected one of: ${[
        ...ALLOWED_SECURITY_MODES,
      ].join(", ")}.`,
    });
  }
}

function validateRegexPattern(
  pattern: string,
  path: string,
  issues: ValidationIssue[],
): void {
  try {
    new RegExp(pattern);
  } catch (error) {
    issues.push({
      severity: "error",
      code: "REGEX_PATTERN_INVALID",
      path,
      message: `Invalid regex pattern: ${formatError(error)}.`,
    });
  }
}

function result<T = unknown>(issues: ValidationIssue[]): ValidationResult<T> {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
