// Draws a classic oscilloscope-style trace from analyser sample data onto a canvas.
export function drawOscilloscope(canvas, samples) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;

  ctx.clearRect(0, 0, width, height);

  // subtle scanline grid
  ctx.strokeStyle = 'rgba(120, 255, 170, 0.08)';
  ctx.lineWidth = 1;
  const gridLines = 8;
  for (let i = 1; i < gridLines; i++) {
    const y = (height / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#4bffa0';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#4bffa0';
  ctx.shadowBlur = 6;

  const step = width / samples.length;
  for (let i = 0; i < samples.length; i++) {
    const x = i * step;
    const y = height / 2 - samples[i] * (height / 2) * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Starts a continuous animation loop drawing `getSamples()` output onto `canvas`.
// Returns a stop function.
export function startOscilloscopeLoop(canvas, getSamples) {
  let raf;
  const tick = () => {
    drawOscilloscope(canvas, getSamples());
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
