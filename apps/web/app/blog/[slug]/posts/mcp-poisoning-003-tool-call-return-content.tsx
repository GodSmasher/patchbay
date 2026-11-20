import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpPoisoning003ToolCallReturnContent() {
  return (
    <>
      <p>
        Patchbay is a passive scanner by design. Point it at an MCP server and it runs 25-plus
        checks against OAuth 2.1, transport security, exposed secrets and tool descriptions. No
        execution. That design decision paid off for the first eight weeks. Static checks are
        cheap, reproducible and legal to run against anyone who publishes a public endpoint.
      </p>
      <p>One finding category kept slipping past.</p>
      <p>
        The tool-call return envelope. When a client invokes a tool and the server responds, the
        response body can carry poisoned instructions the static scan never sees because the
        scanner never invokes anything. The attacker writes nothing into the manifest, nothing
        into the tool description, nothing into the OAuth metadata. They control only what comes
        back when their tool is actually called. The static scan is blind to it.
      </p>
      <p>
        A design partner working on an admission layer flagged this in writing earlier this
        month. Their framing was direct. The scanner catches first-layer envelope attacks but
        misses the second-layer return-content class entirely. They were right.
      </p>

      <h2 className={H2}>What POISONING-003 does</h2>
      <p>
        POISONING-003 is opt-in. It is a runtime check, not a passive one, so it runs only when
        the operator sets <code>--probe-tool-calls</code> and supplies a tool name (or uses the
        default-safe tool heuristic). The flow is small.
      </p>
      <p>
        First, the check reads the tool manifest and picks a call-safe tool. Default heuristic: a
        tool whose scope is read-only, whose name matches{' '}
        <code>get|list|read|describe|status</code>, and whose declared schema does not accept
        free-form text that the server might treat as a side effect. Operators can override by
        passing an explicit tool name.
      </p>
      <p>
        Second, the check invokes that tool with a controlled payload the operator confirms is
        safe (default: an empty object for parameterless tools, or a synthetic test fixture we
        ship with).
      </p>
      <p>Third, the check inspects the response envelope. The scan looks for three patterns:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>Role-marker patterns</strong> like <code>&lt;|system|&gt;</code>,{' '}
          <code>&lt;|assistant|&gt;</code>, <code>[INST]</code>, <code>### Instruction</code>, and
          other model-specific delimiters that would be interpreted as new turn boundaries by
          downstream LLMs.
        </li>
        <li>
          <strong>Hidden Unicode</strong> in the response body: zero-width characters (U+200B
          through U+200D), bidi overrides (U+202A through U+202E), tag characters (U+E0000
          through U+E007F), and the soft hyphen (U+00AD).
        </li>
        <li>
          <strong>Imperative directives</strong> in natural-language response text that would
          read as new instructions to a downstream model. Patterns like{' '}
          <em>ignore previous instructions</em>, <em>you are now</em>,{' '}
          <em>new system message</em>, and the ten most common prompt-injection openers.
        </li>
      </ul>
      <p>
        Each hit is reported as a finding with the exact byte offset in the response, the raw
        bytes, and a suggested fix. Severity is high when the response body is destined for
        direct model context and medium when it passes through structured post-processing first.
      </p>

      <h2 className={H2}>How it differs from POISONING-001</h2>
      <p>
        POISONING-001 stays as it was. It is a static check on the tool description inside the
        manifest, reading the same patterns against what the server exposes before any call.
      </p>
      <p>
        POISONING-003 is the runtime counterpart. Same pattern logic, different source of bytes.
        Operators who already run POISONING-001 and see no findings can still have POISONING-003
        fire if the server poisons only on specific invocations. The two checks are
        complementary, not redundant.
      </p>
      <p>
        Running both covers the tool-description surface and the tool-response surface. Running
        POISONING-001 alone covers the first and misses the second. Running POISONING-003 alone
        covers the second and misses the first.
      </p>

      <h2 className={H2}>Why it is opt-in</h2>
      <p>
        Runtime probes touch the server. The static checks do not. We take that line seriously.
      </p>
      <p>
        The default patchbay scan stays passive. You can run it against any public MCP server
        listed in the registry and the only requests you send are the ones a spec-compliant
        client would send at connect time: the initialize handshake, the metadata fetches, the
        tools-list call. Nothing a reasonable operator would object to.
      </p>
      <p>
        POISONING-003 is different. It invokes a tool. Even when that tool is read-only by
        heuristic, the invocation leaves a log entry on the server side. We require operators to
        pass an explicit opt-in flag before the check runs, and we recommend running it only
        against servers you own or against the patchbay demo server at{' '}
        <code>demo.patchbay-mcp.dev</code> which is set up for exactly this.
      </p>
      <p>
        Operators who want full coverage on servers they do not own should ask the operator
        first. Email, GitHub issue, or a reply to the scan-result email we send with the report
        URL. We publish the per-check scope policy at{' '}
        <Link href="/docs/scopes" className={A}>
          patchbay-mcp.dev/docs/scopes
        </Link>{' '}
        so everyone sees the same line.
      </p>

      <h2 className={H2}>The three-category output</h2>
      <p>
        POISONING-003 also marks the moment patchbay started writing findings in three
        categories, not one.
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>source-confirmed:</strong> static read of the manifest or source caught the
          pattern. High signal, cheap to verify, low false positive.
        </li>
        <li>
          <strong>runtime-verified:</strong> a probe fired and the response confirmed the
          pattern. Highest signal, the finding reproduces on every run.
        </li>
        <li>
          <strong>potential-fp:</strong> the regex matched but context is ambiguous. For humans
          and engineering teams to triage, not for CI to fail on.
        </li>
      </ul>
      <p>
        Every patchbay audit from 0.14 onward tags findings with one of these three categories.
        Report output, SARIF export and JSON mode all carry the tag. Reports under{' '}
        <Link href="/report" className={A}>
          patchbay-mcp.dev/report/
        </Link>{' '}
        show the tag as a colored pill next to each finding.
      </p>
      <p>
        The split is cheap discipline. A scanner that treats every match as equal burns trust the
        first time a false positive costs an engineering team an hour. A scanner that admits its
        uncertainty earns a second look.
      </p>

      <h2 className={H2}>What is next</h2>
      <p>
        POISONING-004 is in the design doc. Same pattern-logic, different trigger: watching for
        return-envelope poisoning that appears only after a session reaches a specific state (for
        example, after a tool has been called N times with a particular argument shape).
        State-dependent poisoning is harder to probe and harder to detect, so we are still
        deciding whether the cost of the check justifies the catch rate. The design partner work
        continues.
      </p>

      <h2 className={H2}>How to run it</h2>
      <p>
        The check is in <code>@patchbay-nebius/audit-core</code> 0.14 and up. Usage:
      </p>
      <pre className={PRE}>
{`npx -y @patchbay-nebius/agent audit https://your-mcp-server.example.com/mcp \\
  --probe-tool-calls \\
  --probe-tool-name=list_documents`}
      </pre>
      <p>Or against the patchbay demo:</p>
      <pre className={PRE}>
{`npx -y @patchbay-nebius/agent audit https://demo.patchbay-mcp.dev/mcp \\
  --probe-tool-calls`}
      </pre>
      <p>
        The demo has a tool that returns poisoned content on purpose. POISONING-003 fires,
        runtime-verified, with the exact bytes in the finding. Good calibration test.
      </p>
      <p>
        The GitHub Action wrapper accepts the same opt-in flag through the{' '}
        <code>probe-tool-calls: true</code> input.
      </p>
      <p>
        Repository:{' '}
        <a href="https://github.com/GodSmasher/patchbay" className={A}>
          github.com/GodSmasher/patchbay
        </a>
        . Source for the check:{' '}
        <a
          href="https://github.com/GodSmasher/patchbay/blob/main/packages/audit-core/src/checks/poisoning-003.ts"
          className={A}
        >
          packages/audit-core/src/checks/poisoning-003.ts
        </a>
        .
      </p>
    </>
  )
}
