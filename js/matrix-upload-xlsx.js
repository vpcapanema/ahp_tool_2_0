(function () {
  'use strict';

  const SAATY_VALUES = [1 / 9, 1 / 7, 1 / 5, 1 / 3, 1, 3, 5, 7, 9];
  let importedMatrix = null;

  function closeEnough(a, b, tolerance = 1e-6) {
    return Math.abs(a - b) <= tolerance;
  }

  function parseValue(value, cell) {
    if (typeof value === 'string') {
      const text = value.trim().replace(',', '.');
      const fraction = text.match(/^(1)\s*\/\s*(3|5|7|9)$/);
      value = fraction ? 1 / Number(fraction[2]) : Number(text);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`A célula ${cell} deve conter um valor numérico da escala de Saaty.`);
    }
    const valid = SAATY_VALUES.some((allowed) => closeEnough(value, allowed));
    if (!valid) {
      throw new Error(`O valor da célula ${cell} não pertence à escala permitida: 1/9, 1/7, 1/5, 1/3, 1, 3, 5, 7 ou 9.`);
    }
    return value;
  }

  function validateStrictMatrix(criteria, matrix) {
    if (criteria.length < 2) throw new Error('Informe pelo menos dois critérios.');
    if (new Set(criteria.map((name) => name.toLocaleLowerCase('pt-BR'))).size !== criteria.length) {
      throw new Error('Os nomes dos critérios devem ser únicos.');
    }
    criteria.forEach((criterion, index) => {
      if (!criterion) throw new Error(`O nome do critério ${index + 1} está vazio.`);
    });
    for (let row = 0; row < matrix.length; row += 1) {
      if (!closeEnough(matrix[row][row], 1)) {
        throw new Error(`A diagonal principal deve ser 1 na posição ${row + 1}, ${row + 1}.`);
      }
      for (let column = row + 1; column < matrix.length; column += 1) {
        if (!closeEnough(matrix[row][column] * matrix[column][row], 1, 1e-4)) {
          throw new Error(`Os valores do par ${criteria[row]} × ${criteria[column]} devem ser recíprocos.`);
        }
      }
    }
  }

  function parseXLSXMatrix(arrayBuffer) {
    if (!window.XLSX) throw new Error('O leitor XLSX não pôde ser carregado. Recarregue a página e tente novamente.');
    const workbook = window.XLSX.read(arrayBuffer, { type: 'array', cellFormula: true });
    const expectedSheets = ['1. Instruções', '2. Matriz AHP'];
    if (workbook.SheetNames[0] !== expectedSheets[0] || workbook.SheetNames[1] !== expectedSheets[1]) {
      throw new Error('As duas primeiras abas devem ser, nesta ordem, “1. Instruções” e “2. Matriz AHP”. Use o modelo XLSX disponibilizado.');
    }
    const worksheet = workbook.Sheets['2. Matriz AHP'];
    if (!worksheet) throw new Error('A planilha deve conter a segunda aba chamada “2. Matriz AHP”.');
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: null });
    if (String(rows[0]?.[0] || '').trim().toLocaleLowerCase('pt-BR') !== 'critério') {
      throw new Error('A célula A1 deve conter “Critério”. Use o modelo XLSX disponibilizado.');
    }
    const criteria = [];
    for (let column = 1; column < (rows[0] || []).length; column += 1) {
      const name = String(rows[0][column] ?? '').trim();
      if (!name) break;
      criteria.push(name);
    }
    const matrix = criteria.map((criterion, rowIndex) => {
      const sourceRow = rows[rowIndex + 1] || [];
      const rowName = String(sourceRow[0] ?? '').trim();
      if (rowName !== criterion) {
        throw new Error(`O nome em A${rowIndex + 2} deve ser igual a “${criterion}”.`);
      }
      return criteria.map((_, columnIndex) => parseValue(
        sourceRow[columnIndex + 1],
        window.XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex + 1 })
      ));
    });
    validateStrictMatrix(criteria, matrix);
    return { criteria, matrix };
  }

  function adaptUploadInterface() {
    const jsonButton = document.querySelector("button[onclick=\"downloadMatrixTemplate('json')\"]");
    if (jsonButton) {
      jsonButton.setAttribute('onclick', "downloadMatrixTemplate('xlsx')");
      jsonButton.innerHTML = '<i class="fas fa-file-excel"></i> Baixar Modelo XLSX';
    }
    const formatItems = document.querySelectorAll('.info-list li');
    if (formatItems[1]) formatItems[1].textContent = 'XLSX: preencha a segunda aba, “2. Matriz AHP”, sem alterar a ordem ou o nome das abas';
    const input = document.getElementById('matrix-file-input');
    if (input) {
      input.accept = '.csv,.xlsx';
      input.title = 'Selecionar arquivo de matriz AHP em formato CSV ou XLSX';
    }
    const label = document.querySelector('label[for="matrix-file-input"]');
    if (label) label.textContent = 'Selecionar arquivo de matriz AHP (CSV ou XLSX)';
  }

  window.downloadMatrixTemplate = function (format) {
    if (format === 'xlsx') {
      const link = document.createElement('a');
      link.href = 'modelo_matriz_ahp.xlsx';
      link.download = 'modelo_matriz_ahp.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      showNotification('Modelo XLSX baixado com sucesso!', 'success');
      return;
    }
    if (format === 'csv') {
      const csv = ',Critério 1,Critério 2,Critério 3\nCritério 1,1,1,1\nCritério 2,1,1,1\nCritério 3,1,1,1\n';
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modelo_matriz_ahp.csv';
      link.click();
      URL.revokeObjectURL(url);
      showNotification('Modelo CSV baixado com sucesso!', 'success');
    }
  };

  window.handleFileSelect = function (event) {
    const file = event.target.files[0];
    const fileInfo = document.getElementById('file-info');
    importedMatrix = null;
    if (!file) {
      fileInfo.innerHTML = '';
      return;
    }
    const extension = file.name.split('.').pop().toLowerCase();
    fileInfo.innerHTML = `<div class="selected-file"><i class="fas fa-file-alt"></i><div><strong>${file.name}</strong><small>${(file.size / 1024).toFixed(2)} KB</small></div></div>`;
    const reader = new FileReader();
    reader.onload = function (loadEvent) {
      try {
        if (extension === 'xlsx') importedMatrix = parseXLSXMatrix(loadEvent.target.result);
        else if (extension === 'csv') importedMatrix = parseCSVMatrix(loadEvent.target.result);
        else throw new Error('Formato não suportado. Use CSV ou XLSX.');
        showNotification('Arquivo validado com sucesso! Clique em Processar Matriz para continuar.', 'success');
      } catch (error) {
        importedMatrix = null;
        showNotification(`Erro ao validar arquivo: ${error.message}`, 'error');
      }
    };
    reader.onerror = function () {
      importedMatrix = null;
      showNotification('Erro ao ler o arquivo.', 'error');
    };
    if (extension === 'xlsx') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  window.processUploadedMatrix = function () {
    if (!importedMatrix) {
      showNotification('Selecione e valide um arquivo CSV ou XLSX primeiro.', 'error');
      return;
    }
    localStorage.setItem('ahp_criteriaCount', importedMatrix.criteria.length);
    localStorage.setItem('ahp_criteria', JSON.stringify(importedMatrix.criteria));
    localStorage.setItem('ahp_uploadedMatrix', JSON.stringify(importedMatrix.matrix));
    localStorage.setItem('ahp_inputMethod', 'upload');
    showNotification('Processando matriz e calculando resultados...', 'info');
    setTimeout(() => { window.location.href = 'step5-resultados.html'; }, 1000);
  };

  window.parseXLSXMatrix = parseXLSXMatrix;
  document.addEventListener('DOMContentLoaded', adaptUploadInterface);
}());
