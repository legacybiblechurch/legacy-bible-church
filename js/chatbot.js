// Legacy Bible Church — Chat Widget
(function () {
  // ── Knowledge base ──────────────────────────────────────────────
  const KB = [
    {
      keys: ['service', 'sunday', 'time', 'when', 'start', 'worship', 'meet', 'meeting', 'gather'],
      answer: 'We meet every Sunday at <strong>10:00 AM</strong> at 225 Fremont Street, Redlands, CA 92373. Come as you are!'
    },
    {
      keys: ['location', 'address', 'where', 'directions', 'find', 'drive', 'map'],
      answer: 'We\'re located at <strong>225 Fremont Street, Redlands, CA 92373</strong>. You can search "Legacy Bible Church Redlands" on Google Maps for directions.'
    },
    {
      keys: ['park', 'parking'],
      answer: 'Street parking is available on Fremont Street and nearby side streets. We\'ll have greeters outside to point you in the right direction!'
    },
    {
      keys: ['first', 'visit', 'new', 'guest', 'expect', 'visitor', 'newcomer', 'come for the first'],
      answer: 'Welcome! First-timers can expect a warm, relaxed atmosphere. We sing hymns, open the Bible together, and there\'s no pressure. Dress however you\'re comfortable — most people are casual. Plan for about 90 minutes.'
    },
    {
      keys: ['kids', 'children', 'child', 'nursery', 'youth', 'family', 'babies', 'toddler'],
      answer: 'We love families! Children\'s ministry details are still being finalized — reach out to us at <strong>info@legacybiblechurch.com</strong> and we\'ll give you the latest info.'
    },
    {
      keys: ['give', 'giving', 'donate', 'donation', 'tithe', 'offering', 'zelle', 'money'],
      answer: 'You can give via <strong>Zelle</strong> with zero fees — just send to <strong>giving@legacybiblechurch.com</strong> through your bank\'s app. You can also give by check payable to Legacy Bible Church. 100% of every gift goes to the church.'
    },
    {
      keys: ['sermon', 'sermons', 'message', 'preach', 'pastor', 'youtube', 'video', 'watch', 'listen', 'online'],
      answer: 'Our sermons are posted on YouTube after each Sunday. Head to the <a href="sermons.html">Sermons page</a> to watch past messages anytime.'
    },
    {
      keys: ['pastor', 'lead', 'staff', 'team', 'elder', 'leadership', 'todd'],
      answer: 'Legacy Bible Church is led by <strong>Todd Barnett</strong>. You can learn more about our leadership on the <a href="leadership.html">Leadership page</a>.'
    },
    {
      keys: ['believe', 'belief', 'doctrine', 'faith', 'statement', 'theology', 'what do you believe', 'denomination', 'baptist', 'reformed'],
      answer: 'We hold to the historic Christian faith — the authority of Scripture, salvation by grace through faith in Jesus Christ, and the importance of making disciples. You can read more <a href="about.html">about us here</a>.'
    },
    {
      keys: ['hymn', 'hymnal', 'song', 'music', 'worship', 'sing'],
      answer: 'We sing traditional hymns in our worship gatherings. You can browse our full hymnal — including lyrics — on the <a href="resources.html">Resources page</a>.'
    },
    {
      keys: ['small group', 'community group', 'bible study', 'group', 'fellowship', 'community'],
      answer: 'Community groups and Bible studies are part of our vision as we grow. Contact us at <strong>info@legacybiblechurch.com</strong> to hear what\'s currently available.'
    },
    {
      keys: ['contact', 'email', 'reach', 'phone', 'call', 'talk', 'question'],
      answer: 'You can reach us at <strong>info@legacybiblechurch.com</strong> or fill out our <a href="connect.html">Connect form</a>. We\'d love to hear from you!'
    },
    {
      keys: ['baptism', 'baptize', 'baptized'],
      answer: 'We practice believer\'s baptism by immersion. If you\'re interested in being baptized, reach out to us at <strong>info@legacybiblechurch.com</strong> and we\'ll walk you through next steps.'
    },
    {
      keys: ['membership', 'member', 'join', 'become'],
      answer: 'We\'d love for you to become part of the Legacy family! Start by visiting on a Sunday, and feel free to reach out at <strong>info@legacybiblechurch.com</strong> to learn more about membership.'
    },
    {
      keys: ['testimony', 'testimonies', 'story', 'stories'],
      answer: 'We love hearing how God is at work! Check out our <a href="resources.html">Resources page</a> for testimonies from our congregation.'
    },
    {
      keys: ['hello', 'hi', 'hey', 'howdy', 'sup', 'good morning', 'good afternoon', 'good evening'],
      answer: 'Hi there! Welcome to Legacy Bible Church. I\'m here to help answer any questions you have. What can I help you with?'
    },
    {
      keys: ['thank', 'thanks', 'appreciate'],
      answer: 'You\'re welcome! Is there anything else I can help you with?'
    },
  ];

  const FALLBACK = 'That\'s a great question — I may not have that info yet. Reach out directly at <strong>info@legacybiblechurch.com</strong> and someone will get back to you!';

  const QUICK_REPLIES = [
    { label: 'Service times', msg: 'When are services?' },
    { label: 'Location', msg: 'Where are you located?' },
    { label: 'First-time visit', msg: 'What should I expect as a first-time visitor?' },
    { label: 'How to give', msg: 'How can I give?' },
    { label: 'Contact', msg: 'How do I contact you?' },
  ];

  // ── Match logic ─────────────────────────────────────────────────
  function getAnswer(input) {
    const lower = input.toLowerCase();
    let best = null;
    let bestScore = 0;
    for (const entry of KB) {
      let score = 0;
      for (const key of entry.keys) {
        if (lower.includes(key)) score++;
      }
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    return bestScore > 0 ? best.answer : FALLBACK;
  }

  // ── Build UI ────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #lbc-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--color-accent, #c9a84c); border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #lbc-chat-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.5); }
    #lbc-chat-btn svg { width: 26px; height: 26px; fill: #000; }
    #lbc-chat-window {
      position: fixed; bottom: 92px; right: 24px; z-index: 9999;
      width: 340px; max-width: calc(100vw - 32px);
      background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      display: none; flex-direction: column;
      font-family: 'Inter', sans-serif; font-size: 14px;
    }
    #lbc-chat-window.open { display: flex; }
    #lbc-chat-header {
      background: var(--color-accent, #c9a84c); color: #000;
      padding: 14px 16px; font-weight: 700; font-size: 15px;
      display: flex; align-items: center; gap: 10px;
    }
    #lbc-chat-header span { flex: 1; }
    #lbc-chat-close {
      background: none; border: none; cursor: pointer;
      font-size: 20px; color: #000; line-height: 1; padding: 0;
    }
    #lbc-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      max-height: 340px; min-height: 120px;
    }
    .lbc-msg {
      max-width: 85%; padding: 10px 13px; border-radius: 12px;
      line-height: 1.5; word-break: break-word;
    }
    .lbc-msg.bot {
      background: rgba(255,255,255,0.08); color: #e8e8e8;
      align-self: flex-start; border-bottom-left-radius: 4px;
    }
    .lbc-msg.user {
      background: var(--color-accent, #c9a84c); color: #000; font-weight: 500;
      align-self: flex-end; border-bottom-right-radius: 4px;
    }
    .lbc-msg a { color: var(--color-accent, #c9a84c); }
    .lbc-msg.bot a { color: #c9a84c; }
    #lbc-quick-replies {
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 0 16px 12px;
    }
    .lbc-qr {
      background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15);
      color: #ccc; border-radius: 20px; padding: 5px 12px;
      font-size: 12px; cursor: pointer; transition: background 0.15s;
      white-space: nowrap;
    }
    .lbc-qr:hover { background: rgba(201,168,76,0.2); border-color: #c9a84c; color: #c9a84c; }
    #lbc-chat-input-row {
      display: flex; gap: 8px; padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    #lbc-chat-input {
      flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 14px;
      outline: none; font-family: inherit;
    }
    #lbc-chat-input::placeholder { color: rgba(255,255,255,0.35); }
    #lbc-chat-send {
      background: var(--color-accent, #c9a84c); border: none; border-radius: 8px;
      padding: 8px 14px; cursor: pointer; font-weight: 700; font-size: 13px; color: #000;
      transition: opacity 0.15s;
    }
    #lbc-chat-send:hover { opacity: 0.85; }
  `;
  document.head.appendChild(style);

  // Button
  const btn = document.createElement('button');
  btn.id = 'lbc-chat-btn';
  btn.setAttribute('aria-label', 'Chat with us');
  btn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>`;
  document.body.appendChild(btn);

  // Window
  const win = document.createElement('div');
  win.id = 'lbc-chat-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', 'Church chat');
  win.innerHTML = `
    <div id="lbc-chat-header">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#000" style="flex-shrink:0"><path d="M12 2C6.48 2 2 5.92 2 10.8c0 2.7 1.4 5.12 3.6 6.75V22l4.4-2.4c.64.1 1.3.15 2 .15 5.52 0 10-3.92 10-8.75S17.52 2 12 2z"/></svg>
      <span>Legacy Bible Church</span>
      <button id="lbc-chat-close" aria-label="Close chat">&times;</button>
    </div>
    <div id="lbc-chat-messages"></div>
    <div id="lbc-quick-replies"></div>
    <div id="lbc-chat-input-row">
      <input id="lbc-chat-input" type="text" placeholder="Ask a question..." maxlength="200" autocomplete="off">
      <button id="lbc-chat-send">Send</button>
    </div>
  `;
  document.body.appendChild(win);

  const messages = win.querySelector('#lbc-chat-messages');
  const input = win.querySelector('#lbc-chat-input');
  const qrContainer = win.querySelector('#lbc-quick-replies');

  function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = `lbc-msg ${who}`;
    div.innerHTML = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function sendMsg(text) {
    if (!text.trim()) return;
    addMsg(text, 'user');
    input.value = '';
    qrContainer.innerHTML = '';
    setTimeout(() => addMsg(getAnswer(text), 'bot'), 350);
  }

  // Quick replies
  QUICK_REPLIES.forEach(qr => {
    const b = document.createElement('button');
    b.className = 'lbc-qr';
    b.textContent = qr.label;
    b.onclick = () => sendMsg(qr.msg);
    qrContainer.appendChild(b);
  });

  // Greeting
  addMsg('Hi! 👋 I\'m the Legacy Bible Church assistant. Ask me anything about our services, location, giving, and more!', 'bot');

  // Events
  btn.onclick = () => {
    win.classList.toggle('open');
    if (win.classList.contains('open')) input.focus();
  };
  win.querySelector('#lbc-chat-close').onclick = () => win.classList.remove('open');
  win.querySelector('#lbc-chat-send').onclick = () => sendMsg(input.value);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(input.value); });
})();
