import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { intelligenceApiPlugin } from './server/vitePlugin'

// intelligenceApiPlugin mounts the server-side /api/interpret and /api/draft
// endpoints (Groq lives there). The browser never calls Groq directly.
export default defineConfig({ plugins: [react(), intelligenceApiPlugin()] })
