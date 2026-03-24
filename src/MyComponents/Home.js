import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Home.css";

import img1  from "../Images/3741.jpg";
import img2  from "../Images/4698.jpg";
import img3  from "../Images/4862.jpg";
import img4  from "../Images/28439.jpg";
import img5  from "../Images/32881-NYSF7H.jpg";
import img6  from "../Images/60261.jpg";
import img7  from "../Images/2282382.jpg";
import img8  from "../Images/O4WHN50.jpg";
import img9  from "../Images/OQECWY0.jpg";
import img10 from "../Images/8-bits-characters-gaming-assets.jpg";
import img11 from "../Images/enhanced-large-preview.jpg";
import img12 from "../Images/render.jpeg";
import img13 from "../Images/vmsimg.jpg";
import img14 from "../Images/variety-people-multitasking-3d-cartoon-scene.jpg";
import img15 from "../Images/render-preview1.jpg";
import img16 from "../Images/render-preview2.jpg";
import img17 from "../Images/render-preview3.jpg";
import img18 from "../Images/render-preview4.jpg";
import img19 from "../Images/render-preview5.jpg";
import img20 from "../Images/upload-preview6.jpg";
import img21 from "../Images/upload-preview7.jpg";

const ALL_IMAGES = [img1,img2,img3,img4,img5,img6,img7,img8,img9,img10,
                    img11,img12,img13,img14,img15,img16,img17,img18,img19,img20,img21];

