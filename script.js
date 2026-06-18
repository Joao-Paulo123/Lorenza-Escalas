/* ============================================================
   LORENZA GELATERIA — SISTEMA DE ESCALAS
   script.js — versão 4.0 (Role-based, Dashboard, Modes)
   ============================================================ */

"use strict";

const DIAS_SEMANA = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const DIAS_PT     = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"];
const DIAS_LABEL  = ["SEG","TER","QUA","QUI","SEX","SAB","DOM"];
const MESES_PT    = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                     "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

let currentUser = null; // { role: 'admin'|'supervisor'|'funcionario', nome: string }

/* ══════════════════════════════════════════════════════════
   1. ESTADO DA APLICAÇÃO
   ══════════════════════════════════════════════════════════ */
let state = carregarStateCompleto();

function dadosPadrao() {
  return {
    funcionarios: [
      { id:"f1", idPonto: "101", nome:"Alice",      local:"Campo Duna", turno:"Único", folga1:"Segunda", folga2:"Quinta",  status:"ativo", observacoes:"", criadoEm: agora() },
      { id:"f2", idPonto: "102", nome:"Clara",      local:"Casa Kimo",  turno:"Tarde", folga1:"Segunda", folga2:"Domingo", status:"ativo", observacoes:"", criadoEm: agora() },
      { id:"f3", idPonto: "103", nome:"Dudu",       local:"Casa Kimo",  turno:"Manhã", folga1:"Segunda", folga2:"Terça",   status:"ativo", observacoes:"", criadoEm: agora() },
      { id:"f4", idPonto: "104", nome:"João Paulo", local:"Campo Duna", turno:"Único", folga1:"Segunda", folga2:"Terça",   status:"ativo", observacoes:"", criadoEm: agora() },
      { id:"f5", idPonto: "105", nome:"Nacho",      local:"Casa Kimo",  turno:"Noite", folga1:"Segunda", folga2:"Domingo", status:"ativo", observacoes:"", criadoEm: agora() },
      { id:"f6", idPonto: "106", nome:"Verónica",   local:"Casa Kimo",  turno:"Manhã", folga1:"Segunda", folga2:"Quinta",  status:"ativo", observacoes:"", criadoEm: agora() }
    ],
    solicitacoes: [], 
    feriados:     [],
    excecoes:     [],
    escalaMensal: {},
    config:       { minCampoDuna: 1, minCasaKimo: 2, modoEscala: '1' },
    audit:        []
  };
}

function carregarStateCompleto() {
  try {
    const salvo = localStorage.getItem("lorenza_state");
    if (salvo) {
      const parsed = JSON.parse(salvo);
      // Rotina de migração automática: Detecta ausência do campo idPonto e inicializa com string vazia
      parsed.funcionarios = (parsed.funcionarios || []).map(f => {
        if (!f.hasOwnProperty('idPonto')) f.idPonto = ""; 
        return f;
      });
      parsed.solicitacoes = (parsed.solicitacoes || []).map(s => {
        // Migração de dados antigos
        if (s.tipo === 'pedido') s.tipo = 'ausencia';
        if (s.tipo === 'troca' && !s.dataOriginal) s.dataOriginal = s.data;
        return s;
      });
      parsed.feriados     = parsed.feriados || [];
      parsed.excecoes     = parsed.excecoes || [];
      
      // Migração de dados antigos da escalaMensal
      const escala = parsed.escalaMensal || {};
      Object.keys(escala).forEach(mes => {
        if (!escala[mes].folgas) {
          // Formato antigo detectado (direto Nome -> Dia)
          const folgasAntigas = { ...escala[mes] };
          escala[mes] = { status: 'aberto', folgas: folgasAntigas };
        }
      });
      parsed.escalaMensal = escala;
      
      parsed.config       = parsed.config || { minCampoDuna: 1, minCasaKimo: 2, modoEscala: '1' };
      parsed.audit        = parsed.audit || [];
      return parsed;
    }
  } catch(e) { console.error(e); }
  return dadosPadrao();
}

function salvarState() {
  localStorage.setItem("lorenza_state", JSON.stringify(state));
}

function sincronizarTodasAsViews() {
  salvarState();
  if (typeof renderCalendario === "function") renderCalendario();
  if (typeof renderDashboard === "function" && currentUser && currentUser.role !== 'funcionario') renderDashboard();
  if (typeof renderEscalaAdmin === "function" && currentUser && currentUser.role === 'admin') {
    renderEscalaAdmin();
  }
  if (typeof renderMinhasSolicitacoes === "function" && currentUser && currentUser.role === 'funcionario') {
    renderMinhasSolicitacoes();
  }
  if (typeof renderCentralAprovacoes === "function" && currentUser && currentUser.role === 'admin') {
    renderCentralAprovacoes();
  }
  // Recalcular modal do dia se estiver aberto
  const modalDia = document.getElementById("modal-dia");
  if (modalDia && modalDia.style.display === "flex") {
    const titulo = document.getElementById("modal-dia-titulo").textContent; // ex: "📅 15/06/2026"
    if (titulo) {
      const dataStr = titulo.replace('📅 ', '').trim();
      const parts = dataStr.split('/');
      if (parts.length === 3) {
        const dataISO = `${parts[2]}-${parts[1]}-${parts[0]}`;
        if (typeof abrirModalDia === "function") abrirModalDia(dataISO);
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════
   2. UTILITÁRIOS
   ══════════════════════════════════════════════════════════ */
function agora() { return new Date().toISOString().slice(0,16).replace("T"," "); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function formatarData(dataISO) {
  if (!dataISO) return "";
  const [a, m, d] = dataISO.split("-");
  return `${d}/${m}/${a}`;
}
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function chavesMes(data) {
  if (typeof data === "string") return data.slice(0,7);
  return toISO(data).slice(0,7);
}
function diaSemanaDate(date) { return DIAS_SEMANA[date.getDay()]; }
function funcionariosAtivos() { return state.funcionarios.filter(f => f.status === "ativo"); }

function toast(msg, tipo = "ok") {
  const el = document.getElementById("toast");
  el.textContent = msg; el.className = "show";
  el.style.background = tipo === "erro" ? "#c62828" : tipo === "ok" ? "#2e7d32" : "#1a1209";
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = "", 3000);
}

function registrarAudit(acao, descricao) {
  const d = new Date();
  state.audit.push({
    acao, descricao, data: toISO(d), hora: d.toTimeString().slice(0,5),
    por: currentUser ? currentUser.nome : "Sistema"
  });
  if (state.audit.length > 500) state.audit = state.audit.slice(-500);
}

function isUltimosTresDias() {
  // MODO TESTE ATIVO: Ignora a restrição dos últimos 3 dias para permitir pedidos a qualquer momento.
  return true;
}

function sameWeek(d1, d2) {
  const date1 = new Date(d1 + "T12:00:00");
  const date2 = new Date(d2 + "T12:00:00");
  
  // Normaliza para segunda-feira como início da semana
  const getMonday = (d) => {
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 6 : day - 1); 
    return new Date(d.setDate(diff)).toDateString();
  };
  
  return getMonday(date1) === getMonday(date2);
}

/* ══════════════════════════════════════════════════════════
   3. LOGIN E NAVEGAÇÃO
   ══════════════════════════════════════════════════════════ */
function renderLoginSelect() {
  const select = document.getElementById('login-funcionarios');
  select.innerHTML = funcionariosAtivos().map(f => `<option value="func_${f.id}">${f.nome}</option>`).join('');
}

document.getElementById('btn-login').addEventListener('click', () => {
  const val = document.getElementById('login-select').value;
  if (val === 'admin') currentUser = { role: 'admin', nome: 'Administrador' };
  else {
    const idFunc = val.replace('func_', '');
    const func = state.funcionarios.find(f => f.id === idFunc);
    if (!func) {
      toast("Funcionário não encontrado.", "erro");
      return;
    }
    currentUser = { role: 'funcionario', nome: func.nome, id: func.id };
  }

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-layout').style.display = 'flex';
  
  // Setup Sidebar UI
  document.getElementById('user-name').textContent = currentUser.nome;
  document.getElementById('user-role').textContent = currentUser.role;
  document.getElementById('user-avatar').textContent = currentUser.nome.charAt(0).toUpperCase();

  // Hide/Show Nav Buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const roles = btn.dataset.roles.split(',');
    btn.style.display = roles.includes(currentUser.role) ? 'flex' : 'none';
  });

  inicializarSistema();
});

document.getElementById('btn-logout').addEventListener('click', () => {
  currentUser = null;
  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
});

function navegarPara(id) {
  document.querySelectorAll(".section").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.section === id));
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => navegarPara(btn.dataset.section));
});

let datasFolgaTemp = []; // Store array of requested dates for employees

/* ══════════════════════════════════════════════════════════
   4. ENGINE DE ESCALAS (NÚCLEO UNIFICADO)
   ══════════════════════════════════════════════════════════ */
function isFolga(f, dataISO) {
  // 1. Exceção manual do Admin
  const exc = state.excecoes.find(e => e.funcionario === f.nome && e.data === dataISO);
  if (exc && exc.tipo === 'folga') return true;
  if (exc && exc.tipo === 'trabalha') return false;

  // Se houver uma ausência ou férias aprovada, o dia não é considerado uma "folga" regular.
  // Isso evita a contagem dupla (como folga e ausência) e garante que a ausência tenha precedência.
  const isAusente = state.solicitacoes.some(s => 
    s.status === 'Aprovado' && 
    s.funcionario === f.nome && 
    (
      (s.tipo === 'ausencia' && s.data === dataISO) || 
      (s.tipo === 'ferias' && s.dataInicio <= dataISO && s.dataFim >= dataISO)
    )
  );
  if (isAusente) return false;

  // 2. Troca de Folga (ganha ou perde o dia)
  const trocaGanha = state.solicitacoes.find(s => s.tipo === 'troca' && s.status === 'Aprovado' && s.funcionario === f.nome && s.novaData === dataISO);
  if (trocaGanha) return true;
  const trocaPerde = state.solicitacoes.find(s => s.tipo === 'troca' && s.status === 'Aprovado' && s.funcionario === f.nome && s.dataOriginal === dataISO);
  if (trocaPerde) return false;

  const date = new Date(dataISO + "T12:00:00");
  const diaSem = diaSemanaDate(date);

  // 3. Folga Fixa
  if (f.folga1 === diaSem) return true;

  // 4. Segunda Folga (Escala Mensal por datas exatas)
  const chaveMes = chavesMes(dataISO);
  const escalaMes = state.escalaMensal[chaveMes];
  
  if (escalaMes && escalaMes.folgas && escalaMes.folgas[f.nome]) {
    // Array de datas exatas
    const datas = escalaMes.folgas[f.nome]; // ex: ["2026-06-03", "2026-06-11"]
    if (Array.isArray(datas) && datas.includes(dataISO)) return true;
    
    // Se o array de datas está definido e vazio, significa que o gestor zerou as folgas.
    // Se não estiver vazio e não incluiu o dia, retorna falso.
    // Assim que a folga for definida/aprovada, ela sobrescreve a folga2 padrão, mesmo sem "Congelar"
    if (Array.isArray(datas)) return false; 
  }

  // Se não tem escala definida ou array salvo, fallback para folga2 padrão
  if (f.folga2 && f.folga2 === diaSem) return true;
  
  return false;
}

function folgasNaData(dataISO) {
  return funcionariosAtivos().filter(f => isFolga(f, dataISO));
}

function feriasNaData(dataISO) {
  return funcionariosAtivos().filter(f => {
    return state.solicitacoes.some(s =>
      s.status === 'Aprovado' &&
      s.funcionario === f.nome &&
      s.tipo === 'ferias' &&
      s.dataInicio <= dataISO &&
      s.dataFim >= dataISO
    );
  });
}

function lojaFechada(dataISO) {
  const feriado = state.feriados.find(f => f.data === dataISO);
  if (feriado && feriado.status === "fechado") return true;
  if (feriado && feriado.status === "aberto")  return false;
  const date = new Date(dataISO + "T12:00:00");
  return diaSemanaDate(date) === "Segunda";
}

function ausentesNaData(dataISO) {
  return funcionariosAtivos().filter(f => {
    return state.solicitacoes.some(s => 
      s.status === 'Aprovado' && 
      s.funcionario === f.nome && 
      s.tipo === 'ausencia' &&
      s.data === dataISO
    );
  });
}

/* ══════════════════════════════════════════════════════════
   5. DASHBOARD & ALERTAS DE COBERTURA
   ══════════════════════════════════════════════════════════ */
