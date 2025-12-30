# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2024-12-30

### Fixed

- Fixed TypeScript type error: `processInputStep` is now explicitly required in return type to satisfy Mastra's `InputProcessorOrWorkflow` type

## [0.1.0] - 2024-12-30

### Added

- Initial release of Contextor
- Generic context management orchestrator for long-running AI agents with 4 strategies (filter, compact, summarize, offload)
- Comprehensive lifecycle hooks (beforeProcess, afterModify, onError, onValidationError)
- Production-ready error handling and validation
- Configurable token counting support
- 55+ unit tests with Bun test runner
- Full TypeScript support
- Examples demonstrating usage with Hono, long-running agents, and prepareStep
