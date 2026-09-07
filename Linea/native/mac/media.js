/* macOS JavaScript for Automation, executed by the bundled OSAKit helper.
   Application dictionaries are resolved only for running, authorized players. */
function readPlayer(target) {
  var app = Application(target.bundle)
  var state = String(app.playerState())
  if (state !== 'playing' && state !== 'paused') return null
  var track = app.currentTrack()
  var spotify = target.bundle === 'com.spotify.client'
  var duration = Number(track.duration()) * (spotify ? 1 : 1000)
  var title = String(track.name()),
    artist = String(track.artist()),
    album = String(track.album())
  var key = String(spotify ? track.id() : track.persistentID())
  var position = Number(app.playerPosition()) * 1000
  var updatedAt = Date.now()
  var shuffle = null,
    repeat = null,
    canShuffle = false,
    canRepeat = false
  try {
    if (spotify) {
      canShuffle = Boolean(app.shufflingEnabled())
      canRepeat = Boolean(app.repeatingEnabled())
      if (canShuffle) shuffle = Boolean(app.shuffling())
      // Spotify's scripting dictionary only exposes repeat as a Boolean.
      if (canRepeat) repeat = app.repeating() ? 'context' : 'off'
    } else {
      shuffle = Boolean(app.shuffleEnabled())
      var mode = String(app.songRepeat())
      repeat = mode === 'one' ? 'track' : mode === 'all' ? 'context' : mode === 'off' ? 'off' : null
      canShuffle = true
      canRepeat = repeat !== null
    }
  } catch (_) {}
  if (!isFinite(duration) || duration < 0) duration = 0
  var valid = isFinite(position) && position >= 0
  return {
    id: target.id,
    mediaRevision: 1,
    appId: target.bundle,
    current: target.current,
    title: title,
    artist: artist,
    album: album,
    mediaType: 'music',
    status: state,
    rate: 1,
    shuffle: shuffle,
    repeat: repeat,
    repeatModes: spotify ? ['off', 'context'] : ['off', 'context', 'track'],
    controls: {
      play: true,
      pause: true,
      toggle: true,
      next: true,
      previous: true,
      seek: valid && duration > 0,
      shuffle: canShuffle,
      repeat: canRepeat
    },
    timeline: {
      startMs: 0,
      endMs: duration,
      positionMs: valid ? position : 0,
      updatedAt: valid ? updatedAt : 0,
      minSeekMs: 0,
      maxSeekMs: duration
    },
    nativeKey: JSON.stringify([key, title, artist, album, duration])
  }
}
function handle(request) {
  if (request.method === 'snapshot') {
    var sessions = []
    for (var i = 0; i < request.targets.length; i++) {
      try {
        var row = readPlayer(request.targets[i])
        if (row) sessions.push(row)
      } catch (error) {
        if (Number(error.errorNumber) === -1743) return { ok: false, reason: 'permission_required' }
      }
    }
    return { ok: true, data: { sessions: sessions } }
  }
  if (request.method !== 'command') return { ok: false, reason: 'invalid_request' }
  var target = request.targets[0]
  if (!target) return { ok: false, reason: 'session_unavailable' }
  var before = readPlayer(target)
  if (!before || before.nativeKey !== request.nativeKey)
    return { ok: false, reason: 'session_unavailable' }
  var app = Application(target.bundle),
    type = request.command
  if (!Object.prototype.hasOwnProperty.call(before.controls, type) || !before.controls[type])
    return { ok: false, reason: 'unsupported_command' }
  switch (type) {
    case 'play':
      if (before.status !== 'playing') app.play()
      break
    case 'pause':
      if (before.status === 'playing') app.pause()
      break
    case 'next':
      app.nextTrack()
      break
    case 'previous':
      app.previousTrack()
      break
    case 'seek':
      if (
        typeof request.positionMs !== 'number' ||
        !isFinite(request.positionMs) ||
        request.positionMs < 0 ||
        request.positionMs > before.timeline.endMs
      )
        return { ok: false, reason: 'invalid_request' }
      app.playerPosition = request.positionMs / 1000
      break
    case 'shuffle':
      if (typeof request.state !== 'boolean') return { ok: false, reason: 'invalid_request' }
      if (target.bundle === 'com.spotify.client') app.shuffling = request.state
      else app.shuffleEnabled = request.state
      break
    case 'repeat':
      if (['off', 'context', 'track'].indexOf(request.mode) < 0)
        return { ok: false, reason: 'invalid_request' }
      if (target.bundle === 'com.spotify.client') {
        if (request.mode === 'track') return { ok: false, reason: 'unsupported_command' }
        app.repeating = request.mode !== 'off'
      } else
        app.songRepeat =
          request.mode === 'track' ? 'one' : request.mode === 'context' ? 'all' : 'off'
      break
    default:
      return { ok: false, reason: 'invalid_request' }
  }
  return { ok: true, data: null }
}