function renderDashboard() {
  if (currentUser.role === 'funcionario') return;

  const hoje = toISO(new Date());
  const ativos = funcionariosAtivos().length;
  const folgas = lojaFechada(hoje) ? 0 : folgasNaData(hoje).length;
  const ausentes = lojaFechada(hoje) ? 0 : ausentesNaData(hoje).length;
  const trabalha = lojaFechada(hoje) ? 0 : ativos - folgas - ausentes;

  document.getElementById("dashTotalFuncionarios").textContent = ativos;
  document.getElementById("dashFolgasHoje").textContent = folgas;
  document.getElementById("dashTrabalhandoHoje").textContent = trabalha;
  document.getElementById("data-hoje").textContent = new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  // Alertas
  const alertas = [];
  const hojeDate = new Date();
  for(let i=0; i<7; i++) {
    const d = new Date(hojeDate); d.setDate(hojeDate.getDate() + i);
    const dataISO = toISO(d);
    if (lojaFechada(dataISO)) continue;
    const fData = folgasNaData(dataISO);
    const aData = ausentesNaData(dataISO);
    ["Campo Duna", "Casa Kimo"].forEach(loc => {
      const min = loc === "Campo Duna" ? parseInt(state.config.minCampoDuna) : parseInt(state.config.minCasaKimo);
      const totLoc = funcionariosAtivos().filter(x => x.local === loc || x.local === "Ambos").length;
      const fLoc = fData.filter(x => x.local === loc || x.local === "Ambos").length;
      const aLoc = aData.filter(x => x.local === loc || x.local === "Ambos").length;
      const disp = totLoc - (fLoc + aLoc);
      if (disp < min) {
        alertas.push(`<div style="padding:10px; background:var(--danger-bg); color:var(--danger); border-radius:6px; margin-bottom:8px; font-size:0.85rem;">
          <strong>${formatarData(dataISO)} — ${loc}</strong><br/>Apenas ${disp} disponível(is) (Mín: ${min})
        </div>`);
      }
    });
  }
  document.getElementById("lista-alertas-cobertura").innerHTML = alertas.length ? alertas.join('') : '<p class="empty-state" style="padding:10px;">✅ Cobertura adequada nos próximos 7 dias.</p>';

  // Últimas atividades
  const acts = [...state.audit].reverse().slice(0, 5);
  document.getElementById("lista-ultimas-atividades").innerHTML = acts.length ? acts.map(a => `
    <div style="font-size:0.8rem; margin-bottom:10px; border-bottom:1px solid var(--neutral-100); padding-bottom:5px;">
      <strong>${a.acao}</strong> <span style="color:var(--neutral-500)">por ${a.por}</span><br/>
      ${a.descricao} <span style="float:right; color:var(--neutral-300)">${formatarData(a.data)}</span>
    </div>
  `).join('') : '<p class="empty-state">Sem atividades.</p>';
}

function verificarCoberturaAposAcao(funcionarioNome, dataISO, callback) {
  const f = state.funcionarios.find(x => x.nome === funcionarioNome);
  if (!f) { callback(); return; }

  const fData = folgasNaData(dataISO);
  const aData = ausentesNaData(dataISO);
  const locais = f.local === "Ambos" ? ["Campo Duna", "Casa Kimo"] : [f.local];
  
  let alertaMensagens = [];
  locais.forEach(loc => {
    const total = funcionariosAtivos().filter(x => x.local === loc || x.local === "Ambos").length;
    const simula = (fData.some(x => x.nome === f.nome) || aData.some(x => x.nome === f.nome)) ? 0 : 1;
    const emFolga = fData.filter(x => x.local === loc || x.local === "Ambos").length;
    const emAusencia = aData.filter(x => x.local === loc || x.local === "Ambos").length;
    const disp = total - (emFolga + emAusencia + simula);
    const min = loc === "Campo Duna" ? parseInt(state.config.minCampoDuna) : parseInt(state.config.minCasaKimo);
    if (disp < min) alertaMensagens.push(`- ${loc}: restará ${disp} (mín: ${min})`);
  });

  if (alertaMensagens.length > 0) {
    document.getElementById("modal-alerta-msg").innerText = `⚠️ Esta aprovação causará falta de equipe no dia ${formatarData(dataISO)}:\n${alertaMensagens.join('\n')}\n\nConfirmar mesmo assim?`;
    document.getElementById("modal-alerta").style.display  = "flex";
    document.getElementById("modal-overlay").style.display = "block";
    document.getElementById("btnAlertaConfirmar").onclick = () => { fecharModais(); callback(); };
    document.getElementById("btnAlertaCancelar").onclick = fecharModais;
  } else {
    callback();
  }
}

/* ══════════════════════════════════════════════════════════
   6. CALENDÁRIO
   ══════════════════════════════════════════════════════════ */
let mesCalendario = new Date();

function renderCalendario() {
  const chave = chavesMes(mesCalendario);
  const container = document.getElementById("resumo-semanal");
  document.getElementById("resumo-mes-label").textContent = `Folgas da semana base para ${MESES_PT[mesCalendario.getMonth()]} ${mesCalendario.getFullYear()}`;
  container.innerHTML = "";

  DIAS_PT.forEach(dia => {
    const fechado = dia === "Segunda";
    const ativos = funcionariosAtivos();
    // Simula uma data genérica para este dia da semana no mês
    let dtSimulada = null;
    for(let i=1; i<=7; i++) {
      const d = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), i);
      if (diaSemanaDate(d) === dia) { dtSimulada = toISO(d); break; }
    }
    const emFolga = dtSimulada ? folgasNaData(dtSimulada).length : 0;
    const emAusencia = dtSimulada ? ausentesNaData(dtSimulada).length : 0;
    const emFerias = dtSimulada ? feriasNaData(dtSimulada).length : 0;
    const trabalha = ativos.length - (emFolga + emAusencia + emFerias);

    let cls = "resumo-dia--ok";
    if (fechado) cls = "resumo-dia--fechado";
    else if (emFolga >= ativos.length * 0.5) cls = "resumo-dia--critico";
    else if (emFolga >= 3) cls = "resumo-dia--alerta";
    else if ((emFolga + emAusencia) >= ativos.length * 0.5) cls = "resumo-dia--critico";
    else if ((emFolga + emAusencia) >= 3) cls = "resumo-dia--alerta";

    const el = document.createElement("div");
    el.className = `resumo-dia ${cls}`;
    if (fechado) {
      el.innerHTML = `<div class="resumo-dia__nome">${dia.slice(0,3)}</div><div class="resumo-dia__count">🔒</div><div class="resumo-dia__label">Fechado</div>`;
    } else {
      const resumoLabel = (emFolga + emAusencia + emFerias) === 0 ? "Completa" : `${emFolga}F / ${emFerias}P / ${emAusencia}A`;
      el.innerHTML = `<div class="resumo-dia__nome">${dia.slice(0,3)}</div><div class="resumo-dia__count">${trabalha}</div><div class="resumo-dia__label">${resumoLabel}</div>`;
    }
    container.appendChild(el);
  });

  // Grade Mensal
  const calMensal = document.getElementById("calendario-mensal");
  const ano = mesCalendario.getFullYear();
  const mes = mesCalendario.getMonth();
  document.getElementById("titulo-calendario").textContent = `${MESES_PT[mes]} ${ano}`;

  const diasNoMes = new Date(ano, mes+1, 0).getDate();
  let primeiroDia = new Date(ano, mes, 1).getDay();
  primeiroDia = primeiroDia === 0 ? 6 : primeiroDia - 1;

  let html = '<div class="calendario-grid">';
  DIAS_LABEL.forEach(d => html += `<div class="cal-header">${d}</div>`);
  for (let i = 0; i < primeiroDia; i++) html += `<div class="cal-dia cal-dia--vazio"></div>`;

  const hoje = toISO(new Date());

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataISO = toISO(new Date(ano, mes, dia));
    const ehHoje  = dataISO === hoje;
    const feriado = state.feriados.find(f => f.data === dataISO);
    const fechado = lojaFechada(dataISO);
    const folgas  = folgasNaData(dataISO);
    const ausentes= ausentesNaData(dataISO);
    const ferias  = feriasNaData(dataISO);

    let classes = "cal-dia";
    if (ehHoje)  classes += " cal-dia--hoje";
    if (fechado) classes += " cal-dia--fechado";
    else if (feriado) classes += " cal-dia--feriado";

    let tags = "";
    if (fechado) tags += `<span class="cal-dia__tag cal-dia__tag--fechado">🔒 Fechado</span>`;
    else {
      if (feriado) tags += `<span class="cal-dia__tag cal-dia__tag--feriado">🎉 ${feriado.nome}</span>`;
      if (folgas.length > 0) tags += `<span class="cal-dia__tag cal-dia__tag--folgas">🏖️ ${folgas.length} folga${folgas.length>1?"s":""}</span>`;
      if (ferias.length > 0) tags += `<span class="cal-dia__tag" style="background:var(--brand-100);color:var(--brand-700);">🌴 ${ferias.length} férias</span>`;
      if (ausentes.length > 0) tags += `<span class="cal-dia__tag" style="background:var(--warning-bg);color:var(--warning);">🚫 ${ausentes.length} ausente${ausentes.length>1?"s":""}</span>`;
    }

    html += `<div class="${classes}" onclick="abrirModalDia('${dataISO}')">
      <span class="cal-dia__num">${dia}</span>${tags}</div>`;
  }
  calMensal.innerHTML = html + "</div>";
}

document.getElementById("mes-anterior").addEventListener("click", () => { mesCalendario.setMonth(mesCalendario.getMonth() - 1); renderCalendario(); });
document.getElementById("mes-proximo").addEventListener("click", () => { mesCalendario.setMonth(mesCalendario.getMonth() + 1); renderCalendario(); });

function abrirModalDia(dataISO) {
  const feriado = state.feriados.find(f => f.data === dataISO);
  const fechado = lojaFechada(dataISO);
  const fData   = folgasNaData(dataISO);
  const aData   = ausentesNaData(dataISO);
  const vData   = feriasNaData(dataISO);
  const trabalha= funcionariosAtivos().filter(f => !fData.includes(f) && !aData.includes(f) && !vData.includes(f));

  document.getElementById("modal-dia-titulo").textContent = `📅 ${formatarData(dataISO)}`;
  let html = "";
  if (feriado) html += `<div class="item-modal"><strong>🎉 ${feriado.nome}</strong> — ${feriado.status === "fechado" ? "Fechada" : "Aberta"}</div>`;
  
  if (fechado) {
    html += `<div class="item-modal" style="color:var(--closed-color);">🔒 Loja fechada</div>`;
  } else {
    if (vData.length > 0) {
      html += `<div class="modal-turno-grupo"><div class="modal-turno-titulo">🌴 Em Férias (${vData.length})</div>`;
      vData.forEach(f => html += `<div class="item-modal">👤 ${f.nome} <span class="badge" style="margin-left:auto; background:var(--brand-100); color:var(--brand-700);">${f.local}</span></div>`);
      html += "</div>";
    }

    html += `<div class="modal-turno-grupo"><div class="modal-turno-titulo">🏖️ Em Folga (${fData.length})</div>`;
    if (fData.length === 0) html += `<div class="item-modal">Ninguém em folga</div>`;
    else fData.forEach(f => html += `<div class="item-modal">👤 ${f.nome} <span class="badge" style="margin-left:auto;">${f.local}</span></div>`);
    html += "</div>";

    if (aData.length > 0) {
      html += `<div class="modal-turno-grupo"><div class="modal-turno-titulo">🚫 Ausentes (${aData.length})</div>`;
      aData.forEach(f => html += `<div class="item-modal">👤 ${f.nome} <span class="badge badge--warning" style="margin-left:auto;">${f.local}</span></div>`);
      html += "</div>";
    }

    ["Manhã","Tarde","Noite","Único"].forEach(t => {
      const g = trabalha.filter(f => f.turno === t);
      if(g.length === 0) return;
      html += `<div class="modal-turno-grupo"><div class="modal-turno-titulo">👷 ${t} (${g.length})</div>`;
      g.forEach(f => html += `<div class="item-modal">👤 ${f.nome} <span class="badge" style="margin-left:auto;">${f.local}</span></div>`);
      html += "</div>";
    });
  }
  document.getElementById("modal-dia-conteudo").innerHTML = html || "<p>Sem informações.</p>";
  document.getElementById("modal-dia").style.display = "flex";
  document.getElementById("modal-overlay").style.display = "block";
}
document.getElementById("btnFecharDia").addEventListener("click", fecharModais);

/* ══════════════════════════════════════════════════════════
   7. MINHAS SOLICITAÇÕES (FUNCIONÁRIOS)
   ══════════════════════════════════════════════════════════ */
document.getElementById("funcTipoSol").addEventListener("change", function() {
  document.getElementById("funcGroupAusencia").style.display = this.value === "ausencia" ? "grid" : "none";
  document.getElementById("funcGroupTroca").style.display = this.value === "troca" ? "grid" : "none";
  if (document.getElementById("funcGroupFerias")) document.getElementById("funcGroupFerias").style.display = this.value === "ferias" ? "grid" : "none";
});

document.getElementById("btnEnviarSol").addEventListener("click", () => {
  const tipo = document.getElementById("funcTipoSol").value;
  const motivo = document.getElementById("funcMotivo").value.trim();
  
  if (tipo === 'ausencia') {
    const data = document.getElementById("funcDataAusencia").value;
    if(!data) { toast("Selecione a data.", "erro"); return; }
    if(!motivo) { toast("Motivo obrigatório.", "erro"); return; }
    salvarNovaSol({ tipo, data, motivo });
  } else if (tipo === 'ferias') {
    const dataInicio = document.getElementById("funcDataInicioFerias").value;
    const dataFim = document.getElementById("funcDataFimFerias").value;
    if (!dataInicio || !dataFim) { toast("Selecione as datas de início e fim.", "erro"); return; }
    if (dataInicio > dataFim) { toast("A data de fim não pode ser antes da data de início.", "erro"); return; }
    
    const temSobreposicao = state.solicitacoes.some(s => 
      s.tipo === 'ferias' && 
      s.funcionario === currentUser.nome && 
      s.status !== 'Recusado' &&
      ((dataInicio >= s.dataInicio && dataInicio <= s.dataFim) || 
       (dataFim >= s.dataInicio && dataFim <= s.dataFim) ||
       (dataInicio <= s.dataInicio && dataFim >= s.dataFim))
    );
    if (temSobreposicao) { toast("Você já possui férias solicitadas/aprovadas que se sobrepõem a este período.", "erro"); return; }
    
    salvarNovaSol({ tipo, dataInicio, dataFim, motivo });
  } else {
    const dataOriginal = document.getElementById("funcDataOriginal").value;
    const novaData = document.getElementById("funcNovaData").value;
    if(!dataOriginal || !novaData) { toast("Selecione as duas datas.", "erro"); return; }
    if(!sameWeek(dataOriginal, novaData)) { toast("A troca deve ser na mesma semana.", "erro"); return; }
    
    const f = state.funcionarios.find(x => x.nome === currentUser.nome);
    if (!isFolga(f, dataOriginal)) { toast("A data original informada não é sua folga.", "erro"); return; }
    if (isFolga(f, novaData)) { toast("Você já está de folga na nova data.", "erro"); return; }
    
    salvarNovaSol({ tipo, dataOriginal, novaData, motivo });
  }
});

