/* 百物語：怪談度 100 — 框架 v2 */

console.log("v2 game.js loaded");
const CONFIG = {
  target: 100,
  dangerAt: 80,
  cpuDelayMs: 2400,
  assets: { bg: "assets/bg_room.png", sprite: (key, state) => `assets/characters/${key}_${state}.png` },
  characters: [
    { key:"boss", name:"老闆", color:"#2c14a3", bio:"怪談出版社的老闆，缺乏靈感而參加百物語",
      skill1:{ name:"怪談化身", desc:"擲1d5，結果×3", usesPerGame:3,
        action(ctx){ const r=rollDie(5); return { text:"老闆把故事扯得更黑、更長，他哪來這麼多奇怪故事？", rollValue:r, deltaToTotal:r*3, sprite:"skill1" }; } },
      skill2:{ name:"高壓催稿", desc:"所有人下一次擲骰=1d10", usesPerGame:2,
        action(ctx){ ctx.state.global.nextDieAll={sides:10,remaining:ctx.state.order.length}; return { text:"「這樣的進度不行啊，每個人多貢獻一點故事吧。」", rollValue:null, deltaToTotal:0, sprite:"skill2" }; } } },
    { key:"sister", name:"姊姊", color:"#b84098", bio:"老闆的大女兒，半夜睡不著來陪玩",
      skill1:{ name:"化險為夷", desc:"擲1d5，本回合-1，下一位+1（2次）", usesPerGame:3,
        action(ctx){ const r=rollDie(5); const next=getNextActorKey(ctx.state); ctx.state.global.nextBonus[next]=(ctx.state.global.nextBonus[next]??0)+1;
          return { text:"姊姊把話尾輕輕推給下一位。", rollValue:r, deltaToTotal:Math.max(0,r-1), sprite:"skill1", extraLog:"（姊姊：本回合-1，下一位+1）" }; } },
      skill2:{ name:"送上點心", desc:"怪談度-1d10", usesPerGame:2,
        action(ctx){ const r=rollDie(10); return { text:"甜味把現場的不安壓下去一截。", rollValue:-r, deltaToTotal:-r, sprite:"skill2" }; } } },
    { key:"little", name:"妹妹", color:"#b466d4", bio:"老闆的小女兒，好奇心旺盛",
      skill1:{ name:"新手上路", desc:"強制擲出1或5", usesPerGame:3,
        action(ctx){ const r=Math.random()<0.5?1:5; return { text:"妹妹要嘛很短，要嘛直接爆衝。", rollValue:r, deltaToTotal:r, sprite:"skill1" }; } },
      skill2:{ name:"送上點心？", desc:"怪談度-10~+10", usesPerGame:2,
        action(ctx){ const r=randint(-10,10); return { text:"妹妹拿出了不明點心分給大家，好像可以減輕不安，又好像更可疑。", rollValue:r, deltaToTotal:r, sprite:"skill2" }; } } },
    { key:"drunk", name:"酒鬼", color:"#388f76", bio:"出版社的寫手作家，酗酒太郎",
      skill1:{ name:"飲酒過度", desc:"強制擲出5（2次）", usesPerGame:3,
        action(ctx){ const r=5; return { text:"酒氣黏著喉嚨往外冒，酒鬼講出了不得了的怪談。", rollValue:r, deltaToTotal:r, sprite:"skill1" }; } },
      skill2:{ name:"勸酒", desc:"所有人下一次擲骰結果+3", usesPerGame:3,
        action(ctx){ ctx.state.global.nextAddAll={add:3,remaining:ctx.state.order.length}; return { text:"「哎～大家多喝點酒啦～這樣才有興致說嘛～」", rollValue:null, deltaToTotal:0, sprite:"skill2" }; } } },
    { key:"cop", name:"警察", color:"#383838", bio:"半夜巡邏經過出版社的警察，來陪玩",
      skill1:{ name:"一言不發", desc:"本回合=0", usesPerGame:1,
        action(ctx){ return { text:"警察沉默地看著所有人。", rollValue:0, deltaToTotal:0, sprite:"skill1" }; } },
      skill2:{ name:"視線壓迫", desc:"下一個人擲骰×2）", usesPerGame:3,
        action(ctx){ ctx.state.global.nextMulNext=2; return { text:"視線像手銬扣在下一個人身上。", rollValue:null, deltaToTotal:0, sprite:"skill2" }; } } },
    { key:"detective", name:"偵探", color:"#d6bcd1", bio:"怪談出版社作品的粉絲，可樂餅信徒",
      skill1:{ name:"偵探直覺", desc:"怪談度-5~+5（2次）", usesPerGame:3,
        action(ctx){ const r=randint(-5,5); return { text:"「嗯……這段有點不對勁。」", rollValue:r, deltaToTotal:r, sprite:"skill1" }; } },
      skill2:{ name:"分享可樂餅", desc:"自身=0；另擲1d5加到下一位", usesPerGame:2,
        action(ctx){ const r=rollDie(5); const next=getNextActorKey(ctx.state); ctx.state.global.nextBonus[next]=(ctx.state.global.nextBonus[next]??0)+r;
          return { text:"「你講一定更可怕吧？」", rollValue:0, deltaToTotal:0, sprite:"skill2", extraLog:`（偵探：下一位擲骰 +${r}）` }; } } },
    { key:"reporter", name:"記者", color:"#517a94", bio:"常來出版社打聽小道消息的記者，來陪玩",
      skill1:{ name:"對答如流", desc:"用前一位的擲骰當本次擲骰結果", usesPerGame:3,
        action(ctx){ const prev=ctx.state.global.lastRollValue??0; return { text:"記者直接接話，像早就背好。", rollValue:prev, deltaToTotal:prev, sprite:"skill1" }; } },
      skill2:{ name:"手忙腳亂", desc:"本局四人重新洗座位（排序重設）", usesPerGame:1,
        action(ctx){ reshuffleSeats(ctx.state); return { text:"桌面一亂——四個人乾脆換座位重來。", rollValue:null, deltaToTotal:0, sprite:"skill2", extraLog:"（座位已重新洗牌）" }; } } },
  ]
};

