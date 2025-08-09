
(()=>{
  const el=s=>document.querySelector(s);
  const storageKey='gppn.multi.recipes.v1';
  let state={recipes:load(),search:'',tagFilter:'',sort:'updatedDesc'};

  const list=el('#recipeList'), searchInput=el('#searchInput'), sortSelect=el('#sortSelect'),
        tagChips=el('#tagChips'), dialog=el('#recipeDialog'), form=el('#recipeForm'),
        newBtn=el('#newRecipeBtn'), exportBtn=el('#exportBtn'), importInput=el('#importInput'),
        dialogTitle=el('#dialogTitle'), aiDialog=el('#aiDialog'), aiFab=el('#aiFab'),
        aiInput=el('#aiInput'), aiResult=el('#aiResult'), aiAskBtn=el('#aiAskBtn'),
        apiKeyInput=el('#apiKeyInput'), saveKeyBtn=el('#saveKeyBtn'), clearKeyBtn=el('#clearKeyBtn'),
        keyStatus=el('#keyStatus');

  // events
  newBtn.addEventListener('click',()=>openForm());
  exportBtn.addEventListener('click',exportJSON);
  importInput.addEventListener('change',importJSON);
  searchInput.addEventListener('input',e=>{state.search=e.target.value.trim();render();});
  sortSelect.addEventListener('change',e=>{state.sort=e.target.value;render();});
  el('#cancelBtn').addEventListener('click',()=>{ if(dialog.close) dialog.close(); else dialog.removeAttribute('open'); });

  aiFab.addEventListener('click',()=>{
    (aiDialog.showModal?aiDialog.showModal():aiDialog.setAttribute('open',''));
    const saved = localStorage.getItem('gppn.apiKey') || '';
    if(apiKeyInput){ apiKeyInput.value = saved; }
    if(keyStatus) keyStatus.textContent = saved ? '🔐 키 저장됨' : '🧪 키 미설정(데모 응답)';
  });

  saveKeyBtn?.addEventListener('click',()=>{
    const v=apiKeyInput.value.trim();
    if(!v){ alert('키를 입력해주세요 (sk-...)'); return; }
    localStorage.setItem('gppn.apiKey', v);
    if(keyStatus) keyStatus.textContent='🔐 저장 완료';
    alert('API 키 저장 완료');
  });
  clearKeyBtn?.addEventListener('click',()=>{
    localStorage.removeItem('gppn.apiKey'); if(apiKeyInput) apiKeyInput.value=''; if(keyStatus) keyStatus.textContent='🧪 키 삭제';
  });

  aiAskBtn?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const q = (aiInput?.value || '').trim(); if(!q) return;
    const key = localStorage.getItem('gppn.apiKey');
    aiResult.textContent = key ? '생각 중…' : '🧪 데모: 키가 없어 예시 답을 보여줘요.\n\n' + demoAI();
    if(!key) return;
    try{
      const model='gpt-4o-mini';
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
        body:JSON.stringify({model, messages:[{role:'system',content:'너는 디저트 보조셰프. 한국어로 간단명료하게.'},{role:'user',content:q}], temperature:0.7})
      });
      if(!r.ok){ aiResult.textContent='❌ 실패: '+r.status+' '+(await r.text()).slice(0,200); return; }
      const data=await r.json();
      aiResult.textContent=data.choices?.[0]?.message?.content || '(응답 없음)';
    }catch(err){ aiResult.textContent='❌ 네트워크 오류: '+(err?.message||err); }
  });

  function demoAI(){
    return [
      "• 재료 분석: '말차, 우유, 달걀' → 말차 푸딩/말차 크림브륄레 추천",
      "• 단위 변환: 설탕 3 Tbsp ≈ 37~40 g",
      "• 시간 스케줄: 굽기 20분 + 휴지 10분 → 총 30분",
      "• 대체 재료: 버터→식물성 마가린(풍미↓), 우유→두유(수분 조절 필요)"
    ].join("\n");
  }

  form.addEventListener('submit',e=>{
    e.preventDefault();
    const data=formToRecipe(new FormData(form));
    if(!data.title) return;
    if(form.dataset.editId){
      const idx=state.recipes.findIndex(r=>r.id===form.dataset.editId);
      if(idx!==-1){ data.id=state.recipes[idx].id; data.createdAt=state.recipes[idx].createdAt; data.updatedAt=Date.now(); state.recipes[idx]=data; }
    }else{
      data.id=crypto.randomUUID(); data.createdAt=Date.now(); data.updatedAt=Date.now(); state.recipes.unshift(data);
    }
    save(); if(dialog.close) dialog.close(); render();
  });

  function formToRecipe(fd){
    const get=n=>(fd.get(n)||'').toString().trim();
    const parseLines=v=>get(v).split(/\r?\n/).map(s=>s.replace(/^\d+\)\s*/,'').trim()).filter(Boolean);
    const parseTags=v=>get(v).split(',').map(s=>s.trim()).filter(Boolean);
    return { title:get('title'), difficulty:get('difficulty'), time:get('time')?Number(get('time')):null,
      yield:get('yield'), tags:parseTags('tags'), image:get('image'), summary:get('summary'),
      ingredients:parseLines('ingredients'), steps:parseLines('steps'), notes:get('notes') };
  }

  function load(){
    try{ const raw=localStorage.getItem(storageKey); if(!raw) return demo();
      const data=JSON.parse(raw); return Array.isArray(data)?data:demo(); }catch{ return demo(); }
  }
  function save(){ localStorage.setItem(storageKey, JSON.stringify(state.recipes)); updateTags(); }

  function exportJSON(){
    const data = JSON.stringify(state.recipes, null, 2);
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isWebView = isIOS && !isSafari; // Shortcuts/앱 내 웹뷰

    if(isWebView && navigator.clipboard){
      navigator.clipboard.writeText(data).then(()=> showToast('복사 완료! 메모/파일에 붙여넣으세요.') );
      return;
    }
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='dessert-recipes.json'; a.click(); URL.revokeObjectURL(url);
  }

  function importJSON(e){
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const arr = JSON.parse(reader.result);
        if(!Array.isArray(arr)) throw 0;
        const map = new Map(state.recipes.map(r=>[r.id,r]));
        for(const r of arr){
          if(r.id && map.has(r.id)) continue;
          r.id = r.id || crypto.randomUUID();
          r.createdAt = r.createdAt || Date.now();
          r.updatedAt = Date.now();
          state.recipes.push(r);
        }
        save(); render();
      }catch{ alert('불러오기에 실패했어요. JSON 형식을 확인해주세요.'); }
    };
    reader.readAsText(file); e.target.value='';
  }

  function render(){
    const q = state.search.toLowerCase();
    const filtered = state.recipes.filter(r=>{
      const hay=[r.title,r.summary,(r.ingredients||[]).join(' '),(r.tags||[]).join(' ')].join(' ').toLowerCase();
      const matchQ = !q || hay.includes(q);
      const matchTag = !state.tagFilter || (r.tags||[]).includes(state.tagFilter);
      return matchQ && matchTag;
    }).sort((a,b)=>{
      switch(state.sort){
        case 'titleAsc': return (a.title||'').localeCompare(b.title||'');
        case 'timeAsc': return (a.time||1e12)-(b.time||1e12);
        case 'timeDesc': return (b.time||-1)-(a.time||-1);
        default: return (b.updatedAt||0)-(a.updatedAt||0);
      }
    });

    const main=document.querySelector('main');
    main.querySelector('#recipeList')?.remove();
    const ul=document.createElement('ul'); ul.id='recipeList'; ul.className='cards';
    main.insertBefore(ul, document.getElementById('aiFab'));

    if(!filtered.length){
      const div=document.createElement('div'); div.className='empty'; div.textContent='레시피가 없어요. 위에서 새 레시피를 추가해보세요!';
      main.insertBefore(div, document.getElementById('aiFab')); return;
    }
    for(const r of filtered) ul.appendChild(card(r));
  }

  function card(r){
    const tpl=document.querySelector('#recipeCardTmpl').content.cloneNode(true);
    const li=tpl.querySelector('.card');
    const thumb=tpl.querySelector('.thumb');
    const title=tpl.querySelector('.title');
    const summary=tpl.querySelector('.summary');
    const time=tpl.querySelector('.time');
    const diff=tpl.querySelector('.diff');
    const yd=tpl.querySelector('.yield');
    const tags=tpl.querySelector('.tags');
    const ing=tpl.querySelector('.ing');
    const steps=tpl.querySelector('.steps');
    const notes=tpl.querySelector('.notes');
    const editBtn=tpl.querySelector('.edit');
    const delBtn=tpl.querySelector('.delete');
    const dupBtn=tpl.querySelector('.dup');

    title.textContent=r.title||'(제목 없음)';
    summary.textContent=r.summary||'';
    time.textContent=r.time?`⏱ ${r.time}분`:'⏱ 시간 미입력';
    diff.textContent=r.difficulty?`🧁 ${r.difficulty}`:'🧁 난이도 미입력';
    yd.textContent=r.yield?`🍽 ${r.yield}`:'';
    if(r.image) thumb.style.backgroundImage=`url('${r.image}')`;

    (r.tags||[]).forEach(t=>{ const s=document.createElement('span'); s.className='tag'; s.textContent=`#${t}`;
      s.addEventListener('click',()=>{state.tagFilter=t; updateTags(); render();}); tags.appendChild(s); });
    (r.ingredients||[]).forEach(i=>{ const li=document.createElement('li'); li.textContent=i; ing.appendChild(li); });
    (r.steps||[]).forEach(s=>{ const li=document.createElement('li'); li.textContent=s; steps.appendChild(li); });
    notes.textContent=r.notes||'';

    editBtn.addEventListener('click',()=>openForm(r));
    delBtn.addEventListener('click',()=>{ if(confirm('이 레시피를 삭제할까요?')){ state.recipes=state.recipes.filter(x=>x.id!==r.id); save(); render(); } });
    dupBtn.addEventListener('click',()=>{ const copy=JSON.parse(JSON.stringify(r)); copy.id=crypto.randomUUID(); copy.title=r.title+' (복제)'; copy.createdAt=Date.now(); copy.updatedAt=Date.now(); state.recipes.unshift(copy); save(); render(); });

    return li;
  }

  function updateTags(){
    const all=new Set(); for(const r of state.recipes) (r.tags||[]).forEach(t=>all.add(t));
    tagChips.innerHTML='';
    if(state.tagFilter){
      const clear=document.createElement('button'); clear.textContent=`태그 해제: #${state.tagFilter}`;
      clear.addEventListener('click',()=>{ state.tagFilter=''; render(); updateTags(); }); tagChips.appendChild(clear);
    }
    for(const t of Array.from(all).sort((a,b)=>a.localeCompare(b))){
      const b=document.createElement('button'); b.textContent=`#${t}`; b.addEventListener('click',()=>{ state.tagFilter=t; render(); updateTags(); }); tagChips.appendChild(b);
    }
  }

  function openForm(r=null){
    form.reset(); delete form.dataset.editId; document.querySelector('#dialogTitle').textContent='새 레시피';
    if(r){ document.querySelector('#dialogTitle').textContent='레시피 수정'; form.title.value=r.title||''; form.difficulty.value=r.difficulty||'';
      form.time.value=r.time||''; form.yield.value=r.yield||''; form.tags.value=(r.tags||[]).join(', ');
      form.image.value=r.image||''; form.summary.value=r.summary||''; form.ingredients.value=(r.ingredients||[]).join('\n');
      form.steps.value=(r.steps||[]).map((s,i)=>`${i+1}) ${s}`).join('\n'); form.notes.value=r.notes||''; form.dataset.editId=r.id; }
    if(dialog.showModal) dialog.showModal(); else dialog.setAttribute('open','');
  }

  function showToast(t){ const toast=document.querySelector('#toast'); toast.textContent=t; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'), 1400); }

  function demo(){ return [{
    id:crypto.randomUUID(), title:'바닐라 빈 푸딩',
    summary:'심플하지만 품격 있는 기본 푸딩. 마다가스카르 바닐라의 향이 포인트.',
    difficulty:'초급', time:35, yield:'4인분', tags:['기본','푸딩','프랑스'], image:'',
    ingredients:['우유 500ml','생크림 200ml','설탕 70g','달걀 3개','바닐라 빈 1/2개','소금 한 꼬집'],
    steps:['오븐 150°C 예열','우유+크림+바닐라 데워 향 우려내기','달걀+설탕 섞기','따뜻한 우유 혼합물 조금씩 넣어 섞기','체에 걸러 중탕으로 30분 굽기','식혀서 냉장'],
    notes:'설탕 일부를 흑설탕으로 바꾸면 풍미 업.', createdAt:Date.now(), updatedAt:Date.now()
  }]; }

  updateTags(); render();
})();