function atualizarCardFolgaMensal() {
  const card = document.getElementById("cardFolgaMensal");
  if (state.config.modoEscala !== '2') { card.style.display = 'none'; return; }
  
  card.style.display = 'block';
  const hoje = new Date();

  // No modo teste, permitimos que o funcionário selecione entre o mês atual e o próximo.
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const proxMes  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  
  const selMes = document.getElementById('funcMesFolga');
  selMes.innerHTML = `
    <option value="${chavesMes(mesAtual)}">${MESES_PT[mesAtual.getMonth()]} ${mesAtual.getFullYear()}</option>
    <option value="${chavesMes(proxMes)}" selected>${MESES_PT[proxMes.getMonth()]} ${proxMes.getFullYear()}</option>
  `;
  selMes.disabled = false; // Habilitado para testes
  
  if (isUltimosTresDias()) {
    document.getElementById('descFolgaMensal').textContent = `⚠️ MODO TESTE ATIVO: O período de solicitações de folga mensal está aberto!`;
    document.getElementById('funcInputDataUnica').disabled = false;
    document.getElementById('btnAddDataFolga').disabled = false;
    document.getElementById('btnEnviarFolgaMensal').disabled = false;
  } else {
    document.getElementById('descFolgaMensal').textContent = `Os pedidos para o próximo mês abrem apenas nos últimos 3 dias do mês atual.`;
    document.getElementById('funcInputDataUnica').disabled = true;
    document.getElementById('btnAddDataFolga').disabled = true;
    document.getElementById('btnEnviarFolgaMensal').disabled = true;
  }
}

function renderDatasSelecionadas() {
  const lista = document.getElementById("lista-datas-selecionadas");
  lista.innerHTML = datasFolgaTemp.map((d, i) => {
    const diaSemana = diaSemanaDate(new Date(d + "T12:00:00"));
    return `
    <span class="badge badge--info" style="display:flex; align-items:center; gap:4px; font-size:0.85rem; padding:6px 10px;">
      ${diaSemana}, ${formatarData(d)}
      <button onclick="removerDataTemp(${i})" style="background:transparent; border:none; color:inherit; font-size:1.1rem; margin-left:4px; cursor:pointer;">&times;</button>
    </span>
    `;
  }).join("");
}

window.removerDataTemp = function(index) {
  datasFolgaTemp.splice(index, 1);
  renderDatasSelecionadas();
}

document.getElementById("btnAddDataFolga").addEventListener("click", () => {
  const data = document.getElementById("funcInputDataUnica").value;
  if (!data) return;
  const mesSel = document.getElementById("funcMesFolga").value;
  
  if (data.substring(0,7) !== mesSel) {
    toast("A data deve pertencer ao mês selecionado.", "erro"); return;
  }
  if (datasFolgaTemp.includes(data)) {
    toast("Data já adicionada.", "erro"); return;
  }
  
  // TRAVA DE SEGURANÇA REFORÇADA
  const temConflito = datasFolgaTemp.some(d => sameWeek(d, data));
  if (temConflito) {
    toast("Erro: Você já possui uma folga nesta mesma semana (Seg-Dom).", "erro");
    return;
  }

  if (datasFolgaTemp.length >= 5) {
    toast("Limite de 5 datas atingido.", "erro"); return;
  }
  
  datasFolgaTemp.push(data);
  datasFolgaTemp.sort((a, b) => a.localeCompare(b));
  renderDatasSelecionadas();
  document.getElementById("funcInputDataUnica").value = "";
});

document.getElementById("btnEnviarFolgaMensal").addEventListener("click", () => {
  const mes = document.getElementById("funcMesFolga").value;
  
  if (datasFolgaTemp.length === 0) {
    toast("Adicione pelo menos uma data.", "erro"); return;
  }
  
  // Validação: pelo menos um domingo
  const temDomingo = datasFolgaTemp.some(d => {
    const date = new Date(d + "T12:00:00");
    return date.getDay() === 0; // 0 is Sunday
  });
  
  if (!temDomingo) {
    toast("Obrigatório selecionar pelo menos 1 Domingo.", "erro"); return;
  }

  // Check se já existe pedido
  if(state.solicitacoes.find(s => s.tipo === 'folga_mensal' && s.funcionario === currentUser.nome && s.mes === mes)) {
    toast("Você já enviou um pedido para este mês. Exclua o anterior para enviar um novo.", "erro"); return;
  }
  
  salvarNovaSol({ tipo: 'folga_mensal', mes, datas: [...datasFolgaTemp] });
  datasFolgaTemp = [];
  renderDatasSelecionadas();
});

function salvarNovaSol(obj) {
  const req = {
    id: uid(), funcionario: currentUser.nome, status: 'Pendente',
    criadoEm: agora(), ...obj
  };
  state.solicitacoes.push(req);
  salvarState();
  registrarAudit("Nova Solicitação", `Pedido de ${req.tipo}`);
  renderMinhasSolicitacoes();
  toast("Solicitação enviada!", "ok");
  
  document.getElementById("funcDataAusencia").value = "";
  document.getElementById("funcDataOriginal").value = "";
  document.getElementById("funcNovaData").value = "";
  if (document.getElementById("funcDataInicioFerias")) document.getElementById("funcDataInicioFerias").value = "";
  if (document.getElementById("funcDataFimFerias")) document.getElementById("funcDataFimFerias").value = "";
  document.getElementById("funcMotivo").value = "";
}

window.excluirMinhaSol = function(id) {
  if (!confirm("Deseja cancelar esta solicitação?")) return;
  const index = state.solicitacoes.findIndex(x => x.id === id);
  if (index > -1) {
    const s = state.solicitacoes[index];
    if (s.status === 'Aprovado' && s.tipo === 'folga_mensal') {
      if (state.escalaMensal && state.escalaMensal[s.mes] && state.escalaMensal[s.mes].folgas) {
        delete state.escalaMensal[s.mes].folgas[s.funcionario];
      }
    }
    registrarAudit("Cancelar", `Cancelou própria solicitação (${s.tipo})`);
    state.solicitacoes.splice(index, 1);
    sincronizarTodasAsViews();
    toast("Solicitação cancelada.");
  }
}

function renderMinhasSolicitacoes() {
  atualizarCardFolgaMensal();
  const lista = document.getElementById("lista-minhas-solicitacoes");
  const minhas = state.solicitacoes.filter(s => s.funcionario === currentUser.nome).reverse();
  
  lista.innerHTML = minhas.length ? minhas.map(s => {
    let lbl = '';
    if (s.tipo === 'ausencia') {
      lbl = `Ausência: ${formatarData(s.data)}`;
    } else if (s.tipo === 'troca') {
      lbl = `Troca: ${formatarData(s.dataOriginal)} ➔ ${formatarData(s.novaData)}`;
    } else if (s.tipo === 'ferias') {
      lbl = `Férias: ${formatarData(s.dataInicio)} a ${formatarData(s.dataFim)}`;
    } else {
      const mesFormatado = s.mes.split('-'); // ex: 2026-07
      const nomeMes = MESES_PT[parseInt(mesFormatado[1]) - 1];
      const datasFormatadas = s.datas.map(d => `${diaSemanaDate(new Date(d + "T12:00:00")).substring(0,3)}, ${formatarData(d)}`).join(' | ');
      lbl = `2ª Folga Mensal (${nomeMes}/${mesFormatado[0]}): ${datasFormatadas}`;
    }
    
    // Usando as classes de badge oficiais do nosso CSS
    const tag = s.status === 'Pendente' ? `<span class="badge badge--warning">⏳ Pendente</span>`
              : s.status === 'Aprovado' ? `<span class="badge badge--success">✅ Aprovado</span>`
              : `<span class="badge badge--danger">❌ Recusado</span>`;
              
    const btnExcluir = s.status === 'Pendente' ? `<button class="btn btn--ghost btn--sm" onclick="excluirMinhaSol('${s.id}')" title="Cancelar Pedido">🗑️ Cancelar</button>` : '';
    
    return `
      <div class="item-solicitacao" style="padding: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="line-height:1.5;">
            <strong style="color:var(--brand-700); display:block; font-size:0.95rem; margin-bottom:4px;">${lbl}</strong> 
            ${tag}
          </div>
          <div>${btnExcluir}</div>
        </div>
        ${s.motivo ? `<div class="item-solicitacao__motivo" style="margin-top:10px; padding-top:10px; border-top:1px solid var(--neutral-100);">💬 ${s.motivo}</div>` : ''}
      </div>`;
  }).join('') : '<p class="empty-state">Você não tem solicitações no momento.</p>';
}

/* ══════════════════════════════════════════════════════════
   8. CENTRAL DE APROVAÇÕES (ADMIN/SUP)
   ══════════════════════════════════════════════════════════ */
function renderCentralAprovacoes() {
  const ativas = state.solicitacoes.filter(s => s.status === "Pendente");
  
  // Popular filtro de meses no histórico
  const selectFiltro = document.getElementById("filtroMesAprovacoes");
  const mesesHist = [...new Set(state.solicitacoes.filter(s => s.status !== "Pendente").map(s => s.criadoEm.substring(0,7)))].sort().reverse();
  const valorAtual = selectFiltro.value;
  selectFiltro.innerHTML = `<option value="todos">Todos os Meses</option>` + mesesHist.map(m => `<option value="${m}">${m}</option>`).join("");
  if (mesesHist.includes(valorAtual) || valorAtual === "todos") selectFiltro.value = valorAtual;

  let hist = state.solicitacoes.filter(s => s.status !== "Pendente").reverse();
  if (selectFiltro.value !== "todos") {
    hist = hist.filter(s => s.criadoEm.startsWith(selectFiltro.value));
  } else {
    hist = hist.slice(0,50); // Limita a 50 se não houver filtro
  }

  document.getElementById("badge-ativas").textContent = ativas.length;
  document.getElementById("badge-aprovacoes-nav").textContent = ativas.length;
  document.getElementById("badge-historico").textContent = state.solicitacoes.length - ativas.length;

  document.getElementById("lista-solicitacoes-ativas").innerHTML = ativas.length ? ativas.map(s => cardAprovacao(s, true)).join("") : '<div class="empty-state">Tudo limpo! ✅</div>';
  document.getElementById("lista-solicitacoes-historico").innerHTML = hist.length ? hist.map(s => cardAprovacao(s, false)).join("") : '<div class="empty-state">Sem histórico para este filtro.</div>';
}

document.getElementById("filtroMesAprovacoes").addEventListener("change", renderCentralAprovacoes);

function cardAprovacao(s, isAtiva) {
  const lbl = s.tipo === 'ausencia' ? `Ausência em ${formatarData(s.data)}` 
            : s.tipo === 'troca' ? `Troca: ${formatarData(s.dataOriginal)} ➔ ${formatarData(s.novaData)}`
            : s.tipo === 'ferias' ? `Férias: ${formatarData(s.dataInicio)} a ${formatarData(s.dataFim)}`
            : `Folga Mensal (${s.mes}): ${s.datas ? s.datas.map(formatarData).join(', ') : s.diaSemana}`; // fallback para dados antigos
  
  const acoes = isAtiva ? `<button class="btn btn--success btn--sm" onclick="aprovarSol('${s.id}')">✓ Aprovar</button>
                           <button class="btn btn--danger btn--sm" onclick="recusarSol('${s.id}')">✗ Recusar</button>
                           <button class="btn btn--ghost btn--sm" onclick="excluirSolAdmin('${s.id}')" title="Excluir">🗑️</button>`
                        : `<span class="badge ${s.status === 'Aprovado' ? 'badge--success' : 'badge--warning'}">${s.status}</span>
                           <button class="btn btn--ghost btn--sm" onclick="excluirSolAdmin('${s.id}')" title="Excluir">🗑️</button>`;

  return `<div class="item-solicitacao">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div><strong style="color:var(--brand-700);">${s.funcionario}</strong> <span class="badge">${lbl}</span></div>
      <div style="display:flex; gap:5px; align-items:center;">${acoes}</div>
    </div>
    ${s.motivo ? `<div class="item-solicitacao__motivo" style="margin-top:6px;">💬 ${s.motivo}</div>` : ''}
  </div>`;
}

window.excluirSolAdmin = function(id) {
  if(!confirm("Tem certeza que deseja excluir esta solicitação?")) return;
  const s = state.solicitacoes.find(x => x.id === id);
  if(!s) return;

  // Se for uma folga mensal aprovada, limpa o registro na escala mensal
  if (s.status === 'Aprovado' && s.tipo === 'folga_mensal') {
    if (state.escalaMensal && state.escalaMensal[s.mes] && state.escalaMensal[s.mes].folgas) {
      delete state.escalaMensal[s.mes].folgas[s.funcionario];
    }
  }

  // Remove a solicitação do estado global
  state.solicitacoes = state.solicitacoes.filter(x => x.id !== id);
  
  registrarAudit("Excluir", `Solicitação de ${s.funcionario} (${s.tipo}) deletada.`);
  
  // Salva no LocalStorage e atualiza todas as views e modais abertos
  sincronizarTodasAsViews();
  
  // Força o fechamento de modais abertos para evitar estados inconsistentes
  fecharModais(); 
  
  toast("Solicitação excluída e calendário recalculado!");
};