const $ = (s)=>document.querySelector(s);
const UI = {
  bg:$("#bg"),
  seats:{1:document.querySelector(".seat.c1"),2:document.querySelector(".seat.c2"),3:document.querySelector(".seat.c3"),4:document.querySelector(".seat.c4")},
  chars:{1:$("#c1"),2:$("#c2"),3:$("#c3"),4:$("#c4")},
  bubbles:{1:$("#b1"),2:$("#b2"),3:$("#b3"),4:$("#b4")},
  total:$("#totalCount"),
  roundNum:$("#roundNum"),
  speaker:$("#speakerName"),
  dialog:$("#dialogText"),
  btnStart:$("#btnStart"),
  btnNext:$("#btnNext"),
  btnLog:$("#btnLog"),
  btnTalk:$("#btnTalk"),
  btnS1:$("#btnSkill1"),
  btnS2:$("#btnSkill2"),
  btnRestart:$("#btnRestart"),
  modal:$("#modal"),
  modalGrid:$("#modalGrid"),
  btnCloseModal:$("#btnCloseModal"),
  logModal:$("#logModal"),
  logBox:$("#logBox"),
  btnCloseLog:$("#btnCloseLog"),
};

function randint(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function rollDie(s){ return randint(1,s); }
function shuffle(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;") 
    .replaceAll("'","&#039;");
}
function safeSetImg(img,src){ img.onerror=()=>{img.style.opacity="0";}; img.src=src; }
function setBackground(){ safeSetImg(UI.bg, CONFIG.assets.bg); }

const state = {
  started:false,
  playerKey:null,
  roster:[],
  seatToKey:{},
  keyToSeat:{},
  order:[1,2,3,4],
  turnPtr:0,
  round:1,
  total:0,
  phase:"idle",
  uses:{},
  global:{ nextDieAll:null, nextAddAll:null, nextMulNext:null, nextBonus:{}, lastRollValue:null },
  logs:[],
  autoTimer:null,
};

function logLine(t){ state.logs.push(t); if(state.logs.length>12) state.logs.shift(); }
function setDialog(t){ UI.dialog.textContent=t; logLine(t); }
function setSpeaker(name,color){ UI.speaker.textContent=name; UI.speaker.style.color=color||""; }

function setHUD(){
  UI.total.textContent=String(state.total);
  UI.roundNum.textContent=String(state.round);
  if(state.total>=CONFIG.dangerAt) UI.total.classList.add("danger"); else UI.total.classList.remove("danger");
}

function clearBubbles(){
  for(const seat of [1,2,3,4]){
    UI.bubbles[seat].classList.remove("danger");
    UI.bubbles[seat].querySelector("span").textContent="-";
  }
}
function setBubbleForKey(key,value,danger=false){
  const seat=state.keyToSeat[key]; if(!seat) return;
  const b=UI.bubbles[seat];
  b.querySelector("span").textContent = (value===null||value===undefined) ? "-" : String(value);
  b.classList.toggle("danger", !!danger);
}

function showCharacters(on){
  for(const seat of [1,2,3,4]){
    UI.seats[seat].classList.toggle("visible", !!on);
  }
}
function setSpriteByKey(key,pose){
  const seat=state.keyToSeat[key]; if(!seat) return;
  safeSetImg(UI.chars[seat], CONFIG.assets.sprite(key,pose));
}

function resetGame(){
  if(state.autoTimer){ clearTimeout(state.autoTimer); state.autoTimer=null; }
  Object.assign(state,{
    started:false, playerKey:null, roster:[], seatToKey:{}, keyToSeat:{}, order:[1,2,3,4],
    turnPtr:0, round:1, total:0, phase:"idle", uses:{},
    global:{ nextDieAll:null, nextAddAll:null, nextMulNext:null, nextBonus:{}, lastRollValue:null },
    logs:[], autoTimer:null
  });
  UI.btnNext.disabled=true;
  UI.btnTalk.disabled=true; UI.btnS1.disabled=true; UI.btnS2.disabled=true;
  UI.btnRestart.classList.add("hidden");
  setSpeaker("—");
  setDialog("按「開始 / 選角」選擇角色。");
  setHUD(); clearBubbles(); showCharacters(false);
}

function openModal(){
  UI.modal.classList.remove("hidden");
  UI.modalGrid.innerHTML="";
  for(const c of CONFIG.characters){
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`<div class="card-title" style="color:${c.color}">${escapeHtml(c.name)}</div>
      <div class="card-desc">${escapeHtml(c.bio)}<br><b>技能1：</b>${escapeHtml(c.skill1.name)}（${escapeHtml(c.skill1.desc)}）<br>
      <b>技能2：</b>${escapeHtml(c.skill2.name)}（${escapeHtml(c.skill2.desc)}）</div>`;
    card.addEventListener("click",()=>choosePlayer(c.key));
    UI.modalGrid.appendChild(card);
  }
}
function closeModal(){ UI.modal.classList.add("hidden"); }

function renderLog(){
  UI.logBox.innerHTML = state.logs.map(t=>`<div class="logline">${escapeHtml(t)}</div>`).join("");
}
function openLog(){ renderLog(); UI.logModal.classList.remove("hidden"); }
function closeLog(){ UI.logModal.classList.add("hidden"); }

function choosePlayer(playerKey){
  closeModal();
  const pool=CONFIG.characters.map(c=>c.key);
  const rest=pool.filter(k=>k!==playerKey);
  const picks=shuffle(rest).slice(0,3);
  const keys=shuffle([playerKey,...picks]);
  state.playerKey=playerKey;
  state.roster=keys.map(k=>CONFIG.characters.find(c=>c.key===k));

  const seats=shuffle([1,2,3,4]);
  state.seatToKey={}; state.keyToSeat={};
  for(let i=0;i<4;i++){ state.seatToKey[seats[i]]=keys[i]; state.keyToSeat[keys[i]]=seats[i]; }

  state.turnPtr=0; state.round=1; state.total=0; state.phase="awaiting_action"; state.started=true;
  for(const c of state.roster){
    state.uses[c.key]={ s1:c.skill1.usesPerGame??1, s2:c.skill2.usesPerGame??1 };
    setSpriteByKey(c.key,"idle");
  }
  showCharacters(true); clearBubbles(); setHUD();
  const me=CONFIG.characters.find(c=>c.key===playerKey);
  setDialog(`你選擇了「${me.name}」。另外三位已入座。`);
  startTurn();
}

function currentActorKey(){ const seat=state.order[state.turnPtr]; return state.seatToKey[seat]; }
function getNextActorKey(st){ const nextPtr=(st.turnPtr+1)%st.order.length; const nextSeat=st.order[nextPtr]; return st.seatToKey[nextSeat]; }

function reshuffleSeats(st){
  const keys=st.roster.map(c=>c.key);
  const seats=shuffle([1,2,3,4]);
  st.seatToKey={}; st.keyToSeat={};
  for(let i=0;i<4;i++){ st.seatToKey[seats[i]]=keys[i]; st.keyToSeat[keys[i]]=seats[i]; }
  for(const k of keys) setSpriteByKey(k,"idle");
}

function disableActions(){ UI.btnTalk.disabled=true; UI.btnS1.disabled=true; UI.btnS2.disabled=true; }
function setButtonsFor(key){
  const c=CONFIG.characters.find(x=>x.key===key);
  const u=state.uses[key];
  UI.btnTalk.textContent="講怪談（1d5）";
  UI.btnS1.textContent=`${c.skill1.name}：${c.skill1.desc}（${u.s1}）`;
  UI.btnS2.textContent=`${c.skill2.name}：${c.skill2.desc}（${u.s2}）`;
  UI.btnTalk.disabled=false;
  UI.btnS1.disabled=(u.s1<=0);
  UI.btnS2.disabled=(u.s2<=0);
}

function pickDieSides(){
  if(state.global.nextDieAll){
    const s=state.global.nextDieAll.sides;
    state.global.nextDieAll.remaining -= 1;
    if(state.global.nextDieAll.remaining<=0) state.global.nextDieAll=null;
    return s;
  }
  return 5;
}
function applyGlobalToRoll(key, r){
  if(state.global.nextMulNext){ r = r*state.global.nextMulNext; state.global.nextMulNext=null; }
  if(state.global.nextBonus[key]){ r = r + state.global.nextBonus[key]; delete state.global.nextBonus[key]; }
  if(state.global.nextAddAll){
    r = r + state.global.nextAddAll.add;
    state.global.nextAddAll.remaining -= 1;
    if(state.global.nextAddAll.remaining<=0) state.global.nextAddAll=null;
  }
  return r;
}

async function doAction(key, kind){
  if(state.phase==="game_over") return;
    state.phase = "awaiting_action"; 
  state.phase="resolving";
  disableActions();
  UI.btnNext.disabled=true;

  const c=CONFIG.characters.find(x=>x.key===key);
  let result=null;

  if(kind==="talk"){
    const sides=pickDieSides();
    const base=rollDie(sides);
    const r=applyGlobalToRoll(key, base);
    result={ text:`${c.name} 講起怪談（1d${sides}）。`, rollValue:r, deltaToTotal:r, sprite:"roll" };
  } else if(kind==="s1"){
    if(state.uses[key].s1<=0) return;
    state.uses[key].s1 -= 1;
    result=c.skill1.action({state,actorKey:key});
  } else if(kind==="s2"){
    if(state.uses[key].s2<=0) return;
    state.uses[key].s2 -= 1;
    result=c.skill2.action({state,actorKey:key});
  }

  setSpriteByKey(key, result.sprite || "idle");
  setDialog(result.text);
  if(result.extraLog) logLine(result.extraLog);
  await sleep(1200);

  if(typeof result.rollValue==="number") setBubbleForKey(key, result.rollValue, false);
  else setBubbleForKey(key, "-", false);

  const before=state.total;
  state.total = clamp(state.total + (result.deltaToTotal||0), 0, 9999);
  setHUD();
  const delta=result.deltaToTotal||0;
  const sign = delta>=0?"+":"";
  setDialog(`${c.name} 使怪談度 ${sign}${delta}（${before} → ${state.total}）。`);

  if(typeof result.rollValue==="number") state.global.lastRollValue = result.rollValue;

  await sleep(1200);
  if(state.phase!=="game_over") setSpriteByKey(key,"idle");

  if(state.total>=CONFIG.target){
    state.phase="game_over";
    setSpriteByKey(key,"lose");
    setBubbleForKey(key, state.global.lastRollValue ?? "-", true);
    setDialog(`怪談度達到 ${state.total}。輸家是「${c.name}」。`);
    UI.btnRestart.classList.remove("hidden");
    UI.btnNext.disabled=true;
    disableActions();
    return;
  }

  advanceTurn();
}

function advanceTurn(){
  state.turnPtr = (state.turnPtr + 1) % state.order.length;
  if(state.turnPtr===0){
    state.round += 1;
    clearBubbles();
    setHUD();
  }
  startTurn();
}

function startTurn(){
  if(state.phase==="game_over") return;

  state.phase = "awaiting_action"; 

  const key=currentActorKey();
  const c=CONFIG.characters.find(x=>x.key===key);
  setSpeaker(c.name,c.color);
  setBubbleForKey(key,"-",false);

  if(key===state.playerKey){
    if(state.autoTimer){ clearTimeout(state.autoTimer); state.autoTimer=null; }
    UI.btnNext.disabled=true;
    setButtonsFor(key);
    setDialog(`輪到${c.name}。請選擇要做的事。`);
  } else {
    disableActions();
    cpuTurn(key);
  }
}


function cpuTurn(key){
  const c = CONFIG.characters.find(x => x.key === key);
  const u = state.uses[key];
  const total = state.total;

  const nextKey = getNextActorKey(state);
  const nextIsPlayer = (nextKey === state.playerKey);

  // 估計自己講怪談的風險（越接近100越危險）
  const riskHigh = (total >= 95);
  const riskMed  = (total >= 88);
  const danger   = (total >= CONFIG.dangerAt); // >=80

  // 可用行動
  const canS1 = u.s1 > 0;
  const canS2 = u.s2 > 0;

  // 想要更像VN：先丟一行「在想」並停一下
  setDialog(`輪到 ${c.name}。他想著……`);

  // ===== 角色性格：用權重表挑選 talk/s1/s2 =====
  // 權重越高越常選到。之後再加條件修正（例如快爆炸就更保命/更陰險）
  let wTalk = 1.0, wS1 = canS1 ? 0.7 : 0, wS2 = canS2 ? 0.7 : 0;

  // --- 老闆：陰險、急切要題材 -> 很愛搞全局、也愛爆衝 ---
  if (key === "boss"){
    wTalk = 0.9;
    wS1   = canS1 ? 1.1 : 0; // ×3 很香
    wS2   = canS2 ? 1.4 : 0; // 全員1d10：陰險招牌
    if (nextIsPlayer && canS2) wS2 += 0.8; // 玩家下一位就更想催稿
    if (riskHigh) { wS1 += 0.6; wTalk -= 0.2; } // 快死時：乾脆賭一把大戲
  }

  // --- 姊姊：好奇但保命 -> 危險時更偏向降怪談度 ---
  if (key === "sister"){
    wTalk = 0.9;
    wS1   = canS1 ? 0.9 : 0;  // 借火：柔和控節奏
    wS2   = canS2 ? 0.8 : 0;  // 點心：保命用
    if (danger && canS2) wS2 += 1.2; // >=80就開始想「壓下去」
    if (riskMed && canS2) wS2 += 1.0;
    if (riskHigh) { wS2 += 1.6; wTalk -= 0.4; } // 快死時幾乎必點心
    // 下一位是玩家：姊姊不一定陰險，但會用借火把風險轉移得更「自然」
    if (nextIsPlayer && canS1) wS1 += 0.4;
  }

  // --- 妹妹：亂按、賭運氣 -> 技能使用更隨機、更波動 ---
  if (key === "little"){
    wTalk = 1.0;
    wS1   = canS1 ? 1.0 : 0; // 1或5：賭
    wS2   = canS2 ? 1.0 : 0; // -10~+10：更賭
    // 她不太會怕死：越危險越興奮
    if (danger) { wS1 += 0.3; wS2 += 0.6; }
    if (riskHigh) { wS2 += 1.0; }
  }

  // --- 酒鬼：不怕死 -> 越危險越激進，愛把大家拉下水 ---
  if (key === "drunk"){
    wTalk = 1.1;
    wS1   = canS1 ? 1.3 : 0; // 固定5：穩定推進
    wS2   = canS2 ? 1.4 : 0; // 全員+3：拉全場一起熱
    if (danger && canS2) wS2 += 1.0;
    if (riskHigh) { wTalk += 0.2; wS1 += 0.6; wS2 += 0.6; } // 快死也照衝
    if (nextIsPlayer && canS2) wS2 += 0.5; // 玩家也一起喝
  }

  // --- 警察：冷、喜歡壓迫下一位 -> 超愛×2，且更針對玩家 ---
  if (key === "cop"){
    wTalk = 0.8;
    wS1   = canS1 ? 0.6 : 0; // 0：偶爾用來穩住自己
    wS2   = canS2 ? 1.6 : 0; // ×2：招牌
    if (nextIsPlayer && canS2) wS2 += 1.2; // 玩家下一位直接壓
    if (riskHigh && canS1) wS1 += 1.2;      // 快死就用0保命
    if (riskHigh) wTalk -= 0.3;
  }

  // --- 偵探：控盤、做局 -> 看情況給下一位加值，危險時用±5控總量 ---
  if (key === "detective"){
    wTalk = 0.7;
    wS1   = canS1 ? 1.2 : 0; // ±5：控盤
    wS2   = canS2 ? 1.1 : 0; // 可樂餅：做局
    if (nextIsPlayer && canS2) wS2 += 0.9; // 玩家下一位更愛做局
    if (danger && canS1) wS1 += 0.6;       // >=80開始控總量
    if (riskHigh && canS1) wS1 += 1.0;     // 快死更控
    if (riskHigh) wTalk -= 0.2;
  }

  // --- 記者：搞亂局勢、也可能把自己推上浪尖 -> 愛洗座位，危險時也敢亂 ---
  if (key === "reporter"){
    wTalk = 1.0;
    wS1   = canS1 ? 0.9 : 0; // 複製上一位：戲劇性
    wS2   = canS2 ? 1.3 : 0; // 洗座位：混亂招牌
    if (danger && canS2) wS2 += 0.8;       // 局勢緊張更想攪局
    if (riskHigh) { wS2 += 0.6; wTalk += 0.1; } // 快死也可能硬搞
    // 下一位是玩家：記者更愛「讓玩家措手不及」
    if (nextIsPlayer && canS2) wS2 += 0.5;
  }

  // 如果技能用完就歸零
  if (!canS1) wS1 = 0;
  if (!canS2) wS2 = 0;

  // ===== 用權重抽選 =====
  const options = [
    { k: "talk", w: Math.max(0, wTalk) },
    { k: "s1",   w: Math.max(0, wS1) },
    { k: "s2",   w: Math.max(0, wS2) },
  ].filter(o => o.w > 0);

  let pick = "talk";
  const sum = options.reduce((a,o)=>a+o.w,0);
  let r = Math.random() * sum;
  for (const o of options){
    r -= o.w;
    if (r <= 0){ pick = o.k; break; }
  }

  // ===== 等待2~3秒，可按 Next 跳過（沿用你原本機制）=====
  UI.btnNext.disabled = false;
  UI.btnNext.textContent = "下一步（跳過等待）";

  let done = false;
  const skip = () => {
    if (done) return;
    done = true;
    if (state.autoTimer){ clearTimeout(state.autoTimer); state.autoTimer = null; }
    UI.btnNext.removeEventListener("click", skip);
    UI.btnNext.disabled = true;
    UI.btnNext.textContent = "下一步";
    doAction(key, pick);
  };
  UI.btnNext.addEventListener("click", skip);
  state.autoTimer = setTimeout(skip, CONFIG.cpuDelayMs);
}


function bindUI(){
  UI.btnStart.addEventListener("click", openModal);
  UI.btnCloseModal.addEventListener("click", closeModal);
  UI.btnLog.addEventListener("click", openLog);
  UI.btnCloseLog.addEventListener("click", closeLog);

  UI.btnTalk.addEventListener("click", ()=>{ if(state.phase==="awaiting_action" && currentActorKey()===state.playerKey) doAction(state.playerKey,"talk"); });
  UI.btnS1.addEventListener("click", ()=>{ if(state.phase==="awaiting_action" && currentActorKey()===state.playerKey) doAction(state.playerKey,"s1"); });
  UI.btnS2.addEventListener("click", ()=>{ if(state.phase==="awaiting_action" && currentActorKey()===state.playerKey) doAction(state.playerKey,"s2"); });

  UI.btnRestart.addEventListener("click", ()=>{ resetGame(); openModal(); });
}

function init(){ setBackground(); bindUI(); resetGame(); }
init();
