const { stat, rm } = require('node:fs/promises')
const { join } = require('node:path')

/**
 * DirectX Shader Compiler, shipped by Chromium for WebGPU: dxcompiler.dll is
 * 25 MB and dxil.dll another 1.5 MB — together ~8% of the installed app.
 *
 * Linea never initialises WebGPU. The only drawing surface is the cymatic
 * thumbnail, and it asks for a 2D context (`src/renderer/src/cymatics.ts`), so
 * these compile WGSL for a pipeline that is never built. ANGLE still handles
 * compositing through libGLESv2 + d3dcompiler_47, which stay.
 *
 * Windows-only — no other platform ships them.
 */
const WEBGPU_DLLS = ['dxcompiler.dll', 'dxil.dll']

/**
 * Runs once per packed app directory, after the app is assembled but before the
 * installer is built and before signing — so nothing downstream sees the files.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
module.exports = async function afterPack(context) {
  const expectedChannel = /-beta\.\d+$/.test(context.packager.appInfo.version) ? 'beta' : 'latest'
  if (context.packager.config.publish?.channel !== expectedChannel) {
    throw new Error('Use the package scripts so update metadata matches the release channel')
  }
  if (context.electronPlatformName === 'darwin') {
    const resources = join(
      context.appOutDir,
      context.packager.appInfo.productFilename + '.app',
      'Contents',
      'Resources',
      'mac'
    )
    await stat(join(resources, 'linea-media'))
    await stat(join(resources, 'media.js'))
  }
  if (context.electronPlatformName !== 'win32') return

  await stat(join(context.appOutDir, 'resources', 'smtc', 'linea-smtc.exe'))

  let freed = 0
  for (const dll of WEBGPU_DLLS) {
    const path = join(context.appOutDir, dll)
    try {
      // Size first: once it is gone there is nothing left to report.
      const { size } = await stat(path)
      await rm(path)
      freed += size
      console.log(`  • removed ${dll} (${(size / 1024 / 1024).toFixed(1)} MB)`)
    } catch (error) {
      // An Electron bump that drops or renames these must not break releases —
      // the app runs fine either way, so a miss is worth a note, not a failure.
      if (error.code === 'ENOENT') {
        console.log(`  • ${dll} not present, skipping`)
        continue
      }
      throw error
    }
  }

  console.log(`afterPack: freed ${(freed / 1024 / 1024).toFixed(1)} MB of WebGPU tooling`)
}
