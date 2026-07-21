import { createServer, type Server } from 'node:http'

export function startLoopbackServer(
  port: number
): Promise<{ server: Server; code: Promise<string> }> {
  let resolveCode!: (code: string) => void
  let rejectCode!: (err: Error) => void
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '', `http://127.0.0.1:${port}`)
    const authCode = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    res.setHeader('Content-Type', 'text/html')
    if (authCode) {
      res.end('<html><body>Linea connected. You can close this tab.</body></html>')
      resolveCode(authCode)
    } else {
      res.end('<html><body>Linea login failed. You can close this tab.</body></html>')
      rejectCode(new Error(error ?? 'No authorization code received'))
    }
  })

  return new Promise((resolveServer) => {
    server.listen(port, '127.0.0.1', () => resolveServer({ server, code }))
  })
}
