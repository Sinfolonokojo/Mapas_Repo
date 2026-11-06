/* Full-page editing. Content is stored as plain text, never executable HTML. */
const STORAGE_KEY = 'mapa-valor-editable-v2';
const LEGACY_KEY = 'mapa-valor-editable-v1';
const BASE_TOPICS = JSON.parse(JSON.stringify(T));
const SUMMARY_KEYS = ['three', 'two', 'one', 'partial', 'gaps'];
const staticFields = new Map();
const sectionFields = new Map();
let pageEdits = {}, summaryEdits = {};
let editorSave = null, editorReset = null;
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const textValue = value => typeof value === 'string' && value.length <= 100000;
const levelValue = value => [0, 0.5, 1].includes(value);
function validURL(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}
function snapshot() {
  return clone({version: 2, E, shortNames, T, pageEdits, matrixEdits, summaryEdits});
}
function validateState(raw) {
  if (!object(raw) || (raw.version !== undefined && ![1, 2].includes(raw.version))) throw Error('Versión de archivo no compatible.');
  const topics = raw.T ?? BASE_TOPICS;
  const ids = BASE_TOPICS.map(t => t[0]);
  if (!Array.isArray(topics) || topics.length !== ids.length || topics.some((t, i) => !Array.isArray(t) || t[0] !== ids[i] || !textValue(t[1]) || !Number.isFinite(t[2]) || t[2] < 0 || t[2] > 360)) throw Error('Los temas no tienen el formato esperado.');
  const strings = ['n', 'd', 'kind', 'structure', 'core', 'coreLabel', 'generatedLabel', 'st', 'mapTitle'];
  if (!Array.isArray(raw.E) || raw.E.length !== 3 || raw.E.some(e => !object(e) || !textValue(e.n) || strings.some(k => e[k] !== undefined && !textValue(e[k])) || !Array.isArray(e.c) || e.c.length !== 6 || e.c.some(c => !Array.isArray(c) || c.length !== 4 || !c.slice(0, 3).every(textValue) || !object(c[3]) || Object.entries(c[3]).some(([k,v]) => !ids.includes(k) || !levelValue(v))) || (e.extra !== undefined && (!object(e.extra) || Object.entries(e.extra).some(([k,v]) => !ids.includes(k) || !Array.isArray(v) || !levelValue(v[0]) || !textValue(v[1])))))) throw Error('Los datos de las entidades o nodos no son válidos.');
  if (!Array.isArray(raw.shortNames) || raw.shortNames.length !== 3 || raw.shortNames.some(row => !Array.isArray(row) || row.length !== 6 || !row.every(textValue))) throw Error('Las etiquetas de los círculos no son válidas.');
  const page = raw.pageEdits ?? {};
  if (!object(page) || Object.entries(page).some(([k,v]) => !staticFields.has(k) || !textValue(v) || (staticFields.get(k).type === 'url' && !validURL(v)))) throw Error('El contenido contiene un campo desconocido o un enlace inválido. Usa enlaces https:// o http://.');
  const matrix = raw.matrixEdits ?? {};
  if (!object(matrix) || Object.entries(matrix).some(([id, cells]) => !ids.includes(id) || !object(cells) || Object.entries(cells).some(([ei, cell]) => !['0','1','2'].includes(ei) || !object(cell) || !levelValue(cell.level) || !textValue(cell.note)))) throw Error('Las correcciones de la matriz no son válidas.');
  const summaries = raw.summaryEdits ?? {};
  if (!object(summaries) || Object.entries(summaries).some(([k,v]) => !SUMMARY_KEYS.includes(k) || !object(v) || !textValue(v.title) || !textValue(v.body) || (k === 'partial' && (!textValue(v.secondaryTitle) || !textValue(v.secondaryBody))))) throw Error('Las lecturas no tienen el formato esperado.');
  return clone({version: 2, E: raw.E, shortNames: raw.shortNames, T: topics, pageEdits: page, matrixEdits: matrix, summaryEdits: summaries});
}
function applyState(state) {
  E = clone(state.E); shortNames = clone(state.shortNames); T = clone(state.T);
  pageEdits = clone(state.pageEdits); matrixEdits = clone(state.matrixEdits); summaryEdits = clone(state.summaryEdits);
  closeEditor(); draw();
  if (!$('allDetails').hidden) renderAllDetails();
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()));
    $('saveStatus').textContent = 'Cambios guardados en este navegador.';
  } catch {
    $('saveStatus').textContent = 'No se pudo guardar en este navegador. Exporta los cambios para conservarlos.';
  }
}
function exportChanges() {
  const blob = new Blob([JSON.stringify(snapshot(), null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mapas-de-valor-cambios.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importChanges(file) {
  if (file.size > 5000000) { alert('El archivo supera el límite de 5 MB.'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try { const state = validateState(JSON.parse(reader.result)); applyState(state); persist(); alert('Se importaron todos los cambios.'); }
    catch (error) { alert('No se importaron cambios. ' + error.message); }
  };
  reader.onerror = () => alert('No se pudo leer el archivo.'); reader.readAsText(file);
}

// Move editing controls above the content so every section is discoverable.
const toolbar = document.createElement('div'); toolbar.id = 'pageToolbar'; toolbar.className = 'page-toolbar';
document.querySelector('main').prepend(toolbar);
const actions = document.createElement('div'); actions.className = 'editor-actions'; toolbar.append(actions);
for (const id of ['editToggle','exportBtn','importFile','resetBtn']) {
  if (id === 'importFile') actions.append(document.querySelector('label[for="importFile"]'));
  actions.append($(id));
}
const importLabel = toolbar.querySelector('label[for="importFile"]');
importLabel.tabIndex = 0; importLabel.setAttribute('role', 'button');
importLabel.addEventListener('keydown', ev => { if (['Enter', ' '].includes(ev.key)) { ev.preventDefault(); $('importFile').click(); } });
toolbar.append($('editNote'));
$('editNote').textContent = 'Activa la edición para modificar cada apartado. Los cambios se guardan en este navegador; exporta el archivo para compartirlos.';
const status = document.createElement('p'); status.id = 'saveStatus'; status.className = 'note'; status.setAttribute('role','status'); toolbar.append(status);
document.querySelector('main').prepend(toolbar);

// Keep references to text nodes to preserve bold text, links, tables and other markup.
for (const section of document.querySelectorAll('[data-section-name]')) {
  const fields = [];
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent.trim() || node.parentElement.closest('#chips,#legend,#cols,#nodeDetail,#editForm,#allDetails,#mx,#sum,button,input,label,script')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) {
    const key = section.id + '-text-' + fields.length;
    const parent = node.parentElement;
    const label = /^H[1-6]$/.test(parent.tagName) ? 'Título' : parent.closest('a') ? 'Texto del enlace' : parent.closest('th') ? 'Encabezado de columna' : 'Texto';
    const field = {key, type:'textarea', label: label + ' · ' + (fields.length + 1), base:node.textContent, node};
    fields.push(field); staticFields.set(key, field);
  }
  [...section.querySelectorAll('a[href]')].forEach((link, index) => {
    const key = section.id + '-link-' + index;
    const field = {key, type:'url', label:'Enlace · ' + link.textContent, base:link.getAttribute('href'), node:link};
    fields.push(field); staticFields.set(key,field);
  });
  sectionFields.set(section.id, fields);
  const button = document.createElement('button'); button.type = 'button'; button.className = 't section-edit';
  button.dataset.editSection = section.id; button.textContent = 'Editar ' + section.dataset.sectionName.toLowerCase(); section.prepend(button);
}
const extraActions = document.createElement('div'); extraActions.className = 'editor-actions section-edit';
extraActions.innerHTML = '<button class="t" type="button" data-edit-entities>Editar entidades y encabezados del mapa</button><button class="t" type="button" data-edit-topics>Editar temas</button>';
$('structure').insertBefore(extraActions, $('chips'));
const dialog = document.createElement('dialog'); dialog.id = 'pageEditor'; dialog.setAttribute('aria-labelledby', 'pageEditorTitle');
dialog.innerHTML = '<form id="pageEditorForm"><h2 id="pageEditorTitle"></h2><p class="s" id="pageEditorHelp"></p><div id="pageEditorFields"></div><p id="pageEditorError" role="alert"></p><div class="editor-actions"><button type="submit" class="t primary">Guardar cambios</button><button type="button" class="t" id="pageEditorCancel">Cancelar</button><button type="button" class="t" id="pageEditorReset">Volver al contenido original</button></div></form>';
document.body.append(dialog);
function openPageEditor(title, fields, onSave, onReset, help = 'Edita los campos y guarda los cambios. Cancelar conserva el contenido anterior.') {
  $('pageEditorTitle').textContent = title; $('pageEditorHelp').textContent = help; $('pageEditorFields').replaceChildren(); $('pageEditorError').textContent = '';
  for (const field of fields) {
    const label = document.createElement('label'); label.append(document.createTextNode(field.label));
    const input = document.createElement(field.options ? 'select' : field.type === 'url' ? 'input' : 'textarea');
    if (field.options) for (const [value,text] of field.options) { const option = document.createElement('option'); option.value = value; option.textContent = text; input.append(option); }
    if (field.type === 'url') input.type = 'url';
    if (!field.options) input.maxLength = 100000;
    if (input.tagName === 'TEXTAREA') input.rows = String(field.value ?? '').length > 140 ? 4 : 2;
    input.name = field.key; input.value = field.value ?? ''; label.append(input); $('pageEditorFields').append(label);
  }
  editorSave = onSave; editorReset = onReset; $('pageEditorReset').hidden = !onReset;
  dialog.showModal();
}
$('pageEditorForm').onsubmit = ev => {
  ev.preventDefault();
  const values = Object.fromEntries(new FormData($('pageEditorForm')));
  const previous = snapshot();
  try { editorSave(values); applyState(validateState(snapshot())); persist(); dialog.close(); }
  catch(error) { applyState(previous); $('pageEditorError').textContent = error.message; }
};
$('pageEditorCancel').onclick = () => dialog.close();
$('pageEditorReset').onclick = () => { if (editorReset) { editorReset(); applyState(snapshot()); persist(); dialog.close(); } };
function editSection(id) {
  const fields = sectionFields.get(id);
  openPageEditor('Editar ' + $(id).dataset.sectionName.toLowerCase(), fields.map(f => ({...f, value: pageEdits[f.key] ?? f.base})), values => {
    for (const f of fields) if (!textValue(values[f.key]) || (f.type === 'url' && !validURL(values[f.key]))) throw Error('Usa un enlace completo que empiece por https:// o http://.');
    Object.assign(pageEdits, values);
  }, () => fields.forEach(f => delete pageEdits[f.key]));
}
function editEntities() {
  const defaults = ['MAPA DE CADENA Y ORGANIZACIÓN','MAPA DE VALORES','MAPA DE VALORES Y RELACIONES'];
  const properties = [['n','Nombre de la entidad'],['mapTitle','Encabezado del mapa'],['generatedLabel','Etiqueta del valor generado']];
  openPageEditor('Editar entidades', E.flatMap((e,i) => properties.map(([key,label]) => ({key:i+'-'+key,label:(i+1)+'. '+label,value:e[key] ?? (key === 'mapTitle' ? defaults[i] : 'Valor generado')}))), values => {
    E.forEach((e,i) => properties.forEach(([key]) => { e[key] = values[i+'-'+key]; }));
  }, () => E.forEach((e,i) => properties.forEach(([key]) => { if (BASE_E[i][key] === undefined) delete e[key]; else e[key] = BASE_E[i][key]; })));
}
function editTopics() {
  openPageEditor('Editar nombres de los temas', T.map((t,i) => ({key:t[0],label:'Tema '+(i+1),value:t[1]})), values => T.forEach(t => {t[1] = values[t[0]];}), () => {T = clone(BASE_TOPICS);}, 'Los nombres se actualizarán en filtros, leyenda, nodos, matriz y lecturas automáticas.');
}
const levelOptions = [['0','○ Sin evidencia explícita'],['0.5','◐ Indicio parcial'],['1','● Evidencia explícita']];
function editMatrix(id) {
  const fields = E.flatMap((e,i) => {const result=lv(e,id); return [{key:i+'-level',label:e.n+' · estado',value:result[0],options:levelOptions},{key:i+'-note',label:e.n+' · evidencia',value:result[1].join(' · ')}];});
  openPageEditor('Matriz · '+T.find(t => t[0] === id)[1], fields, values => {
    matrixEdits[id] = Object.fromEntries(E.map((e,i) => [i,{level:Number(values[i+'-level']),note:values[i+'-note']} ]));
  }, () => delete matrixEdits[id], 'Puedes corregir el estado y la evidencia de cada entidad. «Volver al contenido original» recupera el cálculo automático de los nodos.');
}
function editSummary(key) {
  const box = document.querySelector('[data-summary="'+key+'"]');
  const titles = box.querySelectorAll('h4'), lists = box.querySelectorAll('ul');
  const fields = [{key:'title',label:'Título de la lectura',value:titles[0].textContent},{key:'body',label:'Lecturas (una por línea)',value:[...lists[0].children].map(li=>li.textContent).join('\n')}];
  if(key === 'partial') fields.push({key:'secondaryTitle',label:'Título de temas sin evidencia',value:titles[1].textContent},{key:'secondaryBody',label:'Temas sin evidencia (uno por línea)',value:[...lists[1].children].map(li=>li.textContent).join('\n')});
  openPageEditor('Editar lectura', fields, values => {summaryEdits[key] = values;}, () => delete summaryEdits[key], 'Una lectura personalizada se conserva aunque cambie la matriz. Vuelve al contenido original para recuperar las lecturas automáticas.');
}
function refreshEditing() {
  if (!sectionFields.size) return;
  document.body.classList.toggle('editing', editMode);
  for (const field of staticFields.values()) {
    const value = pageEdits[field.key] ?? field.base;
    if(field.type === 'url') field.node.setAttribute('href', value); else field.node.textContent = value;
  }
  document.title = document.querySelector('h1').textContent;
  [...$('sum').children].forEach((box,i) => {
    const key = SUMMARY_KEYS[i]; if (!key) return;
    box.dataset.summary = key;
    const override = summaryEdits[key];
    if (override) {
      const titles = box.querySelectorAll('h4'), lists = box.querySelectorAll('ul');
      titles[0].textContent = override.title;
      const replaceList = (list, text) => { list.replaceChildren(); text.split('\n').filter(line=>line.trim()).forEach(line => {const li=document.createElement('li');li.textContent=line;list.append(li);}); };
      replaceList(lists[0], override.body);
      if (key === 'partial') {titles[1].textContent = override.secondaryTitle;replaceList(lists[1],override.secondaryBody);}
    }
    const button=document.createElement('button');button.type='button';button.className='t section-edit';button.dataset.editSummary=key;button.textContent='Editar lectura';box.append(button);
    if(override){const tag=document.createElement('p');tag.className='note';tag.textContent='Lectura personalizada';box.append(tag);}
  });
  for(const row of $('mx').querySelectorAll('[data-t]')) {row.tabIndex=0;row.setAttribute('aria-label',(editMode?'Editar tema: ':'Filtrar tema: ')+T.find(t=>t[0]===row.dataset.t)[1]);}
}
function renderNodeTopicFields(c) {
  let container = $('nodeTopicFields');
  if(!container) {container=document.createElement('fieldset');container.id='nodeTopicFields';$('editForm').insertBefore(container,$('editForm').querySelector('.skel'));}
  container.replaceChildren(); const legend=document.createElement('legend');legend.textContent='Temas y nivel de evidencia';container.append(legend);
  for(const t of T){const label=document.createElement('label');label.textContent=t[1];const select=document.createElement('select');select.dataset.topic=t[0];for(const [value,text] of levelOptions){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=String(c[3][t[0]]||0);label.append(select);container.append(label);}
}
function saveNodeTopics(c) {
  c[3] = {};
  for(const select of $('nodeTopicFields').querySelectorAll('select')) if(Number(select.value)>0)c[3][select.dataset.topic]=Number(select.value);
  if(!$('allDetails').hidden)renderAllDetails();
}
document.addEventListener('click', ev => {
  const target = ev.target.closest('[data-edit-section],[data-edit-entities],[data-edit-topics],[data-edit-summary],#mx [data-t]');
  if (!editMode || !target) return;
  ev.preventDefault(); ev.stopPropagation();
  if(target.dataset.editSection) editSection(target.dataset.editSection);
  else if(target.hasAttribute('data-edit-entities'))editEntities();
  else if(target.hasAttribute('data-edit-topics'))editTopics();
  else if(target.dataset.editSummary)editSummary(target.dataset.editSummary);
  else editMatrix(target.dataset.t);
}, true);
document.addEventListener('keydown', ev => {
  const row=ev.target.closest('#mx [data-t]');
  if(row && ['Enter',' '].includes(ev.key)){ev.preventDefault();if(editMode)editMatrix(row.dataset.t);else {sel=sel===row.dataset.t?null:row.dataset.t;draw();}}
});
$('editToggle').onclick = () => {
  editMode = !editMode;
  $('editToggle').textContent = editMode ? 'Terminar edición' : 'Activar edición';
  $('editToggle').setAttribute('aria-pressed',String(editMode));
  if(!editMode)closeEditor();draw();
};
$('cancelEdit').onclick = closeEditor;
for (const input of $('editForm').querySelectorAll('input,textarea')) input.maxLength = 100000;
$('exportBtn').onclick = exportChanges;
$('importFile').onchange = ev => {if(ev.target.files[0])importChanges(ev.target.files[0]);ev.target.value='';};
$('resetBtn').onclick = () => {
  if(!confirm('¿Restaurar todos los apartados y borrar los cambios guardados en este navegador?'))return;
  selectedNode=null;sel=null;applyState(validateState({E:BASE_E,shortNames:BASE_LABELS}));
  try {localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_KEY);$('saveStatus').textContent='Versión base restaurada.';}
  catch {$('saveStatus').textContent='Vista restaurada. No se pudo borrar el guardado del navegador.';}
};
try {
  const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
  if(saved) applyState(validateState(JSON.parse(saved))); else draw();
} catch {
  $('saveStatus').textContent='No se pudieron cargar los cambios guardados. La versión base sigue disponible.';draw();
}
