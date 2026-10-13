/** Contratos de /api/v1/movements (módulo finance del backend). */

export const MOVEMENTS_URL = '/api/v1/movements';

/** `INCOME`: ingreso distinto del recaudo de facturas, que sale de la facturación. */
export type MovementType = 'INCOME' | 'EXPENSE';

export interface MovementAttachment {
  fileName: string;
  contentType: string;
  size: number;
}

export interface Movement {
  id: string;
  type: MovementType;
  /** Fecha del ingreso o del gasto, `yyyy-MM-dd`. */
  date: string;
  category: string;
  description: string;
  amount: number;
  /** Soporte (factura de compra, recibo); `null` si no tiene. */
  attachment: MovementAttachment | null;
  createdAt: string;
}

export interface MovementRequest {
  type: MovementType;
  date: string;
  category: string;
  description: string;
  amount: number;
}

/** Lo que entró y lo que salió en un rango de fechas. `balance` puede ser negativo. */
export interface Balance {
  invoiceCollections: number;
  otherIncome: number;
  expenses: number;
  balance: number;
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
};

/** Categorías sugeridas; el usuario puede escribir otra. */
export const CATEGORY_SUGGESTIONS: Record<MovementType, string[]> = {
  EXPENSE: [
    'Mantenimiento',
    'Insumos y químicos',
    'Honorarios y nómina',
    'Energía y servicios',
    'Transporte',
    'Papelería',
    'Impuestos y trámites',
    'Otros gastos',
  ],
  INCOME: ['Aportes', 'Donaciones', 'Venta de materiales', 'Otros ingresos'],
};

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Por qué no se puede subir un archivo como soporte, o `null` si sirve. El servidor vuelve a validarlo. */
export function attachmentProblem(file: File): string | null {
  if (!ATTACHMENT_TYPES.includes(file.type)) {
    return 'El soporte debe ser un PDF o una imagen JPG o PNG.';
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return 'El soporte no puede pesar más de 5 MB.';
  }
  return null;
}
