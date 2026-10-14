// "Ask Hectic" floating assistant (free Workers AI on our own API).
(()=>{const API=window.HS_API;const css=`.hs-chat-btn{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:50;background:#0d0d0d;color:#f6f5f2;border:0;border-radius:0;padding:15px 20px;font:600 11px Archivo,system-ui;letter-spacing:.2em;text-transform:uppercase;box-shadow:0 14px 34px -14px rgba(0,0,0,.5);cursor:pointer}
.hs-chat{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(84px,calc(env(safe-area-inset-bottom) + 84px));z-index:50;width:min(380px,calc(100vw - 36px));height:min(560px,70vh);background:#f6f5f2;border:1px solid #0d0d0d;border-radius:0;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;box-shadow:0 30px 80px -20px #000;animation:hsin .3s cubic-bezier(.2,.7,.2,1)}
@keyframes hsin{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.hs-chat header{padding:14px 16px;border-bottom:1px solid #0d0d0d;font:italic 600 20px 'Bodoni Moda',Didot,Georgia,serif;color:#0d0d0d;display:flex;justify-content:space-between}
.hs-chat header button{background:none;border:0;color:#6b6966;font-size:22px;cursor:pointer}
.hs-log{padding:14px;overflow-y:auto;display:grid;gap:10px;align-content:start;font:15px/1.5 Archivo,system-ui}
.hs-m{padding:10px 12px;max-width:88%;white-space:pre-wrap;color:#0d0d0d}.hs-u{justify-self:end;background:#ecebe7}.hs-a{justify-self:start;background:#fff;border:1px solid #d8d5cf}
.hs-chat form{display:flex;gap:8px;padding:12px;border-top:1px solid #0d0d0d}.hs-chat input{flex:1;min-width:0;font:15px Archivo,system-ui;color:#0d0d0d;background:#fff;border:1px solid #d8d5cf;border-radius:0;padding:11px 12px}
.hs-chat form button{background:#0d0d0d;color:#f6f5f2;border:0;border-radius:0;padding:0 16px;font:600 11px Archivo;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const btn=document.createElement('button');btn.className='hs-chat-btn';btn.type='button';btn.textContent='Ask Hectic';document.body.appendChild(btn);
let box=null;const hist=[];
function add(log,cls,t){const d=document.createElement('div');d.className='hs-m '+cls;d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight;return d}
btn.onclick=()=>{if(box){box.remove();box=null;return}
box=document.createElement('div');box.className='hs-chat';box.setAttribute('role','dialog');box.setAttribute('aria-label','Ask Hectic');
box.innerHTML='<header><span>Ask Hectic</span><button type="button" aria-label="Close">×</button></header><div class="hs-log" aria-live="polite"></div><form><input aria-label="Your question" placeholder="Describe your app idea…" maxlength="1500"><button>Send</button></form>';
document.body.appendChild(box);const log=box.querySelector('.hs-log'),f=box.querySelector('form'),i=box.querySelector('input');
box.querySelector('header button').onclick=()=>{box.remove();box=null};
add(log,'hs-a',"Hi, I'm the Hectic assistant. Tell me about the app you want to build and I'll help you shape it.");
hist.forEach(m=>add(log,m.role==='user'?'hs-u':'hs-a',m.content));i.focus();
f.onsubmit=async e=>{e.preventDefault();const q=i.value.trim();if(!q)return;i.value='';add(log,'hs-u',q);hist.push({role:'user',content:q});const out=add(log,'hs-a','…');
try{const r=await fetch(API+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:hist.slice(-10)})});const d=await r.json();
out.textContent=d.reply||(d.error==='rate_limited'?'Lots of questions right now. Please try again shortly, or press Start a project.':'Sorry, I can’t answer right now. Press Start a project to send your brief.');if(d.reply)hist.push({role:'assistant',content:d.reply})}
catch{out.textContent='Connection problem. Please try again.'}}}})();