window.aprovarSol = function(id) {
  const s = state.solicitacoes.find(x => x.id === id);
  if(!s) return;
  
  const executar = () => {
    s.status = 'Aprovado'; 
    s.aprovadoPor = currentUser.nome; 
    s.aprovadoEm = agora();
    
    // Se for folga mensal, atualiza o mapa de folgas do mês correspondente
    if (s.tipo === 'folga_mensal') {
      if (!state.escalaMensal[s.mes]) state.escalaMensal[s.mes] = { status: 'aberto', folgas: {} };
      state.escalaMensal[s.mes].folgas[s.funcionario] = s.datas ? [...s.datas] : [s.diaSemana]; 
    }
    
    registrarAudit("Aprovar", `Solicitação de ${s.tipo} para ${s.funcionario} foi aprovada.`);
    sincronizarTodasAsViews();
    toast("Solicitação aprovada com sucesso e calendário atualizado!");
  };

  // Executa verificações de cobertura mínima baseadas no tipo de folga gerada
  if (s.tipo === 'ausencia') {
    verificarCoberturaAposAcao(s.funcionario, s.data, executar);
  } else if (s.tipo === 'troca') {
    // A troca gera uma nova folga na 'novaData', então validamos a cobertura desse dia desejado
    verificarCoberturaAposAcao(s.funcionario, s.novaData, executar);
  } else if (s.tipo === 'ferias') {
    verificarCoberturaAposAcao(s.funcionario, s.dataInicio, executar);
  } else {
    executar();
  }
};

window.recusarSol = function(id) {
  const s = state.solicitacoes.find(x => x.id === id);
  if(!s) return;
  s.status = 'Recusado'; s.recusadoPor = currentUser.nome; s.recusadoEm = agora(); //
  registrarAudit("Recusar", `${s.funcionario} - ${s.tipo}`); //
  sincronizarTodasAsViews(); //
  toast("Recusado.");
};

document.getElementById("btnLimparHistorico").addEventListener("click", () => {
  const filtro = document.getElementById("filtroMesAprovacoes").value;
  let msg = filtro === "todos" ? "Limpar todo o histórico?" : `Limpar histórico de ${filtro}?`;
  if(!confirm(msg)) return;
  
  // Identifica solicitações de folga mensal aprovadas que serão removidas para limpar a escala
  const paraRemover = state.solicitacoes.filter(s => 
    s.status !== 'Pendente' && (filtro === "todos" || s.criadoEm.startsWith(filtro))
  );

  paraRemover.forEach(s => {
    if (s.tipo === 'folga_mensal' && s.status === 'Aprovado') {
      if (state.escalaMensal && state.escalaMensal[s.mes] && state.escalaMensal[s.mes].folgas) {
        delete state.escalaMensal[s.mes].folgas[s.funcionario];
      }
    }
  });

  if (filtro === "todos") {
    state.solicitacoes = state.solicitacoes.filter(s => s.status === 'Pendente');
  } else {
    state.solicitacoes = state.solicitacoes.filter(s => s.status === 'Pendente' || !s.criadoEm.startsWith(filtro));
  }
  registrarAudit("Sistema", `Limpou histórico de aprovações (${filtro})`);
  sincronizarTodasAsViews(); renderCentralAprovacoes(); toast("Histórico limpo.");
});

/* ══════════════════════════════════════════════════════════
   9. ESCALA MENSAL (ADMIN/SUP)
   ══════════════════════════════════════════════════════════ */
function renderEscalaMensalSelects() {
  const sel = document.getElementById('escalaMesSelect');
  sel.innerHTML = '';
  const hoje = new Date();
  for (let i = -1; i <= 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const chave = chavesMes(d);
    sel.innerHTML += `<option value="${chave}">${MESES_PT[d.getMonth()]} ${d.getFullYear()}</option>`;
  }
  sel.value = hoje.getDate() > 15 ? chavesMes(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)) : chavesMes(hoje);
}

document.getElementById('escalaMesSelect').addEventListener('change', renderEscalaAdmin);

function renderEscalaAdmin() {
  const mes = document.getElementById('escalaMesSelect').value;
  if (!mes) return;
  
  if (!state.escalaMensal[mes]) state.escalaMensal[mes] = { status: 'aberto', folgas: {} };
  const escala = state.escalaMensal[mes];
  const isCongelado = escala.status === 'congelado';
  
  const badge = document.getElementById('escalaStatusBadge');
  if (isCongelado) {
    badge.className = 'badge badge--success'; badge.innerHTML = '❄️ Mês Congelado';
    document.getElementById('btnCongelarMes').style.display = 'none';
    document.getElementById('btnDescongelarMes').style.display = 'inline-block';
    document.getElementById('btnSalvarEscalaAdmin').style.display = 'none';
  } else {
    badge.className = 'badge badge--warning'; badge.innerHTML = '✏️ Edição Aberta';
    document.getElementById('btnCongelarMes').style.display = 'inline-block';
    document.getElementById('btnDescongelarMes').style.display = 'none';
    document.getElementById('btnSalvarEscalaAdmin').style.display = 'inline-block';
  }

  document.getElementById('col-pedido-modo2').style.display = state.config.modoEscala === '2' ? 'table-cell' : 'none';
  
  const tbody = document.getElementById('lista-escala-admin');
  tbody.innerHTML = funcionariosAtivos().map(f => {
    const req = state.solicitacoes.find(s => s.tipo === 'folga_mensal' && s.mes === mes && s.funcionario === f.nome);
    let pedidoStr = '<span style="color:var(--neutral-300)">—</span>';
    if (req) {
      // Compatibilidade com dados antigos
      const tags = req.datas ? req.datas.map(d => `[${formatarData(d).substring(0,5)}]`).join(' ') : req.diaSemana;
      let actionBtn = '';
      if (req.status === 'Pendente' && !isCongelado) {
        actionBtn = `<div style="margin-top:6px;"><button class="btn btn--success btn--sm" onclick="aprovarSol('${req.id}')">✓ Aprovar</button></div>`;
      }
      pedidoStr = `<div><span class="badge ${req.status==='Pendente'?'badge--warning':'badge--success'}" style="font-size:0.75rem;">${tags}</span></div>${actionBtn}`;
    }
    
    let selected = escala.folgas[f.nome];
    if (!selected && req && req.status === 'Aprovado') selected = req.datas ? [...req.datas] : [req.diaSemana]; // carrega aprovado
    
    // Se ainda não tem array, mostra que usará o padrão (ou vazio)
    let formatado = selected ? (Array.isArray(selected) ? selected.map(d => `[${formatarData(d).substring(0,5)}]`).join(' ') : selected) : '<span style="color:var(--neutral-400); font-size:0.8rem;">(Usará padrão: ' + (f.folga2 || 'Nenhuma') + ')</span>';
    
    let btnHtml = isCongelado ? `<strong>${formatado}</strong>` : `<div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:0.85rem; font-weight:600;">${formatado}</span>
      <button class="btn btn--ghost btn--sm" onclick="abrirModalDatasAdmin('${mes}', '${f.nome}')">✏️ Editar</button>
    </div>`;
    
    return `<tr style="border-bottom: 1px solid var(--neutral-100);">
      <td style="padding:10px; font-weight:600;">${f.nome} <br/><small style="color:var(--neutral-400);">ID: ${f.idPonto || 'S/ID'}</small></td>
      <td style="padding:10px; font-size:0.85rem; color:var(--neutral-500);">${f.turno} · ${f.local}</td>
      <td style="padding:10px; display:${state.config.modoEscala==='2'?'table-cell':'none'};">${pedidoStr}</td>
      <td style="padding:10px;">${btnHtml}</td>
    </tr>`;
  }).join('');
}

/* ── Modal Edição de Datas do Gestor ── */
let adminDatasTemp = [];

window.abrirModalDatasAdmin = function(mes, funcNome) {
  document.getElementById("adminDataMesKey").value = mes;
  document.getElementById("adminDataFuncKey").value = funcNome;
  document.getElementById("adminDataFuncNome").textContent = funcNome;
  document.getElementById("adminDataMesLabel").textContent = mes;
  
  const escala = state.escalaMensal[mes] || { folgas: {} };
  const current = escala.folgas[funcNome];
  adminDatasTemp = current && Array.isArray(current) ? [...current] : [];
  
  renderAdminDatas();
  
  document.getElementById("modal-datas-admin").style.display = "flex";
  document.getElementById("modal-overlay").style.display = "block";
}

function renderAdminDatas() {
  const lista = document.getElementById("admin-lista-datas");
  lista.innerHTML = adminDatasTemp.length ? adminDatasTemp.map((d, i) => `
    <span class="badge badge--info" style="display:flex; align-items:center; gap:4px; font-size:0.8rem; padding:4px 8px;">
      ${formatarData(d)}
      <button onclick="removerAdminDataTemp(${i})" style="background:transparent; border:none; color:inherit; font-size:0.9rem;">&times;</button>
    </span>
  `).join("") : '<span style="color:var(--neutral-400); font-size:0.8rem;">Nenhuma data definida.</span>';
}

window.removerAdminDataTemp = function(index) {
  adminDatasTemp.splice(index, 1);
  renderAdminDatas();
}

document.getElementById("btnAdminAddData").addEventListener("click", () => {
  const data = document.getElementById("adminInputData").value;
  if (!data) return;
  const mesSel = document.getElementById("adminDataMesKey").value;
  
  if (data.substring(0,7) !== mesSel) {
    toast("A data deve pertencer ao mês da escala.", "erro"); return;
  }
  if (adminDatasTemp.includes(data)) {
    toast("Data já adicionada.", "erro"); return;
  }
  
  adminDatasTemp.push(data);
  adminDatasTemp.sort((a, b) => a.localeCompare(b));
  renderAdminDatas();
  document.getElementById("adminInputData").value = "";
});

document.getElementById("btnAdminSalvarData").addEventListener("click", () => {
  const mes = document.getElementById("adminDataMesKey").value;
  const funcNome = document.getElementById("adminDataFuncKey").value;
  
  if (!state.escalaMensal[mes]) state.escalaMensal[mes] = { status: 'aberto', folgas: {} };
  
  // Salva o array (pode ser vazio, significando que zerou as folgas)
  state.escalaMensal[mes].folgas[funcNome] = [...adminDatasTemp];
  
  registrarAudit("Escala Mensal", `Editou manualmente as folgas de ${funcNome} para o mês ${mes}`);
  renderEscalaAdmin();
  sincronizarTodasAsViews();
});

document.getElementById("btnAdminCancelarData").addEventListener("click", fecharModais);


document.getElementById('btnSalvarEscalaAdmin').addEventListener('click', () => {
  const mes = document.getElementById('escalaMesSelect').value;
  // A aba de admin já salva em tempo real no memory state através do modal //
  salvarState(); registrarAudit("Escala Mensal", `Atualizou rascunho de ${mes}`); toast("Salvo com sucesso!"); renderCalendario();
});

document.getElementById('btnCongelarMes').addEventListener('click', () => {
  if(!confirm("Ao congelar o mês, as folgas entrarão no calendário e os pedidos pendentes serão aprovados automaticamente. Confirmar?")) return;
  const mes = document.getElementById('escalaMesSelect').value;
  
  if (!state.escalaMensal[mes]) state.escalaMensal[mes] = { status: 'aberto', folgas: {} };

  // Analisa pedidos pendentes: Se o admin não editou manualmente, herda o pedido e aprova.
  state.solicitacoes.filter(s => s.tipo === 'folga_mensal' && s.mes === mes && s.status === 'Pendente').forEach(s => {
    const definido = state.escalaMensal[mes].folgas[s.funcionario];
    const pedido = s.datas || [];
    
    if (!definido || definido.length === 0) {
      // Admin não sobreescreveu, então aceita o que o funcionário pediu
      state.escalaMensal[mes].folgas[s.funcionario] = [...pedido];
      s.status = 'Aprovado';
      s.aprovadoPor = currentUser.nome;
      s.aprovadoEm = agora();
    } else {
      // Admin definiu algo manualmente. Confere se é igual ao pedido.
      const iguais = definido.length === pedido.length && definido.every(val => pedido.includes(val));
      if (iguais) {
        s.status = 'Aprovado';
        s.aprovadoPor = currentUser.nome;
        s.aprovadoEm = agora();
      } else {
        s.status = 'Recusado';
        s.recusadoPor = currentUser.nome;
        s.recusadoEm = agora();
      }
    }
  });

  state.escalaMensal[mes].status = 'congelado';
  salvarState(); 
  registrarAudit("Escala Mensal", `Congelou o mês ${mes}`); 
  renderEscalaAdmin(); 
  renderCalendario(); 
  renderCentralAprovacoes();
  toast("Mês Congelado!");
});

document.getElementById('btnDescongelarMes').addEventListener('click', () => {
  const mes = document.getElementById('escalaMesSelect').value;
  state.escalaMensal[mes].status = 'aberto';
  salvarState(); registrarAudit("Escala Mensal", `Descongelou o mês ${mes}`); renderEscalaAdmin(); renderCalendario(); toast("Mês Descongelado!");
});

/* ══════════════════════════════════════════════════════════
   10. FUNCIONÁRIOS E FERIADOS
   ══════════════════════════════════════════════════════════ */
