/* ZKG Planner v4.2 - floating donate, discord link, back-to-top, energy bg */
let PNG_MAP = {}, CHARACTERS = [], TEAMS = [];

const el = id => document.getElementById(id);
const val = id => (el(id).value || "").trim();
const hide = (id) => el(id).style.display = 'none';
const show = (id, mode='block') => el(id).style.display = mode;

function showError(msg){ const e = el('errorBox'); e.textContent = msg; e.style.display='block'; hide('loadingSpinner'); }
function clearError(){ const e = el('errorBox'); e.textContent=""; e.style.display='none'; }

async function api(action, params={}){
  const qs = new URLSearchParams({ action, ...params, _: Date.now() }).toString();
  const r = await fetch(`${backend_url}?${qs}`);
  return r.json();
}

function optionsFrom(list, placeholder){
  return `<option value="">${placeholder}</option>` + list.map(n => `<option>${escapeHtml(n)}</option>`).join('');
}
function escapeHtml(s){return (s==null?'':String(s)).replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

function setPortrait(imgEl, name){
  const file = PNG_MAP[(name||"").toLowerCase()] || "";
  imgEl.src = file ? (PORTRAIT_BASE + file) : "assets/question.png";
  imgEl.alt = name || "portrait";
  imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = "assets/question.png"; };
}
function updatePortrait(i){ setPortrait(el(`charImg${i}`), val(`char${i}`)); }

function resetUI(){
  el('teamSelect').selectedIndex = 0;
  for(let i=1;i<=5;i++){ el(`char${i}`).selectedIndex = 0; updatePortrait(i); }
  const res = el('results'); res.classList.add('muted'); res.innerHTML = "Choose exactly 5 characters to search.";
  hide('teamLoadingMsg');
}

function membersSelected(){
  const m = [];
  for(let i=1;i<=5;i++){ const n = val(`char${i}`); if(n) m.push(n); }
  return m;
}

function setResultsLoading(on){
  const root = el('results');
  if(on){
    root.classList.remove('muted');
    root.innerHTML = `<div class="loadingMsg">Searching counters…</div>`;
  }
}

function maybeAutoSearch(){
  const M = membersSelected();
  if (M.length === 5) {
    setResultsLoading(true);
    findCounters(M);
  }
}

/* ------------------------
   UPDATED renderResults()
   ------------------------ */
function renderResults(payload){
  const root = el('results');
  if(!payload.ok){ 
    root.classList.add('muted'); 
    root.textContent = payload.error || "No match found."; 
    return; 
  }

  const { results } = payload;
  if(!results || !results.length){ 
    root.classList.add('muted'); 
    root.textContent = "No match found."; 
    return; 
  }

  root.classList.remove('muted');
  root.innerHTML = "";

  results.slice(0,6).forEach((r, idx) => {
    // Counter team grid
    const grid = document.createElement('div');
    grid.className = 'resultsGrid';
    r.counterTeam.forEach(name => {
      const div = document.createElement('div');
      div.className = 'resultCard';
      const file = PNG_MAP[(name||"").toLowerCase()] || "";
      const src = file ? (PORTRAIT_BASE + file) : "assets/question.png";
      div.innerHTML = `
        <div class="nameTag">${escapeHtml(name||"")}</div>
        <img src="${src}" alt="${escapeHtml(name||'portrait')}" width="108" height="108"
             onerror="this.src='assets/question.png'">
      `;
      grid.appendChild(div);
    });

    // Divider line + Match title
    root.appendChild(document.createElement('hr'));
    const title = document.createElement('div');
    title.className = 'nameTag';
    title.style.margin = '6px 0';
    title.textContent = `Match #${idx + 1}`;
    root.appendChild(title);

    // Add character grid
    root.appendChild(grid);

    // Add backend-provided horizontal info
    if (r.extraInfo) {
      const infoDiv = document.createElement('div');
      infoDiv.className = 'extras';
      infoDiv.innerHTML = r.extraInfo; // full formatted HTML
      root.appendChild(infoDiv);
    }
  });
}
/* ------------------------ */

async function findCounters(preset){
  const M = preset || membersSelected();
  if(M.length !== 5){ return; }
  const payload = await api('findCounters', { members: encodeURIComponent(M.join('|')) });
  renderResults(payload);
}

async function init(){
  // back-to-top visibility
  const btt = el('backToTop');
  window.addEventListener('scroll', ()=>{
    if (window.scrollY > 300) btt.style.display = 'block'; else btt.style.display = 'none';
  });
  btt.addEventListener('click', ()=>window.scrollTo({top:0, behavior:'smooth'}));

  show('loadingSpinner','flex'); clearError();
  try {
    const [ping, pngs, teams, chars] = await Promise.all([
      api('ping'), api('getPNGs'), api('getTeams'), api('getCharacters')
    ]);
    if(!ping.ok) throw new Error("Backend ping failed");
    if(!pngs.ok || !teams.ok || !chars.ok) throw new Error("Data calls not OK");

    if (pngs.map) {
      PNG_MAP = pngs.map;
    } else if (Array.isArray(pngs.pngs)) {
      PNG_MAP = {};
      pngs.pngs.forEach(({name,file}) => { if (name && file) PNG_MAP[String(name).toLowerCase()] = String(file); });
    } else {
      PNG_MAP = {};
    }

    CHARACTERS = chars.characters || chars.chars || [];
    TEAMS = teams.teams || [];

    el('teamSelect').innerHTML = optionsFrom(TEAMS, '(Optional) Choose a Team');
    const charOpts = optionsFrom(CHARACTERS, 'Choose character');
    for(let i=1;i<=5;i++){
      el(`char${i}`).innerHTML = charOpts;
      el(`char${i}`).addEventListener('change', ()=>{ updatePortrait(i); setResultsLoading(true); maybeAutoSearch(); });
      updatePortrait(i);
    }

    el('teamSelect').addEventListener('change', async ()=>{
      const team = val('teamSelect');
      if(!team){ return; }
      const tmsg = el('teamLoadingMsg');
      tmsg.textContent = 'Loading team…';
      show('teamLoadingMsg');
      try{
        const info = await api('getTeamMembers', { team });
        if(info.ok && info.members){
          info.members.forEach((name,idx) => {
            const sel = el(`char${idx+1}`);
            if (!name) return;
            let i = Array.from(sel.options).findIndex(o => o.value.toLowerCase() === String(name).toLowerCase());
            if (i < 0) { sel.insertAdjacentHTML('beforeend', `<option>${escapeHtml(name)}</option>`); i = Array.from(sel.options).length-1; }
            sel.selectedIndex = i;
            updatePortrait(idx+1);
          });
          setResultsLoading(true);
          maybeAutoSearch();
        }
      } finally {
        hide('teamLoadingMsg');
      }
    });

    el('resetBtn').addEventListener('click', resetUI);
  } catch(e) {
    console.error(e);
    showError('Failed to load data.');
  } finally {
    hide('loadingSpinner');
  }
}

document.addEventListener('DOMContentLoaded', init);
