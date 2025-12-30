# Contributing

## Project Structure

This is a Turborepo monorepo:

```
.
├── packages/
│   ├── context-manager/          # Main package
│   │   ├── index.ts              # Main export
│   │   ├── types.ts              # TypeScript types
│   │   ├── utils.ts              # Utilities
│   │   ├── validation.ts         # Validation logic
│   │   ├── presets.ts            # Preset configurations
│   │   ├── example.ts            # Usage examples
│   │   ├── README.md             # Package documentation
│   │   └── *.test.ts             # Unit tests
│   └── examples/                 # Example implementations
│       ├── agents/               # Example agents
│       ├── tools/                # Example tools
│       ├── mastra/               # Mastra config
│       ├── hono-server.ts        # Hono server example
│       └── test-*.ts             # Test scripts
├── turbo.json                    # Turborepo config
└── package.json                  # Root workspace config
```

## Development

### Setup

```bash
bun install
```

### Running Tests

```bash
# All packages
bun test

# Specific package
cd packages/context-manager
bun test
```

### Running Examples

```bash
cd packages/examples
bun run server
bun run test:client
bun run test:context
bun run test:prepare
```

### Building

```bash
bun run build
```

## Package Structure

- **`packages/context-manager`** - The main package (publishable)
- **`packages/examples`** - Example implementations (not published)

## Workspace Dependencies

Examples use `workspace:*` to reference the context-manager package locally during development.
