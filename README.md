# @logarys/pipeline-validator

Validation helpers for Logarys pipeline runtime JSON configuration.

This package centralizes the checks previously implemented in the UI:

- JSON syntax check
- required object checks
- required field checks
- regex syntax check
- storage-manager DTO compatibility checks
- normalization of `parser.regex` to `parser.pattern`

## Install

```bash
npm install @logarys/pipeline-validator
```

## Usage

```ts
import {
  parsePipelineJson,
  validatePipelineConfig,
  normalizePipelineConfig,
} from "@logarys/pipeline-validator";

const result = parsePipelineJson(`{
  "parser": {
    "type": "regex",
    "pattern": "^timestamp=(?<timestamp>\\S+)"
  },
  "defaults": {
    "source": "locafire-docker"
  },
  "publish": {
    "subject": "logs.locafire-docker.normalized"
  },
  "security": {
    "mode": "none"
  }
}`);

if (!result.valid) {
  console.error(result.errors);
} else {
  console.log(result.value);
}
```

## Runtime config schema

A runtime config block must contain these required objects:

```json
{
  "parser": {},
  "defaults": {},
  "publish": {},
  "security": {}
}
```

Required fields:

```txt
parser.type
defaults.source
publish.subject
security.mode
```

For regex pipelines:

```txt
parser.pattern
```

`parser.regex` is accepted for legacy configs and normalized to `parser.pattern`.

## Full pipeline document validation

```ts
const result = validatePipelineConfig(pipeline, {
  document: true,
  requireDocumentFields: true,
});
```

This also allows and checks:

```txt
id
source
enabled
```

## Storage-manager compatibility

The validator rejects fields known to be rejected by the current storage-manager DTO, for example:

```txt
name
mappings
parser.mappings
defaults.environment
defaults.job
defaults.level
```

## API

### `parsePipelineJson(json, options?)`

Parses JSON and validates the resulting object.

### `validatePipelineConfig(value, options?)`

Validates an already parsed object.

### `normalizePipelineConfig(config)`

Normalizes legacy accepted fields, currently:

```txt
parser.regex -> parser.pattern
```

### `isValidPipelineConfig(value, options?)`

Boolean shortcut.

## Validation result

```ts
type ValidationResult<T = unknown> = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  value?: T;
};
```

