-- =======================================================
-- ESTRUTURA DO BANCO DE DADOS SUPABASE PARA ATLETA & TREINOS
-- Cole este script no SQL Editor do seu projeto no Supabase
-- =======================================================

-- 1. Habilitar extensão para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Perfil do Atleta (Athlete Profiles)
CREATE TABLE IF NOT EXISTS public.athlete_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    age INT,
    gender TEXT,
    weight_kg NUMERIC(5,2),
    height_cm NUMERIC(5,2),
    body_fat_percent NUMERIC(4,1),
    vo2_max NUMERIC(4,1),
    max_hr INT,
    resting_hr INT,
    ftp_watts INT,
    weekly_availability_hours NUMERIC(4,1),
    primary_sport TEXT DEFAULT 'Corrida',
    fitness_level TEXT DEFAULT 'Intermediário',
    sports_goals JSONB DEFAULT '[]'::jsonb,
    personal_goals JSONB DEFAULT '[]'::jsonb,
    injuries JSONB DEFAULT '[]'::jsonb,
    health_notes TEXT,
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Atividades / Treinos FIT
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    sport TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    distance_km NUMERIC(8,2) DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    avg_speed_kmh NUMERIC(5,2),
    max_speed_kmh NUMERIC(5,2),
    avg_heart_rate INT,
    max_heart_rate INT,
    calories INT,
    ascent_meters INT,
    descent_meters INT,
    avg_power INT,
    max_power INT,
    avg_cadence INT,
    rpe INT,
    gps_path JSONB DEFAULT '[]'::jsonb,
    records JSONB DEFAULT '[]'::jsonb,
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    ai_enabled BOOLEAN DEFAULT true,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar Segurança por Linha (Row Level Security - RLS)
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança RLS para athlete_profiles
CREATE POLICY "Permitir leitura ao próprio usuário"
    ON public.athlete_profiles FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Permitir inserção e atualização ao próprio usuário"
    ON public.athlete_profiles FOR ALL
    USING (auth.uid() = user_id OR auth.role() = 'anon');

-- 6. Políticas de Segurança RLS para activities
CREATE POLICY "Permitir leitura de atividades"
    ON public.activities FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'anon');

CREATE POLICY "Permitir inserção e alteração de atividades"
    ON public.activities FOR ALL
    USING (auth.uid() = user_id OR auth.role() = 'anon');

-- 7. Trigger para atualizar campo updated_at no perfil
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_athlete_profiles_updated_at
    BEFORE UPDATE ON public.athlete_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