function renderFuncionarios() {
  const ativos = funcionariosAtivos();
  const inativos = state.funcionarios.filter(f => f.status === "inativo");
  const arquivados = state.funcionarios.filter(f => f.status === "arquivado");

  document.getElementById("badge-ativos").textContent = ativos.length;
  document.getElementById("badge-inativos").textContent = inativos.length;
  document.getElementById("badge-arquivados").textContent = arquivados.length;

  document.getElementById("lista-funcionarios").innerHTML = ativos.length ? ativos.map(f => cardFuncionario(f, false)).join("") : '<div class="empty-state">Nenhum funcionário ativo.</div>';
  document.getElementById("lista-inativos").innerHTML = inativos.length ? inativos.map(f => cardFuncionario(f, true)).join("") : '<div class="empty-state">Nenhum inativo.</div>';
  document.getElementById("lista-arquivados").innerHTML = arquivados.length ? arquivados.map(f => cardFuncionario(f, false, true)).join("") : '<div class="empty-state">Nenhum funcionário arquivado.</div>';

  const selectExc = document.getElementById("funcionarioExcecao");
  if(selectExc) selectExc.innerHTML = ativos.map(f => `<option value="${f.nome}">${f.nome}</option>`).join("");
}

function cardFuncionario(f, inativo, arquivado = false) {
  const idx = state.funcionarios.indexOf(f);
  let botoes = '';

  if (arquivado) {
    botoes = `<button class="btn btn--primary btn--sm" onclick="restaurarFunc(${idx})">♻️ Restaurar</button>
              <button class="btn btn--danger btn--sm" onclick="excluirFuncionario(${idx})">🗑️ Excluir Permanente</button>`;
  } else if (inativo) {
    botoes = `<button class="btn btn--success btn--sm" onclick="reativarFunc(${idx})">Reativar</button>
              <button class="btn btn--ghost btn--sm" onclick="arquivarFunc(${idx})">📦 Arquivar</button>`;
  } else {
    botoes = `<button class="btn btn--ghost btn--sm" onclick="abrirEdicao(${idx})">✏️</button>
              <button class="btn btn--danger btn--sm" onclick="inativarFunc(${idx})">Inativar</button>`;
  }

  return `<div class="item-funcionario ${inativo || arquivado ? 'item-funcionario--inativo' : ''}">
    <div style="flex:1;">
      <div class="item-func__nome">${f.nome} <span style="font-size:0.8rem; color:var(--neutral-400);">#${f.idPonto || 'S/ID'}</span></div>
      <div class="item-func__meta"><span class="tag-local">${f.local||'—'}</span> <span class="tag-turno">${f.turno||'—'}</span> <span class="tag-folga">🏖️ ${f.folga1} ${f.folga2?"& "+f.folga2:""}</span></div>
      ${f.observacoes ? `<div class="item-func__obs">💬 ${f.observacoes}</div>` : ""}
    </div>
    <div class="acoes-funcionario">${botoes}</div>
  </div>`;
}

document.getElementById("btnAdicionar").addEventListener("click", () => {
  const f = { id:uid(), status:'ativo', criadoEm:agora(),
    idPonto: document.getElementById("idPontoFuncionario").value.trim(),
    nome: document.getElementById("nomeFuncionario").value.trim(), local: document.getElementById("localFuncionario").value,
    turno: document.getElementById("turnoFuncionario").value, folga1: "Segunda",
    folga2: document.getElementById("folga2Funcionario").value, observacoes: document.getElementById("obsFuncionario").value.trim()
  };
  if(!f.idPonto || !f.nome || !f.local || !f.turno) { toast("Preencha ID Ponto, nome, local e turno.", "erro"); return; }
  if (state.funcionarios.some(x => x.nome.toLowerCase() === f.nome.toLowerCase())) {
    toast("Já existe um funcionário com este nome.", "erro"); return;
  }
  if (state.funcionarios.some(x => x.idPonto === f.idPonto)) {
    toast("Este ID Ponto já está em uso.", "erro"); return;
  }
  state.funcionarios.push(f); salvarState(); registrarAudit("Funcionário", `Adicionou ${f.nome}`);
  renderFuncionarios(); renderLoginSelect(); toast("Adicionado!");
  document.getElementById("idPontoFuncionario").value = "";
});

window.inativarFunc = (idx) => { if(confirm("Inativar?")) { state.funcionarios[idx].status='inativo'; registrarAudit("Funcionário", `Inativou: ${state.funcionarios[idx].nome}`); salvarState(); renderFuncionarios(); } };
window.reativarFunc = (idx) => { state.funcionarios[idx].status='ativo'; registrarAudit("Funcionário", `Reativou: ${state.funcionarios[idx].nome}`); salvarState(); renderFuncionarios(); };
window.arquivarFunc = (idx) => { if(confirm("Arquivar funcionário? Ele sairá das listas operacionais mas o histórico será mantido.")) { state.funcionarios[idx].status='arquivado'; registrarAudit("Funcionário", `Arquivou: ${state.funcionarios[idx].nome}`); salvarState(); renderFuncionarios(); } };
window.restaurarFunc = (idx) => { state.funcionarios[idx].status='inativo'; registrarAudit("Funcionário", `Restaurou do arquivo: ${state.funcionarios[idx].nome}`); salvarState(); renderFuncionarios(); };

window.excluirFuncionario = (idx) => {
  const f = state.funcionarios[idx];
  if(confirm(`Tem certeza que deseja excluir permanentemente este funcionário? Esta ação não poderá ser desfeita.`)) {
    state.funcionarios.splice(idx, 1);
    
    state.solicitacoes = state.solicitacoes.filter(s => s.funcionario !== f.nome);
    state.excecoes = state.excecoes.filter(e => e.funcionario !== f.nome);
    Object.keys(state.escalaMensal).forEach(mes => {
      if (state.escalaMensal[mes].folgas && state.escalaMensal[mes].folgas[f.nome]) {
        delete state.escalaMensal[mes].folgas[f.nome];
      }
    });

    registrarAudit("Exclusão", `Excluiu definitivamente o funcionário: ${f.nome}`);
    salvarState();
    sincronizarTodasAsViews();
    renderFuncionarios();
    toast("Funcionário excluído permanentemente!");
  }
};

window.abrirEdicao = (idx) => {
  const f = state.funcionarios[idx];
  document.getElementById("editIndex").value = idx; document.getElementById("editNome").value = f.nome;
  document.getElementById("editIdPonto").value = f.idPonto || "";
  document.getElementById("editLocal").value = f.local; document.getElementById("editTurno").value = f.turno;
  document.getElementById("editFolga2").value = f.folga2; document.getElementById("editObs").value = f.observacoes;
  document.getElementById("modal-edicao").style.display = "flex"; document.getElementById("modal-overlay").style.display = "block";
};

document.getElementById("btnSalvarEdicao").addEventListener("click", () => {
  const idx = document.getElementById("editIndex").value;
  const oldNome = state.funcionarios[idx].nome;
  const newNome = document.getElementById("editNome").value.trim();
  const newIdPonto = document.getElementById("editIdPonto").value.trim();

  if (!newNome || !newIdPonto) { toast("Nome e ID Ponto são obrigatórios.", "erro"); return; }
  if (oldNome !== newNome && state.funcionarios.some(f => f.nome.toLowerCase() === newNome.toLowerCase())) {
    toast("Já existe um funcionário com este nome.", "erro"); return;
  }
  if (state.funcionarios.some((f, i) => f.idPonto === newIdPonto && i != idx)) {
    toast("Este ID Ponto já está em uso por outro funcionário.", "erro"); return;
  }

  // Atualização em cascata para evitar perda de histórico se o nome mudar
  if (oldNome !== newNome) {
    state.solicitacoes.forEach(s => { if(s.funcionario === oldNome) s.funcionario = newNome; });
    state.excecoes.forEach(e => { if(e.funcionario === oldNome) e.funcionario = newNome; });
    Object.keys(state.escalaMensal).forEach(mes => {
      if (state.escalaMensal[mes].folgas && state.escalaMensal[mes].folgas[oldNome]) {
        state.escalaMensal[mes].folgas[newNome] = state.escalaMensal[mes].folgas[oldNome];
        delete state.escalaMensal[mes].folgas[oldNome];
      }
    });
  }

  state.funcionarios[idx] = { ...state.funcionarios[idx],
    idPonto: newIdPonto,
    nome: newNome, local: document.getElementById("editLocal").value,
    turno: document.getElementById("editTurno").value, folga2: document.getElementById("editFolga2").value,
    observacoes: document.getElementById("editObs").value.trim()
  };
  registrarAudit("Funcionário", `Editou: ${newNome}`);
  salvarState(); fecharModais(); renderFuncionarios(); renderCalendario(); toast("Atualizado!");
});

document.getElementById("btnCancelarEdicao").addEventListener("click", fecharModais);
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
    btn.classList.add("active"); document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
  });
});

/* FERIADOS E EXCEÇÕES MANUAIS */
function renderFeriadosExcecoes() {
  document.getElementById("lista-feriados").innerHTML = state.feriados.length ? state.feriados.map((f,i) => `
    <div class="item-feriado"><div class="item-feriado__info"><strong>🎉 ${f.nome}</strong><span>${formatarData(f.data)} · ${f.status}</span></div>
    <button class="btn btn--ghost btn--sm" onclick="rmFeriado(${i})">🗑️</button></div>`).join("") : '<div class="empty-state">Nenhum feriado.</div>';
  
  document.getElementById("lista-excecoes").innerHTML = state.excecoes.length ? state.excecoes.map((e,i) => `
    <div class="item-excecao"><div class="item-excecao__info"><strong>${e.funcionario}</strong><span>${formatarData(e.data)} · ${e.tipo==='folga'?'🏖️ Folga Extra':'✅ Trabalha'}</span></div>
    <button class="btn btn--ghost btn--sm" onclick="rmExcecao(${i})">🗑️</button></div>`).join("") : '<div class="empty-state">Nenhuma exceção manual.</div>';
}

document.getElementById("btnAdicionarFeriado").addEventListener("click", () => {
  const data = document.getElementById("dataFeriado").value; const nome = document.getElementById("nomeFeriado").value.trim();
  const status = document.querySelector('input[name="statusFeriado"]:checked').value;
  if(!data || !nome) return toast("Preencha data e nome.", "erro");
  state.feriados = state.feriados.filter(f => f.data !== data); state.feriados.push({data, nome, status}); //
  registrarAudit("Feriado", `Adicionou/editou feriado: ${nome}`);
  sincronizarTodasAsViews(); renderFeriadosExcecoes(); renderCalendario(); toast("Feriado salvo!"); //
});

document.getElementById("btnAdicionarExcecao").addEventListener("click", () => {
  const funcionario = document.getElementById("funcionarioExcecao").value; const data = document.getElementById("dataExcecao").value;
  const tipo = document.getElementById("tipoExcecao").value;
  if(!funcionario || !data) return toast("Preencha funcionário e data.", "erro");
  const exec = () => {
    state.excecoes = state.excecoes.filter(e => !(e.funcionario === funcionario && e.data === data)); //
    state.excecoes.push({funcionario, data, tipo}); sincronizarTodasAsViews(); renderFeriadosExcecoes(); renderCalendario(); toast("Exceção salva!"); //
  };
  if(tipo==='folga') verificarCoberturaAposAcao(funcionario, data, exec); else exec();
});

window.rmFeriado = (i) => { state.feriados.splice(i,1); sincronizarTodasAsViews(); renderFeriadosExcecoes(); toast("Feriado removido."); }; //
window.rmExcecao = (i) => { state.excecoes.splice(i,1); sincronizarTodasAsViews(); renderFeriadosExcecoes(); toast("Exceção removida."); }; //


/* ══════════════════════════════════════════════════════════
   11. RELATÓRIOS
   ══════════════════════════════════════════════════════════ */

const reportConfig = {
  'dashboard': { nome: '📈 Dashboard', render: renderRelatorioDashboard },
  'escala': { nome: '📅 Escala Mensal', render: renderRelatorioEscala },
  'trocas': { nome: '🔄 Trocas de Folga', render: renderRelatorioTrocas },
  'movimentacoes': { nome: '📋 Movimentações', render: renderRelatorioMovimentacoes },
  'cobertura': { nome: '👥 Cobertura', render: renderRelatorioCobertura },
  'excecoes': { nome: '⚙️ Exceções', render: renderRelatorioExcecoes },
  'feriados': { nome: '🎉 Feriados', render: renderRelatorioFeriados },
  'auditoria': { nome: '📜 Auditoria', render: renderRelatorioAuditoria },
};

let activeReportTab = 'dashboard';

function renderRelatorios() {
  if (!currentUser || currentUser.role !== 'admin') return;

  const tabsContainer = document.getElementById('relatorios-tabs-container');
  if (!tabsContainer) return;

  tabsContainer.innerHTML = Object.keys(reportConfig).map(key =>
    `<button class="tab-btn ${activeReportTab === key ? 'active' : ''}" data-tab="${key}">${reportConfig[key].nome}</button>`
  ).join('');

  tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeReportTab = btn.dataset.tab;
      renderRelatorios();
    });
  });

  const contentContainer = document.getElementById('relatorios-content-container');
  contentContainer.innerHTML = '';
  
  if (reportConfig[activeReportTab] && typeof reportConfig[activeReportTab].render === 'function') {
    reportConfig[activeReportTab].render(contentContainer);
  }
}

function getReportCardHTML(title, value) {
  return `<div class="info-card"><span class="info-card__label">${title}</span><span class="info-card__value">${value}</span></div>`;
}