/* ══════════════════════════════════════════════════════════
   CANVAS BACKGROUND
══════════════════════════════════════════════════════════ */
function CanvasBg() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext("2d");
    let W, H, id, t = 0;

    const stars = Array.from({ length: 280 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.2 + 0.15,
      a: Math.random() * 0.7 + 0.2,
      tw: Math.random() * 2.5 + 0.5,
      tp: Math.random() * Math.PI * 2,
    }));

    const streams = Array.from({ length: 20 }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: Math.random() * 0.003 + 0.001,
      len: Math.random() * 0.18 + 0.05,
      hue: [185, 350, 45, 270][Math.floor(Math.random() * 4)],
      a: Math.random() * 0.1 + 0.03,
    }));

    let shooters = [];
    const addShooter = () => {
      if (shooters.length >= 4) return;
      shooters.push({
        x: Math.random() * W, y: 0,
        vx: (Math.random()-0.3)*5, vy: Math.random()*5+3,
        len: Math.random()*100+60, a: 1,
        hue: [185,350,45,280][Math.floor(Math.random()*4)],
      });
    };
    const si = setInterval(addShooter, 2400);

    const resize = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const drawHex = () => {
      const s = 50, h = s * Math.sqrt(3);
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 0.5;
      for (let row = -1; row < H/h+2; row++) {
        for (let col = -1; col < W/(s*1.5)+2; col++) {
          const cx = col*s*1.5, cy = row*h + (col%2 ? h/2 : 0);
          ctx.beginPath();
          for (let a = 0; a < 6; a++) {
            const ang = (Math.PI/3)*a - Math.PI/6;
            ctx.lineTo(cx + s*Math.cos(ang), cy + s*Math.sin(ang));
          }
          ctx.closePath(); ctx.stroke();
        }
      }
    };

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.007;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);

      [[0.12,0.18,0.28,185,0.045],[0.88,0.78,0.22,350,0.035],[0.5,0.92,0.18,45,0.03]].forEach(([nx,ny,nr,h,a])=>{
        const g=ctx.createRadialGradient(W*nx,H*ny,0,W*nx,H*ny,W*nr);
        g.addColorStop(0,`hsla(${h},100%,55%,${a})`); g.addColorStop(1,"transparent");
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      });

      drawHex();

      for (const p of stars) {
        const tw = 0.5+0.5*Math.sin(t*p.tw+p.tp);
        ctx.beginPath(); ctx.arc(p.x*W,p.y*H,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(200,215,255,${p.a*tw})`; ctx.fill();
      }

      for (const s of streams) {
        s.y = (s.y + s.speed) % 1;
        const sy=s.y*H, ey=sy+s.len*H;
        const g=ctx.createLinearGradient(s.x*W,sy,s.x*W,ey);
        g.addColorStop(0,"transparent"); g.addColorStop(0.4,`hsla(${s.hue},100%,70%,${s.a})`); g.addColorStop(1,"transparent");
        ctx.strokeStyle=g; ctx.lineWidth=0.8;
        ctx.beginPath(); ctx.moveTo(s.x*W,sy); ctx.lineTo(s.x*W,ey); ctx.stroke();
      }

      shooters = shooters.filter(s=>s.a>0.01);
      for (const s of shooters) {
        const g=ctx.createLinearGradient(s.x,s.y,s.x-s.vx*s.len/8,s.y-s.vy*s.len/8);
        g.addColorStop(0,`hsla(${s.hue},100%,80%,${s.a})`); g.addColorStop(1,"transparent");
        ctx.strokeStyle=g; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(s.x-s.vx*s.len/8,s.y-s.vy*s.len/8); ctx.stroke();
        s.x+=s.vx; s.y+=s.vy; s.a-=0.015;
      }

      id = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(id); clearInterval(si); window.removeEventListener("resize",resize); };
  }, []);
  return <canvas ref={ref} className="hw-canvas" />;
}

/* ══════════════════════════════════════════════════════════
   VMS REACTOR — centerpiece SVG
══════════════════════════════════════════════════════════ */
function VMSReactor({ onClick }) {
  return (
    <div className="reactor-wrap" onClick={onClick}>
      <svg className="reactor-svg" viewBox="0 0 360 360" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="cg" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#00dcff" stopOpacity="0.8"/>
            <stop offset="60%" stopColor="#004466" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ig" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1"/>
            <stop offset="50%" stopColor="#00dcff" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#0044aa" stopOpacity="0.2"/>
          </radialGradient>
          <filter id="fg"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="fg2"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Aura */}
        <circle cx="180" cy="180" r="168" fill="url(#cg)"/>

        {/* Ring 1 — outer tick marks, slow */}
        <g className="r-slow">
          <circle cx="180" cy="180" r="156" fill="none" stroke="rgba(0,220,255,0.1)" strokeWidth="1"/>
          {Array.from({length:48},(_,i)=>{
            const a=(i/48)*Math.PI*2, r=156, big=i%6===0;
            return <line key={i}
              x1={180+(r-( big?10:5))*Math.cos(a)} y1={180+(r-(big?10:5))*Math.sin(a)}
              x2={180+r*Math.cos(a)} y2={180+r*Math.sin(a)}
              stroke={big?"rgba(0,220,255,0.7)":"rgba(0,220,255,0.25)"} strokeWidth={big?2:1}/>;
          })}
        </g>

        {/* Ring 2 — dashed, fast counter */}
        <g className="r-fast-rev">
          <circle cx="180" cy="180" r="136" fill="none" stroke="rgba(0,220,255,0.2)" strokeWidth="1.5" strokeDasharray="10 14"/>
          {Array.from({length:8},(_,i)=>{
            const a=(i/8)*Math.PI*2, r=136;
            return <polygon key={i} points="0,-8 5,5 -5,5" fill="rgba(0,220,255,0.65)" filter="url(#fg)"
              transform={`translate(${180+r*Math.cos(a)},${180+r*Math.sin(a)}) rotate(${i*45+90})`}/>;
          })}
        </g>

        {/* Ring 3 — red medium */}
        <g className="r-med">
          <circle cx="180" cy="180" r="114" fill="none" stroke="rgba(230,57,70,0.2)" strokeWidth="1" strokeDasharray="5 9"/>
          {Array.from({length:6},(_,i)=>{
            const a=(i/6)*Math.PI*2, r=114;
            return <circle key={i} cx={180+r*Math.cos(a)} cy={180+r*Math.sin(a)} r="4.5" fill="rgba(230,57,70,0.75)" filter="url(#fg)"/>;
          })}
        </g>

        {/* Ring 4 — arc segments, rev slow */}
        <g className="r-slow-rev">
          <circle cx="180" cy="180" r="94" fill="none" stroke="rgba(0,220,255,0.28)" strokeWidth="2"/>
          {Array.from({length:4},(_,i)=>{
            const s=(i/4)*Math.PI*2, e=s+Math.PI/4.5, r=94;
            return <path key={i} d={`M${180+r*Math.cos(s)},${180+r*Math.sin(s)} A${r},${r} 0 0,1 ${180+r*Math.cos(e)},${180+r*Math.sin(e)}`}
              stroke="rgba(0,220,255,0.8)" strokeWidth="3.5" fill="none" filter="url(#fg)"/>;
          })}
        </g>

        {/* Hexagon inner */}
        <g className="r-slow">
          {Array.from({length:6},(_,i)=>{
            const a1=(i/6)*Math.PI*2, a2=((i+1)/6)*Math.PI*2, r=70;
            return <line key={i} x1={180+r*Math.cos(a1)} y1={180+r*Math.sin(a1)} x2={180+r*Math.cos(a2)} y2={180+r*Math.sin(a2)}
              stroke="rgba(0,220,255,0.3)" strokeWidth="1.5"/>;
          })}
          {Array.from({length:6},(_,i)=>{
            const a=(i/6)*Math.PI*2, r=70;
            return <circle key={i} cx={180+r*Math.cos(a)} cy={180+r*Math.sin(a)} r="5" fill="rgba(0,220,255,0.55)" filter="url(#fg)"/>;
          })}
        </g>

        {/* Core */}
        <circle cx="180" cy="180" r="50" fill="rgba(0,25,45,0.9)"/>
        <circle cx="180" cy="180" r="50" fill="none" stroke="rgba(0,220,255,0.55)" strokeWidth="2"/>
        <circle cx="180" cy="180" r="37" fill="url(#ig)" filter="url(#fg2)" className="core-pulse"/>
        <circle cx="180" cy="180" r="20" fill="rgba(255,255,255,0.92)" filter="url(#fg2)" className="core-pulse"/>

        {/* Text */}
        <text x="180" y="177" textAnchor="middle" fill="#000" fontSize="10" fontWeight="900"
          fontFamily="'Orbitron',monospace" letterSpacing="2.5">VMS</text>
        <text x="180" y="190" textAnchor="middle" fill="#000" fontSize="6.5" fontWeight="700"
          fontFamily="'Orbitron',monospace" letterSpacing="1.5">CORE</text>

        {/* Crosshairs */}
        {[[180,133,180,147],[180,213,180,227],[133,180,147,180],[213,180,227,180]].map(([x1,y1,x2,y2],i)=>(
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,220,255,0.55)" strokeWidth="1.5"/>
        ))}

        {/* Sweep */}
        <g className="scan-sweep">
          <path d="M180,180 L180,24 A156,156 0 0,1 315,258 Z" fill="rgba(0,220,255,0.04)"/>
        </g>
      </svg>

      <div className="reactor-ping rp1"/>
      <div className="reactor-ping rp2"/>
      <div className="reactor-ping rp3"/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HUD METRIC CARD
══════════════════════════════════════════════════════════ */
function HUDCard({ title, label, icon, accent, hint, onClick, delay }) {
  const ref = useRef(null);
  const onMove = useCallback((e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width/2)/(r.width/2);
    const dy = (e.clientY - r.top - r.height/2)/(r.height/2);
    el.style.setProperty("--rx",`${-dy*13}deg`);
    el.style.setProperty("--ry",`${dx*13}deg`);
    el.style.setProperty("--mx",`${((e.clientX-r.left)/r.width)*100}%`);
    el.style.setProperty("--my",`${((e.clientY-r.top)/r.height)*100}%`);
    el.classList.add("hud-hover");
  },[]);
  const onLeave = useCallback(() => {
    const el = ref.current; if(!el) return;
    el.style.setProperty("--rx","0deg"); el.style.setProperty("--ry","0deg");
    el.classList.remove("hud-hover");
  },[]);

  return (
    <div className={`hud-card hud-${accent}`} ref={ref}
      onMouseMove={onMove} onMouseLeave={onLeave}
      onClick={onClick} style={{animationDelay:`${delay}s`}}>
      <div className="hud-inner">
        <span className="hc-br hc-tl"/><span className="hc-br hc-tr"/>
        <span className="hc-br hc-bl"/><span className="hc-br hc-brr"/>
        <div className="hud-spotlight"/>
        <div className="hud-top-row">
          <span className="hud-icon">{icon}</span>
          <span className="hud-hint">{hint}</span>
        </div>
        <div className="hud-title">{title}</div>
        <div className="hud-label">{label}</div>
        <div className="hud-cta">OPEN →</div>
        <div className="hud-bar"><div className="hud-bar-fill"/></div>
        <div className="hud-scan"/>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LIVE CLOCK
══════════════════════════════════════════════════════════ */
function LiveClock() {
  const [state, setState] = useState({ date:"", time:"" });
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setState({
        date: n.toLocaleDateString("en-IN",{weekday:"short",month:"short",day:"2-digit",year:"numeric"}),
        time: n.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}),
      });
    };
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);
  return (
    <div className="hw-clock">
      <span className="hw-clock-blink"/>
      <span className="hw-clock-d">{state.date}</span>
      <span className="hw-clock-sep">·</span>
      <span className="hw-clock-t">{state.time}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MARQUEE TICKER
══════════════════════════════════════════════════════════ */
function Ticker() {
  const words = ["PRODUCTS","INVENTORY","SALES","INVOICES","REPORTS","DASHBOARD",
                 "VENDORS","CATALOGUE","ANALYTICS","ORDERS","STOCK","PAYMENTS"];
  return (
    <div className="hw-ticker">
      <span className="hw-ticker-tag">VMS</span>
      <div className="hw-ticker-track">
        {[...words,...words].map((w,i)=>(
          <span key={i} className="hw-ticker-item"><span className="hw-tki-dot">◆</span>{w}</span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   IMAGE CAROUSEL
══════════════════════════════════════════════════════════ */
function ImageCarousel({ images }) {
  const [active, setActive] = useState(0);
  useEffect(()=>{
    const id=setInterval(()=>setActive(p=>(p+1)%images.length), 2600);
    return ()=>clearInterval(id);
  },[images.length]);
  return (
    <div className="img-carousel">
      <div className="img-c-track" style={{transform:`translateX(${-active*100}%)`}}>
        {images.map((src,i)=>(
          <div key={i} className="img-c-slide">
            <img src={src} alt=""/>
            <div className="img-c-overlay"/>
          </div>
        ))}
      </div>
      <div className="img-c-dots">
        {images.map((_,i)=>(
          <button key={i} className={`icd ${i===active?"icd-on":""}`} onClick={()=>setActive(i)}/>
        ))}
      </div>
      <div className="img-c-counter">{String(active+1).padStart(2,"0")} / {String(images.length).padStart(2,"0")}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN HOME PAGE
══════════════════════════════════════════════════════════ */
export default function Home() {
  const navigate   = useNavigate();
  const user       = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const name       = user?.data?.name || "Vendor";
  const isLoggedIn = !!user?.data;

  const [ready, setReady]   = useState(false);
  const [mx, setMx]         = useState(0.5);
  const [my, setMy]         = useState(0.5);

  useEffect(() => {
    const t = setTimeout(()=>setReady(true), 100);
    const mm = (e)=>{ setMx(e.clientX/window.innerWidth); setMy(e.clientY/window.innerHeight); };
    window.addEventListener("mousemove", mm);
    return ()=>{ clearTimeout(t); window.removeEventListener("mousemove",mm); };
  },[]);

  const images = [...ALL_IMAGES].sort(()=>Math.random()-0.5).slice(0,6);

  const cards = [
    { title:"Quick Sales",   label:"Create Invoice",   icon:"🧾", accent:"cyan",   hint:"● ACTIVE",   path:"/master/salesshrt" },
    { title:"Products",      label:"Manage Catalogue", icon:"📦", accent:"red",    hint:"● ONLINE",   path:"/master/product" },
    { title:"Reports",       label:"Analytics Hub",    icon:"📊", accent:"gold",   hint:"● READY",    path:"/master/reports" },
    { title:"Dashboard",     label:"Live Overview",    icon:"🚀", accent:"purple", hint:"● LIVE",     path:"/master/dashboard" },
  ];

  const flow = [
    { n:"01", t:"Product Types",   path:"/master/producttype" },
    { n:"02", t:"Products",        path:"/master/product" },
    { n:"03", t:"Inventory",       path:"/master/inventory" },
    { n:"04", t:"Sales & Invoice", path:"/master/salesshrt" },
    { n:"05", t:"Reports",         path:"/master/reports" },
    { n:"06", t:"Dashboard",       path:"/master/dashboard" },
  ];

  const px = (mx - 0.5) * 28;
  const py = (my - 0.5) * 18;

  return (
    <div className={`hw-root ${ready?"hw-ready":""}`}>
      <CanvasBg />

      {/* Global mouse-parallax glow */}
      <div className="hw-pglow" style={{transform:`translate(${-px*0.35}px,${-py*0.35}px)`}}/>

      <LiveClock />
      <Ticker />

      {/* ═══ THREE-COLUMN LAYOUT ═══════════════════════════ */}
      <main className="hw-layout">

        {/* ── LEFT ──────────────────────────────────────── */}
        <aside className="hw-left">

          <div className="hw-sys-badge">
            <span className="hw-sys-led"/><span className="hw-sys-led hw-sled2"/>
            SYSTEM ONLINE — VMS v2.0
          </div>

          <div className="hw-greet-wrap">
            <span className="hw-namaste" aria-label="Namaste">🙏</span>
            <span className="hw-greet-text">Namaste, <strong>{name}</strong></span>
          </div>

          <h1 className="hw-h1">
            <span className="hw-h1-vendor">VENDOR</span>
            <span className="hw-h1-mgmt">MANAGEMENT</span>
            <span className="hw-h1-sys">
              <span className="hw-h1-sys-text">SYSTEM</span>
            </span>
          </h1>

          <p className="hw-desc">
            Complete command centre — manage products,<br/>
            track inventory, process invoices and analyse<br/>
            performance in real time.
          </p>

          <div className="hw-actions">
            <button className="hw-btn-launch" onClick={()=>navigate(isLoggedIn?"/onboarding":"/")}>
              <span className="hw-btn-sweep"/>
              <span className="hw-btn-label">Launch System</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="hw-btn-dash" onClick={()=>navigate("/master/dashboard")}>
              Dashboard →
            </button>
          </div>

          <div className="hw-carousel-section">
            <div className="hw-carousel-label">SYSTEM GALLERY</div>
            <ImageCarousel images={images}/>
          </div>
        </aside>

        {/* ── CENTER — REACTOR ──────────────────────────── */}
        <div className="hw-center"
          style={{transform:`translate(${px*0.07}px,${py*0.05}px)`}}>

          <div className="hw-center-tag hw-ct-top">◆ VMS CORE REACTOR ◆</div>
          <VMSReactor onClick={()=>navigate(isLoggedIn?"/onboarding":"/")} />
          <div className="hw-center-tag hw-ct-bot">CLICK TO EXPLORE WORKFLOW</div>

          {/* Status indicators around reactor */}
          <div className="hw-ring-stats">
            <div className="hrs hrs-tl"><div className="hrs-dot"/>SYNC</div>
            <div className="hrs hrs-tr"><div className="hrs-dot"/>LIVE</div>
            <div className="hrs hrs-bl"><div className="hrs-dot hrs-amber"/>STOCK</div>
            <div className="hrs hrs-br"><div className="hrs-dot"/>99.9%</div>
          </div>
        </div>

        {/* ── RIGHT ─────────────────────────────────────── */}
        <aside className="hw-right">
          <div className="hw-right-label">— QUICK ACCESS —</div>

          <div className="hw-cards">
            {cards.map((c,i)=>(
              <HUDCard key={i} {...c} delay={0.25+i*0.09}
                onClick={()=>navigate(c.path)}/>
            ))}
          </div>

          {/* System stats */}
          <div className="hw-sys-stats">
            {[{k:"UPTIME",v:"99.9%",c:"cyan"},{k:"SYNC",v:"LIVE",c:"green"},{k:"ALERTS",v:"0",c:"amber"}].map((s,i)=>(
              <div key={i} className="hw-ss-item">
                <div className={`hw-ss-val hw-ss-${s.c}`}>{s.v}</div>
                <div className="hw-ss-key">{s.k}</div>
              </div>
            ))}
          </div>

          {/* VMS Workflow steps */}
          <div className="hw-workflow">
            <div className="hw-wf-label">VMS WORKFLOW</div>
            {flow.map((f,i)=>(
              <div key={i} className="hw-wf-step"
                style={{animationDelay:`${0.5+i*0.07}s`}}
                onClick={()=>navigate(f.path)}>
                <span className="hw-wf-num">{f.n}</span>
                <div className="hw-wf-bar"/>
                <span className="hw-wf-title">{f.t}</span>
                <span className="hw-wf-arrow">›</span>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
