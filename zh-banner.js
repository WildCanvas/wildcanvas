/* Small "中文" prompt for visitors whose browser language is Chinese.
   Shown on English pages only; hidden for 30 days once closed or clicked. */
(function () {
  try {
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
    var zh = langs.some(function (l) { return /^zh/i.test(l); });
    if (!zh) return;
    var KEY = 'wc_zh_banner_hidden';
    try { var until = +localStorage.getItem(KEY); if (until && until > Date.now()) return; } catch (e) {}
    var hide = function () { try { localStorage.setItem(KEY, String(Date.now() + 30 * 864e5)); } catch (e) {} };

    var css = '#wc-zh{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:4px;' +
      'background:#3D2E1E;color:#FBF6EE;border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.22);' +
      'font:15px/1.2 "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;max-width:calc(100% - 32px);' +
      'animation:wczh .4s ease-out}' +
      '#wc-zh a{color:#FBF6EE;text-decoration:none;padding:12px 6px 12px 20px;white-space:nowrap}' +
      '#wc-zh a span{color:#C19965;margin-left:6px}' +
      '#wc-zh button{background:none;border:0;color:rgba(251,246,238,.6);font-size:20px;line-height:1;padding:10px 16px 12px 8px;cursor:pointer}' +
      '#wc-zh button:hover{color:#FBF6EE}' +
      '@keyframes wczh{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var bar = document.createElement('div'); bar.id = 'wc-zh'; bar.lang = 'zh-Hans';
    bar.innerHTML = '<a href="/zh">查看中文介绍<span>→</span></a><button type="button" aria-label="关闭 Close">×</button>';
    bar.querySelector('a').addEventListener('click', hide);
    bar.querySelector('button').addEventListener('click', function () { hide(); bar.remove(); });
    var show = function () { document.body.appendChild(bar); };
    // Wait a moment so it doesn't compete with the page loading
    setTimeout(show, 1500);
  } catch (e) {}
})();
