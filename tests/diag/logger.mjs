// tests/diag/logger.mjs
// Logger simples para diagnósticos determinísticos nos testes.
// Uso típico:
//   const diag = new Diag('nome do caso');
//   diag.push('analyzer.identifyTargetComponents', {...});
//   ...
//   await diag.dumpToFile('tests/out/caso-x.diag.json', { got, expected });

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class Diag {
  /**
   * @param {string} name - nome do caso (aparece no .diag.json)
   * @param {{enabled?: boolean, console?: boolean}} [opts]
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.events = [];
    this.enabled = opts.enabled ?? true;   // liga/desliga coleta
    this.console = opts.console ?? false;  // imprime no console quando push/table
  }

  /** Registra um evento na linha do tempo */
  push(type, payload = {}) {
    if (!this.enabled) return;
    const ev = {
      ts: new Date().toISOString(),
      type: String(type),
      payload
    };
    this.events.push(ev);
    if (this.console) {
      // log curtinho no console (evite despejar payloads gigantes aqui)
      // eslint-disable-next-line no-console
      console.log(`[diag] ${type}`);
    }
  }

  /** Imprime uma tabela resumida no console (não vai para o arquivo) */
  table(label, rows) {
    if (!this.enabled || !this.console) return;
    try {
      // eslint-disable-next-line no-console
      console.log(`[diag] ${label}`);
      // eslint-disable-next-line no-console
      console.table(rows);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`[diag] ${label}`, rows);
    }
  }

  /** Limpa eventos (útil em loops/suites) */
  clear() {
    this.events.length = 0;
  }

  /**
   * Grava o bundle de diagnóstico no disco (JSON).
   * @param {string} filePath - caminho do arquivo .diag.json
   * @param {object} [extra] - campos extras (ex.: { fixture, got, expected })
   */
  async dumpToFile(filePath, extra = {}) {
    const out = {
      name: this.name,
      ...extra,
      events: this.events
    };
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(out, null, 2), 'utf8');
  }
}
