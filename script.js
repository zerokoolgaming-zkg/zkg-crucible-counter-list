/* ZKG v4.78 Frontend */
const API_URL = window.API_URL; // embedded in index.html
const teamSelect = document.getElementById("teamSelect");
const charSelects = [...document.querySelectorAll(".charSelect")];
const resultEl = document.getElementById("result");
const resetBtn = document.getElementById("resetBtn");
const loadingLine = document.getElementById("loadingLine");

let CHARACTERS=[], TEAMS=[], PNG_MAP={};

init();

async function init(){
  lock(true);
  try{
    await loadAll();
    buildTeamDropdown();
    buildCharacterDropdowns();
    hookPreviewUpdates();
    resultEl.textContent = "Choose exactly 5 characters to search.";
  }catch(err){
    resultEl.textContent = "Failed to load data. Check API URL in index.html.";
  }finally{
    lock(false);
  }
}

function lock(s){[...document.querySelectorAll("select,button")].forEach(el=>el.disabled=s);}

async function loadAll(){
  const [chars, tms, pngs] = await Promise.all([
    fetch(`${API_URL}?action=getCharacters`).then(r=>r.json()),
    fetch(`${API_URL}?action=getTeams`).then(r=>r.json()),
    fetch(`${API_URL}?action=getPNGs`).then(r=>r.json())
  ]);
  if(chars.ok) CHARACTERS = chars.characters||[];
  if(tms.ok) TEAMS = (tms.teams||[]);
  if(pngs.ok) PNG_MAP = pngs.map||{};
}

function buildTeamDropdown(){
  teamSelect.innerHTML = `<option value="">(Optional) Choose a Team</option>` +
    TEAMS.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  teamSelect.addEventListener("change", async () => {
    if(!teamSelect.value) return;
    try{
      const r = await fetch(`${API_URL}?action=getTeamMembers&team=${encodeURIComponent(teamSelect.value)}`);
      const data = await r.json();
      if(data.ok){
        data.members.slice(0,5).forEach((m,i)=>{
          if(charSelects[i]){
            charSelects[i].value = m;
            updatePreviewForSelect(charSelects[i]);
          }
        });
        tryAutoSearch();
      }
    }catch(_){}
  });
}

function buildCharacterDropdowns(){
  const opts = `<option value="">Choose character</option>` +
    CHARACTERS.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  charSelects.forEach(sel => sel.innerHTML = opts);
}

function hookPreviewUpdates(){
  charSelects.forEach(sel => sel.addEventListener("change", ev => {
    updatePreviewForSelect(ev.target);
    tryAutoSearch();
  }));
  charSelects.forEach(sel => updatePreviewForSelect(sel));
  resetBtn.addEventListener("click", resetUI);
}

function norm(s){
  return (s||'').toLowerCase()
    .replace(/_/g,' ').replace(/\u00A0/g,' ')
    .replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[’‘`]/g,"'")
    .replace(/[(){}\[\].,;:!?/\\\-–—\"“”‘’]/g,'').replace(/\s+/g,' ').trim();
}

function imgFor(name){ return PNG_MAP[norm(name)] || ""; }

function updatePreviewForSelect(sel){
  const block = sel.closest(".dropdown-block");
  const imgEl = block.querySelector(".preview img");
  const ph = block.querySelector(".preview .missing-ph");
  const url = imgFor(sel.value);
  if(url){ imgEl.src = url; imgEl.style.display='block'; ph.style.display='none'; }
  else { imgEl.removeAttribute('src'); imgEl.style.display='none'; ph.style.display='flex'; }
}

function resetUI(){
  teamSelect.value = "";
  charSelects.forEach(s=>{ s.selectedIndex=0; updatePreviewForSelect(s); });
  resultEl.classList.add('muted'); resultEl.textContent = "Choose exactly 5 characters to search.";
}

function tryAutoSearch(){
  const members = charSelects.map(s=>s.value).filter(Boolean);
  if(members.length===5){ onSearch(members); }
}

async function onSearch(members){
  loadingLine.classList.remove("hidden");
  resultEl.classList.remove('muted');
  resultEl.textContent = "Searching…";
  try{
    const r = await fetch(`${API_URL}?action=findCounters&members=${encodeURIComponent(members.join('|'))}`);
    const d = await r.json();
    if(!d.ok || !d.results || !d.results.length){
      resultEl.classList.add('muted'); resultEl.textContent = "No 5-character team match found.";
      return;
    }
    resultEl.innerHTML = d.results.map((m,i)=>{
      const row = (m.counterTeam||[]).map(name => {
        const img = imgFor(name);
        return `<div class="counter-box">
          ${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(name)}"/>` : ""}
          <div style="margin-top:6px;font-weight:700">${escapeHtml(name)}</div>
        </div>`;
      }).join('');
      const info = m.extraInfo || "";
      return `<div class="match-card">
        <h3>Match #${i+1}</h3>
        <div class="counter-grid">${row}</div>
        ${info}
      </div>`;
    }).join('');
  }catch(e){
    resultEl.classList.add('muted'); resultEl.textContent = "Error: "+e.message;
  }finally{
    loadingLine.classList.add("hidden");
  }
}

function escapeHtml(s){return (s==null?'':String(s)).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
