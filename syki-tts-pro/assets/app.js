(() => {
  'use strict';

  const data = window.SYKI_DEMO;
  const svgNS = 'http://www.w3.org/2000/svg';
  const list = document.querySelector('#samples-list');
  const referenceTarget = document.querySelector('#reference-player');
  const allButton = document.querySelector('#play-all');
  const allIcon = allButton.querySelector('.all-icon');
  const allLabel = allButton.querySelector('.all-label');
  const errorOutput = document.querySelector('#playback-error');
  const players = [];
  let active = null;
  let sequence = false;

  function icon(name) {
    const svg = document.createElementNS(svgNS, 'svg');
    for (const [key, value] of Object.entries({ width: 24, height: 24, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round',
      'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value);
    for (const [tag, attributes] of data.icons[name]) {
      const node = document.createElementNS(svgNS, tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      svg.append(node);
    }
    return svg;
  }

  function clock(seconds) {
    const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
  }

  function setSequence(enabled) {
    sequence = enabled;
    allIcon.replaceChildren(icon(enabled ? 'Square' : 'Play'));
    allLabel.textContent = enabled ? '停止播放' : '连续播放';
    allButton.setAttribute('aria-pressed', String(enabled));
  }

  function setState(player, playing) {
    player.button.replaceChildren(icon(playing ? 'Pause' : 'Play'));
    const label = `${playing ? '暂停' : '播放'}${player.label}`;
    player.button.setAttribute('aria-label', label);
    player.button.title = label;
    player.root.classList.toggle('is-playing', playing);
    if (player.status) player.status.textContent = playing ? '正在播放' : '';
  }

  function updateProgress(player) {
    const duration = Number.isFinite(player.audio.duration) && player.audio.duration > 0
      ? player.audio.duration : player.data.duration;
    const progress = duration > 0 ? Math.min(1, player.audio.currentTime / duration) : 0;
    player.scrubber.value = String(Math.round(progress * 1000));
    player.time.textContent = `${clock(player.audio.currentTime)} / ${clock(duration)}`;
    const reached = Math.floor(progress * player.bars.length);
    player.bars.forEach((bar, index) => bar.classList.toggle('played', index < reached));
  }

  async function start(player, fromSequence = false) {
    if (!fromSequence) setSequence(false);
    if (active && active !== player) active.audio.pause();
    active = player;
    errorOutput.textContent = '';
    try {
      await player.audio.play();
    } catch (_) {
      setSequence(false);
      errorOutput.textContent = '音频暂时无法播放，请重试。';
      setState(player, false);
    }
  }

  function createPlayer(item, label, status = null) {
    const root = document.createElement('div');
    root.className = 'audio-player';
    const button = document.createElement('button');
    button.className = 'play-button';
    button.type = 'button';
    const waveWrap = document.createElement('div');
    waveWrap.className = 'wave-wrap';
    const wave = document.createElement('div');
    wave.className = 'wave';
    wave.setAttribute('aria-hidden', 'true');
    const bars = item.peaks.map(height => {
      const bar = document.createElement('span');
      bar.style.setProperty('--bar-height', `${height}%`);
      wave.append(bar);
      return bar;
    });
    const scrubber = document.createElement('input');
    scrubber.className = 'scrubber';
    scrubber.type = 'range';
    scrubber.min = '0';
    scrubber.max = '1000';
    scrubber.value = '0';
    scrubber.setAttribute('aria-label', `${label}播放进度`);
    waveWrap.append(wave, scrubber);
    const time = document.createElement('span');
    time.className = 'audio-time';
    const audio = document.createElement('audio');
    audio.src = item.audio;
    audio.preload = 'metadata';
    audio.hidden = true;
    root.append(button, waveWrap, time, audio);
    const player = { root, button, scrubber, time, audio, data: item, label, bars, status };
    players.push(player);
    setState(player, false);
    updateProgress(player);

    button.addEventListener('click', () => {
      if (audio.paused) start(player);
      else { setSequence(false); audio.pause(); }
    });
    scrubber.addEventListener('input', () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : item.duration;
      if (duration > 0) audio.currentTime = duration * Number(scrubber.value) / 1000;
      updateProgress(player);
    });
    audio.addEventListener('loadedmetadata', () => updateProgress(player));
    audio.addEventListener('timeupdate', () => updateProgress(player));
    audio.addEventListener('play', () => setState(player, true));
    audio.addEventListener('pause', () => setState(player, false));
    audio.addEventListener('error', () => { errorOutput.textContent = `${label}加载失败，请刷新后重试。`; });
    audio.addEventListener('ended', () => {
      updateProgress(player);
      if (!sequence) return;
      const samplePlayers = players.filter(candidate => candidate.data.id !== 'reference');
      const next = samplePlayers[samplePlayers.indexOf(player) + 1];
      if (next) { next.audio.currentTime = 0; start(next, true); }
      else setSequence(false);
    });
    return player;
  }

  if (!data || !data.reference || data.samples.length !== 8) {
    errorOutput.textContent = '试听内容加载失败。';
    return;
  }
  referenceTarget.append(createPlayer(data.reference, '参考音色').root);
  for (const sample of data.samples) {
    const row = document.createElement('article');
    row.className = 'sample-row';
    const number = document.createElement('span');
    number.className = 'sample-number';
    number.textContent = sample.id;
    number.setAttribute('aria-hidden', 'true');
    const text = document.createElement('p');
    text.className = 'sample-text';
    text.textContent = sample.text;
    const controls = document.createElement('div');
    controls.className = 'sample-control';
    const meta = document.createElement('div');
    meta.className = 'sample-meta';
    const score = document.createElement('span');
    score.className = 'sample-score';
    score.textContent = sample.score;
    const status = document.createElement('span');
    status.className = 'sample-status';
    status.setAttribute('aria-live', 'polite');
    meta.append(score, status);
    controls.append(createPlayer(sample, `语音 ${sample.id}`, status).root, meta);
    row.append(number, text, controls);
    list.append(row);
  }

  setSequence(false);
  allButton.addEventListener('click', () => {
    if (sequence) {
      setSequence(false);
      if (active) active.audio.pause();
      return;
    }
    const first = players.find(player => player.data.id !== 'reference');
    if (!first) return;
    if (active) active.audio.pause();
    first.audio.currentTime = 0;
    setSequence(true);
    start(first, true);
  });
})();
