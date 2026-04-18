'use strict';

const obsidian = require('obsidian');

/* ============================================
   AP SMART Counter — Plugin Principal
   ============================================
   Contador de clientes para Objetivo SMART:
   S/4,000 mensuales · 20 clientes · S/50/semana
   ============================================ */

const VIEW_TYPE = 'ap-counter-view';

const DEFAULT_DATA = {
  currentClients: 0,
  targetClients: 20,
  weeklyPrice: 50,
  monthlyTarget: 4000,
  totalWeeks: 12,
  startDate: '',
  showOnStartup: true,
  clientLog: [],
  milestones: [
    { at: 1,  label: 'Primer cliente beta',           done: false },
    { at: 5,  label: 'Validación inicial (5)',         done: false },
    { at: 10, label: 'Mitad del camino (10)',          done: false },
    { at: 15, label: 'Tracción fuerte (15)',           done: false },
    { at: 20, label: 'Objetivo SMART completado (20)', done: false },
  ],
};

const FOCUS_QUESTIONS = {
  0:  '¿Quién es la primera persona que encaja con tu perfil de cliente ideal?',
  1:  'Ya tienes 1. ¿Qué aprendiste de esa primera venta que puedas replicar?',
  3:  'Tienes impulso. ¿Estás pidiendo referidos a tus clientes actuales?',
  5:  '5 clientes = validación. ¿Ya tienes tu primer testimonio?',
  8:  '¿Tu proceso de entrega sigue funcionando o necesita ajustes?',
  10: 'Mitad del camino. ¿Estás actuando como AP o como consumidor?',
  13: 'La tracción es real. ¿Qué puedes automatizar para liberar tiempo?',
  15: '75% del objetivo. ¿Qué excusa te estás diciendo que debes confrontar?',
  18: 'Casi llegas. ¿Estás manteniendo la calidad con cada cliente?',
  20: 'Objetivo alcanzado. ¿Qué sistema necesitas para sostener esto?',
};

function getPhase(current, target) {
  const pct = target > 0 ? current / target : 0;
  if (pct >= 1)    return 'done';
  if (pct >= 0.5)  return 'good';
  if (pct >= 0.25) return 'mid';
  return 'start';
}

