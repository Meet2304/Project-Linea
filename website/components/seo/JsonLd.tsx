/**
 * JSON-LD as a real <script> node. Next metadata cannot emit this, and the
 * graph has to ship in the first HTML for crawlers that do not run JS.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c')
      }}
    />
  )
}
