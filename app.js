const dialog = document.querySelector('#player');
const cinematicVideo = dialog.querySelector('video');
const projectAudio = document.querySelector('#project-audio');
const globalMuteButton = document.querySelector('#global-mute');
let globalMuted = false;

function updateGlobalMuteButton() {
  globalMuteButton.textContent = globalMuted ? 'Sound off' : 'Sound on';
  globalMuteButton.setAttribute('aria-pressed', String(globalMuted));
}

function setGlobalMuted(muted) {
  globalMuted = muted;
  projectAudio.muted = muted;
  document.querySelectorAll('.in-place-video').forEach((video) => {
    if (video.dataset.hasCompanion !== 'true') video.muted = muted;
  });
  if (cinematicVideo.dataset.hasCompanion !== 'true') cinematicVideo.muted = muted;
  document.querySelectorAll('.video-mute').forEach((button) => {
    button.textContent = muted ? '🔇' : '🔊';
    button.setAttribute('aria-label', muted ? 'Unmute project audio' : 'Mute project audio');
  });
  updateGlobalMuteButton();
}

globalMuteButton.addEventListener('click', () => setGlobalMuted(!globalMuted));

function loadVideo(video, source) {
  if (video.hlsInstance) video.hlsInstance.destroy();
  if (!new URL(source).pathname.endsWith('.m3u8') || video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = source;
    return;
  }
  if (window.Hls && window.Hls.isSupported()) {
    video.hlsInstance = new window.Hls();
    video.hlsInstance.loadSource(source);
    video.hlsInstance.attachMedia(video);
  }
}

function playPlaylist(video, sources, startAt = 0) {
  if (video.playlistEndedHandler) video.removeEventListener('ended', video.playlistEndedHandler);
  let index = startAt;
  const playCurrent = () => {
    loadVideo(video, sources[index]);
    video.play().catch(() => {});
  };
  video.playlistEndedHandler = () => {
    index = (index + 1) % sources.length;
    playCurrent();
  };
  video.addEventListener('ended', video.playlistEndedHandler);
  playCurrent();
}

function playCompanionAudio(playbackId) {
  const source = `https://stream.mux.com/${playbackId}.m3u8`;
  if (projectAudio.dataset.source !== source) {
    loadVideo(projectAudio, source);
    projectAudio.dataset.source = source;
    projectAudio.muted = globalMuted;
  }
  projectAudio.play().catch(() => {});
}

function openCinematicView(sources, startAt, hasCompanion) {
  dialog.showModal();
  cinematicVideo.dataset.hasCompanion = String(hasCompanion);
  cinematicVideo.muted = hasCompanion || globalMuted;
  playPlaylist(cinematicVideo, sources, startAt);
}

document.querySelectorAll('.play').forEach((button) => {
  button.addEventListener('click', () => {
    const project = button.closest('.project');
    const playbackIds = button.dataset.playbackIds?.split(',') || [];
    const audioPlaybackId = button.dataset.audioPlaybackId;
    const sources = playbackIds.length
      ? playbackIds.map((id) => `https://stream.mux.com/${id}.m3u8?min_resolution=1080p`)
      : [button.dataset.video];
    const existingVideo = project.querySelector('.in-place-video');
    if (existingVideo) {
      if (existingVideo.paused) {
        existingVideo.play().catch(() => {});
        if (audioPlaybackId) playCompanionAudio(audioPlaybackId);
        button.innerHTML = '<span>❚❚</span>';
        button.setAttribute('aria-label', 'Pause project film');
      } else {
        existingVideo.pause();
        if (audioPlaybackId) projectAudio.pause();
        button.innerHTML = '<span>▶</span>';
        button.setAttribute('aria-label', 'Play project film');
      }
      return;
    }

    projectAudio.pause();

    const inlineVideo = document.createElement('video');
    inlineVideo.className = 'in-place-video';
    inlineVideo.autoplay = true;
    inlineVideo.muted = Boolean(audioPlaybackId) || globalMuted;
    inlineVideo.dataset.hasCompanion = String(Boolean(audioPlaybackId));
    inlineVideo.playsInline = true;
    inlineVideo.setAttribute('aria-label', 'Playing project film');
    project.append(inlineVideo);

    const expand = document.createElement('button');
    expand.className = 'expand';
    expand.type = 'button';
    expand.setAttribute('aria-label', 'Expand to cinematic view');
    expand.textContent = '⛶';
    expand.addEventListener('click', () => openCinematicView(sources, 0, Boolean(audioPlaybackId)));
    project.append(expand);

    const mute = document.createElement('button');
    mute.className = 'video-mute';
    mute.type = 'button';
    const audioTarget = audioPlaybackId ? projectAudio : inlineVideo;
    mute.textContent = audioTarget.muted ? '🔇' : '🔊';
    mute.setAttribute('aria-label', audioTarget.muted ? 'Unmute project audio' : 'Mute project audio');
    mute.addEventListener('click', () => {
      audioTarget.muted = !audioTarget.muted;
      mute.textContent = audioTarget.muted ? '🔇' : '🔊';
      mute.setAttribute('aria-label', audioTarget.muted ? 'Unmute project audio' : 'Mute project audio');
    });
    project.append(mute);
    button.classList.add('is-playing');
    button.innerHTML = '<span>❚❚</span>';
    button.setAttribute('aria-label', 'Pause project film');
    playPlaylist(inlineVideo, sources);
    if (audioPlaybackId) playCompanionAudio(audioPlaybackId);
  });
});

dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  cinematicVideo.pause();
  if (cinematicVideo.hlsInstance) cinematicVideo.hlsInstance.destroy();
  cinematicVideo.removeAttribute('src');
  cinematicVideo.load();
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