function getReportWrapperHTML(reportKey, title, filtersHTML, tableId) {
  return `
    <div class="card">
      <h2 class="card-title">${title}</h2>
      <div class="report-filters">${filtersHTML}</div>
      <div class="report-actions">
        <button id="btn-view-${reportKey}" class="btn btn--primary">📊 Visualizar Relatório</button>
        <button id="btn-print-${reportKey}" class="btn btn--ghost">🖨️ Imprimir</button>
        <button id="btn-csv-${reportKey}" class="btn btn--ghost">📄 Exportar CSV</button>
      </div>
      <div class="report-table-container" id="${tableId}-wrapper" style="display:none;">
        <table class="table" style="width:100%; text-align:left; border-collapse:collapse;" id="${tableId}">
          <!-- Content will be generated here -->
        </table>
      </div>
    </div>`;
}

function imprimirRelatorio(tableId, titulo) {
    const tableContainer = document.getElementById(tableId + "-wrapper");
    if (!tableContainer || tableContainer.style.display === 'none') {
      toast("Gere um relatório para imprimir.", "erro");
      return;
    }
    const printContents = tableContainer.innerHTML;
    const printWindow = window.open('', '', 'height=800,width=1000');
    printWindow.document.write('<html><head><title>' + document.title + '</title>');
    printWindow.document.write('<link rel="stylesheet" href="style.css" type="text/css" />');
    printWindow.document.write(`
      <style>
        body { padding: 20px; background: #fff; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        thead { background-color: #f2f2f2; }
      </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write(`<h1>${titulo}</h1>`);
    printWindow.document.write(printContents);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

function exportarRelatorioCSV(tableId, filename) {
    const tableContainer = document.getElementById(tableId + "-wrapper");
    if (!tableContainer || tableContainer.style.display === 'none') {
      toast("Gere um relatório para exportar.", "erro");
      return;
    }
    const table = document.getElementById(tableId);
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll("tr");
    
    for (const row of rows) {
        const cols = row.querySelectorAll("td, th");
        const rowData = [];
        for (const col of cols) {
            let data = col.innerText.replace(/"/g, '""');
            if (data.includes(',') || data.includes('\n')) {
                data = `"${data}"`;
            }
            rowData.push(data);
        }
        csv.push(rowData.join(","));
    }

    const csvFile = new Blob([csv.join("\n")], {type: "text/csv;charset=utf-8;"});
    const downloadLink = document.createElement("a");
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function renderRelatorioDashboard(container) {
  const mesAtual = chavesMes(new Date());
  const cards = [
    { title: 'Funcionários Ativos', value: funcionariosAtivos().length },
    { title: 'Funcionários Inativos', value: state.funcionarios.filter(f => f.status !== 'ativo').length },
    { title: 'Solicitações Pendentes', value: state.solicitacoes.filter(s => s.status === 'Pendente').length },
    { title: 'Aprovadas no Mês', value: state.solicitacoes.filter(s => s.status === 'Aprovado' && (s.aprovadoEm || s.criadoEm).startsWith(mesAtual)).length },
    { title: 'Folgas no Mês', value: state.solicitacoes.filter(s => s.tipo === 'ausencia' && s.status === 'Aprovado' && s.data.startsWith(mesAtual)).length },
    { title: 'Ausências no Mês', value: state.solicitacoes.filter(s => s.tipo === 'ausencia' && s.status === 'Aprovado' && s.data.startsWith(mesAtual)).length },
    { title: 'Férias no Mês', value: state.solicitacoes.filter(s => s.tipo === 'ferias' && s.status === 'Aprovado' && s.dataInicio.startsWith(mesAtual)).length },
    { title: 'Trocas no Mês', value: state.solicitacoes.filter(s => s.tipo === 'troca' && s.status === 'Aprovado' && s.novaData.startsWith(mesAtual)).length },
    { title: 'Exceções no Mês', value: state.excecoes.filter(e => e.data.startsWith(mesAtual)).length },
    { title: 'Feriados Cadastrados', value: state.feriados.length },
  ];

  container.innerHTML = `
    <div class="card">
      <h2 class="card-title">Dashboard Executivo</h2>
      <div class="cards-info" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        ${cards.map(c => getReportCardHTML(c.title, c.value)).join('')}
      </div>
    </div>`;
}

function renderRelatorioEscala(container) {
  const reportKey = 'escala';
  const title = 'Relatório de Escala Mensal';
  const tableId = 'table-report-escala';

  // Estrutura de Filtros (Mês, Funcionário e Local)
  const filtersHTML = `
    <div><label class="form-label">Mês</label><select id="filtro-escala-mes" class="input"></select></div>
    <div><label class="form-label">Funcionário</label><select id="filtro-escala-func" class="input"></select></div>
    <div><label class="form-label">Local</label><select id="filtro-escala-local" class="input">
      <option value="">Todos os locais</option><option>Campo Duna</option><option>Casa Kimo</option><option>Ambos</option>
    </select></div>
  `;
  container.innerHTML = getReportWrapperHTML(reportKey, title, filtersHTML, tableId);

  // Populando os filtros via JS
  const hoje = new Date();
  const mesSelect = document.getElementById('filtro-escala-mes');
  for (let i = -6; i <= 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    mesSelect.innerHTML += `<option value="${chavesMes(d)}" ${i===0 ? 'selected' : ''}>${MESES_PT[d.getMonth()]} ${d.getFullYear()}</option>`;
  }
  document.getElementById('filtro-escala-func').innerHTML = `<option value="">Todos</option>` + funcionariosAtivos().map(f => `<option value="${f.nome}">${f.nome}</option>`).join('');

  const tableContainer = document.getElementById(`${tableId}-wrapper`);
  const table = document.getElementById(tableId);

  // Lógica de Geração da Tabela
  const renderTable = () => {
    const mes = document.getElementById('filtro-escala-mes').value;
    const funcFiltro = document.getElementById('filtro-escala-func').value;
    const localFiltro = document.getElementById('filtro-escala-local').value;

    let equipe = funcionariosAtivos();
    if (funcFiltro) equipe = equipe.filter(f => f.nome === funcFiltro);
    if (localFiltro) equipe = equipe.filter(f => f.local === localFiltro || f.local === "Ambos");

    const escala = state.escalaMensal[mes] || { folgas: {} };

    let linhas = equipe.map(f => {
      const folgasDefinidas = escala.folgas[f.nome];
      let formatoFolga2 = '<span style="color:var(--neutral-400); font-size: 0.85rem;">Padrão: ' + (f.folga2 || 'Nenhuma') + '</span>';
      
      if (folgasDefinidas) {
        if (Array.isArray(folgasDefinidas)) {
          formatoFolga2 = folgasDefinidas.length > 0 
            ? folgasDefinidas.map(d => `<span class="badge badge--info">${formatarData(d)}</span>`).join(' ')
            : '<span style="color:var(--danger); font-weight:600; font-size:0.85rem;">Zerar (Sem folga)</span>';
        } else {
           formatoFolga2 = `<span class="badge badge--info">${folgasDefinidas}</span>`;
        }
      }

      return `
        <tr style="border-bottom: 1px solid var(--neutral-100);">
          <td style="padding:10px; font-weight: 600;">${f.nome} <br/><small style="color:var(--neutral-400);">ID: ${f.idPonto || 'S/ID'}</small></td>
          <td style="padding:10px; font-size: 0.85rem;">${f.local}</td>
          <td style="padding:10px; font-size: 0.85rem;">${f.turno}</td>
          <td style="padding:10px;"><span class="badge badge--success">${f.folga1}</span></td>
          <td style="padding:10px;">${formatoFolga2}</td>
        </tr>
      `;
    }).join('');

    if (!linhas) linhas = '<tr><td colspan="5" class="empty-state" style="padding:15px; text-align:center;">Nenhum funcionário encontrado para estes filtros.</td></tr>';

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--neutral-100);">
          <th style="padding:10px;">Funcionário</th>
          <th style="padding:10px;">Local</th>
          <th style="padding:10px;">Turno</th>
          <th style="padding:10px;">1ª Folga (Fixa)</th>
          <th style="padding:10px;">2ª Folga (Mensal/Padrão)</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    `;
    tableContainer.style.display = 'block';
  };

  // Liga as ações aos botões de relatório
  document.getElementById(`btn-view-${reportKey}`).addEventListener('click', renderTable);
  document.getElementById(`btn-print-${reportKey}`).addEventListener('click', () => imprimirRelatorio(tableId, title));
  document.getElementById(`btn-csv-${reportKey}`).addEventListener('click', () => exportarRelatorioCSV(tableId, 'relatorio_escala.csv'));
}

function renderRelatorioTrocas(container) {
  const reportKey = 'trocas';
  const title = 'Relatório de Trocas de Folga';
  const tableId = 'table-report-trocas';

  // Filtros de Mês e Status
  const filtersHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; grid-column: 1 / -1;">
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Mês da Troca</label>
        <select id="filtro-trocas-mes" class="input"><option value="todos">Todos os meses</option></select>
      </div>
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Status</label>
        <select id="filtro-trocas-status" class="input">
          <option value="todos">Todos</option>
          <option value="Aprovado">Aprovado</option>
          <option value="Pendente">Pendente</option>
          <option value="Recusado">Recusado</option>
        </select>
      </div>
    </div>
  `;

  container.innerHTML = getReportWrapperHTML(reportKey, title, filtersHTML, tableId);

  // Populando os meses com base no histórico real de trocas
  const selectMes = document.getElementById('filtro-trocas-mes');
  const mesesDisponiveis = [...new Set(state.solicitacoes.filter(s => s.tipo === 'troca').map(s => s.dataOriginal.substring(0,7)))].sort().reverse();
  mesesDisponiveis.forEach(m => selectMes.innerHTML += `<option value="${m}">${m}</option>`);

  const tableContainer = document.getElementById(`${tableId}-wrapper`);
  const table = document.getElementById(tableId);

  const renderTable = () => {
    const mes = selectMes.value;
    const status = document.getElementById('filtro-trocas-status').value;

    let trocas = state.solicitacoes.filter(s => s.tipo === 'troca').reverse();

    // Aplicação dos Filtros
    if (mes !== 'todos') trocas = trocas.filter(s => s.dataOriginal.startsWith(mes) || s.novaData.startsWith(mes));
    if (status !== 'todos') trocas = trocas.filter(s => s.status === status);

    let linhas = trocas.map(s => {
       const badgeClass = s.status === 'Aprovado' ? 'badge--success' : (s.status === 'Pendente' ? 'badge--warning' : 'badge--danger');
       return `
         <tr style="border-bottom: 1px solid var(--neutral-100);">
           <td style="padding:10px; font-size:0.85rem;">${formatarData(s.criadoEm.split(' ')[0])}</td>
           <td style="padding:10px; font-weight:600;">${s.funcionario}</td>
           <td style="padding:10px;"><span class="badge" style="text-decoration:line-through; color:var(--danger);">${formatarData(s.dataOriginal)}</span></td>
           <td style="padding:10px;"><span class="badge badge--info">${formatarData(s.novaData)}</span></td>
           <td style="padding:10px;"><span class="badge ${badgeClass}">${s.status}</span></td>
           <td style="padding:10px; font-size:0.8rem; color:var(--neutral-500);">${s.motivo || '-'}</td>
         </tr>
       `;
    }).join('');

    if (!linhas) linhas = '<tr><td colspan="6" class="empty-state" style="padding:15px; text-align:center;">Nenhuma troca encontrada com estes filtros.</td></tr>';

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--neutral-100);">
          <th style="padding:10px;">Solicitado em</th>
          <th style="padding:10px;">Funcionário</th>
          <th style="padding:10px;">Dia Original (Trabalha)</th>
          <th style="padding:10px;">Nova Data (Folga)</th>
          <th style="padding:10px;">Status</th>
          <th style="padding:10px;">Motivo</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    `;
    tableContainer.style.display = 'block';
  };

  // Conectando Ações
  document.getElementById(`btn-view-${reportKey}`).addEventListener('click', renderTable);
  document.getElementById(`btn-print-${reportKey}`).addEventListener('click', () => imprimirRelatorio(tableId, title));
  document.getElementById(`btn-csv-${reportKey}`).addEventListener('click', () => exportarRelatorioCSV(tableId, 'relatorio_trocas.csv'));
}

function getMesOperacional(s) {
  if (s.tipo === 'ausencia' && s.data) return s.data.substring(0, 7);
  if (s.tipo === 'troca' && s.dataOriginal) return s.dataOriginal.substring(0, 7);
  if (s.tipo === 'ferias' && s.dataInicio) return s.dataInicio.substring(0, 7);
  if (s.tipo === 'folga_mensal' && s.mes) return s.mes;
  return '';
}

function formatarDataHora(str) {
  if (!str) return '';
  const parts = str.split(' ');
  return formatarData(parts[0]) + (parts[1] ? ' ' + parts[1] : '');
}

