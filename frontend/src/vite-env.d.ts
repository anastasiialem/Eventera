/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_API_URL?: string
  /** Бекенд Ролі 3 на Render — поки лише для POST /api/telegram/link */
  readonly VITE_BACKEND_URL?: string
  readonly VITE_DONATE_URL?: string
  readonly VITE_TELEGRAM_BOT_URL?: string
  readonly VITE_ENABLE_GOOGLE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
