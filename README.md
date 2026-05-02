# @logarys/pipeline-validator

Validation helpers for Logarys pipeline runtime JSON configuration.

This package centralizes pipeline checks shared by Logarys applications:

- JSON syntax check
- required object checks
- required field checks
- parser type validation aligned with the ingestor (`raw`, `json`, `regex`, `loki`)
- regex syntax check
- ingestor pipeline field compatibility checks
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
    "type": "loki"
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
  "publish": {}
}
```

Required fields:

```txt
parser.type
publish.subject
```

Supported parser types:

```txt
raw
json
regex
loki
```

For regex pipelines:

```txt
parser.pattern
```

`parser.regex` is accepted for legacy configs and normalized to `parser.pattern`.

Optional objects:

```txt
mapping
mapping.timestamp
mapping.level
mapping.message
mapping.source
mapping.host
mapping.service
mapping.env

defaults
defaults.source
defaults.host
defaults.service
defaults.env

security
security.mode
security.token
```

Supported security modes:

```txt
none
header
query
```

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

## Ingestor compatibility

The validator follows the ingestor pipeline conventions:

- `mapping` is a top-level object, singular, not `mappings`
- `defaults` is optional and contains only `source`, `host`, `service`, `env`
- `security` is optional and contains `mode` and optional `token`
- `parser.type` must be one of `raw`, `json`, `regex`, `loki`
- the legacy misspelling `lokki` is not accepted

The validator rejects fields that are not part of this schema, for example:

```txt
name
mappings
parser.mappings
mapping.environment
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
