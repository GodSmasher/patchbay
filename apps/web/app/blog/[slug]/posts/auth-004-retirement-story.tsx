import Link from 'next/link'

const A = 'text-ink underline underline-offset-4 hover:text-ink'
const H2 = 'text-xl font-semibold text-ink mt-12 mb-4'
const PRE = 'rounded border border-paper-line bg-paper p-4 text-sm overflow-x-auto my-4'

export function Auth004RetirementStory() {
  return (
    <>
      <p>Patchbay audit-core 0.3.4 killed AUTH-004 off the list.</p>
      <p>
        The check used to flag OAuth metadata that lacked{' '}
        <code>resource_indicators_supported</code>. We added it in the first draft because the
        field looked load-bearing. Audience binding is a real requirement, resource indicators
        are the mechanism, and a server that fails to advertise support for them looks like a
        server that will not bind tokens correctly. The check would fire, mark the server down a
        grade, and point the operator at RFC 8707.
      </p>
      <p>
        On verification pass, something simple went wrong. No RFC defines{' '}
        <code>resource_indicators_supported</code>. No MCP spec references it. We were asking
        servers to signal something that is not a thing.
      </p>
      <p>
        We kept it alive through two releases on the assumption that surely this is somewhere. We
        asked three design partners. We re-read RFC 8707 twice. We checked the OAuth 2.1 draft,
        the MCP 2026-07-28 spec, the RFC 9728 Protected Resource Metadata spec, and the IANA
        OAuth parameters registry. Nothing.
      </p>
      <p>
        Finally we sat down with the spec stack and confirmed the field is invented. Someone had
        written a tutorial that used it, someone else had copied the pattern into an internal
        design note, and by the time it reached patchbay the shape looked load-bearing because
        it had been passed between enough documents.
      </p>
      <p>
        We retired the check in 0.3.4. It now returns an empty finding list and is marked{' '}
        <code>retired</code> in the check metadata.
      </p>

      <h2 className={H2}>Replaced with a probe, not another metadata check</h2>
      <p>
        AUDIENCE-001 does the work AUTH-004 was trying to do. It is an opt-in probe that actually
        tries to mint a token for a sibling resource on the same authorization server and checks
        whether the server accepts it. That is what RFC 8707 actually requires: that tokens are
        bound to a resource and rejected when presented at a different one. The behavior is the
        enforcement, not the metadata flag.
      </p>
      <p>
        AUDIENCE-001 needs a real token, so it is opt-in via{' '}
        <code>--probe-audience=&lt;bearer-for-sibling-resource&gt;</code>. When it fires, it
        fires on actual behavior. A server that rejects the cross-audience token passes. A
        server that accepts it fails, and the failure is reproducible on every run with evidence
        the operator can forward to their auth team.
      </p>
      <p>
        The lesson is small and specific. If you want to know whether a server does the right
        thing, test the thing. Do not grade the metadata.
      </p>

      <h2 className={H2}>The pattern that matters more than the check itself</h2>
      <p>
        A scanner is only useful to the degree that its findings are real. Every false positive
        that reaches an engineering team costs that team an hour, and the trust spent is harder
        to re-earn than the trust lost on a single miss.
      </p>
      <p>Three disciplines fall out of that.</p>
      <p>
        First, verify checks against the spec they claim to enforce. Not the tutorial, not the
        design note, not the internal convention. The RFC, the MCP spec, the IANA registry. If
        the thing the check looks for is not defined, the check is wrong even if the intent was
        right.
      </p>
      <p>
        Second, when a check is wrong, retract it. Faster is better than slower. A check that
        stays on because removing it feels like admitting weakness is a check that burns trust
        every time it fires.
      </p>
      <p>
        Third, prefer probes over metadata. A metadata check asks whether the server claims to
        do the right thing. A probe asks whether the server does the right thing. The answers
        are not the same, and the gap between them is where most real bugs live.
      </p>

      <h2 className={H2}>Patchbay now writes findings in three categories</h2>
      <p>
        The retirement of AUTH-004 was one input into the three-category finding format patchbay
        now uses by default.
      </p>
      <ul className="list-disc list-inside space-y-2 my-4 text-ink-soft">
        <li>
          <strong>source-confirmed:</strong> static read of the manifest or source caught the
          pattern.
        </li>
        <li>
          <strong>runtime-verified:</strong> a probe fired and the response confirmed the
          pattern.
        </li>
        <li>
          <strong>potential-fp:</strong> the regex matched but context is ambiguous.
        </li>
      </ul>
      <p>
        If AUTH-004 had existed under the three-category discipline from day one, it would have
        been a <code>potential-fp</code> from the start because the field it checked was not
        defined. The author would have been nudged to verify. The check would have been fixed
        before shipping. The retirement would not have been needed.
      </p>
      <p>Hindsight is cheap. The discipline is cheaper.</p>

      <h2 className={H2}>How to see which checks changed</h2>
      <p>
        Every check that was added, retired, or re-scoped since 0.11.0 is listed in{' '}
        <code>CHANGELOG.md</code> at the top of the repo. AUTH-004 appears there with the
        retirement reason and a link to AUDIENCE-001 as the replacement.
      </p>
      <p>
        For operators running older versions: audit-core before 0.3.4 will still fire AUTH-004
        and mark servers down for an invented field. Upgrading to 0.11.1 or newer removes the
        false positive entirely.
      </p>
      <pre className={PRE}>
{`npm install @patchbay-nebius/audit-core@latest
npm install @patchbay-nebius/agent@latest`}
      </pre>
      <p>
        Repository:{' '}
        <a href="https://github.com/GodSmasher/patchbay" className={A}>
          github.com/GodSmasher/patchbay
        </a>
        . The retired check stub lives at{' '}
        <a
          href="https://github.com/GodSmasher/patchbay/blob/main/packages/audit-core/src/checks/auth-004.ts"
          className={A}
        >
          packages/audit-core/src/checks/auth-004.ts
        </a>{' '}
        for anyone who wants to read the retirement note in the source.
      </p>
      <p>
        If your scanner is flagging servers for not supporting something that was never
        specified, your scanner is wrong and the servers are correct. Admit it, retract it,
        replace with a probe that tests the actual requirement.
      </p>
    </>
  )
}
