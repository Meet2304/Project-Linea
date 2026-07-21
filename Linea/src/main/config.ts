export const SPOTIFY_CLIENT_ID = import.meta.env.MAIN_VITE_SPOTIFY_CLIENT_ID ?? ''

export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:8888/callback'
export const SPOTIFY_SCOPE =
  'user-read-currently-playing user-read-playback-state user-modify-playback-state user-library-read user-library-modify'
export const LOOPBACK_PORT = 8888
