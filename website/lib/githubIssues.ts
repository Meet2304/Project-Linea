import { REPO_NAME, REPO_OWNER } from './release'
import {
  crashMarker,
  crashSignature,
  issueBody,
  issueLabels,
  issueTitle,
  repeatCrashComment,
  type Report
} from './report'

const API = 'https://api.github.com'
const REPO = `${REPO_OWNER}/${REPO_NAME}`

export function githubToken(): string | undefined {
  const token = process.env.GITHUB_FEEDBACK_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()
  return token || undefined
}

async function gh(path: string, init: RequestInit & { token: string }): Promise<Response> {
  const { token, ...rest } = init
  return fetch(`${API}${path}`, {
    ...rest,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(rest.headers ?? {})
    }
  })
}

async function ensureLabels(token: string): Promise<void> {
  try {
    for (const name of ['feedback', 'crash'] as const) {
      const color = name === 'crash' ? 'b60205' : '0e8a16'
      const res = await gh(`/repos/${REPO}/labels/${encodeURIComponent(name)}`, {
        token,
        method: 'GET'
      })
      if (res.status !== 404) continue
      await gh(`/repos/${REPO}/labels`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          name,
          color,
          description: name === 'crash' ? 'Auto-sent crash' : 'In-app or website report'
        })
      })
    }
  } catch {
    // Labels are optional. createIssue falls back to bug / enhancement.
  }
}

async function findOpenCrash(
  token: string,
  marker: string,
  signature: string
): Promise<number | undefined> {
  const listed = await gh(`/repos/${REPO}/issues?state=open&labels=crash&per_page=50`, {
    token,
    method: 'GET'
  })
  if (listed.ok) {
    const issues = (await listed.json()) as { number: number; body?: string | null }[]
    const hit = issues.find((issue) => (issue.body ?? '').includes(marker))
    if (hit) return hit.number
  }

  const q = `repo:${REPO} is:issue is:open ${JSON.stringify(signature)}`
  const searched = await gh(`/search/issues?q=${encodeURIComponent(q)}&per_page=5`, {
    token,
    method: 'GET'
  })
  if (!searched.ok) return undefined
  const data = (await searched.json()) as { items?: { number: number; body?: string | null }[] }
  return (data.items ?? []).find((issue) => (issue.body ?? '').includes(marker))?.number
}

async function createIssue(
  token: string,
  title: string,
  body: string,
  labels: string[]
): Promise<{ ok: boolean; status: number }> {
  const res = await gh(`/repos/${REPO}/issues`, {
    token,
    method: 'POST',
    body: JSON.stringify({ title, body, labels })
  })
  if (res.ok) return { ok: true, status: res.status }
  if (res.status === 422 && labels.some((label) => label === 'feedback' || label === 'crash')) {
    const fallback = labels.filter((label) => label === 'bug' || label === 'enhancement')
    const retry = await gh(`/repos/${REPO}/issues`, {
      token,
      method: 'POST',
      body: JSON.stringify({ title, body, labels: fallback })
    })
    return { ok: retry.ok, status: retry.status }
  }
  return { ok: false, status: res.status }
}

export async function fileReport(report: Report): Promise<{ ok: boolean; status: number }> {
  const token = githubToken()
  if (!token) return { ok: false, status: 503 }

  await ensureLabels(token)

  if (report.kind === 'crash') {
    const signature = crashSignature(report)
    const marker = crashMarker(signature)
    if (signature) {
      const existing = await findOpenCrash(token, marker, signature)
      if (existing) {
        const res = await gh(`/repos/${REPO}/issues/${existing}/comments`, {
          token,
          method: 'POST',
          body: JSON.stringify({ body: repeatCrashComment(report) })
        })
        return { ok: res.ok, status: res.status }
      }
    }
  }

  return createIssue(token, issueTitle(report), issueBody(report), issueLabels(report.kind))
}
