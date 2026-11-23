import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function Sec001CommandInjection() {
  return (
    <>
      <p>
        patchbay scans public MCP servers for OAuth, header and tool-manifest security issues. On
        2026-11-20 we had the exact species of bug we build patchbay to find in other people{"'"}
        s code: shell-injection in our own call to <code>git clone</code>. Pietro Procaccini sent
        us a private disclosure with a working proof of concept and a one-line fix. Twelve hours
        later, both affected packages were patched on npm, a GitHub Security Advisory was
        published, and the regression that would stop the pattern being reintroduced was running
        in our CI.
      </p>
      <p>This is how it happened and how it was caught.</p>

      <h2 className={H2}>What the bug was</h2>
      <p>
        The <code>scan_repo</code> tool exposed by <code>@patchbay-nebius/mcp</code> lets an MCP
        client (typically an LLM agent) point at a GitHub URL and have patchbay shallow-clone it
        for offline analysis. The same functionality is exposed on the command line as{' '}
        <code>patchbay scan &lt;url&gt;</code>. The implementation looked like this:
      </p>
      <pre className={PRE}>
{`if (/^https?:\\/\\/github\\.com\\//i.test(path)) {
  const target = join(tmpdir(), \`patchbay-mcp-scan-\${Date.now()}\`)
  execSync(\`git clone --depth=1 "\${path}" "\${target}"\`, { stdio: 'pipe' })
  // ...
}`}
      </pre>
      <p>
        The regex looked like a validation. It was not. It pinned the prefix of the URL. Nothing
        more. The rest of the string, up to the end, went straight into the double-quoted shell
        template. In POSIX shells, <code>$(…)</code> command substitution expands inside double
        quotes.
      </p>
      <p>Pietro{"'"}s proof of concept:</p>
      <pre className={PRE}>
{`https://github.com/octocat/Hello-World$(touch /tmp/pwned)`}
      </pre>
      <p>
        That URL passes the prefix check. When the template is handed to <code>execSync</code>,
        the shell parses it: <code>$(touch /tmp/pwned)</code> is evaluated first,{' '}
        <code>/tmp/pwned</code> is created with the permissions of the process, and only then
        does <code>git clone</code> get invoked (with a mangled argument that it promptly
        rejects). The crash on the git side gives no warning that code already ran. Backticks
        and <code>;</code> / <code>&amp;&amp;</code> payloads behave the same way.
      </p>
      <p>
        CWE-78: OS command injection. CVSS 8.8 base (high), with an argument for higher in
        agentic deployments. Any LLM that can be prompted into calling <code>scan_repo</code>{' '}
        with an attacker-supplied URL executes commands on the MCP server{"'"}s host. The user
        running the agent does not need to type the URL; prompt-injection on the agent is
        enough.
      </p>

      <h2 className={H2}>The fix</h2>
      <p>Pietro sent the fix in the same mail that reported the bug:</p>
      <pre className={PRE}>
{`execFileSync('git', ['clone', '--depth=1', '--', path, target], { stdio: 'pipe' })`}
      </pre>
      <p>Two differences from the original matter:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>
            <code>execFileSync</code> with an argv array
          </strong>{' '}
          does not invoke a shell at all. The <code>path</code> argument is passed to git as a
          literal string. If it contains <code>$(…)</code>, backticks, <code>;</code>, newlines,
          git sees those characters, git rejects them (or git tries to clone a URL that makes no
          sense), but nothing else runs.
        </li>
        <li>
          <strong>
            The <code>--</code> separator
          </strong>{' '}
          tells <code>git clone</code> to stop parsing options at that point. If the URL ever
          starts with a <code>-</code>, it cannot be interpreted as a flag. The prefix regex
          blocks that today, but regex-only validation rots. Defence in depth.
        </li>
      </ul>
      <p>
        We applied the fix verbatim to both call sites:{' '}
        <code>packages/mcp/src/server.ts:158</code> and{' '}
        <code>packages/agent/src/cli.ts:98</code>. Pietro had flagged only the first one in his
        report. The second one was the same pattern in a different package, and we found it on
        an audit grep for <code>execSync</code> across the monorepo. Both packages are included
        in the GHSA.
      </p>
      <p>
        The fix commit is{' '}
        <a href="https://github.com/GodSmasher/patchbay/commit/04ea42f" className={A}>
          04ea42f
        </a>
        .
      </p>

      <h2 className={H2}>How it got there, how we missed it</h2>
      <p>This is the honest part.</p>
      <p>
        <strong>The regex-prefix check looked like validation.</strong> It was there to stop a
        user asking the scanner to clone a non-GitHub URL. It was defence against one kind of
        mistake (point the scanner elsewhere) and we silently extended it in our heads to
        defence against another kind (shell injection). Those are different problems with
        different fixes. A prefix regex does not constrain what comes after the prefix.
      </p>
      <p>
        <strong>We had the safe pattern in the same repo.</strong>{' '}
        <code>scripts/crawl-dual.ts:119</code> already used{' '}
        <code>
          spawn({"'"}git{"'"}, [{"'"}clone{"'"}, {"'"}--depth=1{"'"}, {"'"}--single-branch{"'"},{' '}
          {"'"}--quiet{"'"}, repoUrl, dst])
        </code>
        . The argv-array form Pietro suggested. Two code sites away from the two we broke. We
        did not pattern-match from one to the other. In review, nobody stopped and said{' '}
        <em>wait, scan_repo does not do it the way crawl-dual.ts does</em>. We did not have a
        check that would have stopped us.
      </p>
      <p>
        <strong>Our tests covered acceptance and rejection, not side effects.</strong> The
        scanner has tests for what URLs it accepts and what URLs it rejects. It did not have a
        test for what happens when a URL <em>is</em> rejected by git but the rejection path has
        already caused a side effect. The PoC URL passes the prefix check, the{' '}
        <code>git clone</code> call eventually fails with a lookup error, the error handler runs
        cleanly, and by that time the shell has already done the attacker{"'"}s bidding.
      </p>
      <p>
        <strong>
          audit-core has dozens of checks for other servers{"'"} shell-injection patterns. It had
          none for its own sibling packages.
        </strong>{' '}
        That is the gap that let this through. Writing checks that catch bugs in other people
        {"'"}s MCP servers while not running those same checks against our own source is exactly
        the imbalance a security tool should not have.
      </p>

      <h2 className={H2}>What we are doing beyond the fix</h2>
      <p>Concrete follow-ups. Not vibes.</p>
      <p>
        <strong>CI regression guard</strong> (
        <a href="https://github.com/GodSmasher/patchbay/pull/8" className={A}>
          PR #8
        </a>
        , merged 2026-11-20). <code>scripts/validate-process-001.ts</code> walks production
        source trees and fails CI on any <code>(exec|execSync)(…)</code> template-literal with{' '}
        <code>{"${…}"}</code> interpolation. A meta-test (
        <code>validate-process-001.test.ts</code>) plants the pre-fix shape in a fixture and
        asserts the validator rejects it, so the gate cannot silently rot. We also refactored
        two in-repo <code>execSync</code> calls in <code>scripts/build-fixture.ts</code> that
        were safe-by-construction but would have taught the wrong lesson if allowlisted.
      </p>
      <p>
        <strong>Private vulnerability reporting enabled</strong> on{' '}
        <code>GodSmasher/patchbay</code> and <code>GodSmasher/patchbay-audit</code>. Pietro had
        to route through the <Link href="/cve" className={A}>/cve</Link> page email we published
        on the site. That address now coexists with GitHub{"'"}s first-class private reporting
        channel.
      </p>
      <p>
        <strong>Publish-workflow audit.</strong> The release pipeline was publishing{' '}
        <code>@patchbay-nebius/audit-core</code> and <code>@patchbay-nebius/agent</code>{' '}
        automatically on tag push, but <code>@patchbay-nebius/mcp</code> was hand-published.
        That meant we had no idempotent, provenance-signed release path for the package that was
        most exposed by this bug. We added mcp to the workflow and configured npm Trusted
        Publisher as part of the SEC-001 ship. The 0.7.1 release is the first
        signed-with-provenance mcp release, and every future one picks the same path.
      </p>
      <p>What we are not promising:</p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          We are not claiming no one was affected. We cannot prove it, and the responsible
          version is to publish the disclosure and let dependents upgrade. If you ran{' '}
          <code>@patchbay-nebius/mcp</code> or <code>@patchbay-nebius/agent</code> on an older
          version and are concerned, the GHSA has the CVSS vector and the exact pre-fix call
          sites for your own audit.
        </li>
        <li>
          We are not claiming the regression guard is exhaustive. It catches the direct pattern,
          where the template literal is written at the exec call site itself. It does not catch
          indirect patterns (build the string into a local variable first, pass the variable).
          Those are harder to grep for without an AST pass. If they show up we will extend the
          gate.
        </li>
        <li>
          We are not promising this is the last time we will ship a bug. We are promising to be
          the first to tell you when we do.
        </li>
      </ul>

      <h2 className={H2}>Credits</h2>
      <p>
        Thanks to <strong>Pietro Procaccini</strong> (
        <a href="https://github.com/pl4ka7" className={A}>@pl4ka7</a>) for responsibly disclosing
        SEC-001 and for sending the exact fix we shipped. If you run security research on MCP
        infrastructure or the npm supply chain, our private vulnerability reporting is now
        enabled at{' '}
        <a
          href="https://github.com/GodSmasher/patchbay/security/advisories/new"
          className={A}
        >
          github.com/GodSmasher/patchbay/security/advisories/new
        </a>
        . We read every report ourselves.
      </p>

      <h2 className={H2}>Links</h2>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>GHSA:</strong>{' '}
          <a
            href="https://github.com/GodSmasher/patchbay/security/advisories/GHSA-wv32-8ppf-r6ww"
            className={A}
          >
            GHSA-wv32-8ppf-r6ww
          </a>{' '}
          (canonical source, includes CVSS vector and affected ranges)
        </li>
        <li>
          <strong>CVE:</strong> requested from GitHub{"'"}s CNA, assignment pending as of
          publish. This post is updated the moment the ID lands.
        </li>
        <li>
          <strong>Fix commit:</strong>{' '}
          <a href="https://github.com/GodSmasher/patchbay/commit/04ea42f" className={A}>
            04ea42f
          </a>
        </li>
        <li>
          <strong>Regression guard:</strong>{' '}
          <a href="https://github.com/GodSmasher/patchbay/pull/8" className={A}>
            PR #8
          </a>
        </li>
        <li>
          <strong>Patched versions on npm:</strong>{' '}
          <a
            href="https://www.npmjs.com/package/@patchbay-nebius/mcp/v/0.7.1"
            className={A}
          >
            @patchbay-nebius/mcp@0.7.1
          </a>
          ,{' '}
          <a
            href="https://www.npmjs.com/package/@patchbay-nebius/agent/v/0.17.1"
            className={A}
          >
            @patchbay-nebius/agent@0.17.1
          </a>
        </li>
      </ul>
    </>
  )
}
