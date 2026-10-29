import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        const source = warning.id ?? warning.loc?.file ?? '';
        const isZodAnnotationWarning = warning.code === 'INVALID_ANNOTATION'
          && /[\\/]node_modules[\\/]zod[\\/]/.test(source);

        // Rollup strips these misplaced PURE comments from Zod's published bundle.
        if (isZodAnnotationWarning) return;
        warn(warning);
      },
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
