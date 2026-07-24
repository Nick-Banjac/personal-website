/* Secret entrance to the (unlinked) train board.
 *   Desktop: ↑ ↑ ↓ ↓ ← → ← → B A   (arrow keys, then B, A)
 *   Mobile:  swipe ↑ ↑ ↓ ↓ ← → ← →  (same directions as swipes)
 * On success, go to /trains.html. Nothing is shown or hinted until then. */
(function () {
  const DEST = '/trains.html';
  const KEY_CODE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown',
    'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  const SWIPE_CODE = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right'];

  const keyBuf = [];
  const swipeBuf = [];

  function endsWith(buf, code) {
    if (buf.length > code.length) buf.splice(0, buf.length - code.length);
    return buf.length === code.length && buf.every((v, i) => v === code[i]);
  }

  function enter() {
    window.location.href = DEST;
  }

  // Desktop: keyboard
  window.addEventListener('keydown', (e) => {
    keyBuf.push((e.key || '').toLowerCase());
    if (endsWith(keyBuf, KEY_CODE)) enter();
  });

  // Mobile: swipes
  let sx = 0, sy = 0;
  const MIN = 30; // px to count as a swipe rather than a tap
  window.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    sx = t.clientX;
    sy = t.clientY;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN) return;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    swipeBuf.push(dir);
    if (endsWith(swipeBuf, SWIPE_CODE)) enter();
  }, { passive: true });
})();
