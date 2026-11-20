import { Inter, Jost } from 'next/font/google'

/**
 * Glow design system for the audit product pages. Fonts are self-hosted by
 * next/font at build time, so visitors' browsers never call Google — keeps
 * the privacy page's "no trackers" promise intact.
 */
export const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jost', display: 'swap' })
export const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

