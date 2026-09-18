import { createClient } from '@supabase/supabase-js'

// Projeto Supabase "togethere-teste". A chave abaixo é pública (publishable):
// a proteção real está nas regras de acesso do banco (RLS + tabela cond_diretoria).
export const SUPABASE_URL = 'https://ynwumghaptydfoaskbui.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_hA0c7lTrILSWrIW1o3U6KA_aA96KWc0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})
