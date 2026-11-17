(function () {
  "use strict";

  var scale = [9, 7, 5, 3, 1, 1 / 3, 1 / 5, 1 / 7, 1 / 9];
  var labels = ["9", "7", "5", "3", "1", "1/3", "1/5", "1/7", "1/9"];

  function formatValue(value) {
    if (Math.abs(value - 1) < 0.0001) return "1";
    if (value < 1) return "1/" + Math.round(1 / value);
    return String(Math.round(value));
  }

  function tone(value) {
    var intensity = value < 1 ? 1 / value : value;
    if (intensity === 1) return "equal";
    if (intensity <= 3) return "low";
    if (intensity <= 5) return "mid";
    if (intensity <= 7) return "high";
    return "extreme";
  }

  function calculate(matrix) {
    var n = matrix.length;
    var weights = matrix.map(function (row) {
      return Math.pow(row.reduce(function (product, value) { return product * value; }, 1), 1 / n);
    });
    var total = weights.reduce(function (sum, value) { return sum + value; }, 0);
    weights = weights.map(function (value) { return value / total; });
    var lambda = matrix.reduce(function (sum, row, i) {
      var weighted = row.reduce(function (rowSum, value, j) { return rowSum + value * weights[j]; }, 0);
      return sum + weighted / weights[i];
    }, 0) / n;
    var ci = n > 1 ? (lambda - n) / (n - 1) : 0;
    var ri = [0, 0, 0, .58, .90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49, 1.51, 1.48, 1.56, 1.57];
    var cr = n > 2 && ri[n] ? ci / ri[n] : 0;
    return { lambda: lambda, ci: Math.max(0, ci), cr: Math.max(0, cr) };
  }

  function createMatrix(size) {
    var saved = JSON.parse(localStorage.getItem("ahp_pairwiseMatrix") || "null");
    if (Array.isArray(saved) && saved.length === size && saved.every(function (row) { return Array.isArray(row) && row.length === size; })) return saved;
    return Array.from({ length: size }, function (_, i) {
      return Array.from({ length: size }, function (_, j) { return i === j ? 1 : 1; });
    });
  }

  function render(host) {
    var criteria = JSON.parse(localStorage.getItem("ahp_criteria") || "[]");
    if (criteria.length < 2) return;
    var matrix = createMatrix(criteria.length);
    var pairs = [];
    criteria.forEach(function (_, i) { criteria.forEach(function (__, j) { if (i < j) pairs.push([i, j]); }); });

    host.innerHTML = '<section class="ahp-step3-shell"><div class="ahp-step3-label"><span class="ahp-step3-index">3</span><span>Comparação pareada</span></div><div class="ahp-step3-body">' +
      '<section class="ahp-subcard"><h2 class="ahp-subsection-title"><span class="ahp-subsection-num">3.1</span><span>Entenda a escala antes de comparar</span></h2><div class="ahp-subcard-body"><p class="ahp-guide-summary">Compare dois critérios por vez. O <strong>critério 1 é a referência</strong>. À esquerda, a régua favorece o critério 1; no centro, 1 representa igualdade; à direita, os valores recíprocos favorecem o critério 2.</p><p class="ahp-guide-title">Escala de Saaty</p><div class="ahp-scale-guide"><div class="ahp-scale-item" style="--tone:#66818f"><strong>Igual</strong><b>1</b><small>igual importância</small></div><div class="ahp-scale-item" style="--tone:#3c9b67"><strong>Pouco</strong><b>3</b><small>moderada</small></div><div class="ahp-scale-item" style="--tone:#d1a51a"><strong>Médio</strong><b>5</b><small>forte</small></div><div class="ahp-scale-item" style="--tone:#dd7a32"><strong>Bastante</strong><b>7</b><small>muito forte</small></div><div class="ahp-scale-item" style="--tone:#c84b4b"><strong>Extremamente</strong><b>9</b><small>extrema</small></div></div><p class="ahp-guide-inverse"><i class="fas fa-rotate" aria-hidden="true"></i><span>O valor oposto é aplicado automaticamente. Se o critério 1 vale 5 em relação ao critério 2, a comparação inversa passa a valer 1/5.</span></p></div></section>' +
      '<section class="ahp-subcard"><h2 class="ahp-subsection-title"><span class="ahp-subsection-num">3.2</span><span>Comparação pareada</span></h2><div class="ahp-subcard-body"><p class="ahp-pairwise-intro">Ajuste os pares no formulário e acompanhe a matriz recíproca e os indicadores de consistência em tempo real. Procure manter RC inferior a 0,10.</p><div class="ahp-live-metrics" data-metrics></div><div class="ahp-pair-tabs" role="tablist"><button type="button" data-tab="form" role="tab">Formulário de comparação pareada</button><button type="button" data-tab="matrix" role="tab">Matriz de comparação pareada</button></div><div class="ahp-panel" data-panel="form"><div data-pairs></div></div><div class="ahp-panel" data-panel="matrix"><p class="ahp-pairwise-intro">Cada valor compara o critério da linha com o da coluna. A diagonal é 1 e as duas metades são recíprocas. Faça os ajustes na aba formulário.</p><div class="ahp-matrix-wrap" data-matrix></div></div><div class="ahp-pair-actions"><a class="c-btn c-btn--secondary" href="step2-nomes"><i class="fas fa-arrow-left c-btn__icon"></i>Voltar</a><button type="button" class="c-btn c-btn--primary" data-continue></button></div></div></section></div></section>';

    var metrics = host.querySelector("[data-metrics]");
    var matrixWrap = host.querySelector("[data-matrix]");
    var pairWrap = host.querySelector("[data-pairs]");
    var continueButton = host.querySelector("[data-continue]");
    // A etapa 3 sempre abre no formulário. A escolha anterior não altera a
    // experiência inicial; a matriz continua disponível como aba de consulta.
    var active = host.dataset.mode === "method" ? "form" : (localStorage.getItem("ahp_chosenMethod") === "matrix" ? "matrix" : "form");

    function save() { localStorage.setItem("ahp_pairwiseMatrix", JSON.stringify(matrix)); }
    function updateMetrics() {
      var result = calculate(matrix);
      var statusClass = result.cr === 0 ? "" : result.cr < .1 ? " is-ok" : " is-bad";
      var status = result.cr === 0 ? "RC zero" : result.cr < .1 ? "Consistência adequada" : "Revise as comparações";
      metrics.innerHTML = '<div class="ahp-metric-card"><div class="ahp-metric-card__label">Lambda máximo (λmax)</div><div class="ahp-metric-card__value">' + result.lambda.toFixed(4) + '</div></div><div class="ahp-metric-card"><div class="ahp-metric-card__label">Índice de consistência (IC)</div><div class="ahp-metric-card__value">' + result.ci.toFixed(4) + '</div></div><div class="ahp-metric-card' + statusClass + '"><div class="ahp-metric-card__label">Razão de consistência (RC)</div><div class="ahp-metric-card__value">' + result.cr.toFixed(4) + '</div><div class="ahp-metric-card__sub">' + status + '</div></div>';
    }
    function updateMatrix() {
      var html = '<table class="ahp-matrix"><thead><tr><th>Critério</th>' + criteria.map(function (criterion) { return '<th>' + criterion + '</th>'; }).join("") + '</tr></thead><tbody>';
      criteria.forEach(function (criterion, i) {
        html += '<tr><td>' + criterion + '</td>' + matrix[i].map(function (value) { return '<td data-tone="' + tone(value) + '">' + formatValue(value) + '</td>'; }).join("") + '</tr>';
      });
      matrixWrap.innerHTML = html + '</tbody></table>';
    }
    function updatePair(pair, index) {
      var i = pair[0], j = pair[1];
      var sliderIndex = scale.reduce(function (best, value, position) { return Math.abs(value - matrix[i][j]) < Math.abs(scale[best] - matrix[i][j]) ? position : best; }, 0);
      var card = document.createElement("article");
      card.className = "saaty-pair";
      card.innerHTML = '<h3 class="saaty-pair-title">Comparação ' + (index + 1) + ' de ' + pairs.length + '</h3>' +
        '<div class="saaty-widget"><div class="saaty-scale" role="group"><div class="saaty-arrow"></div>' +
        labels.map(function (label, position) { var descriptions = ["Extremamente", "Bastante", "Médio", "Pouco", "Igual", "Pouco", "Médio", "Bastante", "Extremamente"]; return '<span class="saaty-tick" data-tick="' + position + '" style="left:' + (position * 12.5) + '%"><span class="saaty-tick-val">' + label + '</span><span class="saaty-tick-desc">' + descriptions[position] + '</span><span class="saaty-tick-mark"></span></span>'; }).join("") +
        '<span class="saaty-handle" data-handle aria-hidden="true"></span><input class="saaty-range-input" type="range" min="0" max="8" step="1" value="' + sliderIndex + '" aria-label="Importância de ' + criteria[i] + ' em relação a ' + criteria[j] + '"></div>' +
        '<div class="saaty-dir"><span>Mais importante</span><span>Mais importante</span></div></div>' +
        '<div class="saaty-criteria"><div class="saaty-crit saaty-crit--left"><span class="saaty-crit__tag">A</span><span class="saaty-crit__name">' + criteria[i] + '</span></div><span class="saaty-vs">versus</span><div class="saaty-crit saaty-crit--right"><span class="saaty-crit__tag">B</span><span class="saaty-crit__name">' + criteria[j] + '</span></div></div>' +
        '<div class="saaty-readout" data-choice></div><div class="saaty-reciprocal" data-reciprocal><span class="saaty-reciprocal__label">Valor recíproco automático</span><strong class="saaty-reciprocal__value" data-reciprocal-value></strong><span class="saaty-reciprocal__text" data-reciprocal-text></span></div>';
      var input = card.querySelector("input");
      var choice = card.querySelector("[data-choice]");
      var handle = card.querySelector("[data-handle]");
      var reciprocal = card.querySelector("[data-reciprocal]");
      function syncChoice() {
        var value = scale[Number(input.value)];
        matrix[i][j] = value; matrix[j][i] = 1 / value;
        var message = value === 1 ? '<strong>Igual importância</strong>' : value > 1 ? '<strong>' + criteria[i] + '</strong> é ' + formatValue(value) + ' vezes mais importante' : '<strong>' + criteria[j] + '</strong> é ' + formatValue(1 / value) + ' vezes mais importante';
        choice.className = 'saaty-readout ' + (value === 1 ? 'saaty-readout--eq' : value > 1 ? 'saaty-readout--pos' : 'saaty-readout--neg');
        choice.innerHTML = message;
        handle.style.left = (Number(input.value) * 12.5) + '%';
        card.querySelectorAll('[data-tick]').forEach(function (tick) { tick.classList.toggle('is-selected', Number(tick.dataset.tick) === Number(input.value)); });
        reciprocal.className = 'saaty-reciprocal ' + (value === 1 ? 'is-equal' : value > 1 ? 'is-positive' : 'is-negative');
        reciprocal.querySelector('[data-reciprocal-value]').textContent = formatValue(matrix[j][i]);
        reciprocal.querySelector('[data-reciprocal-text]').textContent = 'A comparação inversa de “' + criteria[j] + '” em relação a “' + criteria[i] + '” foi atualizada automaticamente.';
        save(); updateMatrix(); updateMetrics();
      }
      input.addEventListener("input", syncChoice); syncChoice(); pairWrap.appendChild(card);
    }
    function setTab(tab) {
      active = tab;
      host.querySelectorAll("[data-tab]").forEach(function (button) { var selected = button.dataset.tab === tab; button.classList.toggle("is-active", selected); button.setAttribute("aria-selected", String(selected)); });
      host.querySelectorAll("[data-panel]").forEach(function (panel) { panel.hidden = panel.dataset.panel !== tab; });
      continueButton.innerHTML = (host.dataset.mode === "method" ? "Usar " : "Concluir com ") + (tab === "matrix" ? "matriz" : "formulário") + '<i class="fas fa-arrow-right c-btn__icon c-btn__icon--right"></i>';
    }
    pairs.forEach(updatePair); updateMatrix(); updateMetrics();
    host.querySelectorAll("[data-tab]").forEach(function (button) { button.addEventListener("click", function () { setTab(button.dataset.tab); }); });
    continueButton.addEventListener("click", function () {
      localStorage.setItem("ahp_chosenMethod", active === "matrix" ? "matrix" : "form"); save();
      window.location.href = host.dataset.mode === "method" ? "step4-comparacao" : "step5-resultados";
    });
    setTab(active);
  }

  document.addEventListener("DOMContentLoaded", function () { document.querySelectorAll("[data-ahp-pairwise]").forEach(render); });
}());
