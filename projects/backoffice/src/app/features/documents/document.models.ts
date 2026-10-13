/** Contratos de /api/v1/documents (módulo documents del backend). */

export const DOCUMENTS_URL = '/api/v1/documents';

/** Documento importante del prestador. No se edita: si cambia, se sube de nuevo. */
export interface StoredDocument {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  contentType: string;
  /** Tamaño del archivo en bytes. */
  size: number;
  createdAt: string;
}
