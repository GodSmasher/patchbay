import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpToolChangesBreakingAdditiveSemanticDrift() {
  return (
    <>
      <p>
        Last week I wrote that{' '}
        <Link href="/blog/mcp-tools-change-after-approval" className={A}>
          an MCP server can change its tools after you approved it
        </Link>
        . The post left a question open that readers asked straight away: which changes actually
        matter? If every edit raised an alarm, the alarm would never be worth reading.
      </p>
      <p>
        So the scanner got a second check that sorts every change into one of three buckets. The
        bucket decides whether a reviewer needs to update client code, needs to look once, or can
        safely ignore it.
      </p>

      <h2 className={H2}>Three buckets</h2>
      <p>
        <strong>Breaking (critical).</strong> The change forces existing clients to fail. A tool
        was removed, a parameter was removed, an optional parameter became required, a type
        narrowed from <code>string</code> to <code>integer</code>, an enum lost a value. A client
        that still calls the tool the old way gets rejected.
      </p>
      <p>
        <strong>Semantic drift (medium).</strong> The shape is identical but the text the model
        reads changed. A description was rewritten. The schema a programmer codes against did not
        move, but the instructions the LLM uses to decide when and how to call the tool did. The
        tool can start behaving differently without a single line of client code needing to change.
      </p>
      <p>
        <strong>Additive (low).</strong> A new tool appeared, or an existing tool gained an
        optional parameter. Existing clients keep working. If you want to use the new surface, you
        update your client.
      </p>

      <h2 className={H2}>Why semantic drift gets its own bucket</h2>
      <p>
        If you only look at schemas, you miss the most likely source of a quiet behaviour change.
        The MCP specification says the tool description is part of the information the client
        sends to the model. The model treats it as planning context. A rewrite from
        <em> &quot;fetches a record by id&quot;</em> to{' '}
        <em>&quot;fetches a record by id and marks it as read&quot;</em> has no effect on any
        TypeScript or Python type checker. It has a very large effect on what an agent decides to
        do with the tool.
      </p>
      <p>
        A readers&apos; nudge from the MCP community (thanks) pointed out that description-only
        edits are semantically breaking even when the shape stays the same. The bucket exists so a
        diff like that does not disappear into the additive bin.
      </p>

      <h2 className={H2}>How to run it</h2>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        The first run pins the current tool manifest. Every later run against the same server
        diffs the live tools against the pinned copy and reports one finding per non-empty bucket.
      </p>
      <p>
        If you expected the change because you updated the server on purpose, re-pin with{' '}
        <code>--trust</code>:
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp --trust</code>
      </pre>

      <h2 className={H2}>For CI</h2>
      <p>
        The buckets map cleanly onto a single policy that works in most pipelines: fail only on
        breaking.
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp --fail-on=critical</code>
      </pre>
      <p>
        That catches removed tools, removed parameters, narrowed types and shrunk enums. It does
        not fail on a description edit, because a description edit is semantic drift at medium
        severity and should not block a deploy. The medium finding still shows up in the report so
        a human can read it later.
      </p>
      <p>
        Teams that want the stricter gate, including description changes, can set{' '}
        <code>--fail-on=medium</code> instead. Both are valid. The default stays at warn-only, so
        a scan in local dev does not surprise you.
      </p>

      <h2 className={H2}>What the check does not do</h2>
      <p>
        It does not reach into tool behaviour. A tool whose description stays the same and whose
        schema stays the same can still start doing something different on the server. The scanner
        cannot see that from the outside. The purpose of the check is to catch changes that would
        have forced a new approval prompt in a well-behaved client, but did not, because MCP does
        not force that prompt.
      </p>
      <p>
        See{' '}
        <Link href="/docs/manifest-002" className={A}>
          MANIFEST-002
        </Link>{' '}
        for the full list of what each bucket catches. MANIFEST-001 remains the single-line alert;
        MANIFEST-002 is the detail you want when the alert fires.
      </p>
    </>
  )
}