function renderRelatorioMovimentacoes(container) {
  const reportKey = 'movimentacoes';
  const title = 'Relatório de Movimentações do Mês';
  const tableId = 'table-report-movimentacoes';

  // Filtros: Mês, Funcionário e Status
  const filtersHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; grid-column: 1 / -1;">
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Mês</label>
        <select id="filtro-movimentacoes-mes" class="input"><option value="todos">Todos os meses</option></select>
      </div>
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Funcionário</label>
        <select id="filtro-movimentacoes-func" class="input"><option value="todos">Todos</option></select>
      </div>
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Tipo</label>
        <select id="filtro-movimentacoes-tipo" class="input">
          <option value="todos">Todos</option>
          <option value="folga_mensal">🏖️ Folga Mensal</option>
          <option value="troca">🔄 Troca</option>
          <option value="ausencia">🚫 Ausência</option>
          <option value="ferias">🌴 Férias</option>
        </select>
      </div>
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Status</label>
        <select id="filtro-movimentacoes-status" class="input">
          <option value="todos">Todos</option>
          <option value="Aprovado">Aprovado</option>
          <option value="Pendente">Pendente</option>
          <option value="Recusado">Recusado</option>
        </select>
      </div>
    </div>
  `;

  container.innerHTML = getReportWrapperHTML(reportKey, title, filtersHTML, tableId);

  // Populando os meses com base no mês operacional
  const selectMes = document.getElementById('filtro-movimentacoes-mes');
  const mesesDisponiveis = [...new Set(state.solicitacoes.map(s => getMesOperacional(s)).filter(m => m !== ''))].sort().reverse();
  mesesDisponiveis.forEach(m => selectMes.innerHTML += `<option value="${m}">${m}</option>`);

  // Populando a lista de funcionários com base nas solicitações existentes
  const selectFunc = document.getElementById('filtro-movimentacoes-func');
  const funcsDisponiveis = [...new Set(state.solicitacoes.map(s => s.funcionario))].sort();
  funcsDisponiveis.forEach(f => selectFunc.innerHTML += `<option value="${f}">${f}</option>`);

  const tableContainer = document.getElementById(`${tableId}-wrapper`);
  const table = document.getElementById(tableId);

  const renderTable = () => {
    const mes = selectMes.value;
    const func = selectFunc.value;
    const tipo = document.getElementById('filtro-movimentacoes-tipo').value;
    const status = document.getElementById('filtro-movimentacoes-status').value;

    let movs = [...state.solicitacoes];

    // Aplicação dos Filtros
    if (mes !== 'todos') movs = movs.filter(s => getMesOperacional(s) === mes);
    if (func !== 'todos') movs = movs.filter(s => s.funcionario === func);
    if (tipo !== 'todos') movs = movs.filter(s => s.tipo === tipo);
    if (status !== 'todos') movs = movs.filter(s => s.status === status);

    // Ordenação (Data Evento decrescente)
    movs.sort((a, b) => {
      const getIso = (s) => {
        if (s.tipo === 'ausencia') return s.data || '';
        if (s.tipo === 'troca') return s.dataOriginal || '';
        if (s.tipo === 'ferias') return s.dataInicio || '';
        if (s.tipo === 'folga_mensal') return (s.datas && s.datas.length > 0) ? s.datas[0] : (s.mes ? s.mes + '-01' : '');
        return '';
      };
      return getIso(b).localeCompare(getIso(a));
    });

    let linhas = movs.map(s => {
      let dataEvento = '-';
      let detalhes = '-';
      let labelTipo = '';

      if (s.tipo === 'ausencia') {
        labelTipo = '🚫 Ausência';
        dataEvento = s.data ? formatarData(s.data) : '-';
        detalhes = s.motivo || '-';
      } else if (s.tipo === 'troca') {
        labelTipo = '🔄 Troca';
        dataEvento = s.dataOriginal ? formatarData(s.dataOriginal) : '-';
        detalhes = `${s.dataOriginal} → ${s.novaData}`;
      } else if (s.tipo === 'ferias') {
        labelTipo = '🌴 Férias';
        dataEvento = s.dataInicio ? formatarData(s.dataInicio) : '-';
        detalhes = `${s.dataInicio} até ${s.dataFim}`;
      } else if (s.tipo === 'folga_mensal') {
        labelTipo = '🏖️ Folga Mensal';
        dataEvento = s.datas && s.datas.length > 0 ? formatarData(s.datas[0]) : s.diaSemana || '-';
        detalhes = s.datas ? s.datas.join(', ') : s.diaSemana || '-';
      }

      const badgeClass = s.status === 'Aprovado' ? 'badge--success' : (s.status === 'Pendente' ? 'badge--warning' : 'badge--danger');
      const f = state.funcionarios.find(func => func.nome === s.funcionario);

      return `
        <tr style="border-bottom: 1px solid var(--neutral-100);">
          <td style="padding:10px; font-weight:600;">${dataEvento}</td>
          <td style="padding:10px; font-size:0.85rem;">${formatarDataHora(s.criadoEm)}</td>
          <td style="padding:10px; font-weight:600;">${s.funcionario} <br/><small style="color:var(--neutral-400);">ID: ${f ? (f.idPonto || 'S/ID') : 'Excluído'}</small></td>
          <td style="padding:10px;">${labelTipo}</td>
          <td style="padding:10px;"><span class="badge ${badgeClass}">${s.status}</span></td>
          <td style="padding:10px; font-size:0.85rem; color:var(--neutral-500);">${detalhes}</td>
        </tr>
      `;
    }).join('');

    if (!linhas) linhas = '<tr><td colspan="6" class="empty-state" style="padding:15px; text-align:center;">Nenhuma movimentação encontrada para estes filtros.</td></tr>';

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--neutral-100);">
          <th style="padding:10px;">Data Evento</th>
          <th style="padding:10px;">Data Solicitação</th>
          <th style="padding:10px;">Funcionário</th>
          <th style="padding:10px;">Tipo</th>
          <th style="padding:10px;">Status</th>
          <th style="padding:10px;">Detalhes</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    `;

    // Estatísticas e Cabeçalho de Impressão
    const mesLabel = selectMes.options[selectMes.selectedIndex].text;
    const funcLabel = selectFunc.options[selectFunc.selectedIndex].text;
    const tipoLabel = document.getElementById('filtro-movimentacoes-tipo').options[document.getElementById('filtro-movimentacoes-tipo').selectedIndex].text;
    const statusLabel = document.getElementById('filtro-movimentacoes-status').options[document.getElementById('filtro-movimentacoes-status').selectedIndex].text;

    let htmlStats = `
      <div style="margin-bottom: 15px; padding: 15px; background: var(--brand-50); border: 1px solid var(--brand-100); border-radius: var(--radius-sm);">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
          <strong style="color:var(--brand-700); font-size:1.1rem;">Movimentações: ${movs.length}</strong>
          <span style="font-size:0.8rem; color:var(--neutral-500);">Emitido em: ${formatarDataHora(agora())}</span>
        </div>
        <div style="font-size:0.85rem; color:var(--neutral-700); margin-bottom:10px;">
          <strong>Filtros aplicados:</strong> Mês: ${mesLabel} | Funcionário: ${funcLabel} | Tipo: ${tipoLabel} | Status: ${statusLabel}
        </div>
        <div style="display:flex; gap: 15px; flex-wrap:wrap; font-size:0.85rem; padding-top:10px; border-top:1px solid var(--brand-100);">
          <span>🏖️ Folgas: ${movs.filter(m => m.tipo === 'folga_mensal').length}</span>
          <span>🔄 Trocas: ${movs.filter(m => m.tipo === 'troca').length}</span>
          <span>🚫 Ausências: ${movs.filter(m => m.tipo === 'ausencia').length}</span>
          <span>🌴 Férias: ${movs.filter(m => m.tipo === 'ferias').length}</span>
        </div>
      </div>
    `;

    let statsDiv = document.getElementById(`${tableId}-stats`);
    if (!statsDiv) {
      statsDiv = document.createElement('div');
      statsDiv.id = `${tableId}-stats`;
      tableContainer.insertBefore(statsDiv, table);
    }
    statsDiv.innerHTML = htmlStats;

    tableContainer.style.display = 'block';
  };

  // Conectando Ações
  document.getElementById(`btn-view-${reportKey}`).addEventListener('click', renderTable);
  document.getElementById(`btn-print-${reportKey}`).addEventListener('click', () => imprimirRelatorio(tableId, title));
  document.getElementById(`btn-csv-${reportKey}`).addEventListener('click', () => exportarRelatorioCSV(tableId, 'relatorio_movimentacoes.csv'));
}

