/* Play once as soon as ready, then hold the stable final pose. */
(function () {
  var video = document.querySelector('.hero-film-video');
  if (!video) return;
  var stage = document.querySelector('.hero-film .hero-visual');

  /* The film is letterboxed inside the stage: object-fit is contain, so the
     ground colour shows above and below (or left and right) by however much
     the screen ratio differs from 16:9. Measure that band and hand it to the
     scrim, which carries it into the page so the join never reads as a line. */
  function measureBand() {
    if (!stage || !video.videoWidth) return;
    var r = stage.getBoundingClientRect();
    if (!r.height) return;
    var ratio = video.videoWidth / video.videoHeight;
    var band = r.width / r.height < ratio
      ? ((r.height - r.width / ratio) / 2) / r.height
      : 0;
    stage.style.setProperty('--hero-band', (band * 100).toFixed(2) + '%');
  }

  ['loadedmetadata', 'loadeddata', 'resize'].forEach(function (ev) {
    video.addEventListener(ev, measureBand);
  });
  window.addEventListener('resize', measureBand);
  window.addEventListener('load', measureBand);
  document.fonts.ready.then(measureBand);
  measureBand();

  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  video.muted = true;
  video.addEventListener('error', function () {
    video.classList.add('has-error');
  });
  function updateMotion() {
    if (reducedMotion.matches) {
      video.pause();
    } else if (!video.ended) {
      video.play().catch(function () {
        video.classList.add('has-error');
      });
    }
  }
  reducedMotion.addEventListener('change', updateMotion);
  updateMotion();
})();
