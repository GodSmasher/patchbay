import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SubscribeBox } from '@/components/subscribe-box'
import { getPost, POSTS } from '../_data'
import { FourOauthChecksMcpAuthorizationEndpoint } from './posts/four-oauth-checks-mcp-authorization-endpoint'
import { McpToolChangesBreakingAdditiveSemanticDrift } from './posts/mcp-tool-changes-breaking-additive-semantic-drift'
import { McpToolPoisoningHiddenCharactersDescriptions } from './posts/mcp-tool-poisoning-hidden-characters-descriptions'
import { McpTokenMissingAudienceClaimBug } from './posts/mcp-token-missing-audience-claim-bug'
import { McpServerTransportSecurityHeaders } from './posts/mcp-server-transport-security-headers'
import { McpOauthIssParameterMixUpMitigation } from './posts/mcp-oauth-iss-parameter-mix-up-mitigation'
import { McpOauthScopeHygieneThreeMistakes } from './posts/mcp-oauth-scope-hygiene-three-mistakes'
import { McpDynamicClientRegistrationMissing } from './posts/mcp-dynamic-client-registration-missing'
import { McpOauthLoginHangsLoopbackRedirect } from './posts/mcp-oauth-login-hangs-loopback-redirect'
import { McpServerToolsListWithoutAuthentication } from './posts/mcp-server-tools-list-without-authentication'
import { McpPkceMissingFromOauthMetadata } from './posts/mcp-pkce-missing-from-oauth-metadata'
import { McpTokenAudienceValidation } from './posts/mcp-token-audience-validation'
import { McpToolsChangeAfterApproval } from './posts/mcp-tools-change-after-approval'
import { StateOfMcpAuthNov2026 } from './posts/state-of-mcp-auth-nov-2026'

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPost(params.slug)
  if (!post) return { title: 'Not found' }
  return {
    title: `${post.title} · patchbay`,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    // Drafts are reachable by direct link for review but must not be indexed.
    ...(post.draft ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: post.title,
      description: post.summary,
      type: 'article',
      url: `/blog/${post.slug}`,
      publishedTime: post.date,
    },
  }
}

const BODIES: Record<string, () => JSX.Element> = {
  'mcp-oauth-scope-hygiene-three-mistakes': McpOauthScopeHygieneThreeMistakes,
  'mcp-oauth-iss-parameter-mix-up-mitigation': McpOauthIssParameterMixUpMitigation,
  'mcp-server-transport-security-headers': McpServerTransportSecurityHeaders,
  'mcp-token-missing-audience-claim-bug': McpTokenMissingAudienceClaimBug,
  'mcp-tool-poisoning-hidden-characters-descriptions': McpToolPoisoningHiddenCharactersDescriptions,
  'mcp-tool-changes-breaking-additive-semantic-drift': McpToolChangesBreakingAdditiveSemanticDrift,
  'four-oauth-checks-mcp-authorization-endpoint': FourOauthChecksMcpAuthorizationEndpoint,
  'mcp-server-tools-list-without-authentication': McpServerToolsListWithoutAuthentication,
  'mcp-pkce-missing-from-oauth-metadata': McpPkceMissingFromOauthMetadata,
  'mcp-tools-change-after-approval': McpToolsChangeAfterApproval,
  'mcp-dynamic-client-registration-missing': McpDynamicClientRegistrationMissing,
  'mcp-token-audience-validation': McpTokenAudienceValidation,
  'mcp-oauth-login-hangs-loopback-redirect': McpOauthLoginHangsLoopbackRedirect,
  'state-of-mcp-auth-nov-2026': StateOfMcpAuthNov2026,
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()
  const Body = BODIES[post.slug]
  if (!Body) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    url: `https://patchbay-mcp.dev/blog/${post.slug}`,
    mainEntityOfPage: `https://patchbay-mcp.dev/blog/${post.slug}`,
    author: { '@type': 'Person', name: 'Sarah Vogel', url: 'https://github.com/GodSmasher' },
    publisher: { '@type': 'Organization', name: 'patchbay', url: 'https://patchbay-mcp.dev/scan' },
  }

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      {!post.draft && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <div className="mx-auto max-w-3xl">
        <nav className="mb-10 text-sm text-ink-mute">
          <Link href="/scan" className="hover:text-ink">patchbay</Link>
          <span className="mx-2">/</span>
          <Link href="/blog" className="hover:text-ink">blog</Link>
        </nav>

        {post.draft && (
          <div className="mb-6 rounded border border-warn/30 bg-warn-soft px-4 py-2 text-sm text-warn">
            Draft. Not linked from the index in production.
          </div>
        )}

        <div className="flex items-baseline gap-3 text-sm text-ink-mute mb-2">
          <time dateTime={post.date}>{post.date}</time>
          <span>·</span>
          <span>{post.readingMinutes} min read</span>
        </div>
        <h1 className="text-3xl font-semibold text-ink mb-8">{post.title}</h1>

        <article className="max-w-none text-ink-soft leading-relaxed space-y-4">
          <Body />
        </article>

        <SubscribeBox page={`/blog/${post.slug}`} />
      </div>
    </main>
  )
}
