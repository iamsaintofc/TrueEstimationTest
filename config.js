// =====================================================================
// КОНФИГ ТЕСТОВОГО САЙТА (TrueEstimation Testers)
// Всё, что отличает тестовый сайт от пользовательского, лежит здесь.
// Пользовательский сайт должен иметь СВОЙ config/ключи и СВОЙ проект Supabase.
// =====================================================================

// Supabase-проект ТОЛЬКО для тестового сайта.
// Должен отличаться от проекта пользовательского сайта!
export const SUPABASE_URL = 'https://szmwwykgtwdosauounds.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_0r_O4raj-GlUeg3p8E62TQ_X3gpfZER';

// Главный админ тестового сайта (должен совпадать с почтой в is_site_admin() в setup.sql)
export const MASTER_ADMIN_EMAIL = 'zahavalgovno777@gmail.com';

// Бакет для аудио/обложек (создаётся в setup.sql)
export const MEDIA_BUCKET = 'track-media';
