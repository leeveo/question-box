import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables! Check .env.local');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Types pour la base de données
export type Profile = {
    id: string
    email: string
    full_name: string | null
    company_name: string | null
    created_at: string
    updated_at: string
}

export type Project = {
    id: string
    user_id: string
    name: string
    slug: string
    background_image_url: string | null
    response_duration?: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export type Question = {
    id: string
    project_id: string
    text: string
    order: number
    created_at: string
    updated_at: string
}

export type Video = {
    id: string
    project_id: string
    s3_url: string
    participant_name: string | null
    duration: number | null
    file_size: number | null
    created_at: string
}

export type VideoMontage = {
    id: string
    project_id: string
    user_id: string
    name: string
    s3_url: string
    file_size: number | null
    duration: number | null
    video_count: number
    status: 'processing' | 'completed' | 'failed'
    created_at: string
    updated_at: string
}

export type VideoMontageClip = {
    id: string
    montage_id: string
    video_id: string
    clip_order: number
    start_time: number
    end_time: number
    created_at: string
}
