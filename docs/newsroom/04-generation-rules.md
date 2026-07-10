# Generation Rules

Gemini is a newsroom drafting service, not a publishing authority.

Every generated artifact is a draft.

Drafts must be editable.

Drafts must not publish automatically.

The model should receive:

- task assignment
- hard factual guardrails
- story plan
- structured source data
- relevant docs
- JSON schema

The model should not receive private secrets or browser-exposed API keys.

The admin should be able to inspect:

- context packet
- docs included
- model used
- provider used
- fallback trace
- story plan
