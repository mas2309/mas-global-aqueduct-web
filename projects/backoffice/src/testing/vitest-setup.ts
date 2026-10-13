// La primera prueba de cada archivo carga Angular Material y, con la máquina ocupada, puede pasar de los 5
// segundos que Vitest da por defecto: un fallo por tiempo en una arrastra al resto del archivo.
vi.setConfig({ testTimeout: 20_000 });
