import {
  contractMissing,
  contractMissingPy,
  FIXTURES_PATH,
  FIXTURES_PATH_PY,
  renderFixtures,
  renderFixturesPy,
} from './contract'
import { GENERATE_SYSTEM, GENERATE_SYSTEM_PY } from './prompts'
import { parsePytestOutput, parseTestOutput, PYC_MARKER, PYTEST_MARKER, TEST_COMMAND, TEST_COMMAND_PY, TSC_MARKER, VITEST_MARKER } from './report'
import type { ApiSpec, GeneratedFile, Lang, TestReport } from './types'

/**
 * Everything that varies by target language in one place.
 *
 * When a new language ships (Go, Rust, …), add an entry to LANG with the full
 * descriptor filled in. Every callsite reads `LANG[config.lang].X` instead of
 * forking on `lang === 'py'`, so support for the new language falls out
 * automatically — no scattered `if (lang === 'py')` edits across prompts.ts,
 * sandbox.ts, run.ts, contract.ts, cli.ts and syntax-check.ts.
 */
export interface LangDescriptor {
  /** Human label — "TypeScript", "Python 3.12". */
  readonly label: string

  /** The three files the generated connector must contain, in display order. */
  readonly requiredFiles: readonly string[]

  /** Where the authoritative test fixtures live inside the generated bundle. */
  readonly fixturesPath: string

  /** System prompt for the generate + repair steps. */
  readonly generateSystem: string

  /** Default source file the UI opens in the Code panel. */
  readonly defaultOpenFile: string

  /** Short label for the "typecheck" / "syntax check" step shown in UI + logs. */
  readonly typecheckLabel: string

  /** Short label for the test runner shown in UI + repair prompts ("vitest", "pytest"). */
  readonly testRunnerLabel: string

  /**
   * Base Docker image for the sandbox: a public registry URL plus the tag we
   * cache it under so the per-language checkpoint only has to install test deps.
   */
  readonly sandbox: {
    readonly registry: string
    readonly tag: string
    /** Shell command run once to install test deps on top of the base image. */
    readonly prepareCommand: string
    /** Shell command run on every attempt, prints marker-delimited stdout. */
    readonly testCommand: string
  }

  /** Render patchbay-authoritative fixtures for a researched API spec. */
  renderFixtures(spec: ApiSpec): GeneratedFile

  /** Static half of the contract check: inspect test file imports / shape. */
  contractMissing(files: GeneratedFile[]): string | null

  /** Parse the sandbox's marker-delimited stdout into a TestReport. */
  parseTestOutput(stdout: string, ranOn: string): TestReport
}

const TS: LangDescriptor = {
  label: 'TypeScript',
  requiredFiles: ['src/connector.ts', 'src/connector.test.ts', 'README.md'],
  fixturesPath: FIXTURES_PATH,
  generateSystem: GENERATE_SYSTEM,
  defaultOpenFile: 'src/connector.ts',
  typecheckLabel: 'typecheck',
  testRunnerLabel: 'vitest',
  sandbox: {
    registry: 'docker://docker.io/library/node:22-slim',
    tag: 'patchbay-node:22',
    prepareCommand: [
      'mkdir -p /work/src',
      'cd /work',
      `printf '%s' '{"name":"connector","private":true,"type":"module"}' > package.json`,
      'npm install --no-audit --no-fund --loglevel=error -D vitest@3.2.4 typescript@5.6.3 @types/node@22',
    ].join(' && '),
    testCommand: TEST_COMMAND,
  },
  renderFixtures,
  contractMissing,
  parseTestOutput,
}

const PY: LangDescriptor = {
  label: 'Python 3.12',
  requiredFiles: ['connector.py', 'test_connector.py', 'README.md'],
  fixturesPath: FIXTURES_PATH_PY,
  generateSystem: GENERATE_SYSTEM_PY,
  defaultOpenFile: 'connector.py',
  typecheckLabel: 'syntax check',
  testRunnerLabel: 'pytest',
  sandbox: {
    registry: 'docker://docker.io/library/python:3.12-slim',
    tag: 'patchbay-python:3.12',
    prepareCommand: [
      'mkdir -p /work',
      'cd /work',
      'pip install --quiet --no-cache-dir pytest==8.3.3 pytest-asyncio==0.24.0 pytest-json-report==1.5.0',
      // %b interprets \n as a real newline; %s would write literal backslash-n.
      `printf '%b' '[pytest]\\nasyncio_mode = auto\\n' > pytest.ini`,
    ].join(' && '),
    testCommand: TEST_COMMAND_PY,
  },
  renderFixtures: renderFixturesPy,
  contractMissing: contractMissingPy,
  parseTestOutput: parsePytestOutput,
}

/** Lookup table: `LANG[config.lang]` returns the full language profile. */
export const LANG: Record<Lang, LangDescriptor> = { ts: TS, py: PY }

/** Markers re-exported here for sandbox parsers that still read them by name. */
export { PYC_MARKER, PYTEST_MARKER, TSC_MARKER, VITEST_MARKER }
