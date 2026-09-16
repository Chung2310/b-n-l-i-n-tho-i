import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {loadEnv} from 'vite';
import {configDefaults, defineConfig} from 'vitest/config';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'PORT');
  const backendUrl = `http://localhost:${process.env.PORT || env.PORT || '3011'}`;
  return {
    plugins: [react(), tailwindcss()],
    // Tailwind CSS v4 is handled by @tailwindcss/vite. Defining PostCSS here
    // prevents Vite from walking above the repository and loading an unrelated
    // postcss.config.* file from a parent directory.
    css: {
      postcss: {
        plugins: [],
      },
    },
    test: {
      exclude: [
        ...configDefaults.exclude,
        '**/.worktrees/**',
        '**/.claude/worktrees/**',
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true as const,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          ws: true,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
