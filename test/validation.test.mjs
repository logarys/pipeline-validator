import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePipelineConfig,
  parsePipelineJson,
  validatePipelineConfig,
} from "../dist/index.js";

const validRuntimeConfig = {
  parser: {
    type: "regex",
    pattern:
      "^timestamp=(?<timestamp>\\S+)\\s+level=(?<level>\\S+)\\s+msg=(?<message>.*?)$",
  },
  defaults: {
    source: "locafire-docker",
    host: "locafire-prod-1",
    env: "production",
  },
  publish: {
    subject: "logs.locafire-docker.normalized",
  },
  security: {
    mode: "none",
  },
};

test("validates a runtime pipeline config", () => {
  const result = validatePipelineConfig(validRuntimeConfig);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("rejects invalid JSON", () => {
  const result = parsePipelineJson("{");

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, "JSON_INVALID");
});

test("checks required objects", () => {
  const result = validatePipelineConfig({});

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.errors.map((issue) => issue.path),
    ["$.parser", "$.defaults", "$.publish", "$.security"],
  );
});

test("checks required fields", () => {
  const result = validatePipelineConfig({
    parser: {},
    defaults: {},
    publish: {},
    security: {},
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.path === "$.parser.type"));
  assert.ok(result.errors.some((issue) => issue.path === "$.defaults.source"));
  assert.ok(result.errors.some((issue) => issue.path === "$.publish.subject"));
  assert.ok(result.errors.some((issue) => issue.path === "$.security.mode"));
});

test("rejects unsupported fields", () => {
  const result = validatePipelineConfig({
    ...validRuntimeConfig,
    name: "wrong",
    mappings: {},
    parser: {
      ...validRuntimeConfig.parser,
      mappings: {},
    },
    defaults: {
      ...validRuntimeConfig.defaults,
      job: "docker",
      level: "info",
    },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.path === "$.name"));
  assert.ok(result.errors.some((issue) => issue.path === "$.mappings"));
  assert.ok(result.errors.some((issue) => issue.path === "$.parser.mappings"));
  assert.ok(result.errors.some((issue) => issue.path === "$.defaults.job"));
  assert.ok(result.errors.some((issue) => issue.path === "$.defaults.level"));
});

test("checks regex syntax", () => {
  const result = validatePipelineConfig({
    ...validRuntimeConfig,
    parser: {
      type: "regex",
      pattern: "(",
    },
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, "REGEX_PATTERN_INVALID");
});

test("normalizes parser.regex to parser.pattern", () => {
  const config = {
    ...validRuntimeConfig,
    parser: {
      type: "regex",
      regex: "^hello$",
    },
  };

  const result = validatePipelineConfig(config);

  assert.equal(result.valid, true);
  assert.equal(result.value.parser.pattern, "^hello$");
  assert.equal("regex" in result.value.parser, false);
});

test("validates full pipeline documents", () => {
  const result = validatePipelineConfig(
    {
      id: "locafire-docker",
      source: "locafire-docker",
      enabled: true,
      ...validRuntimeConfig,
    },
    { document: true, requireDocumentFields: true },
  );

  assert.equal(result.valid, true);
});

test("warns on source mismatch", () => {
  const result = validatePipelineConfig(
    {
      id: "one",
      source: "one",
      enabled: true,
      ...validRuntimeConfig,
    },
    { document: true },
  );

  assert.equal(result.valid, true);
  assert.equal(result.warnings[0].code, "SOURCE_MISMATCH");
});

test("normalizePipelineConfig can be used directly", () => {
  const normalized = normalizePipelineConfig({
    ...validRuntimeConfig,
    parser: {
      type: "regex",
      regex: "^direct$",
    },
  });

  assert.equal(normalized.parser.pattern, "^direct$");
  assert.equal("regex" in normalized.parser, false);
});