function renderRelatorioCobertura(container) {
  const reportKey = 'cobertura';
  const title = 'Relatório de Cobertura Operacional';
  const tableId = 'table-report-cobertura';

  // Filtro de dias para projeção
  const filtersHTML = `
    <div style="grid-column: 1 / -1;">
      <label class="form-label">Período de Projeção</label>
      <select id="filtro-cobertura-dias" class="input">
        <option value="7">Próximos 7 dias</option>
        <option value="15" selected>Próximos 15 dias</option>
        <option value="30">Próximos 30 dias</option>
      </select>
    </div>
  `;

  container.innerHTML = getReportWrapperHTML(reportKey, title, filtersHTML, tableId);

  const tableContainer = document.getElementById(`${tableId}-wrapper`);
  const table = document.getElementById(tableId);

  const renderTable = () => {
    const dias = parseInt(document.getElementById('filtro-cobertura-dias').value);
    const hojeDate = new Date();
    const minCampo = parseInt(state.config.minCampoDuna) || 1;
    const minKimo = parseInt(state.config.minCasaKimo) || 2;
    const ativos = funcionariosAtivos();
    
    let linhas = '';

    for(let i=0; i<dias; i++) {
      const d = new Date(hojeDate);
      d.setDate(hojeDate.getDate() + i);
      const dataISO = toISO(d);
      
      // Se a loja estiver fechada (Segunda ou Feriado)
      if (lojaFechada(dataISO)) {
        linhas += `
          <tr style="border-bottom: 1px solid var(--neutral-100); background-color: var(--closed-bg);">
            <td style="padding:10px; font-weight:600;">${formatarData(dataISO)}</td>
            <td colspan="3" style="padding:10px; text-align:center; color: var(--closed-color); font-weight: 600;">🔒 Loja Fechada / Feriado</td>
          </tr>
        `;
        continue;
      }

      const fData = folgasNaData(dataISO);
      const aData = ausentesNaData(dataISO);
      
      // Cálculos para Campo Duna
      const totCampo = ativos.filter(x => x.local === "Campo Duna" || x.local === "Ambos").length;
      const folgasCampo = fData.filter(x => x.local === "Campo Duna" || x.local === "Ambos").length;
      const ausCampo = aData.filter(x => x.local === "Campo Duna" || x.local === "Ambos").length;
      const dispCampo = totCampo - (folgasCampo + ausCampo);
      const statusCampo = dispCampo < minCampo ? 
        `<span class="badge badge--warning">⚠️ ${dispCampo} disp. (Mín: ${minCampo})</span>` : 
        `<span class="badge badge--success">OK: ${dispCampo} disp.</span>`;
      
      // Cálculos para Casa Kimo
      const totKimo = ativos.filter(x => x.local === "Casa Kimo" || x.local === "Ambos").length;
      const folgasKimo = fData.filter(x => x.local === "Casa Kimo" || x.local === "Ambos").length;
      const ausKimo = aData.filter(x => x.local === "Casa Kimo" || x.local === "Ambos").length;
      const dispKimo = totKimo - (folgasKimo + ausKimo);
      const statusKimo = dispKimo < minKimo ? 
        `<span class="badge badge--warning">⚠️ ${dispKimo} disp. (Mín: ${minKimo})</span>` : 
        `<span class="badge badge--success">OK: ${dispKimo} disp.</span>`;

      const nomesOff = [...fData.map(f => f.nome), ...aData.map(f => f.nome + " (Aus.)")];

      linhas += `
        <tr style="border-bottom: 1px solid var(--neutral-100);">
          <td style="padding:10px; font-weight: 600;">${formatarData(dataISO)}</td>
          <td style="padding:10px;">${statusCampo}</td>
          <td style="padding:10px;">${statusKimo}</td>
          <td style="padding:10px; font-size: 0.85rem; color: var(--neutral-500);">
            ${fData.length ? fData.map(f => f.nome).join(', ') : 'Equipe Completa'}
            ${nomesOff.length ? nomesOff.join(', ') : 'Equipe Completa'}
          </td>
        </tr>
      `;
    }

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--neutral-100);">
          <th style="padding:10px;">Data</th>
          <th style="padding:10px;">Campo Duna</th>
          <th style="padding:10px;">Casa Kimo</th>
          <th style="padding:10px;">Em Folga</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    `;
    tableContainer.style.display = 'block';
  };

  // Liga as ações aos botões de relatório
  document.getElementById(`btn-view-${reportKey}`).addEventListener('click', renderTable);
  document.getElementById(`btn-print-${reportKey}`).addEventListener('click', () => imprimirRelatorio(tableId, title));
  document.getElementById(`btn-csv-${reportKey}`).addEventListener('click', () => exportarRelatorioCSV(tableId, 'relatorio_cobertura.csv'));
  
  // Recalcula a tabela se o usuário mudar o filtro de período
  document.getElementById('filtro-cobertura-dias').addEventListener('change', () => {
    if (tableContainer.style.display === 'block') renderTable();
  });
}
function renderRelatorioExcecoes(container) {
  const reportKey = 'excecoes';
  const title = 'Relatório de Exceções Administrativas';
  const tableId = 'table-report-excecoes';

  // Estrutura de Filtros (Mês e Funcionário)
  const filtersHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; grid-column: 1 / -1;">
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Mês da Exceção</label>
        <select id="filtro-excecoes-mes" class="input"><option value="todos">Todos os meses</option></select>
      </div>
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Funcionário</label>
        <select id="filtro-excecoes-func" class="input"><option value="todos">Todos</option></select>
      </div>
    </div>
  `;

  container.innerHTML = getReportWrapperHTML(reportKey, title, filtersHTML, tableId);

  // Populando os filtros com base nos dados reais de exceções
  const selectMes = document.getElementById('filtro-excecoes-mes');
  const mesesDisponiveis = [...new Set(state.excecoes.map(e => e.data.substring(0,7)))].sort().reverse();
  mesesDisponiveis.forEach(m => selectMes.innerHTML += `<option value="${m}">${m}</option>`);

  const selectFunc = document.getElementById('filtro-excecoes-func');
  const funcsDisponiveis = [...new Set(state.excecoes.map(e => e.funcionario))].sort();
  funcsDisponiveis.forEach(f => selectFunc.innerHTML += `<option value="${f}">${f}</option>`);

  const tableContainer = document.getElementById(`${tableId}-wrapper`);
  const table = document.getElementById(tableId);

  const renderTable = () => {
    const mes = selectMes.value;
    const func = selectFunc.value;

    let excecoesFiltradas = [...state.excecoes].sort((a, b) => b.data.localeCompare(a.data));

    // Aplicação dos Filtros
    if (mes !== 'todos') excecoesFiltradas = excecoesFiltradas.filter(e => e.data.startsWith(mes));
    if (func !== 'todos') excecoesFiltradas = excecoesFiltradas.filter(e => e.funcionario === func);

    let linhas = excecoesFiltradas.map(e => {
       // Define o visual baseado no tipo de exceção (Folga Extra ou Trabalha)
       const badgeTipo = e.tipo === 'folga' 
         ? '<span class="badge badge--info">🏖️ Folga Extra</span>' 
         : '<span class="badge badge--warning">✅ Trabalha (Cancela Folga)</span>';
         
       return `
         <tr style="border-bottom: 1px solid var(--neutral-100);">
           <td style="padding:10px; font-weight:600;">${formatarData(e.data)}</td>
           <td style="padding:10px;">${e.funcionario}</td>
           <td style="padding:10px;">${badgeTipo}</td>
         </tr>
       `;
    }).join('');

    if (!linhas) linhas = '<tr><td colspan="3" class="empty-state" style="padding:15px; text-align:center;">Nenhuma exceção encontrada para estes filtros.</td></tr>';

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--neutral-100);">
          <th style="padding:10px;">Data da Exceção</th>
          <th style="padding:10px;">Funcionário</th>
          <th style="padding:10px;">Tipo de Exceção</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    `;
    tableContainer.style.display = 'block';
  };

  // Conectando Ações aos Botões
  document.getElementById(`btn-view-${reportKey}`).addEventListener('click', renderTable);
  document.getElementById(`btn-print-${reportKey}`).addEventListener('click', () => imprimirRelatorio(tableId, title));
  document.getElementById(`btn-csv-${reportKey}`).addEventListener('click', () => exportarRelatorioCSV(tableId, 'relatorio_excecoes.csv'));
}
function renderRelatorioFeriados(container) {
  const reportKey = 'feriados';
  const title = 'Relatório de Feriados e Eventos';
  const tableId = 'table-report-feriados';

  // Estrutura de Filtros (Mês e Status)
  const filtersHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; grid-column: 1 / -1;">
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Mês/Ano</label>
        <select id="filtro-feriados-mes" class="input"><option value="todos">Todos os meses</option></select>
      </div>
      <div style="flex:1; min-width:150px;">
        <label class="form-label">Status da Loja</label>
        <select id="filtro-feriados-status" class="input">
          <option value="todos">Todos</option>
          <option value="fechado">Loja Fechada</option>
          <option value="aberto">Loja Aberta</option>
        </select>
      </div>
    </div>
  `;

  container.innerHTML = getReportWrapperHTML(reportKey, title, filtersHTML, tableId);

  // Populando os filtros com base nos dados reais
  const selectMes = document.getElementById('filtro-feriados-mes');
  const mesesDisponiveis = [...new Set(state.feriados.map(f => f.data.substring(0,7)))].sort().reverse();
  mesesDisponiveis.forEach(m => selectMes.innerHTML += `<option value="${m}">${m}</option>`);

  const tableContainer = document.getElementById(`${tableId}-wrapper`);
  const table = document.getElementById(tableId);

  const renderTable = () => {
    const mes = selectMes.value;
    const status = document.getElementById('filtro-feriados-status').value;

    let feriadosFiltrados = [...state.feriados].sort((a, b) => b.data.localeCompare(a.data));

    // Aplicação dos Filtros
    if (mes !== 'todos') feriadosFiltrados = feriadosFiltrados.filter(f => f.data.startsWith(mes));
    if (status !== 'todos') feriadosFiltrados = feriadosFiltrados.filter(f => f.status === status);

    let linhas = feriadosFiltrados.map(f => {
       const badgeStatus = f.status === 'fechado' 
         ? '<span class="badge badge--danger">🔒 Loja Fechada</span>' 
         : '<span class="badge badge--success">🔓 Loja Aberta</span>';
         
       // Utiliza a função auxiliar já existente no sistema para pegar o dia da semana
       const diaSemana = diaSemanaDate(new Date(f.data + "T12:00:00"));
         
       return `
         <tr style="border-bottom: 1px solid var(--neutral-100);">
           <td style="padding:10px; font-weight:600;">${formatarData(f.data)}</td>
           <td style="padding:10px; color:var(--neutral-500); font-size:0.85rem;">${diaSemana}</td>
           <td style="padding:10px; font-weight:600;">🎉 ${f.nome}</td>
           <td style="padding:10px;">${badgeStatus}</td>
         </tr>
       `;
    }).join('');

    if (!linhas) linhas = '<tr><td colspan="4" class="empty-state" style="padding:15px; text-align:center;">Nenhum feriado encontrado para estes filtros.</td></tr>';

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--neutral-100);">
          <th style="padding:10px;">Data</th>
          <th style="padding:10px;">Dia da Semana</th>
          <th style="padding:10px;">Feriado / Evento</th>
          <th style="padding:10px;">Status da Loja</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    `;
    tableContainer.style.display = 'block';
  };

  // Conectando Ações aos Botões
  document.getElementById(`btn-view-${reportKey}`).addEventListener('click', renderTable);
  document.getElementById(`btn-print-${reportKey}`).addEventListener('click', () => imprimirRelatorio(tableId, title));
  document.getElementById(`btn-csv-${reportKey}`).addEventListener('click', () => exportarRelatorioCSV(tableId, 'relatorio_feriados.csv'));
}
function renderRelatorioAuditoria(container) {
  const reportKey = 'auditoria';
  const title = 'Relatório de Auditoria';
  const tableId = 'table-report-auditoria';

  // Criamos um filtro de busca em tempo real
  const filtersHTML = `
    <div style="grid-column: 1 / -1;">
      <label class="form-label">Buscar Ação, Descrição ou Usuário</label>
      <input type="text" id="filtro-audit-busca" class="input" placeholder="Digite para filtrar..." />
    </div>
  `;

  // Injeta a estrutura base (Filtros, Botões e Tabela oculta)
  container.innerHTML = getReportWrapperHTML(reportKey, title, filtersHTML, tableId);

  const tableContainer = document.getElementById(`${tableId}-wrapper`);
  const table = document.getElementById(tableId);

  // Função que renderiza as linhas da tabela baseada no filtro
  const renderTable = () => {
    const busca = document.getElementById('filtro-audit-busca').value.toLowerCase();
    const logs = [...state.audit].reverse().filter(a => 
      a.acao.toLowerCase().includes(busca) || 
      a.descricao.toLowerCase().includes(busca) || 
      (a.por && a.por.toLowerCase().includes(busca))
    );

    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 2px solid var(--neutral-100);">
          <th style="padding:10px;">Data/Hora</th>
          <th style="padding:10px;">Usuário</th>
          <th style="padding:10px;">Ação</th>
          <th style="padding:10px;">Descrição</th>
        </tr>
      </thead>
      <tbody>
        ${logs.length ? logs.map(a => `
          <tr style="border-bottom: 1px solid var(--neutral-100);">
            <td style="padding:10px; font-size:0.85rem;">${formatarData(a.data)} ${a.hora}</td>
            <td style="padding:10px; font-weight:600; font-size:0.85rem;">${a.por || 'Sistema'}</td>
            <td style="padding:10px;"><span class="badge badge--info">${a.acao}</span></td>
            <td style="padding:10px; font-size:0.85rem;">${a.descricao}</td>
          </tr>
        `).join('') : '<tr><td colspan="4" class="empty-state" style="padding:15px; text-align:center;">Nenhum registro encontrado.</td></tr>'}
      </tbody>
    `;
    tableContainer.style.display = 'block';
  };

  // Conectando as ações aos botões
  document.getElementById(`btn-view-${reportKey}`).addEventListener('click', renderTable);
  document.getElementById(`btn-print-${reportKey}`).addEventListener('click', () => imprimirRelatorio(tableId, title));
  document.getElementById(`btn-csv-${reportKey}`).addEventListener('click', () => exportarRelatorioCSV(tableId, 'relatorio_auditoria.csv'));
  
  // Atualização em tempo real ao digitar no campo de busca
  document.getElementById('filtro-audit-busca').addEventListener('input', renderTable);
}

/* ══════════════════════════════════════════════════════════
   12. CONFIGURAÇÕES E AUDITORIA
   ══════════════════════════════════════════════════════════ */
function renderConfiguracoes() {
  document.getElementById("configModoEscala").value = state.config.modoEscala || '1';
  document.getElementById("configMinCampo").value = state.config.minCampoDuna || 1;
  document.getElementById("configMinKimo").value = state.config.minCasaKimo || 2;
}

document.getElementById("btnSalvarConfig").addEventListener("click", () => {
  state.config.modoEscala = document.getElementById("configModoEscala").value;
  state.config.minCampoDuna = parseInt(document.getElementById("configMinCampo").value) || 1;
  state.config.minCasaKimo = parseInt(document.getElementById("configMinKimo").value) || 2;
  salvarState(); registrarAudit("Configurações", "Alterou configurações globais");
  renderEscalaAdmin(); toast("Configurações salvas!", "ok");
});

function renderAuditoria() {
  const lista = document.getElementById("lista-auditoria");
  const logs = [...state.audit].reverse();
  lista.innerHTML = logs.length ? logs.map(a => `
    <div style="padding: 12px; border-bottom: 1px solid var(--neutral-100); font-size: 0.85rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><strong>${a.acao}</strong><span style="color:var(--neutral-500);">${formatarData(a.data)} às ${a.hora}</span></div>
      <div>${a.descricao}</div>
      <div style="color:var(--neutral-500); font-size: 0.75rem; margin-top:4px;">👤 Por: ${a.por || 'Sistema'} ${
        (() => {
          const f = state.funcionarios.find(func => func.nome === a.por);
          return f ? `(#${f.idPonto || 'S/ID'})` : (a.por !== 'Sistema' && a.por !== 'Administrador' ? '(#S/ID)' : '');
        })()
      }</div>
    </div>`).join('') : '<div class="empty-state">Nenhum registro.</div>';
}

function exportarBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `lorenza_v4_${toISO(new Date())}.json`; a.click();
  registrarAudit("Backup", "Exportou dados do sistema"); salvarState();
  URL.revokeObjectURL(url); toast("Backup exportado!");
}
window.exportarBackup = exportarBackup;

window.importarBackup = (event) => {
  const file = event.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const d = JSON.parse(e.target.result);
      if(!d.funcionarios) throw "Erro";
      if(!confirm("Restaurar dados? Isso apagará os dados atuais.")) return;
      state = d; registrarAudit("Backup", "Restaurou dados do sistema"); salvarState(); toast("Restaurado com sucesso!"); window.location.reload();
    } catch(err) { toast("Arquivo inválido", "erro"); }
  };
  reader.readAsText(file);
};

function limparTodasAsFolgas() {
  if (!confirm("ATENÇÃO: Esta ação irá remover TODAS as solicitações de folga (ausências, trocas, folgas mensais) e exceções manuais de folga do sistema. Esta ação é irreversível. Deseja continuar?")) {
    return;
  }

  // Remover solicitações de folga (ausência, troca, folga_mensal)
  state.solicitacoes = state.solicitacoes.filter(s =>
    s.tipo !== 'ausencia' && s.tipo !== 'troca' && s.tipo !== 'folga_mensal' && s.tipo !== 'ferias'
  );

  // Remover exceções manuais de folga
  state.excecoes = state.excecoes.filter(e => e.tipo !== 'folga');

  // Limpar folgas definidas na escala mensal
  for (const mes in state.escalaMensal) {
    if (state.escalaMensal[mes].folgas) {
      state.escalaMensal[mes].folgas = {};
    }
  }
  registrarAudit("Limpeza de Dados", "Todas as folgas (solicitações e exceções) foram removidas.");
  sincronizarTodasAsViews();
  toast("Todas as folgas foram removidas do sistema.", "ok");
}
window.limparTodasAsFolgas = limparTodasAsFolgas;

/* ══════════════════════════════════════════════════════════
   14. INICIALIZAÇÃO
   ══════════════════════════════════════════════════════════ */
function fecharModais() {
  ["modal-edicao","modal-dia","modal-alerta", "modal-datas-admin"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  document.getElementById("modal-overlay").style.display = "none";
}
document.getElementById("modal-overlay").addEventListener("click", fecharModais);

function inicializarSistema() {
  renderConfiguracoes();
  renderFuncionarios();
  renderFeriadosExcecoes();
  renderEscalaMensalSelects();
  renderEscalaAdmin();
  
  if (currentUser.role === 'funcionario') {
    renderMinhasSolicitacoes();
    renderCalendario();
    navegarPara('calendario');
  } else {
    renderCentralAprovacoes();
    renderAuditoria();
    renderDashboard();
    renderRelatorios();
    renderCalendario();
    navegarPara('dashboard');
  }
}

// Start in Login Screen
renderLoginSelect();
