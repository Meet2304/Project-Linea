import { createServer, type Server } from 'node:http'

/** Abandon the login if the browser never comes back. */
const LOGIN_TIMEOUT_MS = 5 * 60_000

export function startLoopbackServer(
  port: number,
  expectedState: string
): Promise<{ server: Server; code: Promise<string> }> {
  let resolveCode!: (code: string) => void
  let rejectCode!: (err: Error) => void
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const timeout = setTimeout(
    () => rejectCode(new Error('Spotify login timed out — try again')),
    LOGIN_TIMEOUT_MS
  )

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '', `http://127.0.0.1:${port}`)

    // Only the OAuth redirect counts. Stray requests (e.g. the browser
    // asking for /favicon.ico) must not settle the login.
    if (url.pathname !== '/callback') {
      res.statusCode = 404
      res.end()
      return
    }

    const authCode = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    res.setHeader('Content-Type', 'text/html')
    clearTimeout(timeout)
    if (authCode && state === expectedState) {
      res.end('<html><body>Linea connected. You can close this tab.</body></html>')
      resolveCode(authCode)
    } else {
      res.end('<html><body>Linea login failed. You can close this tab.</body></html>')
      // A state mismatch means the callback didn't come from the auth
      // flow we started (CSRF / injected request) — never use its code.
      rejectCode(
        new Error(
          state !== expectedState
            ? 'OAuth state mismatch — login rejected'
            : (error ?? 'No authorization code received')
        )
      )
    }
  })

  return new Promise((resolveServer) => {
    server.listen(port, '127.0.0.1', () => resolveServer({ server, code }))
  })
}
