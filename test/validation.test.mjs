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
  mapping: {
    timestamp: "timestamp",
    level: "level",
    message: "message",
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

test("validates an ingestor minimal runtime pipeline config", () => {
  const result = validatePipelineConfig({
    parser: {
      type: "raw",
    },
    publish: {
      subject: "logs.raw.normalized",
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

const supportedParserConfigs = [
  {
    type: "raw",
    parser: { type: "raw" },
  },
  {
    type: "json",
    parser: { type: "json" },
  },
  {
    type: "regex",
    parser: {
      type: "regex",
      pattern: "^(?<message>.*)$",
    },
  },
  {
    type: "loki",
    parser: { type: "loki" },
  },
];

test("accepts all parser types supported by the ingestor", async (t) => {
  for (const { type, parser } of supportedParserConfigs) {
    await t.test(type, () => {
      const result = validatePipelineConfig({
        parser,
        publish: {
          subject: `logs.${type}.normalized`,
        },
      });

      assert.equal(result.valid, true, JSON.stringify(result.errors));
      assert.deepEqual(result.errors, []);
      assert.equal(result.value.parser.type, type);
    });
  }
});

test("accepts the canonical loki parser type", () => {
  const result = validatePipelineConfig({
    parser: {
      type: "loki",
    },
    publish: {
      subject: "logs.loki.normalized",
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.parser.type, "loki");
});

test("rejects the legacy lokki misspelling", () => {
  const result = validatePipelineConfig({
    parser: {
      type: "lokki",
    },
    publish: {
      subject: "logs.loki.normalized",
    },
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((issue) => issue.code === "UNSUPPORTED_PARSER_TYPE"),
  );
});

test("rejects unsupported parser types", () => {
  const result = validatePipelineConfig({
    parser: {
      type: "xml",
    },
    publish: {
      subject: "logs.xml.normalized",
    },
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((issue) => issue.code === "UNSUPPORTED_PARSER_TYPE"),
  );
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
    ["$.parser", "$.publish"],
  );
});

test("checks required fields", () => {
  const result = validatePipelineConfig({
    parser: {},
    publish: {},
    security: {},
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.path === "$.parser.type"));
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
    mapping: {
      ...validRuntimeConfig.mapping,
      environment: "env",
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
  assert.ok(result.errors.some((issue) => issue.path === "$.mapping.environment"));
  assert.ok(result.errors.some((issue) => issue.path === "$.defaults.job"));
  assert.ok(result.errors.some((issue) => issue.path === "$.defaults.level"));
});

test("checks mapping values are strings", () => {
  const result = validatePipelineConfig({
    ...validRuntimeConfig,
    mapping: {
      level: 123,
    },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((issue) => issue.path === "$.mapping.level"));
});

test("checks security mode values", () => {
  const result = validatePipelineConfig({
    ...validRuntimeConfig,
    security: {
      mode: "cookie",
    },
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((issue) => issue.code === "UNSUPPORTED_SECURITY_MODE"),
  );
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

test("validates full loki pipeline documents", () => {
  const result = validatePipelineConfig(
    {
      id: "promtail",
      source: "promtail",
      enabled: true,
      parser: {
        type: "loki",
      },
      publish: {
        subject: "logs.promtail.normalized",
      },
      security: {
        mode: "header",
        token: "secret",
      },
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
  assert.deepEqual(normalized.mapping, validRuntimeConfig.mapping);
});
