import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CONCEPT_ROWS, Concepts } from '../report.models';

/** Una columna de la tabla: un servicio o, si no se separa por servicio, ninguna. */
export interface ConceptColumn {
  label: string;
  concepts: Concepts;
}

/**
 * Tabla de valores por concepto (cargo fijo, consumo, subsidios...), con una columna por servicio y el total. Los
 * conceptos que están en cero en todas las columnas no se muestran, salvo el cargo fijo y el consumo.
 */
@Component({
  selector: 'aq-concept-table',
  imports: [CurrencyPipe],
  template: `
    <div class="table-container">
      <table class="concepts">
        <caption class="cdk-visually-hidden">
          {{
            caption()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Concepto</th>
            @if (columns().length > 1) {
              @for (column of columns(); track column.label) {
                <th scope="col" class="amount">{{ column.label }}</th>
              }
            }
            <th scope="col" class="amount">Total</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.key) {
            <tr>
              <th scope="row">{{ row.label }}</th>
              @if (columns().length > 1) {
                @for (column of columns(); track column.label) {
                  <td class="amount">
                    {{ column.concepts[row.key] | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                  </td>
                }
              }
              <td class="amount">
                {{ totals()[row.key] | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              </td>
            </tr>
          }
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            @if (columns().length > 1) {
              @for (column of columns(); track column.label) {
                <td class="amount">
                  {{ column.concepts.total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                </td>
              }
            }
            <td class="amount">
              {{ totals().total | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  `,
  styles: `
    .table-container {
      overflow-x: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .concepts {
      width: 100%;
      border-collapse: collapse;

      th,
      td {
        padding: 10px 16px;
        text-align: left;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-large);
      }

      tbody th {
        font-weight: 400;
      }

      tfoot th,
      tfoot td {
        font-weight: 600;
        border-bottom: none;
      }

      .amount {
        text-align: right;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConceptTable {
  /** Las columnas por servicio; con una sola (o ninguna) se muestra solo el total. */
  readonly columns = input<ConceptColumn[]>([]);
  readonly totals = input.required<Concepts>();
  readonly caption = input('Valores por concepto');

  protected readonly rows = computed(() =>
    CONCEPT_ROWS.filter(
      (row) =>
        row.always ||
        this.totals()[row.key] !== 0 ||
        this.columns().some((column) => column.concepts[row.key] !== 0),
    ),
  );
}
