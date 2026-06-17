interface LineaAPI {
  toggleClickThrough: () => Promise<boolean>
  getClickThroughState: () => Promise<boolean>
}

declare global {
  interface Window {
    linea: LineaAPI
  }
}

export {}
