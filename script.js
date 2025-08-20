// Footer year
(function(){ const y=document.getElementById('y'); if (y) y.textContent=new Date().getFullYear(); })();

/* =========================================================
   Moto3gp — Pixel Track (10-bike tight pack)
   - Large-ish track band, anchored
   - 10 riders (Moto3 team palettes)
   - Less bunching, more overtakes
   - Faint pixel-fume trails
   ========================================================= */
(function () {
  const canvas = document.getElementById('px-racer');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.imageSmoothingEnabled = false;

  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let PX = 4, W = 0, H = 0;

  // Slightly slimmer than Moto2
  let TRACK_H = 60; // desired
  let groundY = 0, trackMidY = 0;

  const GAP_TOP_PX = 240, GAP_BOTTOM_PX = 240;

  // Moto3 teams (10)
  const MOTO3_TEAMS = [
    { name:'Leopard Racing',        base:'#00c7d9', accent:'#ffffff', dark:'#0b0c10' },
    { name:'Red Bull KTM Ajo',      base:'#ff6a00', accent:'#003087', dark:'#0b0c10' },
    { name:'Red Bull KTM Tech3',    base:'#ff6a00', accent:'#003087', dark:'#0b0c10' },
    { name:'CFMOTO Aspar',          base:'#00b8e0', accent:'#ffffff', dark:'#0b0c10' },
    { name:'Honda Team Asia',       base:'#d50000', accent:'#ffffff', dark:'#0b0c10' },
    { name:'SIC58 Squadra Corse',   base:'#f2f2f2', accent:'#e10600', dark:'#0b0c10' },
    { name:'CIP Green Power',       base:'#1aa34a', accent:'#101010', dark:'#0b0c10' },
    { name:'Liqui Moly Intact GP',  base:'#e6e6e6', accent:'#1b5aa6', dark:'#0b0c10' },
    { name:'Rivacold Snipers',      base:'#1537b0', accent:'#ffd200', dark:'#0b0c10' },
    { name:'BOE Motorsports',       base:'#202020', accent:'#ff6a00', dark:'#0b0c10' }
  ];

  const N = 10;
  const riders = new Array(N); for (let i=0;i<N;i++) riders[i] = {};
  const tmpIdx = new Array(N).fill(0);

  // Pixel fumes
  const puffs = [];
  const MAX_PUFFS = 600, PUFF_RATE = 18, PUFF_VX = 22, PUFF_FADE = 1.1;

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  function fillTeams(list,k){ const out=[]; for(let i=0;i<k;i++) out.push(list[i%list.length]); return out; }

  function emitPuff(x,y){
    if (puffs.length >= MAX_PUFFS) puffs.shift();
    puffs.push({ x, y, life: 1 });
  }
  function drawPuffs(dt){
    for (let i=puffs.length-1;i>=0;i--){
      const p = puffs[i];
      p.life -= dt * PUFF_FADE;
      p.x    -= dt * PUFF_VX;
      if (p.life <= 0){ puffs.splice(i,1); continue; }
      const a = Math.max(0, Math.min(1, p.life)) * 0.18;
      ctx.fillStyle = `rgba(200,220,255,${a})`;
      ctx.fillRect(p.x|0, p.y|0, 2, 2);
    }
  }

  function resize(){
    const vw = Math.max(1, innerWidth);
    const vh = Math.max(1, innerHeight);
    PX = Math.max(3, Math.min(7, Math.floor(vw / 320)));
    W = Math.ceil(vw / PX);
    H = Math.ceil(vh / PX);
    canvas.width = W; canvas.height = H;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';

    const desiredTrackH = Math.max(60, Math.round(H * 0.36)); // large-ish

    const panel  = document.querySelector('.panel');
    const footer = document.querySelector('.foot');
    const panelBottomPx = panel  ? panel.getBoundingClientRect().bottom : vh * 0.42;
    const footerTopPx   = footer ? footer.getBoundingClientRect().top    : vh * 0.96;

    const desiredTopPx    = panelBottomPx + GAP_TOP_PX;
    const desiredBottomPx = footerTopPx   - GAP_BOTTOM_PX;

    const topL    = Math.round(desiredTopPx / PX);
    const bottomL = Math.round(desiredBottomPx / PX);

    const available = bottomL - topL;
    TRACK_H  = Math.min(desiredTrackH, Math.max(44, available));
    groundY  = Math.min(H - 6, topL + TRACK_H);
    const trackTopL = Math.max(3, groundY - TRACK_H);
    trackMidY = (groundY + trackTopL) >> 1;

    initRiders();
  }

  function drawTrack(){
    ctx.fillStyle = '#141821';
    ctx.fillRect(0, groundY - TRACK_H, W, TRACK_H);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, groundY - TRACK_H, W, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, groundY - 2, W, 2);
  }

  function initRiders(){
    const chosen = fillTeams(MOTO3_TEAMS, N);
    const span = TRACK_H * 0.14;
    for (let i=0;i<N;i++){
      const pal = chosen[i], r = riders[i];
      r.palette = pal;
      r.x     = - (i * 28 + (Math.random()*16));
      r.speed = 28 + (i % 3) * 1.3 + Math.random()*1.6;
      r.base  = ((i & 1) ? 1 : -1) * (span * 0.55) + (Math.random()*2 - 1);
      r.phase = Math.random() * Math.PI * 2;
      r.amp   = 2 + Math.random() * 1.5;
      r.yMid  = trackMidY + r.base;
      r.boost = 0; r.intent = 0; r.passT = 0;
    }
  }

  // Moto3: tight but freer flow
  const HEADWAY_MIN = 14, HEADWAY_MAX = 22, SS_RANGE_Y = 3;
  const DRAG_LOSS = 0.985, SS_GAIN = 1.08, CATCHUP = 1.12, BRAKE = 0.955;
  const PASS_TIME = 0.85, PASS_RATE = 0.60, PASS_KICK = 1.16, PASS_SHIFT = 6, PASS_WINDOW = 0.95, ALIGN_GAIN = 0.09;

  function updatePack(dt, t){
    for (let i=0;i<N;i++) tmpIdx[i]=i;
    tmpIdx.sort((a,b)=>riders[a].x - riders[b].x);

    for (let oi=0;oi<N;oi++){
      const i = tmpIdx[oi];
      const r = riders[i];

      const weave = Math.sin(t*1.0 + r.phase) * r.amp;
      let targetY = trackMidY + r.base + weave;
      let vMul = DRAG_LOSS;

      const leader = (oi === N-1);
      if (!leader){
        const a = riders[tmpIdx[oi+1]];
        const dx = a.x - r.x;
        const dy = Math.abs(a.yMid - r.yMid);

        const alignY = a.yMid + (r.intent !== 0 ? r.intent * (PASS_SHIFT*0.4) : 0);
        targetY = targetY * (1 - ALIGN_GAIN) + alignY * ALIGN_GAIN;

        if (dx > HEADWAY_MAX) { vMul = CATCHUP; r.boost = Math.max(0, r.boost - dt*0.4); }
        else if (dx < HEADWAY_MIN) { vMul = BRAKE; r.boost = Math.max(0, r.boost - dt*0.6); }
        else {
          if (dy < SS_RANGE_Y) {
            vMul = SS_GAIN;
            r.boost += dt;
            if (r.boost > PASS_TIME && r.passT <= 0 && r.intent === 0 && Math.random() < PASS_RATE){
              r.intent = (Math.random() < 0.5 ? -1 : 1);
              r.passT  = PASS_WINDOW;
            }
          } else {
            r.boost = Math.max(0, r.boost - dt*0.5);
          }
        }
      } else {
        r.boost = Math.max(0, r.boost - dt*0.5);
      }

      if (r.passT > 0){
        vMul *= PASS_KICK;
        r.base += (r.intent * 0.6) * dt * 10;
        r.passT -= dt;
        if (r.passT <= 0){ r.intent = 0; r.boost = 0; }
      }

      r.x += (r.speed * vMul) * dt;

      if (!prefersReduced && r.passT <= 0 && Math.random() < PUFF_RATE * dt){
        emitPuff(r.x + 2, r.yMid + 10);
      }

      const halfSafe = (TRACK_H / 2) - 7;
      r.yMid = clamp(trackMidY + r.base + Math.sin(t*1.0 + r.phase)*r.amp,
                     trackMidY - halfSafe, trackMidY + halfSafe);

      if (r.x > W + 80){
        r.x     = -80 - Math.random()*120;
        r.speed = 28 + Math.random()*14;
        r.phase = Math.random()*Math.PI*2;
        r.amp   = 2 + Math.random()*1.5;
        r.boost = 0; r.intent=0; r.passT=0;
        r.base  = (Math.random()*2 - 1) * (TRACK_H * 0.08);
      }
    }
  }

  function drawBike(x, yMid, pal, t){
    const S = 3;
    const d = (xx,yy,ww,hh,col)=>{ ctx.fillStyle=col; ctx.fillRect(xx|0, yy|0, ww|0, hh|0); };
    const y = (yMid - 6*S) | 0;

    // Tyres
    d(x + 0*S,  y + 10*S, 4*S, 2*S, pal.dark);
    d(x + 12*S, y + 10*S, 3*S, 2*S, pal.dark);

    // Fork/fender + disc
    d(x + 15*S, y +  9*S, 1*S, 3*S, 'rgba(0,0,0,0.55)');
    d(x + 11*S, y +  9*S, 4*S, 1*S, '#1c2230');
    d(x + 12*S, y + 10*S, 1*S, 1*S, '#b8bec8');
    d(x + 13*S, y + 10*S, 1*S, 1*S, '#8f98a3');

    // Exhaust
    d(x +  5*S, y + 11*S, 4*S, 1*S, '#1a1a1a');

    // Fairing/tank/tail (Moto3: simpler aero)
    d(x +  5*S, y +  5*S, 7*S, 2*S, pal.base);
    d(x +  3*S, y +  7*S,11*S, 2*S, pal.base);
    d(x + 14*S, y +  6*S, 2*S, 2*S, pal.base);
    d(x + 14*S, y +  5*S, 2*S, 1*S, '#e6f2ff'); // screen

    // Tiny winglet
    d(x + 13*S, y +  7*S, 1*S, 1*S, '#1a1f2b');

    // Accent stripe
    d(x +  6*S, y +  7*S, 5*S, 1*S, pal.accent);

    // Tail + pivot
    d(x +  2*S, y +  7*S, 1*S, 1*S, pal.base);
    d(x +  4*S, y + 10*S, 1*S, 1*S, '#151515');

    // Rider
    const suit=pal.base, suitDark='#1a1f2b', helmet=pal.accent;
    d(x +  9*S, y +  4*S, 2*S, 1*S, suit);
    d(x + 11*S, y +  4*S, 1*S, 1*S, suit);
    d(x + 12*S, y +  5*S, 1*S, 1*S, pal.accent);
    d(x +  6*S, y +  6*S, 1*S, 1*S, suit);
    d(x +  7*S, y +  6*S, 1*S, 1*S, suit);
    d(x +  6*S, y +  7*S, 1*S, 1*S, suitDark);
    d(x +  7*S, y +  7*S, 1*S, 1*S, suitDark);
    d(x + 11*S, y +  3*S, 2*S, 2*S, helmet);
    d(x + 11*S, y +  4*S, 2*S, 1*S, '#0f1116');

    // Tail light
    if (((t*2)|0)%2===0) d(x + 1*S, y + 8*S, 1*S, 1*S, '#ff3030');
  }

  let last=0, rafId=0;
  function frame(ts){
    const dt = Math.min(0.05, (ts-last)/1000 || 0.016);
    last = ts;
    const t = ts/1000;

    ctx.clearRect(0,0,W,H);
    drawTrack();
    drawPuffs(dt);

    if (!prefersReduced) updatePack(dt, t);

    for (let i=0;i<N;i++) tmpIdx[i]=i;
    tmpIdx.sort((a,b)=>riders[a].yMid - riders[b].yMid);
    for (let k=0;k<N;k++){
      const r = riders[tmpIdx[k]];
      drawBike(r.x, r.yMid, r.palette, t);
    }

    if (!prefersReduced) rafId = requestAnimationFrame(frame);
  }

  addEventListener('resize', () => {
    cancelAnimationFrame(rafId);
    resize(); last=0; rafId=requestAnimationFrame(frame);
  });

  resize();
  if (prefersReduced) frame(performance.now()); else rafId=requestAnimationFrame(frame);
})();
