// =====================================================================
// КОНФИГ ТЕСТОВОГО САЙТА (TrueEstimation Testers)
// Всё, что отличает тестовый сайт от пользовательского, лежит здесь.
// Пользовательский сайт должен иметь СВОЙ config/ключи и СВОЙ проект Supabase.
// =====================================================================

// Supabase-проект ТОЛЬКО для тестового сайта.
// Должен отличаться от проекта пользовательского сайта!
export const SUPABASE_URL = 'https://tdzinkgzpwmjybfmzaoh.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_LWH3t9UExBL0uQ5s0xuGPg_5O2Z56b-';

// Главный админ тестового сайта (должен совпадать с почтой в is_site_admin() в setup.sql)
export const MASTER_ADMIN_EMAIL = 'zahavalgovno777@gmail.com';

// Бакет для аудио/обложек (создаётся в setup.sql)
export const MEDIA_BUCKET = 'track-media';
