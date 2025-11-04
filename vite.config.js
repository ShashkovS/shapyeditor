// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    // Плагин для копирования статических ассетов, которые не обрабатываются Vite.
    // Нам это нужно для папки `ace`, так как она загружает свои части динамически.
    viteStaticCopy({
      targets: [
        {
          src: 'src/ace', // Откуда копировать
          dest: ''       // Куда (в корень папки dist)
        }
      ]
    })
  ],
  build: {
    // Включаем сборку в режиме библиотеки
    lib: {
      // Указываем основной файл, "входную точку" нашей библиотеки
      entry: resolve(__dirname, 'src/index.js'),
      
      // Имя, под которым библиотека будет доступна глобально (в window)
      // Например, window.PyEditorLib
      name: 'PyEditorLib',
      
      // Форматы сборки: 'es' (ES Module) и 'iife' (для подключения через <script>)
      formats: ['es', 'iife'],
      
      // Имя файла для сборки (без расширения)
      fileName: (format) => `py-editor-lib.${format}.js`,
    },
    // Директория для собранных файлов
    outDir: 'dist',
    // Очищать директорию перед сборкой
    emptyOutDir: true,
  },
});
