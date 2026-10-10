/** Sin caracteres que se confunden al dictarlos o escribirlos a mano (0/O, 1/l/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;

/**
 * Contraseña temporal aleatoria, p. ej. `Kp7m-Xw3R-nT9d`. El usuario debe cambiarla en su primer ingreso.
 * Usa el generador criptográfico del navegador, no `Math.random`.
 */
export function generateTemporaryPassword(): string {
  const random = crypto.getRandomValues(new Uint32Array(GROUPS * GROUP_LENGTH));
  const groups: string[] = [];
  for (let group = 0; group < GROUPS; group++) {
    let text = '';
    for (let i = 0; i < GROUP_LENGTH; i++) {
      text += ALPHABET[random[group * GROUP_LENGTH + i] % ALPHABET.length];
    }
    groups.push(text);
  }
  return groups.join('-');
}
