import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const source = 'public/social/linea-whatsapp-og.png'
const exports = [
  ['linea-x-social.png', 1500, 750],
  ['linea-facebook-og.png', 1200, 630],
  ['linea-linkedin-og.png', 1200, 627],
  ['linea-slack-og.png', 1200, 630]
]

await mkdir('public/social', { recursive: true })
await Promise.all(
  exports.map(([name, width, height]) =>
    sharp(source)
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9, quality: 92 })
      .toFile(`public/social/${name}`)
  )
)
