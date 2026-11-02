# Responsible disclosure template (patchbay audit findings)

Use this when `patchbay audit` surfaces a critical or high finding on a production third-party MCP server. Default embargo is 90 days from first contact; shorten if the vendor fixes early, extend if the vendor needs more time and asks.

**Before you send:**

1. Verify the finding manually — reproduce with a single `curl` command.
2. Try `/.well-known/security.txt` on the vendor's domain first.
3. If no `security.txt`, check their public GitHub for `SECURITY.md` or a Security Advisory tab.
4. Fallback: `security@<their-domain>` is a de-facto standard (RFC 2142 §4).
5. Last resort: contact form on their website — but never post exploit details publicly.

**Email template (English):**

```
Subject: [Responsible disclosure] <Vendor name> MCP server — auth posture

Hi <team or security@>,

I run patchbay (https://patchbay.dev), a free auditor for MCP servers. In a routine
sweep of public MCP endpoints on <DATE>, your server at <URL> surfaced the following
finding:

  Finding ID:   <AUTH-001 / AUTH-002 / etc.>
  Severity:     <critical | high>
  Summary:      <one line>
  Reproducer:
    curl -s -H 'content-type: application/json' \
         -H 'accept: application/json, text/event-stream' \
         -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
         <URL>

  Observed:     <what the response showed, e.g. "6 tools returned including
                start_dca_swap, start_swap — no credential required">

  Recommended fix:
    <short, actionable — usually "require OAuth 2.1 bearer, serve
    /.well-known/oauth-protected-resource, reject unauthenticated calls on
    initialize and tools/*">

  Reference: https://patchbay.dev/docs/<finding-id>

I'm giving you a 90-day embargo from today (<DATE + 90 days>) before any
public write-up names your server. If you fix sooner, let me know and I'll
cite the fixed state in the post. If 90 days isn't enough, tell me what
timeline works and I'll extend.

No bounty required — I'm reporting because the tool flagged it and the
right thing to do is tell you. Happy to answer questions or re-test after
you deploy a fix.

<Your name>
<Your email>
<Your PGP key, if you use one>
```

**German template:**

```
Betreff: [Responsible Disclosure] <Vendor-Name> MCP-Server — Auth-Zustand

Hallo <Team oder security@>,

ich betreibe patchbay (https://patchbay.dev), ein kostenloses Audit-Tool für
MCP-Server. Bei einem Routine-Scan öffentlicher MCP-Endpoints am <DATUM> ist
Euer Server unter <URL> aufgefallen:

  Finding-ID:     <AUTH-001 / AUTH-002 / ...>
  Severity:       <critical | high>
  Zusammenfassung: <ein Satz>
  Reproduzierbar:
    curl -s -H 'content-type: application/json' \
         -H 'accept: application/json, text/event-stream' \
         -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
         <URL>

  Beobachtung:    <was die Antwort zeigt>

  Vorschlag:
    <konkrete Empfehlung — meist "OAuth 2.1 bearer verlangen,
    /.well-known/oauth-protected-resource ausliefern, unauthenticated
    Requests auf initialize und tools/* ablehnen">

  Referenz: https://patchbay.dev/docs/<finding-id>

Ich halte 90 Tage Embargo ab heute (<DATUM + 90 Tage>) bevor eine
öffentliche Veröffentlichung Euren Server namentlich erwähnt. Fixt Ihr
schneller — sagt Bescheid, dann erwähne ich den gefixten Zustand. Reicht
die Frist nicht — sagt mir eine andere, ich verlängere.

Keine Bounty-Forderung — ich melde, weil das Tool es gefunden hat und das
der richtige Umgang damit ist. Fragen oder Nach-Test nach dem Fix gerne.

<Dein Name>
<Deine E-Mail>
<Dein PGP-Key, falls vorhanden>
```

**After sending:**

- Note the date you sent each one in a tracking file (e.g. `scratchpad/disclosure-log.md`).
- If no response in 14 days, send a polite follow-up.
- At day 90, publish — or extend if they asked and are making progress.
- When they fix, update the public post with "fixed in <date / version>".

**Do NOT:**

- Post the vendor name + exploit publicly before the embargo expires.
- Demand a bounty. Mention one only if they advertise one.
- Share the specific URL + reproducer on social media before the fix is live.
