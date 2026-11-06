const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');

function app(saved) {
  const dom = new JSDOM(readFileSync('index.html', 'utf8'), {
    url: 'https://mapas.example', runScripts: 'dangerously',
    beforeParse(w) {
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      w.HTMLDialogElement.prototype.close = function () { this.open = false; };
      w.alert = () => {};
      w.confirm = () => true;
      if (saved) w.localStorage.setItem(saved.key, JSON.stringify(saved.value));
    }
  });
  // The page editor is a local classic script, loaded explicitly for offline tests.
  if (readFileSync('index.html', 'utf8').includes('src="editor.js"')) {
    dom.window.eval(readFileSync('editor.js', 'utf8'));
  }
  return dom.window;
}
const click = (w, id) => w.document.getElementById(id).click();
const submit = w => w.document.getElementById('pageEditorForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
const field = (w, name) => [...w.document.querySelectorAll('#pageEditorFields label')].find(x => x.firstChild.textContent === name)?.querySelector('input, textarea, select');

test('editing an introduction persists through reload without changing its markup', () => {
  const w = app();
  click(w, 'editToggle');
  const edit = w.document.querySelector('[data-edit-section="intro"]');
  assert.ok(edit, 'the introduction must have an edit action');
  edit.click();
  w.document.querySelector('#pageEditorFields textarea').value = 'Mi comparador actualizado';
  submit(w);
  assert.equal(w.document.querySelector('h1').textContent, 'Mi comparador actualizado');
  const saved = JSON.parse(w.localStorage.getItem('mapa-valor-editable-v2'));
  const reload = app({key: 'mapa-valor-editable-v2', value: saved});
  assert.equal(reload.document.querySelector('h1').textContent, 'Mi comparador actualizado');
  assert.equal(reload.document.querySelectorAll('#intro .skel b').length, 4);
  w.close(); reload.close();
});

test('matrix corrections update calculated readings and can return to automatic', () => {
  const w = app(); click(w, 'editToggle');
  w.document.querySelector('#mx [data-t="amb"]').click();
  assert.ok(field(w, 'La Florida · estado'), 'matrix row must be editable');
  field(w, 'La Florida · estado').value = '1';
  field(w, 'La Florida · evidencia').value = 'Nueva evidencia ambiental';
  submit(w);
  assert.match(w.document.querySelector('#mx [data-t="amb"]').textContent, /Nueva evidencia ambiental/);
  assert.match(w.document.querySelector('[data-summary="two"]').textContent, /Sostenibilidad ambiental/);
  w.document.querySelector('#mx [data-t="amb"]').click(); click(w, 'pageEditorReset');
  assert.doesNotMatch(w.document.querySelector('#mx [data-t="amb"]').textContent, /Nueva evidencia ambiental/);
  w.close();
});

test('exported full state round-trips, accepts legacy backups, and rejects malformed imports atomically', () => {
  const w = app();
  assert.equal(typeof w.snapshot, 'function', 'full-page export must exist');
  const original = w.snapshot();
  const legacy = { E: original.E, shortNames: original.shortNames };
  legacy.E[0].c[0][0] = 'Territorio editado antes';
  w.applyState(w.validateState(legacy));
  assert.equal(w.snapshot().E[0].c[0][0], 'Territorio editado antes');
  const full = w.snapshot();
  full.T[0][1] = '<img src=x onerror=alert(1)>';
  full.E[0].n = '<b>Nombre seguro</b>';
  w.applyState(w.validateState(full));
  assert.equal(w.document.querySelector('#chips img'), null);
  assert.match(w.document.querySelector('#mx').textContent, /<b>Nombre seguro<\/b>/);
  const before = JSON.stringify(w.snapshot());
  const bad = w.snapshot(); bad.E[0].c[0][3].cal = 'not a level';
  assert.throws(() => w.validateState(bad));
  assert.equal(JSON.stringify(w.snapshot()), before);
  w.close();
});

test('unsafe links are rejected and reset restores all sections', () => {
  const w = app(); click(w, 'editToggle');
  const edit = w.document.querySelector('[data-edit-section="individual-maps"]');
  assert.ok(edit, 'individual map links must be editable'); edit.click();
  const url = w.document.querySelector('#pageEditorFields input[type="url"]');
  const original = w.document.querySelector('#individual-maps a').href;
  url.value = 'javascript:alert(1)'; submit(w);
  assert.equal(w.document.querySelector('#individual-maps a').href, original);
  assert.ok(w.document.getElementById('pageEditorError').textContent);
  url.value = 'https://example.com/mapa'; submit(w);
  assert.equal(w.document.querySelector('#individual-maps a').href, 'https://example.com/mapa');
  click(w, 'resetBtn');
  assert.equal(w.document.querySelector('#individual-maps a').href, original);
  assert.equal(w.localStorage.getItem('mapa-valor-editable-v2'), null);
  w.close();
});

test('resetting topic names also restores expanded node details', () => {
  const w = app(); click(w, 'editToggle'); click(w, 'tg');
  w.document.querySelector('[data-edit-topics]').click();
  field(w, 'Tema 1').value = 'Calidad revisada'; submit(w);
  assert.match(w.document.getElementById('allDetails').textContent, /Calidad revisada/);
  w.document.querySelector('[data-edit-topics]').click(); click(w, 'pageEditorReset');
  assert.doesNotMatch(w.document.getElementById('allDetails').textContent, /Calidad revisada/);
  w.close();
});

test('invalid edits cannot corrupt a previously saved full-page snapshot', () => {
  const w = app(); click(w, 'editToggle');
  w.document.querySelector('[data-edit-section="intro"]').click();
  w.document.querySelector('#pageEditorFields textarea').value = 'Título guardado'; submit(w);
  const before = w.localStorage.getItem('mapa-valor-editable-v2');
  w.document.querySelector('[data-edit-summary="three"]').click();
  field(w, 'Lecturas (una por línea)').value = 'x'.repeat(100001); submit(w);
  assert.equal(w.localStorage.getItem('mapa-valor-editable-v2'), before);
  assert.ok(w.document.getElementById('pageEditorError').textContent);
  assert.equal(w.document.querySelector('h1').textContent, 'Título guardado');
  w.close();
});

test('node evidence updates the matrix while custom readings survive filtering', () => {
  const w = app(); click(w, 'editToggle');
  w.document.querySelector('[data-edit-summary="three"]').click();
  field(w, 'Lecturas (una por línea)').value = 'Mi lectura pendiente de validar'; submit(w);
  w.document.querySelector('[data-node="1-0"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  w.document.getElementById('editTitle').value = 'Trabajo en equipo actualizado';
  w.document.querySelector('#nodeTopicFields [data-topic="amb"]').value = '1';
  w.document.getElementById('editForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  assert.match(w.document.querySelector('#mx [data-t="amb"]').textContent, /Trabajo en equipo actualizado/);
  w.document.querySelector('#chips [data-t="amb"]').click();
  assert.match(w.document.querySelector('[data-summary="three"]').textContent, /Mi lectura pendiente de validar/);
  assert.equal(w.snapshot().E[1].c[0][3].amb, 1);
  w.close();
});
