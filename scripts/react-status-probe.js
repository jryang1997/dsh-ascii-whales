const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

/** Observe the mounted plugin without writing its summary or replacing its renderer. */
export async function probeReactStatus({ publish, observeDelivery, burst = false }) {
  publish(false);
  await frame();
  await frame();
  const canvas = document.querySelector('.aw-overlay canvas');
  const summary = document.querySelector('.aw-activity-summary ul');
  if (!canvas || !summary || !summary.textContent.includes('Running')) throw new Error('Mounted running summary and Canvas required');
  const result = { receivedAt: null, reactCommitMs: null, canvasDrawEndMs: null, lastCanvasCommandMs: null,
    canvasCommands: 0, waitingBadgeDrawn: false, burst, summary: null,
    textEndpoint: 'MutationObserver after formal React summary DOM mutation',
    canvasEndpoint: 'microtask after actual Canvas commands return, with waiting badge drawn; CPU draw completion, not GPU presentation' };
  let active = true, drawQueued = false;
  const observer = new MutationObserver(() => {
    if (result.receivedAt !== null && result.reactCommitMs === null && summary.textContent.includes('Waiting for you')) {
      result.reactCommitMs = performance.now() - result.receivedAt;
      result.summary = summary.textContent;
    }
  });
  observer.observe(summary, { subtree: true, childList: true, characterData: true });
  const release = observeDelivery(() => { result.receivedAt ??= performance.now(); });
  const restores = [];
  for (const name of ['clearRect', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'drawImage', 'fill', 'stroke', 'restore']) {
    const original = CanvasRenderingContext2D.prototype[name];
    CanvasRenderingContext2D.prototype[name] = function (...args) {
      const value = Reflect.apply(original, this, args);
      if (active && result.receivedAt !== null && this.canvas === canvas && result.canvasDrawEndMs === null) {
        result.canvasCommands++;
        result.lastCanvasCommandMs = performance.now() - result.receivedAt;
        if (name === 'fillText' && String(args[0]).startsWith('! Demo session')) result.waitingBadgeDrawn = true;
        if (!drawQueued) {
          drawQueued = true;
          queueMicrotask(() => {
            drawQueued = false;
            if (active && result.waitingBadgeDrawn && result.canvasDrawEndMs === null) result.canvasDrawEndMs = performance.now() - result.receivedAt;
          });
        }
      }
      return value;
    };
    restores.push(() => { CanvasRenderingContext2D.prototype[name] = original; });
  }
  try {
    publish(true);
    if (burst) for (let index = 0; index < 50; index++) publish(index % 2 === 1);
    const deadline = performance.now() + 2000;
    while ((result.reactCommitMs === null || result.canvasDrawEndMs === null) && performance.now() < deadline) await frame();
    return { ...result, visibility: document.visibilityState,
      withinControlledBudget: result.reactCommitMs !== null && result.canvasDrawEndMs !== null
        && result.reactCommitMs <= 250 && result.canvasDrawEndMs <= 250 };
  } finally {
    active = false;
    observer.disconnect();
    release();
    for (const restore of restores) restore();
  }
}
