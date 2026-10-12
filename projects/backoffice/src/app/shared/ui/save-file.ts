/** Descarga un archivo recibido de la API (va con el token de la sesión, por eso no sirve un enlace directo). */
export function saveFile(content: Blob, name: string): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
