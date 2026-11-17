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
    var active = localStorage.getItem("ahp_chosenMethod") === "matrix" ? "matrix" : "form";

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
      card.className = "ahp-pair-card";
      card.innerHTML = '<div class="ahp-pair-card__header"><span>Comparação ' + (index + 1) + ' de ' + pairs.length + '</span><span>Critério 1 × Critério 2</span></div><div class="ahp-pair-card__body"><div class="ahp-pair-criteria"><div class="ahp-pair-criterion">' + criteria[i] + '<small><br>critério 1</small></div><span class="ahp-pair-versus">VERSUS</span><div class="ahp-pair-criterion">' + criteria[j] + '<small><br>critério 2</small></div></div><input class="ahp-range" type="range" min="0" max="8" step="1" value="' + sliderIndex + '" aria-label="Importância de ' + criteria[i] + ' em relação a ' + criteria[j] + '"><div class="ahp-range-labels">' + labels.map(function (label) { return '<span>' + label + '</span>'; }).join("") + '</div><p class="ahp-choice" data-choice></p></div>';
      var input = card.querySelector("input");
      var choice = card.querySelector("[data-choice]");
      function syncChoice() {
        var value = scale[Number(input.value)];
        matrix[i][j] = value; matrix[j][i] = 1 / value;
        var message = value === 1 ? '<strong>Igual importância</strong>' : value > 1 ? '<strong>' + criteria[i] + '</strong> é ' + formatValue(value) + ' vezes mais importante' : '<strong>' + criteria[j] + '</strong> é ' + formatValue(1 / value) + ' vezes mais importante';
        choice.innerHTML = message + '<span class="ahp-opposite">Valor oposto: ' + formatValue(matrix[j][i]) + '</span>';
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
