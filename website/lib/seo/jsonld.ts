import { REPO_URL } from '@/lib/release'
import {
  AUTHOR_NAME,
  AUTHOR_URL,
  DESCRIPTION,
  FAQ_TITLE,
  LICENSE_URL,
  SITE_ALTERNATE_NAMES,
  SITE_NAME,
  SITE_URL
} from '@/lib/site'
import { FAQ } from '@/lib/seo/faq'

const OG = `${SITE_URL}/social/linea-whatsapp-og.png`

function thing<T extends Record<string, unknown>>(data: T): T {
  return data
}

export function organizationJsonLd() {
  return thing({
    '@type': 'Person',
    '@id': `${SITE_URL}/#author`,
    name: AUTHOR_NAME,
    url: AUTHOR_URL
  })
}

export function websiteJsonLd() {
  return thing({
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    url: SITE_URL,
    description: DESCRIPTION,
    inLanguage: 'en',
    publisher: { '@id': `${SITE_URL}/#author` }
  })
}

export function softwareJsonLd() {
  return thing({
    '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
    '@id': `${SITE_URL}/#app`,
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    url: SITE_URL,
    description: DESCRIPTION,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Windows 10, Windows 11',
    downloadUrl: `${SITE_URL}/download?platform=win`,
    installUrl: `${SITE_URL}/download?platform=win`,
    screenshot: OG,
    image: OG,
    isAccessibleForFree: true,
    license: LICENSE_URL,
    codeRepository: REPO_URL,
    sameAs: [REPO_URL],
    author: { '@id': `${SITE_URL}/#author` },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    },
    featureList: [
      'Always-on-top synced lyrics overlay',
      'Windows media session playback (no Spotify login)',
      'LRCLIB lyrics with NetEase fallback',
      'Local lyric cache',
      'Play, pause, skip and seek from the overlay',
      'Per-track cymatic artwork',
      'Click-through and summon shortcuts',
      'MIT licensed source on GitHub'
    ]
  })
}

export function siteGraphJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationJsonLd(), websiteJsonLd(), softwareJsonLd()]
  }
}

export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    name: FAQ_TITLE,
    url: `${SITE_URL}/faq`,
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a
      }
    }))
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`
    }))
  }
}

export function changelogJsonLd(
  releases: {
    version: string
    title: string
    lede: string
    url: string
  }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Linea changelog',
    url: `${SITE_URL}/changelog`,
    description: 'Every Linea release, newest first.',
    itemListElement: releases.map((release, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Linea ${release.version} — ${release.title}`,
      description: release.lede,
      url: release.url
    }))
  }
}
