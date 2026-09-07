-- Migration: Adiciona colunas de aparência visual para campanhas do portal cativo
-- Data: 2026-09-02

BEGIN;

-- Adicionar colunas de aparência na tabela campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3B82F6';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#10B981';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS visual_style TEXT DEFAULT 'moderno' CHECK (visual_style IN ('moderno', 'elegante', 'minimalista', 'vibrante'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'center' CHECK (logo_position IN ('left', 'center', 'right'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS button_text TEXT DEFAULT 'Conectar ao Wi-Fi grátis';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS autoplay_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS show_arrows BOOLEAN DEFAULT TRUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS show_indicators BOOLEAN DEFAULT TRUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS show_progress_bar BOOLEAN DEFAULT TRUE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS quick_info_1 TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS quick_info_2 TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS quick_info_3 TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'gradient' CHECK (background_type IN ('gradient', 'solid', 'image'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS background_value TEXT DEFAULT 'radial';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS banner_overlay_opacity INTEGER DEFAULT 40;

-- Adicionar comentários às colunas
COMMENT ON COLUMN campaigns.primary_color IS 'Cor principal do portal (hex)';
COMMENT ON COLUMN campaigns.accent_color IS 'Cor de destaque do portal (hex)';
COMMENT ON COLUMN campaigns.visual_style IS 'Estilo visual: moderno, elegante, minimalista, vibrante';
COMMENT ON COLUMN campaigns.logo_position IS 'Posição da logo: left, center, right';
COMMENT ON COLUMN campaigns.button_text IS 'Texto personalizado do botão de conexão';
COMMENT ON COLUMN campaigns.autoplay_enabled IS 'Se o carrossel tem autoplay';
COMMENT ON COLUMN campaigns.show_arrows IS 'Se mostra setas de navegação no carrossel';
COMMENT ON COLUMN campaigns.show_indicators IS 'Se mostra indicadores do carrossel';
COMMENT ON COLUMN campaigns.show_progress_bar IS 'Se mostra barra de progresso no carrossel';
COMMENT ON COLUMN campaigns.quick_info_1 IS 'Informação rápida opcional 1';
COMMENT ON COLUMN campaigns.quick_info_2 IS 'Informação rápida opcional 2';
COMMENT ON COLUMN campaigns.quick_info_3 IS 'Informação rápida opcional 3';
COMMENT ON COLUMN campaigns.background_type IS 'Tipo de background: gradient, solid, image';
COMMENT ON COLUMN campaigns.background_value IS 'Valor do background (cor ou URL da imagem)';
COMMENT ON COLUMN campaigns.banner_overlay_opacity IS 'Opacidade do overlay sobre banners (0-100)';

COMMIT;