function getFocusQuestion(current) {
  let question = FOCUS_QUESTIONS[0];
  const keys = Object.keys(FOCUS_QUESTIONS).map(Number).sort((a, b) => a - b);
  for (const k of keys) {
    if (current >= k) question = FOCUS_QUESTIONS[k];
  }
  return question;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getCurrentWeek(startDate, totalWeeks) {
  if (!startDate) return { current: 0, total: totalWeeks };
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now - start;
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { current: Math.min(Math.max(diffWeeks, 1), totalWeeks), total: totalWeeks };
}

function getCountdown(startDate, totalWeeks) {
  if (!startDate) return { days: totalWeeks * 7, weeks: totalWeeks, started: false, expired: false };
  const start = new Date(startDate);
  const end = new Date(start.getTime() + totalWeeks * 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = end - now;
  if (diffMs <= 0) return { days: 0, weeks: 0, started: true, expired: true };
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  const weeks = Math.ceil(days / 7);
  return { days, weeks, started: true, expired: false };
}

function animateCount(el, target, duration) {
  duration = duration || 1800;
  if (target === 0) { el.textContent = '0'; return; }
  var start = performance.now();
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function tick(now) {
    var elapsed = now - start;
    var progress = Math.min(elapsed / duration, 1);
    var value = Math.round(ease(progress) * target);
    el.textContent = String(value);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function animateRing(circleEl, pct, duration) {
  duration = duration || 1800;
  var circumference = 2 * Math.PI * 52;
  var startOffset = circumference;
  var endOffset = circumference * (1 - Math.min(pct, 100) / 100);
  var start = performance.now();
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function tick(now) {
    var elapsed = now - start;
    var progress = Math.min(elapsed / duration, 1);
    var current = startOffset + (endOffset - startOffset) * ease(progress);
    circleEl.setAttribute('stroke-dashoffset', String(current));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ============================================
   STARTUP MODAL — Guardian Character
   ============================================ */
class APStartupModal extends obsidian.Modal {
  constructor(app, data) {
    super(app);
    this.data = data;
  }

  onOpen() {
    this.modalEl.addClass('ap-modal-wrapper');
    var self = this;
    var contentEl = this.contentEl;
    contentEl.addClass('ap-sm-container');

    var d = this.data;
    var pct = d.targetClients > 0 ? Math.round((d.currentClients / d.targetClients) * 100) : 0;
    var phase = getPhase(d.currentClients, d.targetClients);
    var phaseColors = { start: '#ef4444', mid: '#f59e0b', good: '#22c55e', done: '#06b6d4' };
    var color = phaseColors[phase];
    var monthlyRev = d.currentClients * d.weeklyPrice * 4;
    var question = getFocusQuestion(d.currentClients);
    var countdown = getCountdown(d.startDate, d.totalWeeks);
    var week = getCurrentWeek(d.startDate, d.totalWeeks);

    /* ======== BACKGROUND IMAGE LAYER ======== */
    var pluginDir = this.app.vault.configDir + '/plugins/ap-smart-counter';
    var imgPath = this.app.vault.adapter.getResourcePath(pluginDir + '/Guardian.png');

    var bgLayer = contentEl.createDiv({ cls: 'ap-sm-bg' });
    bgLayer.style.backgroundImage = "url('" + imgPath + "')";

    // Dark gradient overlay
    contentEl.createDiv({ cls: 'ap-sm-overlay' });

    // Eye glow effects (positioned at ~22% from top, each ~38%/62% from left)
    var eyesWrap = contentEl.createDiv({ cls: 'ap-sm-eyes' });
    var eyeL = eyesWrap.createDiv({ cls: 'ap-sm-eye-glow left phase-' + phase });
    var eyeR = eyesWrap.createDiv({ cls: 'ap-sm-eye-glow right phase-' + phase });

    /* ======== CONTENT LAYER ======== */
    var wrap = contentEl.createDiv({ cls: 'ap-startup-modal' });

    // Spacer to push content below the guardian's face
    wrap.createDiv({ cls: 'ap-sm-hero-spacer' });

    // Phase badge
    var phaseLabels = {
      start: 'MODO: DETERMINACI\u00D3N',
      mid: 'MODO: IMPULSO',
      good: 'MODO: TRACCI\u00D3N',
      done: 'MODO: VICTORIA'
    };
    wrap.createDiv({ cls: 'ap-sm-badge phase-' + phase + ' ap-enter-1', text: phaseLabels[phase] });

    // Title
    wrap.createDiv({ cls: 'ap-sm-title ap-enter-1', text: 'Objetivo SMART #1' });
    wrap.createDiv({ cls: 'ap-sm-subtitle ap-enter-2', text: 'Servicio AP Beta' });

    /* ---- SVG RING + COUNTER ---- */
    var ringWrap = wrap.createDiv({ cls: 'ap-ring-wrap ap-enter-3' });

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'ap-ring-svg');

    var circumference = 2 * Math.PI * 52;

    var bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', '60');
    bgCircle.setAttribute('cy', '60');
    bgCircle.setAttribute('r', '52');
    bgCircle.setAttribute('class', 'ap-ring-bg');
    svg.appendChild(bgCircle);

    var fgCircle = document.createElementNS(svgNS, 'circle');
    fgCircle.setAttribute('cx', '60');
    fgCircle.setAttribute('cy', '60');
    fgCircle.setAttribute('r', '52');
    fgCircle.setAttribute('class', 'ap-ring-fg');
    fgCircle.setAttribute('stroke', color);
    fgCircle.setAttribute('stroke-dasharray', String(circumference));
    fgCircle.setAttribute('stroke-dashoffset', String(circumference));
    fgCircle.setAttribute('transform', 'rotate(-90 60 60)');
    svg.appendChild(fgCircle);

    ringWrap.appendChild(svg);

    var counterOverlay = ringWrap.createDiv({ cls: 'ap-ring-counter' });
    var countNum = counterOverlay.createDiv({ cls: 'ap-ring-num' });
    countNum.style.color = color;
    countNum.textContent = '0';
    counterOverlay.createDiv({ cls: 'ap-ring-label', text: 'de ' + d.targetClients });

    setTimeout(function () {
      animateCount(countNum, d.currentClients, 1800);
      animateRing(fgCircle, pct, 1800);
    }, 600);

    /* ---- REVENUE ---- */
    var revRow = wrap.createDiv({ cls: 'ap-sm-revenue ap-enter-4' });
    var revCurrent = revRow.createSpan({ cls: 'ap-sm-rev-current' });
    revCurrent.style.color = color;
    revCurrent.textContent = 'S/' + monthlyRev.toLocaleString();
    revRow.createSpan({ cls: 'ap-sm-rev-arrow', text: ' \u2192 ' });
    revRow.createSpan({ cls: 'ap-sm-rev-target', text: 'S/' + d.monthlyTarget.toLocaleString() });
    wrap.createDiv({ cls: 'ap-sm-rev-label ap-enter-4', text: 'facturaci\u00F3n mensual' });

    /* ---- COUNTDOWN ---- */
    var cdWrap = wrap.createDiv({ cls: 'ap-sm-countdown ap-enter-5' });
    if (!countdown.started) {
      cdWrap.createDiv({ cls: 'ap-cd-icon', text: '\u23F3' });
      cdWrap.createDiv({ cls: 'ap-cd-text', text: d.totalWeeks + ' semanas desde que empieces' });
    } else if (countdown.expired) {
      cdWrap.createDiv({ cls: 'ap-cd-icon', text: '\u23F0' });
      cdWrap.createDiv({ cls: 'ap-cd-text', text: 'Plazo cumplido \u2014 \u00BFlogrado?' });
    } else {
      var cdBlocks = cdWrap.createDiv({ cls: 'ap-cd-blocks' });

      var dBlock = cdBlocks.createDiv({ cls: 'ap-cd-block' });
      var dNum = dBlock.createDiv({ cls: 'ap-cd-num' });
      dNum.textContent = '0';
      dBlock.createDiv({ cls: 'ap-cd-unit', text: 'd\u00EDas' });

      var wBlock = cdBlocks.createDiv({ cls: 'ap-cd-block' });
      var wNum = wBlock.createDiv({ cls: 'ap-cd-num' });
      wNum.textContent = '0';
      wBlock.createDiv({ cls: 'ap-cd-unit', text: 'semanas' });

      var weekBlock = cdBlocks.createDiv({ cls: 'ap-cd-block ap-cd-week-indicator' });
      weekBlock.createDiv({ cls: 'ap-cd-num', text: String(week.current) });
      weekBlock.createDiv({ cls: 'ap-cd-unit', text: 'de ' + week.total });

      setTimeout(function () {
        animateCount(dNum, countdown.days, 1400);
        animateCount(wNum, countdown.weeks, 1400);
      }, 900);
    }

    /* ---- FOCUS QUESTION ---- */
    var qWrap = wrap.createDiv({ cls: 'ap-sm-question ap-enter-6' });
    qWrap.createDiv({ cls: 'ap-sm-q-label', text: 'PREGUNTA DE ENFOQUE' });
    var qText = qWrap.createDiv({ cls: 'ap-sm-q-text' });
    qText.textContent = '\u201C' + question + '\u201D';

    /* ---- CTA BUTTON ---- */
    var btn = wrap.createEl('button', { cls: 'ap-sm-btn ap-enter-7' });
    btn.innerHTML = 'A ejecutar <span class="ap-sm-btn-arrow">\u2192</span>';
    btn.addEventListener('click', function () { self.close(); });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ============================================
   ADD / REMOVE CLIENT MODAL
   ============================================ */
class APClientModal extends obsidian.Modal {
  constructor(app, mode, onSave) {
    super(app);
    this.mode = mode; // 'add' or 'remove'
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    const isAdd = this.mode === 'add';
    const wrap = contentEl.createDiv({ cls: 'ap-add-modal' });

    wrap.createEl('h3', { text: isAdd ? '+ Nuevo Cliente' : '- Baja de Cliente' });

    // Name
    const nameGroup = wrap.createDiv({ cls: 'ap-input-group' });
    nameGroup.createEl('label', { text: 'Nombre o referencia' });
    const nameInput = nameGroup.createEl('input', { type: 'text', placeholder: 'Ej: Juan — referido de Pedro' });

    // Note
    const noteGroup = wrap.createDiv({ cls: 'ap-input-group' });
    noteGroup.createEl('label', { text: isAdd ? 'Nota (cómo lo conseguiste, canal, etc.)' : 'Motivo de baja' });
    const noteInput = noteGroup.createEl('textarea', { placeholder: isAdd ? 'Ej: conversación directa en comunidad X' : 'Ej: no encajaba con el perfil ideal' });

    // Actions
    const actions = wrap.createDiv({ cls: 'ap-modal-actions' });
    const cancelBtn = actions.createEl('button', { cls: 'ap-cancel-btn', text: 'Cancelar' });
    const saveBtn = actions.createEl('button', {
      cls: 'ap-save-btn',
      text: isAdd ? '+ Agregar cliente' : '- Registrar baja',
    });
    if (!isAdd) {
      saveBtn.style.background = '#ef4444';
    }

    cancelBtn.addEventListener('click', () => this.close());
    saveBtn.addEventListener('click', () => {
      this.onSave({
        name: nameInput.value.trim(),
        note: noteInput.value.trim(),
      });
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ============================================
   SIDEBAR VIEW
   ============================================ */
class APCounterView extends obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'AP Counter'; }
  getIcon() { return 'target'; }

  async onOpen() {
    this.render();
  }

  render() {
    const container = this.containerEl.children[1];
    container.empty();

    const root = container.createDiv({ cls: 'ap-counter-root' });
    const d = this.plugin.data;
    const phase = getPhase(d.currentClients, d.targetClients);
    const pct = d.targetClients > 0 ? Math.round((d.currentClients / d.targetClients) * 100) : 0;
    const weeklyRev = d.currentClients * d.weeklyPrice;
    const monthlyRev = weeklyRev * 4;
    const week = getCurrentWeek(d.startDate, d.totalWeeks);

    // Header
    root.createEl('h2', { text: 'Objetivo SMART #1' });
    root.createDiv({ cls: 'ap-subtitle', text: 'Servicio AP Beta · S/4,000 mensuales' });

    // Big number
    const bigNum = root.createDiv({ cls: `ap-big-number phase-${phase}` });
    const numLine = bigNum.createSpan();
    numLine.createSpan({ cls: 'ap-current', text: String(d.currentClients) });
    numLine.createSpan({ cls: 'ap-separator', text: '/' });
    numLine.createSpan({ cls: 'ap-target', text: String(d.targetClients) });
    bigNum.createSpan({ cls: 'ap-label', text: 'clientes activos' });

    // Progress bar
    const progWrap = root.createDiv({ cls: 'ap-progress-wrap' });
    const progBar = progWrap.createDiv({ cls: 'ap-progress-bar' });
    const progFill = progBar.createDiv({ cls: `ap-progress-fill phase-${phase}` });
    progFill.style.width = `${Math.min(pct, 100)}%`;
    progWrap.createDiv({ cls: 'ap-progress-pct', text: `${pct}%` });

    // Revenue card
    const revCard = root.createDiv({ cls: 'ap-revenue-card' });
    revCard.createDiv({ cls: 'ap-rev-title', text: 'Facturación' });

    const revRows = [
      ['Semanal', `S/${weeklyRev.toLocaleString()}`, weeklyRev > 0],
      ['Mensual', `S/${monthlyRev.toLocaleString()}`, monthlyRev > 0],
      ['Meta mensual', `S/${d.monthlyTarget.toLocaleString()}`, false],
      ['Faltan', `S/${Math.max(d.monthlyTarget - monthlyRev, 0).toLocaleString()}`, false],
    ];
    for (const [label, value, highlight] of revRows) {
      const row = revCard.createDiv({ cls: 'ap-revenue-row' });
      row.createSpan({ cls: 'ap-rev-label', text: label });
      const valEl = row.createSpan({ cls: 'ap-rev-value', text: value });
      if (highlight) valEl.addClass('ap-highlight');
    }

    // Week tracker
    if (d.startDate) {
      const weekCard = root.createDiv({ cls: 'ap-week-card' });
      weekCard.createDiv({ cls: 'ap-week-title', text: `Semana ${week.current} de ${week.total}` });
      const blocks = weekCard.createDiv({ cls: 'ap-week-blocks' });
      for (let i = 1; i <= week.total; i++) {
        let cls = 'ap-week-block ';
        if (i < week.current) cls += 'past';
        else if (i === week.current) cls += 'current';
        else cls += 'future';
        blocks.createDiv({ cls, text: String(i) });
      }
    }

    // Milestones
    const msWrap = root.createDiv({ cls: 'ap-milestones' });
    msWrap.createDiv({ cls: 'ap-ms-title', text: 'Hitos' });
    for (const ms of d.milestones) {
      const isDone = d.currentClients >= ms.at;
      const item = msWrap.createDiv({ cls: 'ap-milestone-item' });
      const icon = item.createDiv({ cls: `ap-ms-icon ${isDone ? 'done' : 'pending'}` });
      icon.setText(isDone ? '✓' : String(ms.at));
      item.createSpan({ cls: `ap-ms-text ${isDone ? 'done' : ''}`, text: ms.label });
    }

    // Focus question
    const focusCard = root.createDiv({ cls: 'ap-focus-card' });
    focusCard.createDiv({ cls: 'ap-focus-label', text: 'Pregunta de enfoque' });
    focusCard.createDiv({ cls: 'ap-focus-text', text: getFocusQuestion(d.currentClients) });

    // Action buttons
    const actions = root.createDiv({ cls: 'ap-actions' });
    const addBtn = actions.createEl('button', { cls: 'ap-btn ap-btn-add', text: '+ Cliente' });
    const removeBtn = actions.createEl('button', { cls: 'ap-btn ap-btn-remove', text: '−' });

    addBtn.addEventListener('click', () => {
      new APClientModal(this.app, 'add', async (info) => {
        this.plugin.data.currentClients++;
        this.plugin.data.clientLog.unshift({
          date: new Date().toISOString().split('T')[0],
          action: 'add',
          name: info.name || '',
          note: info.note || '',
        });
        // Auto-set start date on first client
        if (!this.plugin.data.startDate) {
          this.plugin.data.startDate = new Date().toISOString().split('T')[0];
        }
        await this.plugin.saveData(this.plugin.data);
        this.plugin.refreshAll();
        new obsidian.Notice(`✅ Cliente agregado — ${this.plugin.data.currentClients}/${this.plugin.data.targetClients}`);
      }).open();
    });

    removeBtn.addEventListener('click', () => {
      if (d.currentClients <= 0) {
        new obsidian.Notice('No hay clientes para dar de baja.');
        return;
      }
      new APClientModal(this.app, 'remove', async (info) => {
        this.plugin.data.currentClients = Math.max(0, this.plugin.data.currentClients - 1);
        this.plugin.data.clientLog.unshift({
          date: new Date().toISOString().split('T')[0],
          action: 'remove',
          name: info.name || '',
          note: info.note || '',
        });
        await this.plugin.saveData(this.plugin.data);
        this.plugin.refreshAll();
        new obsidian.Notice(`Cliente dado de baja — ${this.plugin.data.currentClients}/${this.plugin.data.targetClients}`);
      }).open();
    });

    // Client log (last 8 entries)
    if (d.clientLog.length > 0) {
      const logCard = root.createDiv({ cls: 'ap-log-card' });
      logCard.createDiv({ cls: 'ap-log-title', text: 'Registro reciente' });
      const entries = d.clientLog.slice(0, 8);
      for (const entry of entries) {
        const row = logCard.createDiv({ cls: 'ap-log-entry' });
        row.createDiv({ cls: `ap-log-dot ${entry.action}` });
        const text = `${formatDate(entry.date)} — ${entry.name || 'Sin nombre'}`;
        row.createSpan({ text });
      }
    } else {
      root.createDiv({ cls: 'ap-log-empty', text: 'Sin registros aún. Agrega tu primer cliente.' });
    }
  }

  async onClose() {}
}

/* ============================================
   SETTINGS TAB
   ============================================ */
class APCounterSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'AP SMART Counter — Configuración' });

    new obsidian.Setting(containerEl)
      .setName('Clientes actuales')
      .setDesc('Número actual de clientes activos pagando')
      .addText(text => text
        .setPlaceholder('0')
        .setValue(String(this.plugin.data.currentClients))
        .onChange(async (value) => {
          this.plugin.data.currentClients = Math.max(0, parseInt(value) || 0);
          await this.plugin.saveData(this.plugin.data);
          this.plugin.refreshAll();
        }));

    new obsidian.Setting(containerEl)
      .setName('Meta de clientes')
      .setDesc('Número objetivo de clientes')
      .addText(text => text
        .setPlaceholder('20')
        .setValue(String(this.plugin.data.targetClients))
        .onChange(async (value) => {
          this.plugin.data.targetClients = Math.max(1, parseInt(value) || 20);
          await this.plugin.saveData(this.plugin.data);
          this.plugin.refreshAll();
        }));

    new obsidian.Setting(containerEl)
      .setName('Precio semanal por cliente (S/)')
      .addText(text => text
        .setPlaceholder('50')
        .setValue(String(this.plugin.data.weeklyPrice))
        .onChange(async (value) => {
          this.plugin.data.weeklyPrice = Math.max(0, parseInt(value) || 50);
          await this.plugin.saveData(this.plugin.data);
          this.plugin.refreshAll();
        }));

    new obsidian.Setting(containerEl)
      .setName('Meta mensual (S/)')
      .addText(text => text
        .setPlaceholder('4000')
        .setValue(String(this.plugin.data.monthlyTarget))
        .onChange(async (value) => {
          this.plugin.data.monthlyTarget = Math.max(0, parseInt(value) || 4000);
          await this.plugin.saveData(this.plugin.data);
          this.plugin.refreshAll();
        }));

    new obsidian.Setting(containerEl)
      .setName('Total de semanas del objetivo')
      .addText(text => text
        .setPlaceholder('12')
        .setValue(String(this.plugin.data.totalWeeks))
        .onChange(async (value) => {
          this.plugin.data.totalWeeks = Math.max(1, parseInt(value) || 12);
          await this.plugin.saveData(this.plugin.data);
          this.plugin.refreshAll();
        }));

    new obsidian.Setting(containerEl)
      .setName('Fecha de inicio')
      .setDesc('Se establece automáticamente al agregar el primer cliente, o puedes definirla manualmente (YYYY-MM-DD)')
      .addText(text => text
        .setPlaceholder('2026-04-18')
        .setValue(this.plugin.data.startDate)
        .onChange(async (value) => {
          this.plugin.data.startDate = value;
          await this.plugin.saveData(this.plugin.data);
          this.plugin.refreshAll();
        }));

    new obsidian.Setting(containerEl)
      .setName('Mostrar al iniciar Obsidian')
      .setDesc('Muestra el modal de progreso cada vez que abres Obsidian')
      .addToggle(toggle => toggle
        .setValue(this.plugin.data.showOnStartup)
        .onChange(async (value) => {
          this.plugin.data.showOnStartup = value;
          await this.plugin.saveData(this.plugin.data);
        }));

    // Danger zone
    containerEl.createEl('h3', { text: 'Zona de reinicio' });

    new obsidian.Setting(containerEl)
      .setName('Limpiar registro de clientes')
      .setDesc('Elimina todo el historial de altas y bajas')
      .addButton(btn => btn
        .setButtonText('Limpiar historial')
        .setWarning()
        .onClick(async () => {
          this.plugin.data.clientLog = [];
          await this.plugin.saveData(this.plugin.data);
          this.plugin.refreshAll();
          new obsidian.Notice('Historial limpiado');
        }));
  }
}

/* ============================================
   PLUGIN PRINCIPAL
   ============================================ */
class APSmartCounter extends obsidian.Plugin {
  async onload() {
    // Load saved data
    const saved = await this.loadData();
    this.data = Object.assign({}, DEFAULT_DATA, saved || {});
    // Ensure milestones exist
    if (!this.data.milestones || this.data.milestones.length === 0) {
      this.data.milestones = DEFAULT_DATA.milestones;
    }

    // Register sidebar view
    this.registerView(VIEW_TYPE, (leaf) => new APCounterView(leaf, this));

    // Status bar
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass('ap-status-bar');
    this.statusBarEl.addEventListener('click', () => this.activateView());
    this.updateStatusBar();

    // Ribbon icon
    this.addRibbonIcon('target', 'AP Counter', () => this.activateView());

    // Commands
    this.addCommand({
      id: 'open-ap-counter',
      name: 'Abrir panel AP Counter',
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: 'add-client',
      name: 'Agregar cliente',
      callback: () => {
        new APClientModal(this.app, 'add', async (info) => {
          this.data.currentClients++;
          this.data.clientLog.unshift({
            date: new Date().toISOString().split('T')[0],
            action: 'add',
            name: info.name || '',
            note: info.note || '',
          });
          if (!this.data.startDate) {
            this.data.startDate = new Date().toISOString().split('T')[0];
          }
          await this.saveData(this.data);
          this.refreshAll();
          new obsidian.Notice(`✅ Cliente agregado — ${this.data.currentClients}/${this.data.targetClients}`);
        }).open();
      },
    });

    this.addCommand({
      id: 'show-progress-modal',
      name: 'Mostrar progreso del objetivo',
      callback: () => new APStartupModal(this.app, this.data).open(),
    });

    // Settings tab
    this.addSettingTab(new APCounterSettingTab(this.app, this));

    // Startup modal (with delay to let Obsidian finish loading)
    if (this.data.showOnStartup) {
      this.registerEvent(
        this.app.workspace.onLayoutReady(() => {
          setTimeout(() => {
            new APStartupModal(this.app, this.data).open();
          }, 1500);
        })
      );
    }

    // Open sidebar on first install
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
    });
  }

  updateStatusBar() {
    if (!this.statusBarEl) return;
    const d = this.data;
    const phase = getPhase(d.currentClients, d.targetClients);
    const monthlyRev = d.currentClients * d.weeklyPrice * 4;

    this.statusBarEl.empty();
    this.statusBarEl.createSpan({ cls: `ap-pulse phase-${phase}` });
    this.statusBarEl.createSpan({
      text: `${d.currentClients}/${d.targetClients} clientes · S/${monthlyRev.toLocaleString()}`,
    });
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  refreshAll() {
    this.updateStatusBar();
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof APCounterView) {
        leaf.view.render();
      }
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
}

module.exports = APSmartCounter;
