export const IPC = {
  TOGGLE_CLICK_THROUGH: 'linea:toggle-click-through',
  GET_CLICK_THROUGH_STATE: 'linea:get-click-through-state',
  SPOTIFY_LOGIN: 'linea:spotify-login',
  SPOTIFY_LOGOUT: 'linea:spotify-logout',
  SPOTIFY_AUTH_STATE: 'linea:spotify-auth-state',
  NOW_PLAYING: 'linea:now-playing',
  LYRICS_UPDATE: 'linea:lyrics-update',
  GET_PREFS: 'linea:get-prefs',
  SET_PREFS: 'linea:set-prefs',
  PLAYER_COMMAND: 'linea:player-command',
  TOGGLE_LIKE: 'linea:toggle-like',
  SET_PINNED: 'linea:set-pinned',
  SET_LYRICS_EXPANDED: 'linea:set-lyrics-expanded',
  CLICK_THROUGH_CHANGED: 'linea:click-through-changed',
  PLAYER_ERROR: 'linea:player-error'
} as const
