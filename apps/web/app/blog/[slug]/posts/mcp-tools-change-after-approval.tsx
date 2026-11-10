import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function McpToolsChangeAfterApproval() {
  return (
    <>
      <p>
        You looked at an MCP server before you connected it. You read the tool list, decided the
        tools were harmless and approved it. That decision was about the server as it was on that
        day.
      </p>
      <p>
        The tool list is not fixed. The server sends it fresh every time a client asks. What you
        approved last month and what your agent sees today can be two different things.
      </p>

      <h2 className={H2}>What the spec allows</h2>
      <p>
        The{' '}
        <a href="https://modelcontextprotocol.io/specification/2026-07-28/server/tools" className={A}>
          MCP tools spec
        </a>{' '}
        says the set of tools may change over time. A server can announce changes with a{' '}
        <code>notifications/tools/list_changed</code> message. That notification is a should, it
        only reaches clients that subscribed to it and nothing in the spec requires a client to ask
        the user again when the list changes.
      </p>
      <p>
        The spec does tell clients to treat tool annotations as untrusted unless they come from a
        trusted server. It recommends a human in the loop who can deny a tool call. It does not
        define how a client should notice that a tool it already knows has become something else.
        That part is left to the client and to you.
      </p>

      <h2 className={H2}>The changes that matter</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>A new tool that can write.</strong> A server that only searched documents now
          also has a tool that sends mail or deletes records.
        </li>
        <li>
          <strong>A known tool gets a new parameter.</strong> A read only lookup gains a{' '}
          <code>command</code>, <code>path</code> or <code>url</code> argument. The name is the
          same. What it can reach is not.
        </li>
        <li>
          <strong>A description changes.</strong> The model reads tool descriptions as part of its
          instructions. New text in a description is new input to the model that no user reviewed.
        </li>
      </ul>
      <p>
        None of these has to be an attack. Servers add features. The point is that you want to
        hear about it before your agent does.
      </p>

      <h2 className={H2}>Pin the manifest and diff it</h2>
      <p>
        <code>patchbay audit</code> stores the tool manifest of a server the first time it audits
        it. Every later run compares the current list with the stored one.
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp</code>
      </pre>
      <p>
        If something changed you get finding{' '}
        <Link href="/docs/manifest-001" className={A}>
          MANIFEST-001
        </Link>{' '}
        with the list of differences. The severity follows the most serious change:
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>Critical:</strong> a new tool that looks like it writes or executes, or an
          existing tool with a new parameter such as <code>command</code>, <code>path</code>,{' '}
          <code>url</code> or <code>sql</code>
        </li>
        <li>
          <strong>Medium:</strong> the description of an existing tool changed
        </li>
        <li>
          <strong>Low:</strong> a new read only tool or another change to an input schema
        </li>
        <li>
          <strong>Info:</strong> a tool was removed
        </li>
      </ul>
      <p>
        The pinned manifests live on your machine under <code>~/.patchbay/manifests</code>. That is
        why this check runs in the CLI and not in the{' '}
        <Link href="/scan" className={A}>
          browser scanner
        </Link>
        . The comparison is between your own runs.
      </p>

      <h2 className={H2}>When a change is expected</h2>
      <p>
        If you reviewed the differences and they are fine, pin the new state:
      </p>
      <pre className={PRE}>
        <code>npx -y @patchbay-nebius/agent audit https://mcp.example.com/mcp --trust</code>
      </pre>
      <p>
        If a change surprises you, do not pin it. Read the release notes of the server first. For
        a server you host yourself, check what was deployed.
      </p>

      <h2 className={H2}>Run it on a schedule</h2>
      <p>
        A diff only helps if something runs it. Put the audit in a scheduled CI job for the servers
        your agents depend on and let it fail on critical findings. On a fresh machine such as a
        GitHub Actions runner you have to keep the manifest store between runs. Without the cache
        step every run looks like the first one and the diff never fires.
      </p>
      <pre className={PRE}>
        <code>
{`- uses: actions/cache@v4
  with:
    path: ~/.patchbay/manifests
    key: patchbay-manifests-v1

- uses: GodSmasher/patchbay-audit@v1
  with:
    url: https://your-mcp.example.com/mcp
    fail-on: critical`}
        </code>
      </pre>
      <p>
        The cache is written once under that key and then stays as it is. That is what you want
        for a pinned state. When you have reviewed a change and want to accept it, raise the key to{' '}
        <code>v2</code>. The next run starts without a pinned manifest and pins the current one.
      </p>
      <p>
        One limit to keep in mind: the check sees the tool list a server returns to the scanner. A
        server that only answers after login needs the <code>--auth</code> flag so the audit can
        read the list at all.
      </p>
    </>
  )
}
