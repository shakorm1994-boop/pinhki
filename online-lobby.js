/* Public matchmaking UI foundation. This does not yet synchronize card gameplay. */
(() => {
  const SERVER_URL = 'https://YOUR-SERVER.onrender.com'; // Replace after deploying server.
  const socketScript = document.createElement('script');
  socketScript.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
  socketScript.onload = init;
  socketScript.onerror = () => console.warn('Socket.IO client failed to load.');
  document.head.appendChild(socketScript);

  function init() {
    const modes = document.querySelector('#scr');
    if (!modes) return;
    const originalGo = window.go;
    if (typeof originalGo !== 'function') return;
    const originalInnerHTMLSetter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
    // Add online controls after each menu render without changing game rules.
    const observer = new MutationObserver(() => {
      const buttons = [...document.querySelectorAll('#scr button')];
      const online = buttons.find(b => /بازی آنلاین/.test(b.textContent));
      if (online && online.disabled) {
        online.disabled = false;
        online.onclick = openLobby;
        online.textContent = 'بازی آنلاین — صف عمومی';
      }
      const friends = buttons.find(b => /بازی با دوستان/.test(b.textContent));
      if (friends) friends.title = 'فعلاً در این مرحله غیرفعال است';
    });
    observer.observe(modes, { childList: true, subtree: true });

    let socket = null;
    let panel = null;
    function ensurePanel() {
      if (panel) return panel;
      panel = document.createElement('div');
      panel.id = 'pk-online-panel';
      panel.dir = 'rtl';
      panel.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#061c16ee;display:none;align-items:center;justify-content:center;padding:18px;font-family:Tahoma,sans-serif;color:#fff';
      panel.innerHTML = `<section style="width:min(100%,440px);background:#0c3a2b;border:1px solid #c9a24b;border-radius:20px;padding:22px;box-shadow:0 20px 60px #0009;text-align:center"><h2 style="color:#f3d98b;margin-top:0">پینه‌کی آنلاین</h2><p id="pk-online-status">برای ورود به صف عمومی آماده‌ای؟</p><div id="pk-online-room" style="line-height:2"></div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button id="pk-online-join" style="padding:12px 18px;border:0;border-radius:10px;background:#f3d98b;color:#241808;font-weight:bold">ورود به صف عمومی</button><button id="pk-online-cancel" style="padding:12px 18px;border:1px solid #c9a24b;border-radius:10px;background:transparent;color:white">بستن / خروج</button></div><small style="display:block;margin-top:14px;opacity:.75">مرحلهٔ آزمایشی: فعلاً اتاق و تیم ساخته می‌شود؛ همگام‌سازی کارت‌ها در مرحلهٔ بعد اضافه خواهد شد.</small></section>`;
      document.body.appendChild(panel);
      panel.querySelector('#pk-online-join').onclick = joinQueue;
      panel.querySelector('#pk-online-cancel').onclick = closeLobby;
      return panel;
    }
    function status(t) { ensurePanel().querySelector('#pk-online-status').textContent = t; }
    function roomInfo(room) {
      const el = ensurePanel().querySelector('#pk-online-room');
      if (!room) { el.textContent = ''; return; }
      el.innerHTML = `<b>کد اتاق: ${escapeHtml(room.id || '')}</b><br>بازیکنان: ${(room.players || []).length}/4<br>` + (room.players || []).map(p => `${escapeHtml(p.name)} — صندلی ${Number(p.seat)+1} — تیم ${Number(p.team)+1}`).join('<br>');
    }
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function connect() {
      if (SERVER_URL.includes('YOUR-SERVER')) { status('ابتدا URL سرور را در فایل online-lobby.js تنظیم کن و دوباره منتشر کن.'); return false; }
      if (!window.io) { status('کتابخانهٔ اتصال بارگذاری نشد. اینترنت را بررسی و صفحه را دوباره باز کن.'); return false; }
      if (!socket) {
        socket = window.io(SERVER_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => status('متصل شدی. برای پیدا کردن سه بازیکن دیگر وارد صف شو.'));
        socket.on('connect_error', () => status('اتصال به سرور ناموفق بود؛ آدرس سرور و وضعیت انتشار را بررسی کن.'));
        socket.on('queue:joined', d => status(d.message || 'در صف عمومی هستی…'));
        socket.on('match:found', d => { status(d.message || 'اتاق آماده شد.'); roomInfo(d); });
        socket.on('room:update', roomInfo);
        socket.on('room:notice', status);
        socket.on('queue:cancelled', () => { status('از صف خارج شدی.'); roomInfo(null); });
        socket.on('room:left', () => { status('از اتاق خارج شدی.'); roomInfo(null); });
      }
      return true;
    }
    function joinQueue() {
      if (!connect()) return;
      const name = (window.P && window.P.name) || prompt('نام بازیکن:', 'بازیکن') || 'بازیکن';
      const av = (window.P && window.AV && window.AV[window.P.av]) || '🃏';
      status('در حال اتصال به صف عمومی…');
      socket.emit('queue:join', { name, avatar: av });
    }
    function openLobby() { ensurePanel().style.display = 'flex'; connect(); }
    function closeLobby() {
      if (socket && socket.connected) { socket.emit('queue:cancel'); socket.emit('room:leave'); }
      if (panel) panel.style.display = 'none';
    }
    window.PinehkiOnline = { open: openLobby, close: closeLobby };
  }
})();
