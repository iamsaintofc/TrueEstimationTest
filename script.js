import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

import { SUPABASE_URL, SUPABASE_KEY, MASTER_ADMIN_EMAIL, MEDIA_BUCKET } from './config.js'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// пришли по ссылке из письма (подтверждение почты)? запоминаем до очистки адреса
const _hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
let cameFromEmailLink = /^(signup|email|magiclink|invite|email_change)$/.test(_hashParams.get('type') || '');
const emailLinkError = _hashParams.get('error_description');
let scheduledTracksData = [], allNewsData = [], lastLoadAt = Date.now(), editingNewsId = null;


const translations = {
    ru: { main: 'Главное', all: 'Все треки', comments: 'Комментарии', admin: 'Админ-панель', playlists: 'Плейлисты', liked: 'Мне понравилось', settings: 'Настройки', logout: 'Выйти', search: 'Поиск...', addTrack: 'Добавить трек', title: 'Название', artist: 'Исполнитель', category: 'Категория', audioUrl: 'Ссылка на аудио', coverUrl: 'Ссылка на обложку', emptyComments: 'Пока нет комментариев. Стань первым!', add: 'Добавить', close: 'Закрыть', newPlaylist: 'Новый плейлист', plName: 'Название плейлиста', cancel: 'Отмена', create: 'Создать' },
    en: { main: 'Home', all: 'All Tracks', comments: 'Comments', admin: 'Admin Panel', playlists: 'Playlists', liked: 'Liked', settings: 'Settings', logout: 'Logout', search: 'Search...', addTrack: 'Add Track', title: 'Title', artist: 'Artist', category: 'Category', audioUrl: 'Audio URL', coverUrl: 'Cover URL', emptyComments: 'No comments yet. Be the first!', add: 'Add', close: 'Close', newPlaylist: 'New Playlist', plName: 'Playlist name', cancel: 'Cancel', create: 'Create' }
};
let currentLang = localStorage.getItem('te_lang') || 'ru';
const presetAvatars = ['😎','🔥','🎧','🎵','🚀','👾','🐉','🍕','👑','😈','🤖','🦊','🐼','🦁','🍀','🌙','⚡','💎','🎸','🎹'];
const presetColors = ['#1e293b', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#000000', '#ffffff'];

const globalAudio = new Audio();
let currentTrackId = null; let allTracksData = []; let allCommentsData = []; let allProfilesData = []; let allRepliesData = []; 
let currentCategory = 'Главное меню'; let ratingTrackId = null; let currentUserRating = null;
let previousVolume = 1; let currentUserId = null; let currentUserProfile = null; let isAdmin = false;
let isShuffle = false; let repeatMode = 0; let currentSort = 'rating'; let currentCommentsSort = 'likes'; 
let confirmCallback = null; let searchQuery = '';
let userPlaylists = []; let currentTrackToAddToPlaylist = null; let allPlaylistTracksData = [];
let selectedEmojiAvatar = null;
let selectedAvatarBg = '#1e293b';
let allReportsData = []; // ДЛЯ ЖАЛОБ
let messagesData = []; let activeChatId = null; let msgChannel = null; let msgTimer = null; let msgUserId = null;
let notifications = []; let notifChannel = null; let notifTimer = null; let notifUserId = null; let statsIndex = null; let allTrackLikesData = [];
let allRatingsData = []; let allCommentLikesData = []; let userLinkHandled = false;

// --- ПЕРЕХВАТ ОШИБОК ---
window.onerror = function(message, source, lineno, colno, error) {
    const msg = `Ошибка JS: ${message} (строка ${lineno})`;
    showToast(msg, 'error');
    console.error(message, source, lineno, colno, error);
    return false;
};

function escapeHtml(str) { if (str === null || str === undefined) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container'); 
    if(!container) return;
    const toast = document.createElement('div');
    const borderColor = type === 'success' ? 'border-cyan-500' : 'border-red-500'; 
    const textColor = type === 'success' ? 'text-cyan-400' : 'text-red-400';
    const icon = type === 'success' ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>` : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
    toast.className = `bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl border-l-4 ${borderColor} flex items-center gap-3 transition-all duration-300 translate-y-[-20px] opacity-0 pointer-events-auto`;
    toast.innerHTML = `<div class="${textColor}">${icon}</div><span class="font-medium text-sm">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'), 10);
    setTimeout(() => { toast.classList.add('translate-y-[-20px]', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3500);
}

function formatTime(seconds) { if (isNaN(seconds)) return "0:00"; const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${mins}:${secs < 10 ? '0' : ''}${secs}`; }
window.toggleMobileMenu = () => document.getElementById('sidebar').classList.toggle('open');

// --- ИНИЦИАЛИЗАЦИЯ ---
async function initApp() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUserId = session.user.id;
            await updateProfileUI();
        }
        await loadData();
    } catch (err) {
        console.error("Init Error:", err);
        showToast("Ошибка при запуске: " + err.message, 'error');
    }
}
initApp();
if (emailLinkError) { history.replaceState(null, '', location.pathname + location.search); setTimeout(() => showToast('Ссылка из письма недействительна или устарела. Войди заново, письмо отправится повторно', 'error'), 600); }

supabase.auth.onAuthStateChange(async (event, session) => { 
    if (event === 'SIGNED_IN') { 
        if (cameFromEmailLink) {
            cameFromEmailLink = false;
            history.replaceState(null, '', location.pathname + location.search);
            showToast('Почта подтверждена! Добро пожаловать', 'success');
        }
        currentUserId = session.user.id; 
        await updateProfileUI(); 
        await loadData(); 
    } else if (event === 'SIGNED_OUT') { 
        currentUserId = null; currentUserProfile = null; isAdmin = false; 
        await updateProfileUI(); 
        await loadData(); 
    } 
});

// --- ПОДТВЕРЖДЕНИЕ ---
window.showConfirm = function(text, callback, type = 'delete') {
    document.getElementById('confirm-text').innerText = text; 
    confirmCallback = callback;
    const iconSvg = document.getElementById('confirm-icon');
    const iconContainer = document.getElementById('confirm-icon-container');
    const actionBtn = document.getElementById('confirm-action-btn');

    if (type === 'admin') {
        iconSvg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`;
        iconSvg.setAttribute('class', "w-8 h-8 text-cyan-500");
        iconContainer.setAttribute('class', "w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mx-auto mb-4");
        actionBtn.setAttribute('class', "flex-1 px-4 py-2.5 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-black transition-colors shadow-lg active:scale-95");
    } else {
        iconSvg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>`;
        iconSvg.setAttribute('class', "w-8 h-8 text-red-500");
        iconContainer.setAttribute('class', "w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4");
        actionBtn.setAttribute('class', "flex-1 px-4 py-2.5 rounded-xl font-bold bg-red-500 hover:bg-red-400 text-white transition-colors shadow-lg active:scale-95");
    }
    document.getElementById('confirm-modal').classList.remove('hidden'); 
}
window.closeConfirmModal = function() { document.getElementById('confirm-modal').classList.add('hidden'); confirmCallback = null; }
window.executeConfirm = async function() { if (confirmCallback) await confirmCallback(); closeConfirmModal(); }

// --- ШАРИНГ ---
window.shareTrack = function(trackId, event) { event.stopPropagation(); const url = `${window.location.origin}${window.location.pathname}?track=${trackId}`; navigator.clipboard.writeText(url).then(() => showToast(currentLang === 'ru' ? 'Ссылка на трек скопирована!' : 'Track link copied!', 'success')); }
window.shareCurrentPlaylist = function() { if (!currentCategory.startsWith('Playlist_')) return; const plId = currentCategory.split('_')[1]; const url = `${window.location.origin}${window.location.pathname}?playlist=${plId}`; navigator.clipboard.writeText(url).then(() => showToast(currentLang === 'ru' ? 'Ссылка на плейлист скопирована!' : 'Playlist link copied!', 'success')); }

// --- ПОДДЕРЖКА ---
let reportFilter = 'all';
let replyingReportId = null;

function findProfileByName(name) {
    const n = (name || '').trim().replace(/^@/, '').toLowerCase();
    if (!n) return null;
    return allProfilesData.find(p => (p.username || '').toLowerCase() === n) || null;
}

function avatarMarkup(p, size = 'w-8 h-8', textSize = 'text-sm') {
    p = p || {};
    const isUrl = p.avatar_url && String(p.avatar_url).startsWith('http');
    const letter = (p.username || 'U').charAt(0).toUpperCase();
    const bg = isUrl ? '' : `background-color:${p.avatar_bg || '#1e293b'}`;
    const light = ['#ffffff', '#f59e0b', '#10b981', '#06b6d4'].includes(p.avatar_bg);
    const inner = isUrl
        ? `<img src="${escapeHtml(p.avatar_url)}" class="w-full h-full object-cover">`
        : `<span class="${textSize} font-bold" style="color:${light ? 'black' : 'white'}">${p.avatar_url ? escapeHtml(p.avatar_url) : escapeHtml(letter)}</span>`;
    return `<div class="${size} rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10" style="${bg}">${inner}</div>`;
}

function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

window.openSiteReview = function() {
    if (!currentUserId) return showToast('Войдите, чтобы оставить отзыв', 'error');
    openSupportModal({ type: 'review' });
}

window.openSupportModal = function(opts) {
    if (!currentUserId) return showToast('Войдите, чтобы написать в поддержку', 'error');
    opts = (opts && typeof opts === 'object' && !opts.target) ? opts : (opts || {});
    const list = document.getElementById('support-users-list');
    if (list) list.innerHTML = allProfilesData.filter(p => p.id !== currentUserId && p.username).map(p => `<option value="${escapeHtml(p.username)}"></option>`).join('');
    document.getElementById('support-type').value = opts.type || 'bug';
    toggleTargetUserInput();
    if (opts.target) document.getElementById('support-target-user').value = opts.target;
    pendingReportRatingId = opts.ratingId || null;
    if (opts.message) { const m = document.getElementById('support-message'); m.value = opts.message; document.getElementById('support-msg-counter').innerText = m.value.length + ' / 1000'; }
    switchSupportTab('new');
    renderMyTickets();
    document.getElementById('support-modal').classList.remove('hidden');
}
window.closeSupportModal = function() { document.getElementById('support-modal').classList.add('hidden'); }

window.switchSupportTab = function(tab) {
    const isNew = tab === 'new';
    document.getElementById('support-panel-new').classList.toggle('hidden', !isNew);
    document.getElementById('support-panel-my').classList.toggle('hidden', isNew);
    const on = 'flex-1 px-3 py-2 rounded-lg text-sm font-bold bg-cyan-500 text-black transition-colors';
    const off = 'flex-1 px-3 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition-colors';
    document.getElementById('support-tab-new').className = isNew ? on : off;
    document.getElementById('support-tab-my').className = isNew ? off : on;
}

window.toggleTargetUserInput = function() {
    const type = document.getElementById('support-type').value;
    const wrap = document.getElementById('support-target-wrap');
    const input = document.getElementById('support-target-user');
    const desc = document.getElementById('support-desc');
    if (desc) desc.innerText = type === 'review'
        ? 'Расскажи, что нравится на сайте и что стоит улучшить. Ответ поддержки появится во вкладке «Мои обращения».'
        : 'Опиши проблему, баг или пожалуйся на пользователя. Ответ появится во вкладке «Мои обращения».';
    if (type === 'report') {
        wrap.classList.remove('hidden');
    } else {
        wrap.classList.add('hidden');
        input.value = '';
        document.getElementById('support-target-hint').innerText = '';
    }
}

window.checkSupportTarget = function() {
    const hint = document.getElementById('support-target-hint');
    const v = document.getElementById('support-target-user').value.trim();
    if (!v) { hint.innerText = ''; return; }
    const p = findProfileByName(v);
    if (!p) { hint.className = 'text-[11px] mt-1 text-red-400'; hint.innerText = 'Пользователь с таким ником не найден'; }
    else if (p.id === currentUserId) { hint.className = 'text-[11px] mt-1 text-red-400'; hint.innerText = 'Нельзя пожаловаться на себя'; }
    else { hint.className = 'text-[11px] mt-1 text-emerald-400'; hint.innerText = '✓ Пользователь найден'; }
}

function renderMyTickets() {
    const list = document.getElementById('support-my-list');
    if (!list) return;
    const mine = allReportsData.filter(r => r.user_id === currentUserId);
    const open = mine.filter(r => r.status !== 'resolved').length;
    const cnt = document.getElementById('support-my-count');
    if (cnt) cnt.innerText = mine.length ? `(${mine.length})` : '';
    if (!mine.length) { list.innerHTML = `<p class="text-sm text-gray-500 text-center py-8">Ты пока ничего не отправлял</p>`; return; }
    const typeText = t => t === 'bug' ? 'Баг' : t === 'report' ? 'Жалоба' : t === 'review' ? 'Отзыв о сайте' : 'Другое';
    list.innerHTML = mine.map(r => {
        const done = r.status === 'resolved';
        const badge = done
            ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Решено</span>`
            : `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400">На рассмотрении</span>`;
        const reply = r.admin_reply ? `<div class="mt-2 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20"><div class="text-[10px] font-bold text-cyan-400 mb-1">Ответ поддержки</div><div class="text-sm text-gray-200 whitespace-pre-wrap">${escapeHtml(r.admin_reply)}</div></div>` : '';
        return `<div class="bg-black/30 border border-white/10 rounded-xl p-3">
            <div class="flex items-center justify-between mb-1"><span class="text-xs text-cyan-400 font-bold">${typeText(r.type)}${r.target_username ? ' · ' + escapeHtml(r.target_username) : ''}</span>${badge}</div>
            <div class="text-sm text-gray-300 whitespace-pre-wrap">${escapeHtml(r.message)}</div>
            <div class="text-[10px] text-gray-500 mt-1">${fmtDate(r.created_at)}</div>${reply}</div>`;
    }).join('');
}

async function refreshReports() {
    if (!currentUserId) return;
    try {
        let q = supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (!isAdmin) q = q.eq('user_id', currentUserId);
        const { data, error } = await q;
        if (!error) allReportsData = data || [];
    } catch (e) { console.error(e); }
    renderMyTickets();
    if (currentCategory === 'AdminPanel') renderAdminPanel();
}

window.submitSupport = async function() {
    if (!currentUserId) return showToast('Войдите, чтобы написать в поддержку', 'error');
    const type = document.getElementById('support-type').value;
    const targetRaw = document.getElementById('support-target-user').value.trim();
    const message = document.getElementById('support-message').value.trim();

    if (!message) return showToast('Напишите сообщение', 'error');
    if (message.length > 1000) return showToast('Сообщение слишком длинное (макс. 1000 символов)', 'error');

    let target = null;
    if (type === 'report') {
        if (!targetRaw) return showToast('Укажите никнейм нарушителя', 'error');
        target = findProfileByName(targetRaw);
        if (!target) return showToast(`Пользователь «${targetRaw}» не найден. Проверь ник`, 'error');
        if (target.id === currentUserId) return showToast('Нельзя пожаловаться на себя', 'error');
    }

    const openCount = allReportsData.filter(r => r.user_id === currentUserId && r.status !== 'resolved').length;
    if (!isAdmin && openCount >= 5) return showToast('У тебя уже 5 открытых обращений. Дождись ответа', 'error');

    const btn = document.getElementById('support-submit-btn');
    btn.disabled = true; btn.classList.add('opacity-50');
    try {
        const row = { user_id: currentUserId, type, target_username: target ? target.username : null, target_user_id: target ? target.id : null, message, status: 'open' };
        if (pendingReportRatingId) row.target_rating_id = pendingReportRatingId;
        let { error } = await supabase.from('reports').insert(row);
        if (error && type === 'review' && /check constraint|violates/i.test(error.message || '')) {
            // SQL-миграция с типом 'review' ещё не выполнена — сохраняем как "Другое"
            row.type = 'other';
            ({ error } = await supabase.from('reports').insert(row));
        }
        if (error && /target_user_id|status|column/i.test(error.message || '')) {
            delete row.target_user_id; delete row.status; delete row.target_rating_id;
            ({ error } = await supabase.from('reports').insert(row));
        }
        if (error) throw error;

        showToast('Обращение отправлено! Спасибо.', 'success'); pendingReportRatingId = null;
        document.getElementById('support-message').value = '';
        document.getElementById('support-target-user').value = '';
        document.getElementById('support-msg-counter').innerText = '0 / 1000';
        await refreshReports();
        switchSupportTab('my');
    } catch (err) {
        showToast('Ошибка отправки: ' + err.message, 'error');
    } finally {
        btn.disabled = false; btn.classList.remove('opacity-50');
    }
}

// --- УПРАВЛЕНИЕ ЖАЛОБАМИ (АДМИН) ---
window.setReportFilter = function(f) { reportFilter = f; renderAdminPanel(); }

window.toggleReportResolved = async function(reportId) {
    if (!isAdmin) return;
    const r = allReportsData.find(x => String(x.id) === String(reportId));
    if (!r) return;
    const resolve = r.status !== 'resolved';
    const { data, error } = await supabase.from('reports')
        .update({ status: resolve ? 'resolved' : 'open', resolved_at: resolve ? new Date().toISOString() : null })
        .eq('id', reportId).select();
    if (error) return showToast('Ошибка: ' + error.message, 'error');
    if (!data || data.length === 0) return showToast('Нет прав на изменение жалоб. Выполни SQL из файла support_setup.sql в Supabase', 'error');
    Object.assign(r, data[0]);
    renderAdminPanel();
    showToast(resolve ? 'Отмечено как решённое' : 'Возвращено в работу', 'success');
}

window.deleteReport = function(reportId) {
    showConfirm('Удалить эту жалобу?', async () => {
        const { data, error } = await supabase.from('reports').delete().eq('id', reportId).select();
        if (error) return showToast('Ошибка: ' + error.message, 'error');
        // Без политики DELETE в RLS Supabase молча удаляет 0 строк и не возвращает ошибку
        if (!data || data.length === 0) return showToast('Не удалено: нет прав (RLS). Выполни SQL из файла support_setup.sql в Supabase', 'error');
        allReportsData = allReportsData.filter(x => String(x.id) !== String(reportId));
        renderAdminPanel();
        showToast('Жалоба удалена', 'success');
    }, 'delete');
}

window.openReportReply = function(reportId) {
    const r = allReportsData.find(x => String(x.id) === String(reportId));
    if (!r) return;
    replyingReportId = reportId;
    document.getElementById('report-reply-original').innerText = r.message;
    document.getElementById('report-reply-text').value = r.admin_reply || '';
    document.getElementById('report-reply-resolve').checked = true;
    document.getElementById('report-reply-modal').classList.remove('hidden');
}
window.closeReportReply = function() { document.getElementById('report-reply-modal').classList.add('hidden'); replyingReportId = null; }
window.saveReportReply = async function() {
    if (!isAdmin || replyingReportId === null) return;
    const text = document.getElementById('report-reply-text').value.trim();
    const resolve = document.getElementById('report-reply-resolve').checked;
    const patch = { admin_reply: text || null };
    if (resolve) { patch.status = 'resolved'; patch.resolved_at = new Date().toISOString(); }
    const { data, error } = await supabase.from('reports').update(patch).eq('id', replyingReportId).select();
    if (error) return showToast('Ошибка: ' + error.message, 'error');
    if (!data || data.length === 0) return showToast('Нет прав на изменение. Выполни SQL из файла support_setup.sql', 'error');
    const r = allReportsData.find(x => String(x.id) === String(replyingReportId));
    if (r) Object.assign(r, data[0]);
    closeReportReply();
    renderAdminPanel();
    showToast('Ответ сохранён', 'success');
}

// --- ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ---
window.openUserProfile = function(userId) {
    const p = allProfilesData.find(x => x.id === userId);
    if (!p) return showToast('Профиль не найден', 'error');
    const rs = allRatingsData.filter(r => r.user_id === userId);
    const cm = rs.filter(r => r.comment && r.comment.trim() !== '');
    const avg = rs.length ? (rs.reduce((a, r) => a + r.score, 0) / rs.length).toFixed(1) : '—';
    const cmIds = new Set(cm.map(c => c.id));
    const likes = allCommentLikesData.filter(l => cmIds.has(l.rating_id)).length;
    const isSelf = userId === currentUserId;
    const isMaster = p.email === MASTER_ADMIN_EMAIL;
    const isTargetAdmin = p.is_admin || isMaster;

    const stat = (val, label) => `<div class="bg-black/30 border border-white/10 rounded-xl p-3 text-center"><div class="text-xl font-extrabold text-white">${val}</div><div class="text-[10px] uppercase tracking-wider text-gray-400 mt-0.5">${label}</div></div>`;

    const recent = rs.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 8).map(r => {
        const t = allTracksData.find(x => x.id === r.track_id);
        if (!t) return '';
        return `<div onclick="closeUserProfile(); playTrack(${t.id})" class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors">
            <img src="${escapeHtml(t.cover_url)}" onerror="this.style.visibility='hidden'" class="w-11 h-11 rounded-lg object-cover bg-white/5 flex-shrink-0">
            <div class="min-w-0 flex-1"><div class="text-sm font-bold text-white truncate">${escapeHtml(t.title)}</div>
            <div class="text-xs text-gray-400 truncate">${escapeHtml(t.artist)}${r.comment ? ' · «' + escapeHtml(r.comment) + '»' : ''}</div></div>
            <div class="text-sm font-bold text-yellow-400 flex-shrink-0">${r.score}<span class="text-gray-500 text-xs"> / 30</span></div></div>`;
    }).join('');

    let adminBlock = '';
    if (isAdmin) {
        const against = allReportsData.filter(r => r.target_user_id === userId || (r.target_username || '').toLowerCase() === (p.username || '').toLowerCase()).length;
        const sent = allReportsData.filter(r => r.user_id === userId).length;
        adminBlock = `<div class="mt-5 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
            <div class="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2">Для админа</div>
            <div class="text-sm text-gray-300">Email: <span class="text-white">${escapeHtml(p.email || '—')}</span></div>
            <div class="text-sm text-gray-300">Жалоб на пользователя: <span class="font-bold ${against ? 'text-red-400' : 'text-white'}">${against}</span> · отправил обращений: <span class="text-white font-bold">${sent}</span></div>
            ${(!isMaster && !isSelf) ? `<button onclick="closeUserProfile(); toggleAdminStatus('${p.id}', ${!!p.is_admin}, '${escapeHtml(p.email || '')}')" class="mt-3 ${p.is_admin ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-black'} px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">${p.is_admin ? 'Снять админа' : 'Выдать админа'}</button>` : ''}
        </div>`;
    }

    if (isAdmin && adminBlock) adminBlock = adminBlock.replace(/<\/div>\s*$/, `${banControls(p)}</div>`);

    const actions = isSelf
        ? `<button onclick="closeUserProfile(); openProfileModal()" class="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 rounded-xl text-sm transition-colors neon-btn">Редактировать профиль</button>`
        : (currentUserId ? `<button onclick="closeUserProfile(); openMessages('${p.id}')" class="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 rounded-xl text-sm transition-colors neon-btn">Написать</button><button onclick="closeUserProfile(); openSupportModal({type:'report', target:'${escapeHtml(p.username).replace(/'/g, '')}'})" class="flex-1 bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white font-bold py-2.5 rounded-xl text-sm transition-colors">Пожаловаться</button>` : '');

    document.getElementById('user-profile-content').innerHTML = `
        <div class="h-24 bg-gradient-to-r from-cyan-900/60 via-cyan-500/20 to-transparent"></div>
        <div class="px-6 pb-6 -mt-12">
            <div class="flex items-end gap-4">
                ${avatarMarkup(p, 'w-24 h-24 border-4 !border-gray-900', 'text-4xl')}
                <div class="pb-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap"><h3 class="text-2xl font-extrabold truncate ${isTargetAdmin ? 'text-cyan-200' : 'text-white'}">${escapeHtml(p.username)}</h3>
                    ${isTargetAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}${banBadge(p)}</div>
                    ${isSelf ? '<div class="text-xs text-cyan-400">Это ты</div>' : ''}
                </div>
            </div>
            ${levelBlockHtml(p)}${socialRowHtml(p)}<div class="grid grid-cols-4 gap-2 mt-3">${stat(rs.length, 'Оценок')}${stat(cm.length, 'Отзывов')}${stat(avg, 'Ср. балл')}${stat(likes, 'Лайков')}</div>
            <div class="flex gap-2 mt-4">${actions}<button onclick="shareUserProfile('${p.id}')" class="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-300 bg-white/5 hover:bg-white/10 transition-colors">Ссылка</button></div>
            ${adminBlock}
            ${achievementsHtml(p)}${favoritesHtml(p)}
            <h4 class="text-sm font-bold text-gray-300 mt-6 mb-2">Последние оценки</h4>
            <div class="space-y-1">${recent || '<p class="text-sm text-gray-500 py-4 text-center">Пока ничего не оценил</p>'}</div>
        </div>`;
    document.getElementById('user-profile-modal').classList.remove('hidden');
}
window.openMyProfile = function() { if (currentUserId) openUserProfile(currentUserId); }
window.closeUserProfile = function() { document.getElementById('user-profile-modal').classList.add('hidden'); }
window.shareUserProfile = function(id) {
    const url = `${window.location.origin}${window.location.pathname}?user=${id}`;
    navigator.clipboard.writeText(url).then(() => showToast('Ссылка на профиль скопирована!', 'success'));
}

// --- СКРОЛЛ СВАЙПОМ МЫШЬЮ (на тач-экранах работает нативно) ---
function initDragScroll() {
    const main = document.getElementById('main-scroll');
    if (!main) return;
    let down = false, startY = 0, startTop = 0;
    main.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (e.target.closest('button, a, input, textarea, select, label, tr[onclick], [onclick], .rating-slider')) return;
        down = true; startY = e.clientY; startTop = main.scrollTop;
    });
    window.addEventListener('pointermove', e => {
        if (!down) return;
        const dy = e.clientY - startY;
        if (Math.abs(dy) > 4) { main.classList.add('dragging'); main.scrollTop = startTop - dy; }
    });
    const stop = () => { down = false; main.classList.remove('dragging'); };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
}
initDragScroll();
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['user-profile-modal', 'support-modal', 'report-reply-modal', 'messages-modal'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
});

// --- ЯЗЫКИ ---
window.changeLanguage = function(lang) { currentLang = lang; localStorage.setItem('te_lang', lang); applyLanguage(); showToast(lang === 'ru' ? 'Язык изменен' : 'Language changed', 'success'); }
function applyLanguage() {
    try {
        const t = translations[currentLang];
        if(document.getElementById('nav-main')) document.getElementById('nav-main').innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>${t.main}`;
        if(document.getElementById('nav-all')) document.getElementById('nav-all').innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>${t.all}`;
        if(document.getElementById('nav-comments')) document.getElementById('nav-comments').innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>${t.comments}`;
        if(document.getElementById('nav-admin')) document.getElementById('nav-admin').innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>${t.admin}`;
        
        const navLiked = document.getElementById('nav-liked');
        if(navLiked) navLiked.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>${t.liked}`;

        if(document.getElementById('search-input')) document.getElementById('search-input').placeholder = t.search;
        const langSelect = document.getElementById('settings-language'); if(langSelect) langSelect.value = currentLang;
        const addFormTitle = document.querySelector('#admin-view-container h3'); if(addFormTitle) addFormTitle.innerText = t.addTrack;
        const inputs = ['add-track-title', 'add-track-artist', 'add-track-category', 'add-track-audio', 'add-track-cover'];
        const placeholders = [t.title, t.artist, t.category, t.audioUrl, t.coverUrl];
        inputs.forEach((id, i) => { const el = document.getElementById(id); if(el) el.placeholder = placeholders[i]; });
        const plModalTitle = document.querySelector('#create-playlist-modal h3'); if(plModalTitle) plModalTitle.innerText = t.newPlaylist;
        const plModalInput = document.getElementById('new-playlist-name'); if(plModalInput) plModalInput.placeholder = t.plName;
        
        renderCategories(); 
        renderView();
    } catch (err) {
        console.error("Language error:", err);
    }
}
window.handleSearch = function(val) { searchQuery = val.toLowerCase().trim(); renderView(); }

// --- ПРОФИЛИ ---
async function fetchProfile(userId) { 
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single(); 
        if(error) throw error;
        return data || { id: userId, username: 'User_' + userId.substring(0, 4), avatar_url: null, avatar_bg: '#1e293b', is_admin: false, language: 'ru' }; 
    } catch(err) {
        return { id: userId, username: 'User_' + userId.substring(0, 4), avatar_url: null, avatar_bg: '#1e293b', is_admin: false, language: 'ru' }; 
    }
}

async function updateProfileUI() {
    if (!currentUserId) { onNotifLogout(); 
        document.getElementById('login-btn').classList.remove('hidden'); 
        document.getElementById('user-profile').classList.add('hidden'); 
        document.getElementById('nav-admin').classList.add('hidden'); 
        isAdmin = false; currentUserProfile = null; renderBanBanner();
        return; 
    }
    currentUserProfile = await fetchProfile(currentUserId);
    const session = await supabase.auth.getSession(); 
    const userEmail = session.data.session?.user?.email; currentUserProfile.email = userEmail;
    isAdmin = (userEmail === MASTER_ADMIN_EMAIL) || currentUserProfile.is_admin;
    
    document.getElementById('login-btn').classList.add('hidden'); 
    document.getElementById('user-profile').classList.remove('hidden'); onNotifLogin();
    document.getElementById('user-username-display').innerText = currentUserProfile.username; 
    document.getElementById('user-email-display').innerText = userEmail;
    
    const avatarBtn = document.getElementById('header-avatar-btn');
    const avatarImg = document.getElementById('user-avatar-img'); 
    const avatarLetter = document.getElementById('user-avatar-letter');
    const adminBadge = document.getElementById('admin-badge-header'); 
    const navAdmin = document.getElementById('nav-admin');
    
    avatarBtn.style.backgroundColor = currentUserProfile.avatar_bg || '#1e293b';
    const isUrl = currentUserProfile.avatar_url && currentUserProfile.avatar_url.startsWith('http');
    if (isUrl) {
        avatarImg.src = currentUserProfile.avatar_url; 
        avatarImg.classList.remove('hidden'); 
        avatarLetter.classList.add('hidden');
        avatarBtn.style.color = 'black';
    } else if (currentUserProfile.avatar_url) {
        avatarImg.classList.add('hidden'); 
        avatarLetter.classList.remove('hidden'); 
        avatarLetter.innerText = currentUserProfile.avatar_url;
        avatarBtn.style.color = (currentUserProfile.avatar_bg === '#ffffff' || currentUserProfile.avatar_bg === '#f59e0b' || currentUserProfile.avatar_bg === '#10b981' || currentUserProfile.avatar_bg === '#06b6d4') ? 'black' : 'white';
    } else {
        avatarImg.classList.add('hidden'); 
        avatarLetter.classList.remove('hidden'); 
        avatarLetter.innerText = currentUserProfile.username.charAt(0).toUpperCase();
        avatarBtn.style.color = 'white';
    }
    
    if (isAdmin) { 
        avatarBtn.classList.add('ring-2', 'ring-cyan-300', 'shadow-[0_0_15px_rgba(34,211,238,0.6)]'); 
        adminBadge.classList.remove('hidden'); 
        navAdmin.classList.remove('hidden'); 
    } else { 
        avatarBtn.classList.remove('ring-2', 'ring-cyan-300', 'shadow-[0_0_15px_rgba(34,211,238,0.6)]'); 
        adminBadge.classList.add('hidden'); 
        navAdmin.classList.add('hidden'); 
    }
    updateProfilePreview(); renderBanBanner();
}

function updateProfilePreview() {
    const previewImg = document.getElementById('settings-avatar-preview'); 
    const previewLetter = document.getElementById('settings-avatar-letter'); 
    const previewEmoji = document.getElementById('settings-avatar-emoji');
    const container = document.getElementById('settings-avatar-container');
    if(!container) return;
    
    container.style.backgroundColor = selectedAvatarBg || '#1e293b';
    let currentAvatar = selectedEmojiAvatar || currentUserProfile?.avatar_url;
    
    if (currentAvatar && currentAvatar.startsWith('http')) {
        previewImg.src = currentAvatar; previewImg.classList.remove('hidden'); previewLetter.classList.add('hidden'); previewEmoji.classList.add('hidden');
    } else if (currentAvatar) {
        previewImg.classList.add('hidden'); previewLetter.classList.add('hidden'); previewEmoji.innerText = currentAvatar; previewEmoji.classList.remove('hidden');
        previewEmoji.style.color = (selectedAvatarBg === '#ffffff' || selectedAvatarBg === '#f59e0b' || selectedAvatarBg === '#10b981' || selectedAvatarBg === '#06b6d4') ? 'black' : 'white';
    } else {
        previewImg.classList.add('hidden'); previewEmoji.classList.add('hidden'); previewLetter.innerText = currentUserProfile ? currentUserProfile.username.charAt(0).toUpperCase() : 'U'; previewLetter.classList.remove('hidden');
        previewLetter.style.color = 'white';
    }
}

window.openProfileModal = function() { 
    if (!currentUserProfile) return showToast('Сначала войдите в аккаунт', 'error'); 
    selectedEmojiAvatar = null;
    selectedAvatarBg = currentUserProfile.avatar_bg || '#1e293b';
    document.getElementById('settings-username').value = currentUserProfile.username; 
    
    document.getElementById('emoji-avatar-picker').innerHTML = presetAvatars.map(emoji => 
        `<button onclick="setEmojiAvatar('${emoji}')" class="text-2xl hover:scale-125 hover:bg-white/10 rounded-lg p-1 transition-all ${currentUserProfile.avatar_url === emoji ? 'bg-cyan-500/20 neon-border' : ''}">${emoji}</button>`
    ).join('');

    document.getElementById('bg-color-picker').innerHTML = presetColors.map(color => 
        `<button onclick="setAvatarBg('${color}')" class="w-8 h-8 rounded-full border-2 border-white/20 hover:scale-110 transition-all ${selectedAvatarBg === color ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-gray-900' : ''}" style="background-color: ${color}"></button>`
    ).join('');

    updateProfilePreview();
    document.getElementById('profile-modal').classList.remove('hidden'); 
}
window.closeProfileModal = () => document.getElementById('profile-modal').classList.add('hidden');

window.setEmojiAvatar = function(emoji) {
    selectedEmojiAvatar = emoji; updateProfilePreview();
    document.querySelectorAll('#emoji-avatar-picker button').forEach(btn => {
        btn.setAttribute('class', btn.innerText === emoji ? 'text-2xl hover:scale-125 hover:bg-white/10 rounded-lg p-1 transition-all bg-cyan-500/20 neon-border' : 'text-2xl hover:scale-125 hover:bg-white/10 rounded-lg p-1 transition-all');
    });
}
window.setAvatarBg = function(color) {
    selectedAvatarBg = color; updateProfilePreview();
    document.querySelectorAll('#bg-color-picker button').forEach(btn => {
        const isSel = btn.style.backgroundColor === color || btn.style.backgroundColor === `rgb(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)})`;
        btn.setAttribute('class', isSel ? 'w-8 h-8 rounded-full border-2 border-white/20 hover:scale-110 transition-all ring-2 ring-cyan-500 ring-offset-2 ring-offset-gray-900' : 'w-8 h-8 rounded-full border-2 border-white/20 hover:scale-110 transition-all');
    });
}

window.saveProfile = async function() {
    const newUsername = document.getElementById('settings-username').value.trim(); 
    if (!newUsername) return showToast('Никнейм не может быть пустым', 'error');
    const fileInput = document.getElementById('settings-avatar-file');
    let avatarUrl = selectedEmojiAvatar || currentUserProfile.avatar_url;
    
    try {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0]; const fileExt = file.name.split('.').pop(); const fileName = `${currentUserId}-${Date.now()}.${fileExt}`;
            showToast('Загрузка аватарки...', 'success');
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = publicUrlData.publicUrl;
        }

        const { error } = await supabase.from('profiles').upsert({ id: currentUserId, username: newUsername, avatar_url: avatarUrl, avatar_bg: selectedAvatarBg, language: currentLang });
        if (error) {
            if (error.code === '23505') throw new Error('Этот никнейм уже занят!');
            throw error;
        }
        
        showToast('Профиль обновлён!', 'success'); 
        closeProfileModal(); 
        await updateProfileUI(); 
        await loadData(); 
    } catch(err) {
        showToast(err.message, 'error');
    }
}

window.openLoginModal = () => document.getElementById('login-modal').classList.remove('hidden');
window.closeLoginModal = () => document.getElementById('login-modal').classList.add('hidden');

window.handleLogin = async function() {
    const email = document.getElementById('login-email').value; const password = document.getElementById('login-password').value;
    if(!email || !password) return showToast("Введи email и пароль!", "error");
    
    try {
        let { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error && error.message.includes('Invalid login credentials')) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
            if (signUpError) throw signUpError;
            showToast(signUpData.session ? 'Аккаунт создан!' : 'Аккаунт создан! Подтверди почту по ссылке из письма', 'success'); closeLoginModal();
        } else if (error) { 
            throw error;
        } else { 
            showToast('Успешный вход!', 'success'); 
            closeLoginModal(); 
        }
    } catch (err) {
        const msg = /email not confirmed/i.test(err.message) ? 'Почта не подтверждена. Открой письмо и перейди по ссылке' : err.message;
        showToast('Ошибка: ' + msg, 'error');
    }
}

window.handlePasswordReset = async function() {
    const email = document.getElementById('login-email').value;
    if (!email) return showToast('Введи email для сброса!', 'error');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    if (error) showToast('Ошибка: ' + error.message, 'error'); else showToast('Инструкция отправлена на почту!', 'success');
}
window.logout = async function() { await supabase.auth.signOut(); showToast('Вы вышли', 'success'); }

// --- АДМИН ПАНЕЛЬ ---
// (adminAddTrack — см. блок «УПРАВЛЕНИЕ ТРЕКАМИ» в конце файла)
window.toggleAdminStatus = async function(targetUserId, currentStatus, targetEmail) {
    if (!isAdmin) return;
    if (targetEmail === MASTER_ADMIN_EMAIL) return showToast('Нельзя снять права с главного админа', 'error');
    
    showConfirm(currentStatus ? 'Снять права администратора?' : 'Выдать права администратора?', async () => {
        const { error } = await supabase.from('profiles').update({ is_admin: !currentStatus }).eq('id', targetUserId);
        if (error) showToast('Ошибка: ' + error.message, 'error'); else { showToast('Права обновлены!', 'success'); await loadData(); }
    }, 'admin'); 
}

// --- ПЛЕЙЛИСТЫ ---
window.openCreatePlaylistModal = function() { if (!currentUserId) return showToast('Войди, чтобы создавать плейлисты', 'error'); document.getElementById('create-playlist-modal').classList.remove('hidden'); }
window.closeCreatePlaylistModal = () => document.getElementById('create-playlist-modal').classList.add('hidden');
window.createPlaylist = async function() {
    if (guardBan()) return;
    const name = document.getElementById('new-playlist-name').value.trim();
    if (!name) return showToast('Введи название', 'error');
    const { error } = await supabase.from('playlists').insert({ user_id: currentUserId, name });
    if (error) showToast('Ошибка: ' + error.message, 'error');
    else { showToast('Плейлист создан', 'success'); closeCreatePlaylistModal(); document.getElementById('new-playlist-name').value = ''; await loadData(); }
}
window.deletePlaylist = function(playlistId, event) {
    event.stopPropagation();
    showConfirm('Удалить этот плейлист?', async () => {
        const { error } = await supabase.from('playlists').delete().match({ id: playlistId, user_id: currentUserId });
        if (error) showToast('Ошибка: ' + error.message, 'error');
        else { showToast('Плейлист удален', 'success'); if (currentCategory === `Playlist_${playlistId}`) changeCategory('Главное меню'); await loadData(); }
    }, 'delete');
}
window.openAddToPlaylistModal = function(trackId) {
    if (!currentUserId) return showToast('Войди!', 'error'); if (guardBan()) return; 
    currentTrackToAddToPlaylist = trackId; const container = document.getElementById('playlists-to-add-container');
    if (userPlaylists.length === 0) container.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">У вас пока нет плейлистов.</p>`;
    else container.innerHTML = userPlaylists.map(pl => `<button onclick="addTrackToPlaylist(${pl.id})" class="w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm font-bold text-white neon-border">${escapeHtml(pl.name)}</button>`).join('');
    document.getElementById('add-to-playlist-modal').classList.remove('hidden');
}
window.closeAddToPlaylistModal = () => document.getElementById('add-to-playlist-modal').classList.add('hidden');
window.addTrackToPlaylist = async function(playlistId) {
    if (guardBan()) return;
    const { error } = await supabase.from('playlist_tracks').insert({ playlist_id: playlistId, track_id: currentTrackToAddToPlaylist });
    if (error && error.code === '23505') showToast('Трек уже есть в этом плейлисте', 'error');
    else if (error) showToast('Ошибка: ' + error.message, 'error');
    else { showToast('Добавлено в плейлист!', 'success'); closeAddToPlaylistModal(); await loadData(); }
}

// --- ПЛЕЕР ---
window.playTrack = function(trackId, startTime = 0, playImmediately = true) {
    const track = allTracksData.find(t => t.id === trackId); if (!track) return;
    if (currentTrackId === trackId && playImmediately) { toggleGlobalPlay(); return; }
    currentTrackId = trackId; globalAudio.src = track.audio_url; 
    if (playImmediately) globalAudio.play(); else globalAudio.pause();
    document.getElementById('global-player').classList.remove('hidden');
    document.getElementById('player-title').innerText = track.title; document.getElementById('player-artist').innerText = track.artist || 'TrueEstimation';
    updatePlayerExtras(track); const coverImg = document.getElementById('player-cover'); if(track.cover_url) { coverImg.src = track.cover_url; coverImg.style.display = 'block'; } else { coverImg.style.display = 'none'; }
    if (startTime > 0) { globalAudio.addEventListener('loadedmetadata', () => { globalAudio.currentTime = startTime; }, { once: true }); }
    updateAllPlayIcons(); updateGlobalPlayPauseIcon(playImmediately);
}
window.toggleGlobalPlay = function() { 
    if (!currentTrackId) return; 
    if (globalAudio.paused) { globalAudio.play(); updateGlobalPlayPauseIcon(true); } 
    else { globalAudio.pause(); updateGlobalPlayPauseIcon(false); } 
    updateAllPlayIcons(); updateVolumeUI();
}
window.playNext = function() { if (!currentTrackId || allTracksData.length === 0) return; if (playQueue.length && repeatMode !== 2) { const qid = playQueue.shift(); renderQueuePanel(); if (qid === currentTrackId) { globalAudio.currentTime = 0; globalAudio.play(); } else playTrack(qid); return; } if (repeatMode === 2) { globalAudio.currentTime = 0; globalAudio.play(); return; } let nextIndex; if (isShuffle) { nextIndex = Math.floor(Math.random() * allTracksData.length); } else { const currentIndex = allTracksData.findIndex(t => t.id === currentTrackId); nextIndex = currentIndex + 1; if (nextIndex >= allTracksData.length) { if (repeatMode === 1) nextIndex = 0; else { globalAudio.pause(); updateGlobalPlayPauseIcon(false); updateAllPlayIcons(); return; } } } playTrack(allTracksData[nextIndex].id); }
window.playPrev = function() { if (!currentTrackId || allTracksData.length === 0) return; if (repeatMode === 2) { globalAudio.currentTime = 0; globalAudio.play(); return; } let prevIndex; if (isShuffle) { prevIndex = Math.floor(Math.random() * allTracksData.length); } else { const currentIndex = allTracksData.findIndex(t => t.id === currentTrackId); prevIndex = currentIndex - 1; if (prevIndex < 0) { if (repeatMode === 1) prevIndex = allTracksData.length - 1; else prevIndex = 0; } } playTrack(allTracksData[prevIndex].id); }
window.toggleShuffle = function() { isShuffle = !isShuffle; const btn = document.getElementById('shuffle-btn'); if (isShuffle) { btn.classList.add('text-cyan-500'); btn.classList.remove('text-gray-400'); } else { btn.classList.remove('text-cyan-500'); btn.classList.add('text-gray-400'); } }
window.toggleRepeat = function() { repeatMode = (repeatMode + 1) % 3; const btn = document.getElementById('repeat-btn'); const badge = document.getElementById('repeat-badge'); btn.classList.remove('text-cyan-500', 'text-gray-400'); badge.classList.add('hidden'); if (repeatMode === 0) btn.classList.add('text-gray-400'); else if (repeatMode === 1) btn.classList.add('text-cyan-500'); else if (repeatMode === 2) { btn.classList.add('text-cyan-500'); badge.classList.remove('hidden'); } }
window.openCoverModal = function() { if (!currentTrackId) return; const track = allTracksData.find(t => t.id === currentTrackId); if (!track || !track.cover_url) return; document.getElementById('cover-modal-img').src = track.cover_url; document.getElementById('cover-modal').classList.remove('hidden'); }
window.closeCoverModal = () => document.getElementById('cover-modal').classList.add('hidden');

function updateAllPlayIcons() { document.querySelectorAll('.card-play-icon').forEach(icon => { icon.innerHTML = `<path class="ml-0.5" d="M8 5v14l11-7z"/>`; }); if (currentTrackId && !globalAudio.paused) { document.querySelectorAll(`.card-icon-${currentTrackId}`).forEach(icon => { icon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`; }); } }
function updateGlobalPlayPauseIcon(isPlaying) { 
    const icon = document.getElementById('global-play-icon'); 
    if (isPlaying) { icon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`; icon.classList.remove('ml-0.5'); } 
    else { icon.innerHTML = `<path d="M8 5v14l11-7z"/>`; icon.classList.add('ml-0.5'); } 
    document.querySelectorAll('#volume-eq .eq-bar').forEach(bar => isPlaying ? bar.classList.remove('paused') : bar.classList.add('paused'));
}
document.getElementById('progress-container').addEventListener('mousedown', function(e) { if (e.target.tagName.toLowerCase() === 'input') return; const rect = this.getBoundingClientRect(); const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); if (globalAudio.duration) { const newTime = percent * globalAudio.duration; globalAudio.currentTime = newTime; document.getElementById('global-progress-bar').style.width = `${percent * 100}%`; document.getElementById('global-slider').value = newTime; document.getElementById('global-current-time').innerText = formatTime(newTime); updateThumbPosition('progress', percent); } });
document.getElementById('volume-container').addEventListener('mousedown', function(e) { if (e.target.tagName.toLowerCase() === 'input') return; const rect = this.getBoundingClientRect(); const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); changeVolume(percent); updateThumbPosition('volume', percent); });
function updateThumbPosition(type, percent) { const thumb = document.getElementById(`${type}-thumb`); if (thumb) { thumb.style.left = `${percent * 100}%`; if (type === 'volume' && percent === 0) thumb.style.opacity = '0'; else if (percent > 0) thumb.style.opacity = '1'; } }
globalAudio.addEventListener('timeupdate', () => { if (!globalAudio.duration) return; const percent = (globalAudio.currentTime / globalAudio.duration) * 100; document.getElementById('global-progress-bar').style.width = `${percent}%`; document.getElementById('global-slider').value = globalAudio.currentTime; document.getElementById('global-current-time').innerText = formatTime(globalAudio.currentTime); updateThumbPosition('progress', percent / 100); });
globalAudio.addEventListener('loadedmetadata', () => { document.getElementById('global-duration').innerText = formatTime(globalAudio.duration); document.getElementById('global-slider').max = globalAudio.duration; });
globalAudio.addEventListener('ended', () => { if (repeatMode === 2) { globalAudio.currentTime = 0; globalAudio.play(); } else { playNext(); } });
window.seekGlobalAudio = function(value) { globalAudio.currentTime = value; if (globalAudio.duration) { const percent = value / globalAudio.duration; document.getElementById('global-progress-bar').style.width = `${percent * 100}%`; updateThumbPosition('progress', percent); } }

function updateVolumeUI() {
    const eq = document.getElementById('volume-eq'); const muteIcon = document.getElementById('volume-mute-icon');
    if (globalAudio.volume === 0 || globalAudio.muted) { eq.classList.add('hidden'); muteIcon.classList.remove('hidden'); } 
    else { eq.classList.remove('hidden'); muteIcon.classList.add('hidden'); }
}
window.changeVolume = function(value) { 
    value = parseFloat(value); globalAudio.volume = value; if (value > 0) previousVolume = value; localStorage.setItem('te_volume', value); 
    document.getElementById('volume-progress-bar').style.width = `${value * 100}%`; document.getElementById('global-volume-slider').value = value; 
    updateThumbPosition('volume', value); updateVolumeUI();
}
window.toggleMute = function() { if (globalAudio.volume > 0) { changeVolume(0); } else { changeVolume(previousVolume || 0.5); } }
const savedVol = parseFloat(localStorage.getItem('te_volume')); 
if (!isNaN(savedVol)) { globalAudio.volume = savedVol; previousVolume = savedVol > 0 ? savedVol : 1; document.getElementById('global-volume-slider').value = savedVol; document.getElementById('volume-progress-bar').style.width = `${savedVol * 100}%`; setTimeout(() => { changeVolume(savedVol); updateVolumeUI(); }, 100); }
window.addEventListener('beforeunload', () => { if (currentTrackId) { localStorage.setItem('te_trackId', currentTrackId); localStorage.setItem('te_currentTime', globalAudio.currentTime); } });
globalAudio.addEventListener('pause', () => { if (currentTrackId) { localStorage.setItem('te_trackId', currentTrackId); localStorage.setItem('te_currentTime', globalAudio.currentTime); } updateVolumeUI(); });
globalAudio.addEventListener('play', updateVolumeUI);

// --- ОЦЕНКА И КОММЕНТАРИИ ---
window.openRatingModal = function(trackId) { const track = allTracksData.find(t => t.id === trackId); if (!track) return; ratingTrackId = trackId; document.getElementById('modal-track-title').innerText = track.title; document.getElementById('modal-track-artist').innerText = track.artist || 'TrueEstimation'; const coverImg = document.getElementById('modal-track-cover'); if(track.cover_url) { coverImg.src = track.cover_url; coverImg.style.display = 'block'; } else { coverImg.style.display = 'none'; } currentUserRating = track.userRating; const deleteBtn = document.getElementById('delete-rating-btn'); if (currentUserRating) { for(let i=1; i<=5; i++) document.getElementById(`crit-${i}`).value = 3; document.getElementById('rating-comment').value = currentUserRating.comment || ''; deleteBtn.classList.remove('hidden'); } else { for(let i=1; i<=5; i++) { document.getElementById(`crit-${i}`).value = 3; document.getElementById(`val-crit-${i}`).innerText = '3 / 6'; } document.getElementById('rating-comment').value = ''; deleteBtn.classList.add('hidden'); } updateTotalScore(); document.getElementById('rating-modal').classList.remove('hidden'); }
window.closeRatingModal = function() { document.getElementById('rating-modal').classList.add('hidden'); ratingTrackId = null; currentUserRating = null; }
window.updateTotalScore = function() { let total = 0; for(let i=1; i<=5; i++) { const val = parseInt(document.getElementById(`crit-${i}`).value); document.getElementById(`val-crit-${i}`).innerText = `${val} / 6`; total += val; } document.getElementById('modal-total-score').innerText = total; }
window.submitRating = async function() { if (!ratingTrackId) return; if (guardBan()) return;  const { data: { session } } = await supabase.auth.getSession(); if (!session) { showToast('Сначала войди!', 'error'); closeRatingModal(); return; } let totalScore = 0; for(let i=1; i<=5; i++) totalScore += parseInt(document.getElementById(`crit-${i}`).value); const commentText = document.getElementById('rating-comment').value.trim(); const { error } = await supabase.from('ratings').upsert({ user_id: session.user.id, track_id: ratingTrackId, score: totalScore, comment: commentText || null }, { onConflict: 'user_id, track_id' }); if (error) showToast('Ошибка: ' + error.message, 'error'); else { showToast('Оценка сохранена!', 'success'); closeRatingModal(); await loadData(); } }
window.promptDeleteRating = function() { if (!ratingTrackId || !currentUserRating) return; showConfirm('Удалить свою оценку?', async () => { const { error } = await supabase.from('ratings').delete().match({ id: currentUserRating.id }); if (error) showToast('Ошибка: ' + error.message, 'error'); else { showToast('Удалено', 'success'); closeRatingModal(); await loadData(); } }, 'delete'); }
window.promptDeleteComment = function(ratingId) { showConfirm('Удалить этот комментарий?', async () => { const { error } = await supabase.from('ratings').delete().match({ id: ratingId }); if (error) showToast('Ошибка (возможно, нет прав): ' + error.message, 'error'); else { showToast('Удалено', 'success'); await loadData(); } }, 'delete'); }
window.likeTrack = async function(trackId, event) { event.stopPropagation(); if (!currentUserId) return showToast('Войди!', 'error'); if (guardBan()) return;  const track = allTracksData.find(t => t.id === trackId); if (!track) return; const wasLiked = track.userLiked; track.userLiked = !wasLiked; track.likesCount += wasLiked ? -1 : 1; renderTracksList(); if (wasLiked) { const { error } = await supabase.from('track_likes').delete().match({ user_id: currentUserId, track_id: trackId }); if (error) { track.userLiked = true; track.likesCount++; renderTracksList(); } } else { const { error } = await supabase.from('track_likes').insert({ user_id: currentUserId, track_id: trackId }); if (error) { track.userLiked = false; track.likesCount--; renderTracksList(); } } }
window.likeComment = async function(ratingId, event) { event.stopPropagation(); if (!currentUserId) return showToast('Войди!', 'error'); if (guardBan()) return;  const comment = allCommentsData.find(c => c.id === ratingId); if (!comment) return; const wasLiked = comment.userLiked; comment.userLiked = !wasLiked; comment.likesCount += wasLiked ? -1 : 1; renderCommentsView(); if (wasLiked) { const { error } = await supabase.from('comment_likes').delete().match({ user_id: currentUserId, rating_id: ratingId }); if (error) { comment.userLiked = true; comment.likesCount++; renderCommentsView(); } } else { const { error } = await supabase.from('comment_likes').insert({ user_id: currentUserId, rating_id: ratingId }); if (error) { comment.userLiked = false; comment.likesCount--; renderCommentsView(); } } }
window.likeReply = async function(replyId, event) { event.stopPropagation(); if (!currentUserId) return showToast('Войди!', 'error'); if (guardBan()) return;  const reply = allCommentsData.flatMap(c => c.replies || []).find(r => r.id === replyId); if (!reply) return; const wasLiked = reply.userLiked; reply.userLiked = !wasLiked; reply.likesCount += wasLiked ? -1 : 1; renderCommentsView(); if (wasLiked) { const { error } = await supabase.from('reply_likes').delete().match({ user_id: currentUserId, reply_id: replyId }); if (error) { reply.userLiked = true; reply.likesCount++; renderCommentsView(); showToast('Ошибка: ' + error.message, 'error'); } } else { const { error } = await supabase.from('reply_likes').insert({ user_id: currentUserId, reply_id: replyId }); if (error) { reply.userLiked = false; reply.likesCount--; renderCommentsView(); showToast('Ошибка: ' + error.message, 'error'); } } }
window.toggleReplyBox = function(ratingId) { const box = document.getElementById(`reply-box-${ratingId}`); if (box) { box.classList.toggle('hidden'); if (!box.classList.contains('hidden')) document.getElementById(`reply-input-${ratingId}`).focus(); } }
window.replyToUser = function(commentId, username) { document.getElementById(`reply-box-${commentId}`).classList.remove('hidden'); const input = document.getElementById(`reply-input-${commentId}`); input.value = `@${username} `; input.focus(); }
window.submitReply = async function(ratingId) { if (!currentUserId) return showToast('Войди!', 'error'); if (guardBan()) return;  const input = document.getElementById(`reply-input-${ratingId}`); const text = input.value.trim(); if (!text) return; const { error } = await supabase.from('replies').insert({ rating_id: ratingId, user_id: currentUserId, content: text }); if (error) showToast('Ошибка: ' + error.message, 'error'); else { showToast('Ответ добавлен', 'success'); input.value = ''; await loadData(); } }
window.deleteReply = function(replyId) { showConfirm('Удалить этот ответ?', async () => { const { error } = await supabase.from('replies').delete().match({ id: replyId }); if (error) showToast('Ошибка: ' + error.message, 'error'); else { showToast('Удалено', 'success'); await loadData(); } }, 'delete'); }
window.changeSort = function(sortType) { currentSort = sortType; renderView(); }
window.changeCommentsSort = function(sortType) { currentCommentsSort = sortType; renderCommentsView(); }

// --- ЗАГРУЗКА ДАННЫХ ---
async function loadData() {
    try {
        const [tracksRes, ratingsRes, trackLikesRes, commentLikesRes, profilesRes, repliesRes, replyLikesRes, playlistsRes, playlistTracksRes, reportsRes] = await Promise.all([
            supabase.from('tracks').select('*'), supabase.from('ratings').select('*'), supabase.from('track_likes').select('*'), supabase.from('comment_likes').select('*'),
            supabase.from('profiles').select('*'), supabase.from('replies').select('*'), supabase.from('reply_likes').select('*'),
            currentUserId ? supabase.from('playlists').select('*').eq('user_id', currentUserId) : Promise.resolve({data: []}),
            currentUserId ? supabase.from('playlist_tracks').select('*') : Promise.resolve({data: []}),
            currentUserId ? (isAdmin ? supabase.from('reports').select('*').order('created_at', { ascending: false }) : supabase.from('reports').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false })) : Promise.resolve({data: []})
        ]);

        const tracks = tracksRes.data || []; const ratings = ratingsRes.data || []; const trackLikes = trackLikesRes.data || []; const commentLikes = commentLikesRes.data || [];
        allProfilesData = profilesRes.data || []; await mergePrivateEmails(); await loadFollows(); allRepliesData = repliesRes.data || []; const replyLikes = replyLikesRes.data || [];
        userPlaylists = playlistsRes.data || [];
        allPlaylistTracksData = playlistTracksRes.data || [];
        allReportsData = reportsRes.data || [];
        allRatingsData = ratings; allCommentLikesData = commentLikes; allTrackLikesData = trackLikes;
        buildStatsIndex(); renderHeaderLevel(); checkAchievementUnlocks();

        const ratingsByTrack = new Map(); ratings.forEach(r => { if (!ratingsByTrack.has(r.track_id)) ratingsByTrack.set(r.track_id, []); ratingsByTrack.get(r.track_id).push(r); });
        const likesByTrack = new Map(); trackLikes.forEach(l => { if (!likesByTrack.has(l.track_id)) likesByTrack.set(l.track_id, []); likesByTrack.get(l.track_id).push(l.user_id); });
        const likesByComment = new Map(); commentLikes.forEach(l => { if (!likesByComment.has(l.rating_id)) likesByComment.set(l.rating_id, []); likesByComment.get(l.rating_id).push(l.user_id); });
        const likesByReply = new Map(); replyLikes.forEach(l => { if (!likesByReply.has(l.reply_id)) likesByReply.set(l.reply_id, []); likesByReply.get(l.reply_id).push(l.user_id); });

        allTracksData = []; scheduledTracksData = []; lastLoadAt = Date.now(); let totalGlobalVotes = 0;
        for (const track of tracks) {
            if (track.publish_at && new Date(track.publish_at).getTime() > Date.now()) { scheduledTracksData.push({ ...track, category: (track.category && track.category.trim()) || 'Без категории', avgScore: 0, votesCount: 0, likesCount: 0, userLiked: false }); continue; }
            const tRatings = ratingsByTrack.get(track.id) || []; const tLikes = likesByTrack.get(track.id) || []; const votesCount = tRatings.length; totalGlobalVotes += votesCount;
            let avgScore = 0; if (votesCount > 0) { const sum = tRatings.reduce((acc, curr) => acc + curr.score, 0); avgScore = parseFloat((sum / votesCount).toFixed(1)); }
            let category = track.category; if (!category || category.trim() === "") category = 'Без категории';
            const userRatingObj = currentUserId ? tRatings.find(r => r.user_id === currentUserId) : null;
            allTracksData.push({ ...track, category, avgScore, votesCount, likesCount: tLikes.length, userLiked: currentUserId ? tLikes.includes(currentUserId) : false, userRating: userRatingObj });
        }

        allCommentsData = ratings.filter(r => r.comment && r.comment.trim() !== "" && (!r.hidden || isAdmin)).map(r => {
            const cLikes = likesByComment.get(r.id) || []; const track = tracks.find(t => t.id === r.track_id);
            const profile = allProfilesData.find(p => p.id === r.user_id) || { username: 'User', avatar_url: null, avatar_bg: '#1e293b', is_admin: false };
            const replies = allRepliesData.filter(rep => rep.rating_id === r.id).map(rep => {
                const repProfile = allProfilesData.find(p => p.id === rep.user_id) || { username: 'User', avatar_url: null, avatar_bg: '#1e293b', is_admin: false };
                const repLikes = likesByReply.get(rep.id) || [];
                return { ...rep, username: repProfile.username, avatar_url: repProfile.avatar_url, avatar_bg: repProfile.avatar_bg, isAdmin: repProfile.is_admin, isOwn: currentUserId === rep.user_id || isAdmin, likesCount: repLikes.length, userLiked: currentUserId ? repLikes.includes(currentUserId) : false };
            });
            return { ...r, likesCount: cLikes.length, userLiked: currentUserId ? cLikes.includes(currentUserId) : false, trackTitle: track ? track.title : 'Неизвестный трек', trackArtist: track ? track.artist : '', trackCover: track ? track.cover_url : '', isOwn: currentUserId === r.user_id || isAdmin, isAdmin: profile.is_admin, username: profile.username, avatar_url: profile.avatar_url, avatar_bg: profile.avatar_bg, replies: replies };
        });

        const statsEl = document.getElementById('stats-container');
        if(statsEl) statsEl.innerText = `${allTracksData.length} треков | ${totalGlobalVotes} оценок`;
        
        await loadNews();
        renderSidebarPlaylists();
        applyLanguage(); 
        renderView(); 

        const urlParams = new URLSearchParams(window.location.search);
        const sharedTrackId = urlParams.get('track');
        const sharedPlaylistId = urlParams.get('playlist');
        const sharedUserId = urlParams.get('user');
        if (sharedUserId && !userLinkHandled) { userLinkHandled = true; setTimeout(() => openUserProfile(sharedUserId), 600); }

        if (sharedTrackId) {
            setTimeout(() => { const track = allTracksData.find(t => t.id == sharedTrackId); if (track) { showToast(`Загружен трек по ссылке`, 'success'); changeCategory('Все'); setTimeout(() => playTrack(track.id), 500); } }, 1000);
        } else if (sharedPlaylistId) {
            setTimeout(() => { const pl = userPlaylists.find(p => p.id == sharedPlaylistId); if (pl) { showToast(`Загружен плейлист по ссылке`, 'success'); changeCategory(`Playlist_${pl.id}`); } }, 1000);
        }

        const savedTrackId = localStorage.getItem('te_trackId'); const savedTime = parseFloat(localStorage.getItem('te_currentTime'));
        if (savedTrackId && !currentTrackId) {
            const savedTrack = allTracksData.find(t => t.id == savedTrackId);
            if (savedTrack) {
                playTrack(savedTrack.id, savedTime || 0, false);
                setTimeout(() => { if (savedTime && globalAudio.duration) { document.getElementById('global-progress-bar').style.width = `${(savedTime / globalAudio.duration) * 100}%`; document.getElementById('global-slider').value = savedTime; document.getElementById('global-current-time').innerText = formatTime(savedTime); updateThumbPosition('progress', savedTime / globalAudio.duration); } }, 500);
            }
        }
    } catch (err) {
        console.error("Data Load Error:", err);
        showToast("Ошибка загрузки данных: " + err.message, 'error');
    }
}

// ОТДЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПЛЕЙЛИСТОВ В САЙДБАРЕ
function renderSidebarPlaylists() {
    const plContainer = document.getElementById('playlists-container');
    if(!plContainer) return;

    const t = translations[currentLang];
    let html = `
        <button onclick="changeCategory('Liked')" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left" id="nav-liked">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            ${t.liked}
        </button>
    `;

    html += userPlaylists.map(pl => `
        <div class="flex items-center justify-between group/pl w-full rounded-xl hover:bg-white/10 transition-colors pr-2">
            <button onclick="changeCategory('Playlist_${pl.id}')" class="flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-300 group-hover/pl:text-white text-left" id="nav-playlist-${pl.id}">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
                <span class="truncate">${escapeHtml(pl.name)}</span>
            </button>
            <button onclick="deletePlaylist(${pl.id}, event)" class="opacity-0 group-hover/pl:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-all" title="Удалить плейлист">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>
    `).join('');

    plContainer.innerHTML = html;
}

function renderCategories() {
    try {
        const container = document.getElementById('categories-container');
        if(!container) return;
        const dynamicCategories = Array.from(new Set(allTracksData.map(t => t.category).filter(c => c && c !== 'Все' && c.toLowerCase() !== 'треки')));
        
        if(document.getElementById('nav-main')) document.getElementById('nav-main').setAttribute('class', currentCategory === 'Главное меню' ? 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-white/10 text-white transition-colors text-left neon-text' : 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left');
        if(document.getElementById('nav-all')) document.getElementById('nav-all').setAttribute('class', currentCategory === 'Все' ? 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-white/10 text-white transition-colors text-left neon-text' : 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left');
        if(document.getElementById('nav-comments')) document.getElementById('nav-comments').setAttribute('class', currentCategory === 'Комментарии' ? 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-white/10 text-white transition-colors text-left neon-text' : 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left');
        if(document.getElementById('nav-liked')) document.getElementById('nav-liked').setAttribute('class', currentCategory === 'Liked' ? 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold bg-white/10 text-white transition-colors text-left neon-text' : 'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-left');
        
        const navCls = key => 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors text-left ' + (currentCategory === key ? 'bg-white/10 text-white neon-text' : 'text-gray-300 hover:text-white hover:bg-white/10');
        document.getElementById('nav-top')?.setAttribute('class', navCls('TopTracks')); document.getElementById('nav-ranking')?.setAttribute('class', navCls('UserRanking')); document.getElementById('nav-news')?.setAttribute('class', navCls('News'));

        const adminBtnClass = currentCategory === 'AdminPanel' 
            ? 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-white/10 text-cyan-200 transition-colors text-left neon-text' 
            : 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-cyan-200 hover:text-white hover:bg-cyan-500/10 transition-colors text-left';
        if(document.getElementById('nav-admin')) document.getElementById('nav-admin').setAttribute('class', isAdmin ? adminBtnClass : `${adminBtnClass} hidden`);

        userPlaylists.forEach(pl => {
            const el = document.getElementById(`nav-playlist-${pl.id}`);
            if (el) el.setAttribute('class', currentCategory === `Playlist_${pl.id}` ? 'flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-cyan-400 text-left neon-text' : 'flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-300 group-hover/pl:text-white text-left');
        });

        const htmlParts = dynamicCategories.map(cat => {
            const isActive = cat === currentCategory;
            const btnClass = isActive ? 'bg-white/10 text-white font-bold neon-text' : 'text-gray-300 hover:text-white hover:bg-white/5 font-medium';
            const safeCat = escapeHtml(cat); const catArg = escapeHtml(JSON.stringify(cat));
            return `<button onclick='changeCategory(${catArg})' class="w-full text-left px-4 py-2.5 rounded-xl transition-all text-sm ${btnClass}">${safeCat}</button>`;
        });
        container.innerHTML = htmlParts.join('');
    } catch(err) {
        console.error("Category Render Error:", err);
    }
}

window.changeCategory = function(cat) { 
    currentCategory = cat; 
    if(window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open'); 
    
    const shareHeader = document.getElementById('playlist-share-header');
    if (shareHeader) {
        if (cat.startsWith('Playlist_')) shareHeader.classList.remove('hidden');
        else shareHeader.classList.add('hidden');
    }

    renderCategories(); 
    renderView(); 
}

function renderView() {
    refreshPlayerExtras();
    try {
        const heroContainer = document.getElementById('hero-container'); 
        const listViewContainer = document.getElementById('list-view-container');
        const commentsViewContainer = document.getElementById('comments-view-container'); 
        const adminViewContainer = document.getElementById('admin-view-container');
        
        if(!heroContainer || !listViewContainer || !commentsViewContainer || !adminViewContainer) return;

        heroContainer.classList.add('hidden'); listViewContainer.classList.add('hidden'); commentsViewContainer.classList.add('hidden'); adminViewContainer.classList.add('hidden');
        adminViewContainer.classList.remove('flex');
        document.getElementById('home-extras')?.classList.add('hidden'); document.getElementById('top-view-container')?.classList.add('hidden'); document.getElementById('ranking-view-container')?.classList.add('hidden'); document.getElementById('news-view-container')?.classList.add('hidden');

        if (currentCategory === 'Главное меню') { 
            heroContainer.classList.remove('hidden'); 
            renderHero(); document.getElementById('home-extras')?.classList.remove('hidden'); renderHomeExtras();
        } else if (currentCategory === 'Комментарии') { 
            commentsViewContainer.classList.remove('hidden'); 
            renderCommentsView(); 
        } else if (currentCategory === 'TopTracks') {
            document.getElementById('top-view-container').classList.remove('hidden'); renderTopTracks();
        } else if (currentCategory === 'UserRanking') {
            document.getElementById('ranking-view-container').classList.remove('hidden'); renderUserRanking();
        } else if (currentCategory === 'News') {
            document.getElementById('news-view-container').classList.remove('hidden'); renderNewsView();
        } else if (currentCategory === 'AdminPanel') {
            if (!isAdmin) { changeCategory('Главное меню'); return; }
            adminViewContainer.classList.remove('hidden'); 
            adminViewContainer.classList.add('flex'); 
            renderAdminPanel(); loadBanLog();
        } else {
            listViewContainer.classList.remove('hidden');
            if (currentCategory === 'Liked') document.getElementById('current-category-title').innerText = translations[currentLang].liked;
            else if (currentCategory.startsWith('Playlist_')) {
                const plId = currentCategory.split('_')[1];
                const pl = userPlaylists.find(p => p.id == plId);
                document.getElementById('current-category-title').innerText = pl ? pl.name : 'Плейлист';
            }
            else document.getElementById('current-category-title').innerText = currentCategory === 'Все' ? translations[currentLang].all : currentCategory;
            
            const sortEl = document.getElementById('sort-select');
            if(sortEl) sortEl.value = currentSort; 
            renderTracksList();
        }
    } catch(err) {
        console.error("View Render Error:", err);
    }
}

function renderHero() { 
    const heroContainer = document.getElementById('hero-container'); 
    if (!heroContainer) return;
    if (allTracksData.length === 0 || allTracksData[0].avgScore === 0) { 
        heroContainer.innerHTML = `<div class="text-center text-gray-400 py-20 bg-white/5 rounded-3xl border border-white/10 neon-border"><p class="text-xl">Пока нет оценок.</p></div>`; 
        return; 
    } 
    const topTrack = allTracksData[0]; 
    const isPlayingThis = currentTrackId === topTrack.id && !globalAudio.paused; 
    const iconPath = isPlayingThis ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>` : `<path class="ml-1" d="M8 5v14l11-7z"/>`; 
    const topId = Number(topTrack.id); 
    
    heroContainer.innerHTML = `
        <div class="relative bg-gradient-to-br from-[#001f24] to-[#000000] p-6 md:p-10 rounded-3xl border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col items-center text-center group mt-2 w-full max-w-4xl mx-auto pulse-neon">
            <div class="absolute -top-32 -right-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div class="absolute -bottom-32 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
            <div class="text-cyan-400 text-xs font-bold tracking-widest uppercase mb-6 flex items-center gap-3 z-10 neon-text"><span>🏆</span> ТРЕК №1 <span>🏆</span></div>
            
            <div class="relative z-10 mb-8">
                <img src="${topTrack.cover_url ? escapeHtml(topTrack.cover_url) : 'https://via.placeholder.com/500?text=No+Cover'}" class="w-48 h-48 md:w-64 md:h-64 rounded-2xl object-cover shadow-[0_0_30px_rgba(6,182,212,0.4)] border-2 border-cyan-500/50 group-hover:scale-[1.03] transition-transform duration-500">
                <div class="absolute bottom-2 right-2 flex items-end gap-1 h-6 bg-black/80 px-2 py-1.5 rounded-lg border border-cyan-500/50">
                    <div class="eq-bar eq-anim-1"></div><div class="eq-bar eq-anim-2"></div><div class="eq-bar eq-anim-3"></div><div class="eq-bar eq-anim-4"></div>
                </div>
            </div>
            
            <h2 class="text-4xl md:text-6xl font-extrabold mb-2 tracking-tight z-10 line-clamp-1 text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-cyan-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">${escapeHtml(topTrack.title)}</h2>
            <p class="text-lg text-gray-300 mb-8 z-10 font-medium tracking-wide">${escapeHtml(topTrack.artist || 'TrueEstimation')}</p>
            
            <div class="flex flex-col md:flex-row items-center justify-center gap-8 z-10 w-full">
                <div class="flex items-center gap-6 bg-black/60 px-6 py-3 rounded-2xl border border-white/10 neon-border">
                    <button onclick="playTrack(${topId})" class="w-14 h-14 flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 text-black rounded-full transition-transform active:scale-95 shadow-xl hover:scale-110 neon-btn pulse-neon">
                        <svg class="w-7 h-7 card-play-icon card-icon-${topId}" fill="currentColor" viewBox="0 0 24 24">${iconPath}</svg>
                    </button>
                    <div class="text-left">
                        <div class="text-yellow-400 font-extrabold text-3xl neon-text">${topTrack.avgScore} <span class="text-sm text-gray-400 font-medium">/ 30</span></div>
                        <div class="text-xs text-gray-400 font-medium">${topTrack.votesCount} оценок</div>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="openRatingModal(${topId})" class="bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-3 rounded-2xl font-bold text-base transition-all active:scale-95 neon-btn">Оценить</button>
                    <button onclick="shareTrack(${topId}, event)" class="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl transition-all active:scale-95 neon-btn" title="Поделиться">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `; 
}

function renderTracksList() {
    try {
        const container = document.getElementById('tracks-container'); 
        if(!container) return;
        let filteredTracks = allTracksData;
        if (currentCategory === 'Liked') filteredTracks = allTracksData.filter(t => t.userLiked);
        else if (currentCategory.startsWith('Playlist_')) {
            const plId = currentCategory.split('_')[1];
            const plTrackIds = allPlaylistTracksData.filter(pt => pt.playlist_id == plId).map(pt => pt.track_id);
            filteredTracks = allTracksData.filter(t => plTrackIds.includes(t.id));
        }
        else if (currentCategory !== 'Все') filteredTracks = allTracksData.filter(t => t.category === currentCategory);

        if (searchQuery) { filteredTracks = filteredTracks.filter(t => t.title.toLowerCase().includes(searchQuery) || (t.artist && t.artist.toLowerCase().includes(searchQuery))); }

        filteredTracks.sort((a, b) => { if (currentSort === 'newest') return new Date(b.publish_at || b.created_at) - new Date(a.publish_at || a.created_at); if (currentSort === 'popular') return b.votesCount - a.votesCount; if (currentSort === 'likes') return b.likesCount - a.likesCount; return b.avgScore - a.avgScore; });
        if (filteredTracks.length === 0) { container.innerHTML = `<p class="text-center text-gray-400 py-10">Ничего не найдено</p>`; return; }

        const htmlParts = filteredTracks.map(track => {
            const isPlayingThis = currentTrackId === track.id && !globalAudio.paused; const iconPath = isPlayingThis ? `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>` : `<path class="ml-0.5" d="M8 5v14l11-7z"/>`; const trackIdArg = Number(track.id);
            const heartIcon = track.userLiked ? `<svg class="w-4 h-4 md:w-5 md:h-5 text-cyan-300 fill-current drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>` : `<svg class="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
            const playlistIcon = `<svg class="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`;
            const shareIcon = `<svg class="w-4 h-4 md:w-5 md:h-5 text-gray-400 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>`;

            return `<div class="group flex items-center p-2 rounded-xl hover:bg-white/10 transition-colors cursor-default border border-transparent hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]"><div class="w-8 md:w-10 shrink-0 flex items-center justify-center"><button onclick="playTrack(${trackIdArg})" class="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"><svg class="w-4 h-4 md:w-6 md:h-6 card-play-icon card-icon-${trackIdArg}" fill="currentColor" viewBox="0 0 24 24">${iconPath}</svg></button></div><div class="w-10 md:w-12 shrink-0 pr-2">${track.cover_url ? `<img src="${escapeHtml(track.cover_url)}" class="w-8 h-8 md:w-10 md:h-10 rounded-md object-cover shadow-sm">` : `<div class="w-8 h-8 md:w-10 md:h-10 rounded-md bg-gray-800 flex items-center justify-center"><svg class="w-4 h-4 md:w-5 md:h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>`}</div><div class="flex-1 min-w-0 pr-2 md:pr-4"><h2 class="text-xs md:text-sm font-bold truncate">${escapeHtml(track.title)}</h2><p class="text-[10px] md:text-xs text-gray-400 truncate">${escapeHtml(track.artist || 'TrueEstimation')}</p></div><div class="w-16 md:w-24 text-center shrink-0 tabular-nums leading-tight"><div class="text-yellow-400 font-bold text-xs md:text-sm whitespace-nowrap">${track.avgScore > 0 ? track.avgScore : '-'} <span class="text-[9px] md:text-[10px] text-gray-500 font-medium">/30</span></div><div class="text-[9px] md:text-[10px] text-gray-500 whitespace-nowrap">${track.votesCount} оц.</div></div><div class="w-32 md:w-40 text-center shrink-0 flex justify-center items-center gap-1"><div class="relative"><button onclick="likeTrack(${trackIdArg}, event)" class="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors" title="Лайк">${heartIcon}</button><span class="absolute left-full top-1/2 -translate-y-1/2 pointer-events-none text-[10px] md:text-xs font-bold ${track.userLiked ? 'text-cyan-300' : 'text-gray-400'}">${track.likesCount > 0 ? track.likesCount : ''}</span></div><button onclick="queueTrack(${trackIdArg}, event)" class="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-cyan-300 transition-colors ml-1" title="В очередь"><svg class="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h7m9-6v6m-3-3h6"/></svg></button><button onclick="openAddToPlaylistModal(${trackIdArg})" class="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors ml-1" title="В плейлист">${playlistIcon}</button><button onclick="shareTrack(${trackIdArg}, event)" class="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors ml-1" title="Поделиться">${shareIcon}</button></div><div class="w-20 md:w-24 shrink-0 flex justify-center"><button onclick="openRatingModal(${trackIdArg})" class="bg-white/5 hover:bg-white/20 border border-white/10 px-2 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all active:scale-95 opacity-0 group-hover:opacity-100 neon-btn">Оценить</button></div></div>`;
        });
        container.innerHTML = htmlParts.join('');
    } catch (err) {
        console.error("Tracks Render Error:", err);
    }
}

function renderAdminPanel() {
    const tbody = document.getElementById('admin-users-list'); 
    const reportsTbody = document.getElementById('admin-reports-list');
    if(!tbody || !reportsTbody) return;
    renderAdminTracks(); renderBanLog();
    
    // РЕНДЕР ПОЛЬЗОВАТЕЛЕЙ
    const q = (document.getElementById('admin-users-search')?.value || '').trim().toLowerCase();
    const users = allProfilesData.filter(p => p.email && (!q || (p.username || '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q)))
        .sort((x, y) => (isBannedNow(y) - isBannedNow(x)) || ((y.is_admin ? 1 : 0) - (x.is_admin ? 1 : 0)));
    if (users.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">Не найдено</td></tr>`; }
    else {
        tbody.innerHTML = users.map(u => {
            const isTargetAdmin = u.is_admin, isMasterAdmin = u.email === MASTER_ADMIN_EMAIL, banned = isBannedNow(u);
            let actionBtn = '';
            if (isMasterAdmin) actionBtn = `<span class="text-xs text-gray-500 font-bold">Главный админ</span>`;
            else {
                const adm = isTargetAdmin ? `<button onclick="toggleAdminStatus('${u.id}', true, '${escapeHtml(u.email)}')" class="bg-white/5 text-gray-300 hover:bg-white/15 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Снять админа</button>` : `<button onclick="toggleAdminStatus('${u.id}', false, '${escapeHtml(u.email)}')" class="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Выдать админа</button>`;
                actionBtn = `<div class="flex justify-end gap-2 flex-wrap">${adm}${banControls(u, true)}</div>`;
            }
            const status = banned ? `<span class="ban-badge">БАН</span><div class="text-[10px] text-gray-500 mt-1">${u.banned_until ? 'до ' + fmtDate(u.banned_until) : 'навсегда'}${u.ban_reason ? ' · ' + escapeHtml(u.ban_reason) : ''}</div>` : (isTargetAdmin ? '<span class="admin-badge">ADMIN</span>' : '<span class="text-gray-500 text-sm">Юзер</span>');
            return `<tr class="border-b border-white/5 hover:bg-white/5 transition-colors ${banned ? 'bg-red-500/5' : ''}"><td class="p-4"><button onclick="openUserProfile('${u.id}')" class="flex items-center gap-3 text-left group">${avatarMarkup(u)}<span class="font-bold text-sm group-hover:underline ${isTargetAdmin ? 'text-cyan-200' : 'text-white'} ${banned ? 'line-through opacity-70' : ''}">${escapeHtml(u.username)}</span></button></td><td class="p-4 text-sm text-gray-400">${escapeHtml(u.email)}</td><td class="p-4 text-sm">${status}</td><td class="p-4 text-right">${actionBtn}</td></tr>`;
        }).join('');
    }

    // РЕНДЕР ЖАЛОБ
    const openCount = allReportsData.filter(r => r.status !== 'resolved').length;
    const doneCount = allReportsData.length - openCount;
    const filtersEl = document.getElementById('admin-reports-filters');
    if (filtersEl) {
        const btn = (key, label, n) => `<button onclick="setReportFilter('${key}')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${reportFilter === key ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:text-white'}">${label} <span class="opacity-70">${n}</span></button>`;
        filtersEl.innerHTML = btn('all', 'Все', allReportsData.length) + btn('open', 'Открытые', openCount) + btn('resolved', 'Решённые', doneCount);
    }

    const list = allReportsData.filter(r => reportFilter === 'all' ? true : reportFilter === 'resolved' ? r.status === 'resolved' : r.status !== 'resolved');
    if (list.length === 0) {
        reportsTbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-400">${allReportsData.length === 0 ? 'Жалоб пока нет' : 'В этой вкладке пусто'}</td></tr>`;
        return;
    }
    const checkSvg = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>`;
    reportsTbody.innerHTML = list.map(r => {
        const done = r.status === 'resolved';
        const senderP = allProfilesData.find(p => p.id === r.user_id);
        const targetP = (r.target_user_id && allProfilesData.find(p => p.id === r.target_user_id)) || findProfileByName(r.target_username);
        const typeText = r.type === 'bug' ? 'Баг' : r.type === 'report' ? 'Жалоба' : r.type === 'review' ? 'Отзыв о сайте' : 'Другое';
        const sender = senderP
            ? `<button onclick="openUserProfile('${senderP.id}')" class="text-sm text-white font-bold hover:underline text-left">${escapeHtml(senderP.username)}</button>`
            : `<span class="text-sm text-gray-500">Неизвестный</span>`;
        let target = '<span class="text-gray-500">-</span>';
        if (r.target_username) {
            target = targetP
                ? `<button onclick="openUserProfile('${targetP.id}')" class="text-sm text-red-400 font-bold hover:underline text-left">${escapeHtml(targetP.username)}</button>`
                : `<span class="text-sm text-gray-500 line-through" title="Такого пользователя нет">${escapeHtml(r.target_username)}</span>`;
        }
        const reply = r.admin_reply ? `<div class="mt-2 text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2 py-1">Ответ: ${escapeHtml(r.admin_reply)}</div>` : '';
        return `<tr class="border-b border-white/5 hover:bg-white/5 transition-colors ${done ? 'opacity-50' : ''}">
            <td class="p-4 w-12"><button onclick="toggleReportResolved('${r.id}')" title="${done ? 'Вернуть в работу' : 'Отметить решённой'}" class="w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-colors ${done ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-white/30 text-transparent hover:border-emerald-400 hover:text-emerald-400'}">${checkSvg}</button></td>
            <td class="p-4">${sender}</td>
            <td class="p-4 text-sm text-cyan-400">${typeText}</td>
            <td class="p-4">${target}</td>
            <td class="p-4 text-sm text-gray-300 ${done ? 'line-through decoration-white/20' : ''}">${escapeHtml(r.message)} <span class="text-[10px] text-gray-500 block">${fmtDate(r.created_at)}</span>${reply}</td>
            <td class="p-4 text-right whitespace-nowrap">
                <button onclick="openReportReply('${r.id}')" class="text-cyan-400 hover:text-cyan-300 p-1.5" title="Ответить"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg></button>
                <button onclick="deleteReport('${r.id}')" class="text-red-400 hover:text-red-300 p-1.5" title="Удалить"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
            </td></tr>`;
    }).join('');
}

function renderCommentsView() {
    try {
        const container = document.getElementById('comments-list');
        if(!container) return;
        if (allCommentsData.length === 0) { 
            container.innerHTML = `<div class="relative overflow-hidden bg-gradient-to-br from-cyan-900/20 to-gray-900/60 rounded-3xl border border-cyan-500/20 p-12 text-center shadow-[0_0_30px_rgba(6,182,212,0.1)] w-full max-w-2xl neon-border"><div class="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div><p class="relative z-10 text-lg font-medium text-gray-300">${translations[currentLang].emptyComments}</p></div>`; return; 
        }
        const sortedComments = [...allCommentsData].sort((a, b) => { if (currentCommentsSort === 'newest') return new Date(b.created_at) - new Date(a.created_at); if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount; return new Date(b.created_at) - new Date(a.created_at); });
        const htmlParts = sortedComments.slice(0, commentsLimit).map(comment => {
            const dateStr = new Date(comment.created_at).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });
            const heartIcon = comment.userLiked ? `<svg class="w-5 h-5 text-cyan-300 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>` : `<svg class="w-5 h-5 text-gray-400 group-hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
            const deleteBtn = comment.isOwn ? `<button onclick="promptDeleteComment(${comment.id})" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors ml-2" title="Удалить"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : '';
            const authorAdminBadge = comment.isAdmin ? `<span class="admin-badge ml-2">ADMIN</span>` : '';
            
            const isCommentUrl = comment.avatar_url && comment.avatar_url.startsWith('http');
            const commentAvatarHtml = isCommentUrl ? `<img src="${escapeHtml(comment.avatar_url)}" class="w-full h-full object-cover">` : `<span class="text-sm md:text-lg font-bold text-white" style="color: ${comment.avatar_bg === '#ffffff' ? 'black' : 'white'}">${comment.avatar_url || escapeHtml(comment.username.charAt(0).toUpperCase())}</span>`;
            const commentBgStyle = isCommentUrl ? '' : `background-color: ${comment.avatar_bg || '#1e293b'}`;

            const repliesHtml = comment.replies.map(rep => {
                const repDate = new Date(rep.created_at).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });
                const repDeleteBtn = rep.isOwn ? `<button onclick="deleteReply(${rep.id})" class="text-gray-500 hover:text-red-400 ml-2 transition-colors" title="Удалить"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : '';
                const repHeart = rep.userLiked ? `<svg class="w-4 h-4 text-cyan-300 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>` : `<svg class="w-4 h-4 text-gray-500 hover:text-cyan-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
                const repAdminBadge = rep.isAdmin ? `<span class="admin-badge ml-2">ADMIN</span>` : '';
                
                const isRepUrl = rep.avatar_url && rep.avatar_url.startsWith('http');
                const repAvatarHtml = isRepUrl ? `<img src="${escapeHtml(rep.avatar_url)}" class="w-full h-full object-cover">` : `<span class="text-xs font-bold text-white" style="color: ${rep.avatar_bg === '#ffffff' ? 'black' : 'white'}">${rep.avatar_url || escapeHtml(rep.username.charAt(0).toUpperCase())}</span>`;
                const repBgStyle = isRepUrl ? '' : `background-color: ${rep.avatar_bg || '#1e293b'}`;

                return `<div class="bg-black/20 rounded-xl p-3 mt-2 border border-white/5 flex gap-3"><div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden" style="${repBgStyle}">${repAvatarHtml}</div><div class="flex-1"><div class="flex justify-between items-baseline mb-1"><div class="flex items-center"><span onclick="openUserProfile('${rep.user_id}')" class="text-xs font-bold cursor-pointer hover:underline ${rep.isAdmin ? 'text-cyan-200' : 'text-cyan-400'}">${escapeHtml(rep.username)}</span>${repAdminBadge}</div><div class="flex items-center"><span class="text-[10px] text-gray-500 mr-2">${repDate}</span>${repDeleteBtn}</div></div><p class="text-sm text-gray-300 mb-1">${escapeHtml(rep.content)}</p><div class="flex items-center gap-3 mt-1"><button onclick="likeReply(${rep.id}, event)" class="flex items-center gap-1 hover:opacity-80">${repHeart}<span class="text-[11px] font-bold ${rep.userLiked ? 'text-cyan-300' : 'text-gray-400'}">${rep.likesCount > 0 ? rep.likesCount : ''}</span></button><button onclick="replyToUser(${comment.id}, '${escapeHtml(rep.username)}')" class="text-[11px] text-gray-500 hover:text-white transition-colors">Ответить</button></div></div></div>`;
            }).join('');
            return `<div class="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 transition-all hover:bg-white/10 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]"><div onclick="openUserProfile('${comment.user_id}')" class="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10 cursor-pointer hover:border-cyan-400 transition-colors" style="${commentBgStyle}">${commentAvatarHtml}</div><div class="flex-1 min-w-0"><div class="flex justify-between items-start mb-1"><div><div class="flex items-center mb-1"><span onclick="openUserProfile('${comment.user_id}')" class="text-sm font-bold cursor-pointer hover:underline ${comment.isAdmin ? 'text-cyan-200' : 'text-white'}">${escapeHtml(comment.username)}</span>${levelChip(comment.user_id)}${authorAdminBadge}${banBadgeById(comment.user_id)}<span class="text-[10px] text-gray-500 ml-2">${dateStr}</span></div><h4 class="text-xs text-gray-400 truncate cursor-pointer hover:underline hover:text-cyan-400" onclick="playTrack(${comment.track_id})">Трек: ${escapeHtml(comment.trackTitle)}</h4></div><div class="flex items-center">${deleteBtn}</div></div><p class="text-sm text-gray-200 leading-relaxed my-3">"${escapeHtml(comment.comment)}"</p><div class="flex items-center gap-3"><button onclick="likeComment(${comment.id}, event)" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all active:scale-95 group">${heartIcon}<span class="text-sm font-bold ${comment.userLiked ? 'text-cyan-300' : 'text-gray-400 group-hover:text-white'}">${comment.likesCount > 0 ? comment.likesCount : '0'}</span></button><div class="text-xs text-gray-400 bg-black/30 px-3 py-1.5 rounded-lg">Оценка: <span class="text-yellow-400 font-bold">${comment.score} / 30</span></div><button onclick="toggleReplyBox(${comment.id})" class="text-xs text-gray-400 hover:text-white transition-colors ml-2 font-medium">Ответить</button>${modButtons(comment)}</div><div class="mt-2">${repliesHtml}</div><div id="reply-box-${comment.id}" class="hidden mt-3 flex gap-2"><input type="text" id="reply-input-${comment.id}" placeholder="Написать ответ..." class="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500"><button onclick="submitReply(${comment.id})" class="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-1.5 rounded-lg text-sm font-bold transition-colors neon-btn">Отправить</button></div></div></div>`;
        });
        container.innerHTML = htmlParts.join('') + (sortedComments.length > commentsLimit ? `<button onclick="showMoreComments()" class="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-cyan-300 transition-colors">Показать ещё (${sortedComments.length - commentsLimit})</button>` : '');
    } catch (err) {
        console.error("Comments Render Error:", err);
    }
}

// Инициализация громкости
updateVolumeUI();

// ==========================================
// УВЕДОМЛЕНИЯ
// ==========================================
const NOTIF_ICONS = { follow: '👤', banned: '⛔', unbanned: '🔓', reply: '💬', like: '❤️', support_reply: '🛟', support_resolved: '✅', admin_granted: '🛡️', admin_revoked: '⚠️' };

function timeAgo(d) {
    const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
    if (s < 60) return 'только что';
    const m = Math.floor(s / 60); if (m < 60) return `${m} мин назад`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} ч назад`;
    const dd = Math.floor(h / 24); if (dd < 7) return `${dd} дн назад`;
    return fmtDate(d);
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    if (!list || !badge) return;
    const unread = notifications.filter(n => !n.is_read).length;
    badge.innerText = unread > 9 ? '9+' : unread;
    badge.classList.toggle('hidden', unread === 0);
    if (!notifications.length) { list.innerHTML = `<div class="p-8 text-center text-sm text-gray-500">Пока тихо 🎧</div>`; return; }
    list.innerHTML = notifications.map(n => `
        <div onclick="openNotification('${n.id}')" class="flex gap-3 px-4 py-3 cursor-pointer border-b border-white/5 hover:bg-white/5 transition-colors ${n.is_read ? 'opacity-60' : 'bg-cyan-500/5'}">
            <div class="text-xl leading-none mt-0.5">${NOTIF_ICONS[n.type] || '🔔'}</div>
            <div class="min-w-0 flex-1">
                <div class="text-sm text-gray-200 break-words">${escapeHtml(n.message)}</div>
                <div class="text-[10px] text-gray-500 mt-0.5">${timeAgo(n.created_at)}</div>
            </div>
            ${n.is_read ? '' : '<div class="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.9)]"></div>'}
        </div>`).join('');
}

async function loadNotifications() {
    if (!currentUserId) { notifications = []; renderNotifications(); return; }
    try {
        const { data, error } = await supabase.from('notifications').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(30);
        if (!error) { notifications = data || []; renderNotifications(); }
    } catch (e) { console.error(e); }
}

function subscribeNotifications() {
    if (notifChannel) { supabase.removeChannel(notifChannel); notifChannel = null; }
    if (!currentUserId) return;
    notifChannel = supabase.channel('notif-' + currentUserId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, payload => {
            const n = payload.new;
            if (notifications.some(x => x.id === n.id)) return;
            notifications.unshift(n);
            renderNotifications();
            showToast(`${NOTIF_ICONS[n.type] || '🔔'} ${n.message}`, 'success');
            if (n.type.startsWith('support')) refreshReports();
            if (n.type.startsWith('admin') || n.type === 'banned' || n.type === 'unbanned') updateProfileUI().then(() => loadData());
        })
        .subscribe();
}

function onNotifLogin() {
    onMsgLogin();
    document.getElementById('notif-wrap')?.classList.remove('hidden');
    if (notifUserId !== currentUserId) { notifUserId = currentUserId; subscribeNotifications(); }
    loadNotifications();
    if (!notifTimer) notifTimer = setInterval(loadNotifications, 60000); // запасной вариант, если realtime не включён
}
function onNotifLogout() {
    onMsgLogout();
    document.getElementById('notif-wrap')?.classList.add('hidden');
    document.getElementById('notif-panel')?.classList.add('hidden');
    if (notifChannel) { supabase.removeChannel(notifChannel); notifChannel = null; }
    if (notifTimer) { clearInterval(notifTimer); notifTimer = null; }
    notifUserId = null; notifications = []; renderNotifications();
}

window.toggleNotifPanel = function(e) {
    if (e) e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) loadNotifications();
}
window.closeNotifPanel = function() { document.getElementById('notif-panel')?.classList.add('hidden'); }

window.openNotification = async function(id) {
    const n = notifications.find(x => String(x.id) === String(id));
    if (!n) return;
    if (!n.is_read) {
        n.is_read = true; renderNotifications();
        await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    }
    closeNotifPanel();
    if (n.type === 'reply' || n.type === 'like') changeCategory('Комментарии');
    else if (n.type.startsWith('support')) { await refreshReports(); openSupportModal(); switchSupportTab('my'); }
    else if (n.type.startsWith('admin') && isAdmin) changeCategory('AdminPanel');
    else if (n.type === 'follow' && n.actor_id) openUserProfile(n.actor_id);
}

window.markAllNotificationsRead = async function() {
    if (!notifications.some(n => !n.is_read)) return;
    notifications.forEach(n => n.is_read = true); renderNotifications();
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUserId).eq('is_read', false);
}
window.clearNotifications = async function() {
    if (!notifications.length) return;
    notifications = []; renderNotifications();
    await supabase.from('notifications').delete().eq('user_id', currentUserId);
}
document.addEventListener('click', e => { if (!e.target.closest('#notif-wrap')) closeNotifPanel(); });

// ==========================================
// УРОВНИ И АЧИВКИ (считаются на лету из данных, SQL не нужен)
// ==========================================
const LEVEL_NAMES = ['Новичок', 'Слушатель', 'Ценитель', 'Меломан', 'Критик', 'Эксперт', 'Мастер', 'Гуру', 'Легенда', 'Икона'];

const ACHIEVEMENTS = [
    { id: 'rate_1',   icon: '⭐', title: 'Первая оценка',  desc: 'Оцени первый трек',               check: s => s.ratings >= 1 },
    { id: 'rate_10',  icon: '🎧', title: 'Меломан',        desc: 'Поставь 10 оценок',               check: s => s.ratings >= 10 },
    { id: 'rate_50',  icon: '🏆', title: 'Критик',         desc: 'Поставь 50 оценок',               check: s => s.ratings >= 50 },
    { id: 'rate_100', icon: '👑', title: 'Легенда',        desc: 'Поставь 100 оценок',              check: s => s.ratings >= 100 },
    { id: 'com_1',    icon: '💬', title: 'Голос',          desc: 'Напиши первый отзыв',             check: s => s.comments >= 1 },
    { id: 'com_10',   icon: '📝', title: 'Рецензент',      desc: 'Напиши 10 отзывов',               check: s => s.comments >= 10 },
    { id: 'likes_10', icon: '❤️', title: 'Любимец',        desc: 'Набери 10 лайков на отзывах',     check: s => s.likesReceived >= 10 },
    { id: 'likes_50', icon: '🔥', title: 'Звезда',         desc: 'Набери 50 лайков на отзывах',     check: s => s.likesReceived >= 50 },
    { id: 'rep_10',   icon: '🤝', title: 'Собеседник',     desc: 'Оставь 10 ответов',               check: s => s.replies >= 10 },
    { id: 'tl_10',    icon: '💿', title: 'Коллекционер',   desc: 'Лайкни 10 треков',                check: s => s.trackLikes >= 10 },
    { id: 'strict',   icon: '⚖️', title: 'Строгий судья',  desc: 'Средний балл ≤ 12 при 5+ оценках', check: s => s.ratings >= 5 && s.avg <= 12 },
    { id: 'kind',     icon: '🌈', title: 'Добряк',         desc: 'Средний балл ≥ 24 при 5+ оценках', check: s => s.ratings >= 5 && s.avg >= 24 },
    { id: 'admin',    icon: '🛡️', title: 'Страж',          desc: 'Быть администратором',            check: (s, p) => !!(p && (p.is_admin || p.email === MASTER_ADMIN_EMAIL)) }
];

function finalizeStats(s) {
    s.avg = s.ratings ? s.scoreSum / s.ratings : 0;
    s.xp = s.ratings * 10 + s.comments * 15 + s.likesReceived * 5 + s.replies * 5 + s.trackLikes * 2;
    const level = Math.floor(Math.sqrt(s.xp / 25)) + 1;
    const base = 25 * (level - 1) ** 2, next = 25 * level ** 2;
    s.level = level; s.levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
    s.levelBase = base; s.levelNext = next; s.levelPct = Math.round(((s.xp - base) / (next - base)) * 100);
    return s;
}

function buildStatsIndex() {
    statsIndex = new Map();
    const get = id => { let s = statsIndex.get(id); if (!s) { s = { ratings: 0, scoreSum: 0, comments: 0, likesReceived: 0, replies: 0, trackLikes: 0 }; statsIndex.set(id, s); } return s; };
    const owner = new Map();
    allRatingsData.forEach(r => { const s = get(r.user_id); s.ratings++; s.scoreSum += r.score || 0; if (r.comment && r.comment.trim()) { s.comments++; owner.set(r.id, r.user_id); } });
    allCommentLikesData.forEach(l => { const o = owner.get(l.rating_id); if (o && o !== l.user_id) get(o).likesReceived++; });
    allRepliesData.forEach(r => get(r.user_id).replies++);
    allTrackLikesData.forEach(l => get(l.user_id).trackLikes++);
    statsIndex.forEach(finalizeStats);
}

function getStats(userId) {
    return (statsIndex && statsIndex.get(userId)) || finalizeStats({ ratings: 0, scoreSum: 0, comments: 0, likesReceived: 0, replies: 0, trackLikes: 0 });
}
function getAchievements(userId) {
    const s = getStats(userId), p = allProfilesData.find(x => x.id === userId);
    return ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(s, p) }));
}

function levelChip(userId) {
    const s = getStats(userId);
    return `<span class="text-[10px] font-bold ml-2 px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" title="${escapeHtml(s.levelName)} · ${s.xp} XP">Ур. ${s.level}</span>`;
}

function levelBlockHtml(p) {
    const s = getStats(p.id);
    return `<div class="mt-5 p-4 rounded-xl bg-black/30 border border-cyan-500/20">
        <div class="flex items-baseline justify-between mb-2">
            <div><span class="text-2xl font-extrabold text-cyan-400 neon-text">Ур. ${s.level}</span> <span class="text-sm font-bold text-gray-300 ml-1">${escapeHtml(s.levelName)}</span></div>
            <div class="text-xs text-gray-400">${s.xp} / ${s.levelNext} XP</div>
        </div>
        <div class="h-2 rounded-full bg-white/10 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" style="width:${Math.min(100, Math.max(2, s.levelPct))}%"></div></div>
        <div class="text-[10px] text-gray-500 mt-1.5">Оценка +10 XP · отзыв +15 · лайк на отзыве +5 · ответ +5 · лайк трека +2</div>
    </div>`;
}

function achievementsHtml(p) {
    const list = getAchievements(p.id);
    const got = list.filter(a => a.earned).length;
    return `<div class="flex items-center justify-between mt-6 mb-2"><h4 class="text-sm font-bold text-gray-300">Достижения</h4><span class="text-xs text-gray-500">${got} / ${list.length}</span></div>
    <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">${list.map(a => `
        <div title="${escapeHtml(a.desc)}" class="rounded-xl p-2 text-center border transition-colors ${a.earned ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]' : 'bg-black/20 border-white/5 opacity-40 grayscale'}">
            <div class="text-2xl leading-none">${a.icon}</div>
            <div class="text-[11px] font-bold mt-1 ${a.earned ? 'text-white' : 'text-gray-400'}">${a.title}</div>
            <div class="text-[9px] text-gray-500 leading-tight mt-0.5">${a.desc}</div>
        </div>`).join('')}</div>`;
}

function renderHeaderLevel() {
    const el = document.getElementById('user-level-display');
    if (!el || !currentUserId) return;
    const s = getStats(currentUserId);
    el.innerText = `Ур. ${s.level} · ${s.levelName} · ${s.xp} XP`;
}

// Тост при получении новой ачивки (первый запуск молча запоминает уже полученные)
function checkAchievementUnlocks() {
    if (!currentUserId) return;
    const key = 'te_ach_' + currentUserId;
    const earned = getAchievements(currentUserId).filter(a => a.earned);
    let known = null;
    try { known = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    if (Array.isArray(known)) {
        earned.filter(a => !known.includes(a.id)).forEach((a, i) => setTimeout(() => showToast(`${a.icon} Достижение: ${a.title}!`, 'success'), 600 + i * 1200));
    }
    try { localStorage.setItem(key, JSON.stringify(earned.map(a => a.id))); } catch (e) {}
}

// ==========================================
// ЛИЧНЫЕ СООБЩЕНИЯ
// ==========================================
function msgOtherId(m) { return m.sender_id === currentUserId ? m.recipient_id : m.sender_id; }
function msgProfile(id) { return allProfilesData.find(p => p.id === id) || { id, username: 'Удалённый пользователь', avatar_url: null, avatar_bg: '#1e293b' }; }
function msgTime(d) {
    const dt = new Date(d), now = new Date();
    const hm = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return dt.toDateString() === now.toDateString() ? hm : dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + hm;
}
function msgDayLabel(d) {
    const dt = new Date(d), now = new Date(), y = new Date(); y.setDate(now.getDate() - 1);
    if (dt.toDateString() === now.toDateString()) return 'Сегодня';
    if (dt.toDateString() === y.toDateString()) return 'Вчера';
    return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function unreadMessagesCount() { return messagesData.filter(m => m.recipient_id === currentUserId && !m.read_at).length; }

function updateMsgBadge() {
    const b = document.getElementById('msg-badge'); if (!b) return;
    const n = unreadMessagesCount();
    b.innerText = n > 9 ? '9+' : n;
    b.classList.toggle('hidden', n === 0);
}

async function loadMessages() {
    if (!currentUserId) { messagesData = []; updateMsgBadge(); return; }
    try {
        const { data, error } = await supabase.from('messages').select('*')
            .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
            .order('created_at', { ascending: false }).limit(500);
        if (!error) { messagesData = (data || []).reverse(); }
    } catch (e) { console.error(e); }
    updateMsgBadge();
    if (!document.getElementById('messages-modal').classList.contains('hidden')) { renderMsgList(); renderChat(false); }
}

function subscribeMessages() {
    if (msgChannel) { supabase.removeChannel(msgChannel); msgChannel = null; }
    if (!currentUserId) return;
    msgChannel = supabase.channel('msg-' + currentUserId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${currentUserId}` }, async payload => {
            const m = payload.new;
            if (messagesData.some(x => x.id === m.id)) return;
            messagesData.push(m);
            const open = !document.getElementById('messages-modal').classList.contains('hidden');
            if (open && activeChatId === m.sender_id) {
                renderChat(true);
                await markChatRead(m.sender_id);
            } else {
                const p = msgProfile(m.sender_id);
                showToast(`💬 ${p.username}: ${m.content.length > 60 ? m.content.slice(0, 60) + '…' : m.content}`, 'success');
            }
            updateMsgBadge();
            if (open) renderMsgList();
        })
        .subscribe();
}

function onMsgLogin() {
    document.getElementById('msg-btn')?.classList.remove('hidden');
    if (msgUserId !== currentUserId) { msgUserId = currentUserId; subscribeMessages(); }
    loadMessages();
    if (!msgTimer) msgTimer = setInterval(loadMessages, 45000); // запасной вариант без realtime
}
function onMsgLogout() {
    document.getElementById('msg-btn')?.classList.add('hidden');
    document.getElementById('messages-modal')?.classList.add('hidden');
    if (msgChannel) { supabase.removeChannel(msgChannel); msgChannel = null; }
    if (msgTimer) { clearInterval(msgTimer); msgTimer = null; }
    msgUserId = null; messagesData = []; activeChatId = null; updateMsgBadge();
}

function buildConversations() {
    const map = new Map();
    messagesData.forEach(m => {
        const oid = msgOtherId(m);
        let c = map.get(oid); if (!c) { c = { id: oid, last: m, unread: 0 }; map.set(oid, c); }
        c.last = m;
        if (m.recipient_id === currentUserId && !m.read_at) c.unread++;
    });
    return [...map.values()].sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));
}

window.openMessages = function(userId) {
    if (!currentUserId) return showToast('Войдите, чтобы писать сообщения', 'error');
    const dl = document.getElementById('msg-users-list');
    if (dl) dl.innerHTML = allProfilesData.filter(p => p.id !== currentUserId && p.username).map(p => `<option value="${escapeHtml(p.username)}"></option>`).join('');
    document.getElementById('messages-modal').classList.remove('hidden');
    if (userId && userId !== currentUserId) openChat(userId); else { activeChatId = null; document.getElementById('messages-modal').classList.remove('chat-open'); renderMsgList(); renderChat(false); }
}
window.closeMessages = function() { document.getElementById('messages-modal').classList.add('hidden'); }

window.openChat = async function(userId) {
    activeChatId = userId;
    document.getElementById('messages-modal').classList.add('chat-open');
    renderMsgList(); renderChat(false);
    document.getElementById('msg-input')?.focus();
    await markChatRead(userId);
}
window.backToConversations = function() {
    activeChatId = null;
    document.getElementById('messages-modal').classList.remove('chat-open');
    renderMsgList(); renderChat(false);
}
window.startChatFromInput = function() {
    const input = document.getElementById('msg-search');
    const v = input.value.trim(); if (!v) return;
    const p = findProfileByName(v);
    if (!p) return showToast(`Пользователь «${v}» не найден`, 'error');
    if (p.id === currentUserId) return showToast('Нельзя написать самому себе', 'error');
    input.value = '';
    openChat(p.id);
}

async function markChatRead(otherId) {
    const unread = messagesData.filter(m => m.sender_id === otherId && m.recipient_id === currentUserId && !m.read_at);
    if (!unread.length) return;
    const now = new Date().toISOString();
    unread.forEach(m => m.read_at = now);
    updateMsgBadge(); renderMsgList();
    try { await supabase.rpc('mark_messages_read', { other: otherId }); } catch (e) { console.error(e); }
}

function renderMsgList() {
    const list = document.getElementById('msg-conv-list'); if (!list) return;
    const convs = buildConversations();
    if (!convs.length) { list.innerHTML = `<div class="p-8 text-center text-sm text-gray-500">Пока нет диалогов.<br>Найди пользователя выше или открой его профиль и нажми «Написать».</div>`; return; }
    list.innerHTML = convs.map(c => {
        const p = msgProfile(c.id), mine = c.last.sender_id === currentUserId;
        const prev = (mine ? 'Вы: ' : '') + c.last.content;
        return `<div onclick="openChat('${c.id}')" class="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-white/5 transition-colors ${activeChatId === c.id ? 'bg-cyan-500/10' : 'hover:bg-white/5'}">
            ${avatarMarkup(p, 'w-11 h-11', 'text-base')}
            <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2"><span class="text-sm font-bold truncate ${p.is_admin ? 'text-red-400' : 'text-white'}">${escapeHtml(p.username)}</span><span class="text-[10px] text-gray-500 flex-shrink-0">${msgTime(c.last.created_at)}</span></div>
                <div class="flex items-center justify-between gap-2"><span class="text-xs truncate ${c.unread ? 'text-gray-200' : 'text-gray-500'}">${escapeHtml(prev)}</span>${c.unread ? `<span class="min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-black text-[10px] font-bold flex items-center justify-center flex-shrink-0">${c.unread}</span>` : ''}</div>
            </div></div>`;
    }).join('');
}

function renderChat(keepScrollIfUp) {
    const header = document.getElementById('msg-chat-header'), body = document.getElementById('msg-chat-body'), foot = document.getElementById('msg-chat-input');
    if (!body) return;
    if (!activeChatId) {
        header.innerHTML = ''; foot.classList.add('hidden');
        body.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center text-gray-500"><div class="text-5xl mb-3">💬</div><div class="text-sm">Выбери диалог слева<br>или найди пользователя по нику</div></div>`;
        return;
    }
    foot.classList.remove('hidden');
    const p = msgProfile(activeChatId);
    header.innerHTML = `
        <button onclick="backToConversations()" class="md:hidden text-gray-400 hover:text-white mr-1"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>
        <button onclick="closeMessages(); openUserProfile('${p.id}')" class="flex items-center gap-3 min-w-0 text-left group">
            ${avatarMarkup(p, 'w-10 h-10', 'text-base')}
            <div class="min-w-0"><div class="text-sm font-bold truncate group-hover:underline ${p.is_admin ? 'text-red-400' : 'text-white'}">${escapeHtml(p.username)}${p.is_admin ? ' <span class="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold ml-1">ADMIN</span>' : ''}</div>
            <div class="text-[10px] text-cyan-300">${p.id ? 'Ур. ' + getStats(p.id).level + ' · ' + escapeHtml(getStats(p.id).levelName) : ''}</div></div>
        </button>
        <button onclick="closeMessages(); openSupportModal({type:'report', target:'${escapeHtml(p.username).replace(/'/g, '')}'})" class="ml-auto mr-10 text-xs font-bold text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">Пожаловаться</button>`;

    const msgs = messagesData.filter(m => msgOtherId(m) === activeChatId);
    const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 120;
    let lastDay = '', html = '';
    if (!msgs.length) html = `<div class="h-full flex items-center justify-center text-sm text-gray-500">Напиши первое сообщение 👋</div>`;
    msgs.forEach(m => {
        const day = new Date(m.created_at).toDateString();
        if (day !== lastDay) { lastDay = day; html += `<div class="text-center text-[10px] text-gray-500 py-2">${msgDayLabel(m.created_at)}</div>`; }
        const mine = m.sender_id === currentUserId;
        html += `<div class="flex ${mine ? 'justify-end' : 'justify-start'} group">
            <div class="max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${mine ? 'bg-cyan-500 text-black rounded-br-md' : 'bg-white/10 text-gray-100 rounded-bl-md'}">${escapeHtml(m.content)}
                <div class="flex items-center justify-end gap-1.5 mt-0.5 text-[10px] ${mine ? 'text-black/60' : 'text-gray-400'}">
                    ${mine ? `<button onclick="deleteMessage('${m.id}')" class="opacity-0 group-hover:opacity-100 hover:text-red-700 transition-opacity" title="Удалить">✕</button>` : ''}
                    <span>${msgTime(m.created_at)}</span>${mine ? `<span>${m.read_at ? '✓✓' : '✓'}</span>` : ''}
                </div></div></div>`;
    });
    body.innerHTML = html;
    if (!keepScrollIfUp || nearBottom) body.scrollTop = body.scrollHeight;
}

window.sendMessage = async function() {
    if (!currentUserId || !activeChatId) return; if (guardBan()) return;
    const input = document.getElementById('msg-input'), btn = document.getElementById('msg-send-btn');
    const content = input.value.trim();
    if (!content) return;
    if (content.length > 1000) return showToast('Сообщение слишком длинное (макс. 1000)', 'error');
    btn.disabled = true; btn.classList.add('opacity-50');
    try {
        const { data, error } = await supabase.from('messages').insert({ sender_id: currentUserId, recipient_id: activeChatId, content }).select().single();
        if (error) throw error;
        if (!messagesData.some(x => x.id === data.id)) messagesData.push(data);
        input.value = ''; input.style.height = 'auto';
        renderChat(false); renderMsgList();
    } catch (e) {
        showToast('Не отправлено: ' + (e.message || 'ошибка'), 'error');
    } finally { btn.disabled = false; btn.classList.remove('opacity-50'); input.focus(); }
}

window.deleteMessage = function(id) {
    showConfirm('Удалить сообщение? Оно исчезнет у обоих.', async () => {
        const { data, error } = await supabase.from('messages').delete().eq('id', id).select();
        if (error) return showToast('Ошибка: ' + error.message, 'error');
        if (!data || !data.length) return showToast('Не удалено: нет прав. Выполни messages_setup.sql', 'error');
        messagesData = messagesData.filter(m => String(m.id) !== String(id));
        renderChat(true); renderMsgList(); updateMsgBadge();
    }, 'delete');
}

document.addEventListener('keydown', e => {
    if (e.target && e.target.id === 'msg-input' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.target && e.target.id === 'msg-search' && e.key === 'Enter') { e.preventDefault(); startChatFromInput(); }
});
document.addEventListener('input', e => {
    if (e.target && e.target.id === 'msg-input') { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'msg-search') startChatFromInput(); });

// ==========================================
// БАНЫ ПОЛЬЗОВАТЕЛЕЙ
// ==========================================
function isBannedNow(p) {
    return !!(p && p.is_banned && (!p.banned_until || new Date(p.banned_until) > new Date()));
}
function isBannedSelf() { return isBannedNow(currentUserProfile); }
function banUntilText(p) { return p.banned_until ? 'до ' + fmtDate(p.banned_until) : 'навсегда'; }
function guardBan() {
    if (!isBannedSelf()) return false;
    showToast('Аккаунт заблокирован ' + banUntilText(currentUserProfile) + '. Действие недоступно', 'error');
    return true;
}
function banBadge(p) { return isBannedNow(p) ? '<span class="ban-badge ml-2">БАН</span>' : ''; }
function banBadgeById(id) { return banBadge(allProfilesData.find(p => p.id === id)); }

function renderBanBanner() {
    const el = document.getElementById('ban-banner');
    if (!el) return;
    if (!isBannedSelf()) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const p = currentUserProfile;
    el.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3"><div><b>⛔ Ваш аккаунт заблокирован ${banUntilText(p)}.</b>${p.ban_reason ? ' Причина: ' + escapeHtml(p.ban_reason) + '.' : ''}<span class="text-red-200/70"> Оценки, комментарии, лайки и сообщения недоступны.</span></div><button onclick="openSupportModal()" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold">Написать в поддержку</button></div>`;
    el.classList.remove('hidden');
}

function canBan(p) {
    if (!isAdmin || !p || p.id === currentUserId || p.email === MASTER_ADMIN_EMAIL) return false;
    if (p.is_admin && currentUserProfile?.email !== MASTER_ADMIN_EMAIL) return false;
    return true;
}
function banControls(p, compact) {
    if (!canBan(p)) return '';
    const m = compact ? '' : 'ml-2 mt-3';
    return isBannedNow(p)
        ? `<button onclick="unbanUser('${p.id}')" class="${m} bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Разбанить</button>`
        : `<button onclick="openBanModal('${p.id}')" class="${m} bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Забанить</button>`;
}

let banTargetId = null;
window.openBanModal = function(userId) {
    const p = allProfilesData.find(x => x.id === userId);
    if (!p || !canBan(p)) return showToast('Этого пользователя забанить нельзя', 'error');
    closeUserProfile();
    banTargetId = userId;
    document.getElementById('ban-target-name').innerText = p.username + (p.email ? ' · ' + p.email : '');
    document.getElementById('ban-reason').value = '';
    document.getElementById('ban-duration').value = '0';
    document.getElementById('ban-modal').classList.remove('hidden');
}
window.closeBanModal = function() { document.getElementById('ban-modal').classList.add('hidden'); banTargetId = null; }
window.confirmBan = async function() {
    const p = allProfilesData.find(x => x.id === banTargetId);
    if (!p || !canBan(p)) return;
    const days = parseInt(document.getElementById('ban-duration').value, 10);
    const reason = document.getElementById('ban-reason').value.trim().slice(0, 300) || null;
    const until = days > 0 ? new Date(Date.now() + days * 864e5).toISOString() : null;
    const { error } = await supabase.from('profiles').update({ is_banned: true, ban_reason: reason, banned_until: until }).eq('id', p.id);
    if (error) return showToast('Ошибка: ' + error.message, 'error');
    showToast(`${p.username} заблокирован`, 'success');
    closeBanModal(); await loadData();
}
window.unbanUser = function(userId) {
    const p = allProfilesData.find(x => x.id === userId);
    if (!p || !canBan(p)) return;
    closeUserProfile();
    showConfirm(`Снять блокировку с «${p.username}»?`, async () => {
        const { error } = await supabase.from('profiles').update({ is_banned: false }).eq('id', userId);
        if (error) showToast('Ошибка: ' + error.message, 'error'); else { showToast('Блокировка снята', 'success'); await loadData(); }
    }, 'admin');
}

// ==========================================
// ТОП ТРЕКОВ
// ==========================================
let topMetric = 'rating', topPeriod = 'all', rankMetric = 'xp';
const TOP_PERIODS = { all: ['За всё время', null], month: ['30 дней', 30], week: ['7 дней', 7] };
const TOP_METRICS = { rating: 'По рейтингу', votes: 'По числу оценок', likes: 'По лайкам' };
window.setTopMetric = m => { topMetric = m; renderTopTracks(); };
window.setTopPeriod = p => { topPeriod = p; renderTopTracks(); };

function segBtns(map, current, fn, disabled) {
    return Object.entries(map).map(([k, v]) => `<button onclick="${fn}('${k}')" class="seg-btn ${k === current ? 'active' : ''} ${disabled ? 'disabled' : ''}">${Array.isArray(v) ? v[0] : v}</button>`).join('');
}

function computeTopTracks() {
    const days = TOP_PERIODS[topPeriod][1], since = days ? Date.now() - days * 864e5 : 0;
    const by = new Map();
    allRatingsData.forEach(r => {
        if (since && new Date(r.created_at || 0).getTime() < since) return;
        const a = by.get(r.track_id) || { sum: 0, n: 0 }; a.sum += r.score || 0; a.n++; by.set(r.track_id, a);
    });
    const arr = [...by.values()], N = arr.reduce((x, a) => x + a.n, 0), C = N ? arr.reduce((x, a) => x + a.sum, 0) / N : 0, M = 3;
    const rows = allTracksData.map(t => {
        const a = by.get(t.id) || { sum: 0, n: 0 }, avg = a.n ? a.sum / a.n : 0;
        return { t, avg, n: a.n, likes: t.likesCount, w: a.n ? (a.n / (a.n + M)) * avg + (M / (a.n + M)) * C : 0 };
    });
    const key = { rating: r => r.w, votes: r => r.n, likes: r => r.likes }[topMetric];
    const valid = topMetric === 'likes' ? r => r.likes > 0 : r => r.n > 0;
    return rows.filter(valid).sort((a, b) => key(b) - key(a) || b.avg - a.avg || b.n - a.n);
}

function topValueHtml(r) {
    if (topMetric === 'likes') return `<div class="text-cyan-200 font-extrabold text-lg neon-text">♥ ${r.likes}</div><div class="text-[10px] text-gray-400">${r.n || r.t.votesCount} оц.</div>`;
    if (topMetric === 'votes') return `<div class="text-cyan-200 font-extrabold text-lg neon-text">${r.n}</div><div class="text-[10px] text-gray-400">оценок · ср. ${r.avg.toFixed(1)}</div>`;
    return `<div class="text-yellow-400 font-extrabold text-lg">${r.avg.toFixed(1)}<span class="text-[10px] text-gray-400 font-medium"> /30</span></div><div class="text-[10px] text-gray-400">${r.n} оц.</div>`;
}

function coverImg(t, cls) {
    return t.cover_url ? `<img src="${escapeHtml(t.cover_url)}" class="${cls} object-cover bg-white/5" onerror="this.style.visibility='hidden'">` : `<div class="${cls} bg-gray-800 flex items-center justify-center text-gray-500">♪</div>`;
}

function renderTopTracks() {
    const c = document.getElementById('top-view-container');
    if (!c) return;
    const list = computeTopTracks().slice(0, 30);
    const head = `<div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h2 class="text-2xl md:text-3xl font-extrabold tracking-tight neon-text">Топ треков</h2>
        <p class="text-xs text-gray-400 mt-1">${topMetric === 'rating' ? 'Рейтинг учитывает число оценок: один «30/30» не обгонит трек с десятком высоких оценок.' : topMetric === 'likes' ? 'Лайки считаются за всё время.' : 'Самые обсуждаемые треки.'}</p></div>
        <div class="flex flex-col items-end gap-2"><div class="flex gap-1.5 flex-wrap justify-end">${segBtns(TOP_METRICS, topMetric, 'setTopMetric')}</div>
        <div class="flex gap-1.5">${segBtns(TOP_PERIODS, topPeriod, 'setTopPeriod', topMetric === 'likes')}</div></div></div>`;
    if (!list.length) { c.innerHTML = head + `<div class="ice-card p-10 text-center text-gray-400">В этом периоде пока нет данных</div>`; return; }

    const podium = list.slice(0, 3).map((r, i) => {
        const order = ['md:order-2', 'md:order-1', 'md:order-3'][i], lift = i === 0 ? 'md:-mt-4' : 'md:mt-4';
        return `<div class="${order} ${lift} podium-${i + 1} border rounded-2xl p-4 text-center relative overflow-hidden transition-transform hover:-translate-y-1">
            <div class="absolute top-2 left-3 text-3xl font-black ${i === 0 ? 'text-cyan-100' : 'text-cyan-400/70'} neon-text">${i + 1}</div>
            <div class="mx-auto w-28 h-28 md:w-32 md:h-32 mb-3 rounded-xl overflow-hidden border border-cyan-300/30 shadow-[0_0_20px_rgba(34,211,238,0.25)]">${coverImg(r.t, 'w-full h-full')}</div>
            <div class="font-bold text-sm truncate">${escapeHtml(r.t.title)}</div><div class="text-xs text-gray-400 truncate mb-2">${escapeHtml(r.t.artist || 'TrueEstimation')}</div>
            ${topValueHtml(r)}
            <button onclick="playTrack(${Number(r.t.id)})" class="mt-3 w-full bg-cyan-500 text-black font-bold py-1.5 rounded-lg text-xs neon-btn">▶ Слушать</button></div>`;
    }).join('');

    const rows = list.slice(3).map((r, i) => `<div class="ice-card group flex items-center gap-3 p-2 pr-4">
        <div class="w-8 text-center font-extrabold text-gray-400">${i + 4}</div>${coverImg(r.t, 'w-11 h-11 rounded-lg flex-shrink-0')}
        <div class="flex-1 min-w-0"><div class="text-sm font-bold truncate">${escapeHtml(r.t.title)}</div><div class="text-xs text-gray-400 truncate">${escapeHtml(r.t.artist || 'TrueEstimation')}</div></div>
        <div class="text-right w-24 shrink-0">${topValueHtml(r)}</div>
        <button onclick="playTrack(${Number(r.t.id)})" class="w-9 h-9 rounded-full bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500 hover:text-black transition-colors flex items-center justify-center flex-shrink-0" title="Слушать">▶</button></div>`).join('');

    c.innerHTML = head + `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:pt-4">${podium}</div><div class="space-y-2 pb-24">${rows}</div>`;
}

// ==========================================
// РЕЙТИНГ ПОЛЬЗОВАТЕЛЕЙ
// ==========================================
const RANK_METRICS = { xp: 'По опыту', ratings: 'По оценкам', comments: 'По отзывам', likesReceived: 'По лайкам' };
window.setRankMetric = m => { rankMetric = m; renderUserRanking(); };

function renderUserRanking() {
    const c = document.getElementById('ranking-view-container');
    if (!c) return;
    const all = allProfilesData.filter(p => !isBannedNow(p)).map(p => ({ p, s: getStats(p.id) })).filter(x => x.s.xp > 0)
        .sort((a, b) => b.s[rankMetric] - a.s[rankMetric] || b.s.xp - a.s.xp);
    const myIdx = all.findIndex(x => x.p.id === currentUserId);
    const head = `<div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h2 class="text-2xl md:text-3xl font-extrabold tracking-tight neon-text">Рейтинг пользователей</h2>
        <p class="text-xs text-gray-400 mt-1">Опыт: оценка +10 · отзыв +15 · лайк на отзыве +5 · ответ +5 · лайк трека +2. Забаненные не участвуют.</p></div>
        <div class="flex gap-1.5 flex-wrap justify-end">${segBtns(RANK_METRICS, rankMetric, 'setRankMetric')}</div></div>
        ${myIdx >= 0 ? `<div class="ice-card p-3 mb-5 flex items-center justify-between"><span class="text-sm text-gray-300">Твоё место</span><span class="text-2xl font-extrabold text-cyan-200 neon-text">#${myIdx + 1} <span class="text-xs text-gray-400 font-medium">из ${all.length}</span></span></div>` : ''}`;
    if (!all.length) { c.innerHTML = head + `<div class="ice-card p-10 text-center text-gray-400">Пока никто не набрал опыт. Оцени трек — и ты в списке!</div>`; return; }

    const val = x => x.s[rankMetric];
    const unit = { xp: 'XP', ratings: 'оценок', comments: 'отзывов', likesReceived: 'лайков' }[rankMetric];
    const podium = all.slice(0, 3).map((x, i) => {
        const order = ['md:order-2', 'md:order-1', 'md:order-3'][i], lift = i === 0 ? 'md:-mt-4' : 'md:mt-4';
        return `<div onclick="openUserProfile('${x.p.id}')" class="${order} ${lift} podium-${i + 1} border rounded-2xl p-5 text-center cursor-pointer relative transition-transform hover:-translate-y-1 ${x.p.id === currentUserId ? 'ring-2 ring-cyan-300' : ''}">
            <div class="absolute top-2 left-3 text-3xl font-black ${i === 0 ? 'text-cyan-100' : 'text-cyan-400/70'} neon-text">${i + 1}</div>
            <div class="flex justify-center mb-3">${avatarMarkup(x.p, 'w-20 h-20 !border-2 !border-cyan-300/40', 'text-3xl')}</div>
            <div class="font-bold truncate ${x.p.is_admin ? 'text-cyan-200' : ''}">${escapeHtml(x.p.username)}</div>
            <div class="text-[11px] text-cyan-300 mb-2">Ур. ${x.s.level} · ${escapeHtml(x.s.levelName)}</div>
            <div class="text-2xl font-extrabold text-cyan-100 neon-text">${val(x)}</div><div class="text-[10px] text-gray-400 uppercase tracking-wider">${unit}</div></div>`;
    }).join('');

    const col = (k, v) => `<div class="w-14 md:w-16 text-center hidden sm:block ${rankMetric === k ? 'text-cyan-200 font-extrabold' : 'text-gray-400'}">${v}</div>`;
    const rows = all.slice(3, 50).map((x, i) => `<div onclick="openUserProfile('${x.p.id}')" class="ice-card flex items-center gap-3 p-2.5 pr-4 cursor-pointer ${x.p.id === currentUserId ? '!border-cyan-300/70 shadow-[0_0_16px_rgba(34,211,238,0.25)]' : ''}">
        <div class="w-8 text-center font-extrabold text-gray-400">${i + 4}</div>${avatarMarkup(x.p, 'w-10 h-10')}
        <div class="flex-1 min-w-0"><div class="flex items-center gap-1 min-w-0"><span class="text-sm font-bold truncate ${x.p.is_admin ? 'text-cyan-200' : ''}">${escapeHtml(x.p.username)}</span>${x.p.is_admin ? '<span class="admin-badge ml-1">ADMIN</span>' : ''}</div>
        <div class="text-[11px] text-cyan-300">Ур. ${x.s.level} · ${escapeHtml(x.s.levelName)}</div></div>
        ${col('ratings', x.s.ratings + ' оц.')}${col('comments', x.s.comments + ' отз.')}${col('likesReceived', '♥ ' + x.s.likesReceived)}
        <div class="w-16 text-right font-extrabold ${rankMetric === 'xp' ? 'text-cyan-200' : 'text-gray-300'}">${x.s.xp}<span class="text-[10px] text-gray-500 font-medium"> XP</span></div></div>`).join('');

    c.innerHTML = head + `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 md:pt-4">${podium}</div><div class="space-y-2 pb-24">${rows}</div>`;
}
window.renderAdminPanel = renderAdminPanel;


// ==========================================
// ПЛЕЕР: фон из обложки, лайк / плейлист / оценка прямо в панели
// ==========================================
function updatePlayerExtras(track) {
    if (track) setMediaSession(track);
    const bg = document.getElementById('player-bg');
    if (bg) bg.style.backgroundImage = track && track.cover_url ? `url("${String(track.cover_url).replace(/"/g, '%22')}")` : 'none';
    const btn = document.getElementById('player-like-btn');
    if (!btn) return;
    const liked = !!(track && track.userLiked);
    btn.classList.toggle('text-cyan-300', liked);
    btn.innerHTML = liked
        ? `<svg class="w-5 h-5 text-cyan-300 fill-current drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
        : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
}
function refreshPlayerExtras() { if (currentTrackId) updatePlayerExtras(allTracksData.find(t => t.id === currentTrackId)); }
window.playerLike = function(e) { if (!currentTrackId) return; likeTrack(currentTrackId, e); refreshPlayerExtras(); };
window.playerAddToPlaylist = function() { if (!currentTrackId) return; if (!currentUserId) return showToast('Войди!', 'error'); openAddToPlaylistModal(currentTrackId); };
window.playerRate = function() { if (!currentTrackId) return; if (!currentUserId) return showToast('Войди!', 'error'); openRatingModal(currentTrackId); };

// ==========================================
// ПРИВАТНОСТЬ EMAIL (почты лежат в profile_private: видит админ и сам владелец)
// ==========================================
async function mergePrivateEmails() {
    if (!currentUserId) { allProfilesData.forEach(p => { p.email = null; }); return; }
    try {
        const { data, error } = await supabase.from('profile_private').select('id,email');
        if (error) return; // миграция ещё не запущена — остаётся старое поведение
        const m = new Map((data || []).map(x => [x.id, x.email]));
        allProfilesData.forEach(p => { p.email = m.get(p.id) || null; });
    } catch (e) { console.error(e); }
}

// ==========================================
// УПРАВЛЕНИЕ ТРЕКАМИ (добавление файлами, редактирование, удаление)
// ==========================================

async function uploadMedia(file, folder, maxMb) {
    if (!file) return null;
    if (file.size > maxMb * 1048576) throw new Error(`Файл «${file.name}» больше ${maxMb} МБ`);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { cacheControl: '31536000', contentType: file.type || undefined });
    if (error) throw error;
    return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
function mediaPathFromUrl(u) {
    const m = String(u || '').match(/\/track-media\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
}
const $id = id => document.getElementById(id);

window.adminAddTrack = async function() {
    if (!isAdmin) return;
    const title = $id('add-track-title').value.trim(), artist = $id('add-track-artist').value.trim(), category = $id('add-track-category').value.trim();
    let audio_url = $id('add-track-audio').value.trim(), cover_url = $id('add-track-cover').value.trim();
    const release_date = $id('add-track-release').value || null;
    const publishRaw = $id('add-track-publish').value; const publish_at = publishRaw ? new Date(publishRaw).toISOString() : null;
    const aFile = $id('add-track-audio-file').files[0], cFile = $id('add-track-cover-file').files[0];
    if (!title || (!audio_url && !aFile)) return showToast('Название и аудио обязательны', 'error');
    const btn = $id('add-track-btn'); btn.disabled = true; btn.classList.add('opacity-50'); btn.innerText = 'Загрузка…';
    try {
        if (aFile) audio_url = await uploadMedia(aFile, 'audio', 50);
        if (cFile) cover_url = await uploadMedia(cFile, 'covers', 5);
        const { error } = await supabase.from('tracks').insert({ title, artist, category, audio_url, cover_url, release_date, publish_at });
        if (error) throw error;
        showToast(publish_at && new Date(publish_at) > new Date() ? 'Трек запланирован на ' + fmtDateTime(publish_at) : 'Трек добавлен!', 'success');
        ['add-track-title', 'add-track-artist', 'add-track-category', 'add-track-audio', 'add-track-cover', 'add-track-release', 'add-track-publish', 'add-track-audio-file', 'add-track-cover-file'].forEach(i => { $id(i).value = ''; });
        await loadData();
    } catch (e) { showToast('Ошибка: ' + (e.message || e), 'error'); }
    finally { btn.disabled = false; btn.classList.remove('opacity-50'); btn.innerText = 'Добавить трек'; }
}

function renderAdminTracks() {
    const el = $id('admin-tracks-list'); if (!el) return;
    const q = ($id('admin-tracks-search')?.value || '').trim().toLowerCase();
    const list = [...scheduledTracksData, ...allTracksData].filter(t => !q || t.title.toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q));
    el.innerHTML = list.length ? list.map(t => `<tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
        <td class="p-3 w-14">${coverImg(t, 'w-10 h-10 rounded-lg')}</td>
        <td class="p-3"><div class="text-sm font-bold truncate max-w-[220px]">${escapeHtml(t.title)}</div><div class="text-xs text-gray-400 truncate max-w-[220px]">${escapeHtml(t.artist || '—')}</div></td>
        <td class="p-3 text-xs text-cyan-300">${escapeHtml(t.category)}${schedBadge(t.publish_at)}</td>
        <td class="p-3 text-xs text-gray-400 whitespace-nowrap"><span class="text-yellow-400 font-bold">${t.avgScore || '—'}</span> · ${t.votesCount} оц.</td>
        <td class="p-3 text-right whitespace-nowrap"><button onclick="openEditTrack(${Number(t.id)})" class="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Изменить</button>
        <button onclick="deleteTrack(${Number(t.id)})" class="ml-1 bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Удалить</button></td></tr>`).join('')
        : `<tr><td class="p-4 text-center text-gray-400">Ничего не найдено</td></tr>`;
}
window.renderAdminTracks = renderAdminTracks;

let editingTrackId = null;
window.openEditTrack = function(id) {
    const t = [...allTracksData, ...scheduledTracksData].find(x => x.id === id); if (!t || !isAdmin) return;
    editingTrackId = id;
    $id('edit-track-title').value = t.title || ''; $id('edit-track-artist').value = t.artist || '';
    $id('edit-track-category').value = t.category === 'Без категории' ? '' : t.category;
    $id('edit-track-audio').value = t.audio_url || ''; $id('edit-track-cover').value = t.cover_url || '';
    $id('edit-track-audio-file').value = ''; $id('edit-track-cover-file').value = '';
    $id('edit-track-release').value = t.release_date ? String(t.release_date).slice(0, 10) : '';
    $id('edit-track-publish').value = toLocalInput(t.publish_at);
    $id('edit-track-modal').classList.remove('hidden');
}
window.closeEditTrack = function() { $id('edit-track-modal').classList.add('hidden'); editingTrackId = null; }
window.saveTrackEdit = async function() {
    const t = [...allTracksData, ...scheduledTracksData].find(x => x.id === editingTrackId); if (!t || !isAdmin) return;
    const title = $id('edit-track-title').value.trim();
    if (!title) return showToast('Название обязательно', 'error');
    let audio_url = $id('edit-track-audio').value.trim(), cover_url = $id('edit-track-cover').value.trim();
    const aFile = $id('edit-track-audio-file').files[0], cFile = $id('edit-track-cover-file').files[0];
    const btn = $id('edit-track-save'); btn.disabled = true; btn.classList.add('opacity-50');
    try {
        if (aFile) audio_url = await uploadMedia(aFile, 'audio', 50);
        if (cFile) cover_url = await uploadMedia(cFile, 'covers', 5);
        if (!audio_url) throw new Error('Нужна ссылка на аудио или файл');
        const { error } = await supabase.from('tracks').update({ title, artist: $id('edit-track-artist').value.trim(), category: $id('edit-track-category').value.trim() || null, audio_url, cover_url: cover_url || null, release_date: $id('edit-track-release').value || null, publish_at: $id('edit-track-publish').value ? new Date($id('edit-track-publish').value).toISOString() : null }).eq('id', t.id);
        if (error) throw error;
        const old = [aFile && t.audio_url, cFile && t.cover_url].map(mediaPathFromUrl).filter(Boolean);
        if (old.length) supabase.storage.from(MEDIA_BUCKET).remove(old).catch(() => {});
        showToast('Сохранено', 'success'); closeEditTrack(); await loadData();
    } catch (e) { showToast('Ошибка: ' + (e.message || e), 'error'); }
    finally { btn.disabled = false; btn.classList.remove('opacity-50'); }
}
window.deleteTrack = function(id) {
    const t = [...allTracksData, ...scheduledTracksData].find(x => x.id === id); if (!t || !isAdmin) return;
    showConfirm(`Удалить трек «${t.title}»? Его оценки и места в плейлистах тоже пропадут.`, async () => {
        const { error } = await supabase.from('tracks').delete().eq('id', id);
        if (error) return showToast('Ошибка: ' + error.message, 'error');
        const paths = [t.audio_url, t.cover_url].map(mediaPathFromUrl).filter(Boolean);
        if (paths.length) supabase.storage.from(MEDIA_BUCKET).remove(paths).catch(() => {});
        playQueue = playQueue.filter(x => x !== id); renderQueuePanel();
        showToast('Трек удалён', 'success'); await loadData();
    }, 'delete');
}

// ================= НОВОСТИ И ПЛАНИРОВАНИЕ =================
const fmtDateTime = iso => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isFuture = iso => !!iso && new Date(iso).getTime() > Date.now();
const schedBadge = iso => isFuture(iso) ? `<div class="mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-400/15 text-cyan-200 border border-cyan-400/30 whitespace-nowrap">⏳ выйдет ${fmtDateTime(iso)}</div>` : '';
function toLocalInput(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

async function loadNews() {
    try {
        const { data, error } = await supabase.from('news').select('*').order('publish_at', { ascending: false });
        if (error) throw error;
        allNewsData = data || [];
    } catch (e) { allNewsData = []; }
    updateNewsDot();
}

function updateNewsDot() {
    const dot = document.getElementById('news-dot'); if (!dot) return;
    const latest = allNewsData.filter(n => !isFuture(n.publish_at)).reduce((m, n) => Math.max(m, new Date(n.publish_at).getTime()), 0);
    const seen = parseInt(localStorage.getItem('te_news_seen') || '0', 10);
    dot.classList.toggle('hidden', !(latest > seen) || currentCategory === 'News');
}

function formatNewsBody(text) {
    const inline = t => escapeHtml(t).replace(/\*\*(.+?)\*\*/g, '<b class="text-white">$1</b>');
    let html = '', inList = false;
    const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
    for (const raw of String(text || '').split('\n')) {
        const l = raw.trim();
        if (/^[-•]\s+/.test(l)) { if (!inList) { html += '<ul class="list-disc pl-5 space-y-1.5 my-2">'; inList = true; } html += '<li>' + inline(l.replace(/^[-•]\s+/, '')) + '</li>'; continue; }
        closeList();
        if (!l) continue;
        if (l.startsWith('## ')) html += '<h4 class="text-base font-extrabold text-cyan-200 mt-5 mb-1">' + inline(l.slice(3)) + '</h4>';
        else if (l.startsWith('> ')) html += '<blockquote class="my-3 pl-4 border-l-2 border-cyan-400/60 italic text-gray-200">' + inline(l.slice(2)) + '</blockquote>';
        else html += '<p class="my-2">' + inline(l) + '</p>';
    }
    closeList(); return html;
}

function renderNewsView() {
    const list = $id('news-list'); if (!list) return;
    $id('news-add-btn')?.classList.toggle('hidden', !isAdmin);
    localStorage.setItem('te_news_seen', String(Date.now())); updateNewsDot();
    if (!allNewsData.length) { list.innerHTML = '<div class="text-center text-gray-400 py-16 bg-white/5 border border-white/10 rounded-2xl">Пока новостей нет. Загляни позже!</div>'; return; }
    list.innerHTML = allNewsData.map(n => {
        const future = isFuture(n.publish_at);
        const author = allProfilesData.find(p => p.id === n.author_id)?.username || 'Команда TrueEstimation';
        const adminBtns = isAdmin ? `<div class="flex gap-1 shrink-0"><button onclick="openNewsModal(${Number(n.id)})" class="bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Изменить</button><button onclick="deleteNews(${Number(n.id)})" class="bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Удалить</button></div>` : '';
        return `<article class="bg-white/5 border ${future ? 'border-dashed border-cyan-400/40' : 'border-white/10'} rounded-2xl p-5 md:p-6 hover:border-cyan-500/30 transition-colors">
            <div class="flex items-start justify-between gap-3 mb-1"><h3 class="text-xl md:text-2xl font-extrabold text-white leading-tight">${escapeHtml(n.title)}</h3>${adminBtns}</div>
            <div class="text-xs text-gray-400 mb-3">${future ? '⏳ Запланировано на ' : ''}${fmtDateTime(n.publish_at)} · ${escapeHtml(author)}</div>
            <div class="text-sm text-gray-300 leading-relaxed">${formatNewsBody(n.body)}</div></article>`;
    }).join('');
}

window.openNewsModal = function(id) {
    if (!isAdmin) return;
    editingNewsId = id || null;
    const n = id ? allNewsData.find(x => x.id === id) : null;
    $id('news-modal-title').innerText = n ? 'Изменить новость' : 'Новая новость';
    $id('news-title').value = n ? n.title : ''; $id('news-body').value = n ? n.body : '';
    $id('news-publish').value = n && isFuture(n.publish_at) ? toLocalInput(n.publish_at) : '';
    $id('news-save-btn').innerText = $id('news-publish').value ? 'Запланировать' : (n ? 'Сохранить' : 'Опубликовать');
    $id('news-modal').classList.remove('hidden');
};
window.closeNewsModal = function() { $id('news-modal').classList.add('hidden'); editingNewsId = null; };

window.saveNews = async function() {
    if (!isAdmin) return;
    const title = $id('news-title').value.trim(), body = $id('news-body').value.trim(), raw = $id('news-publish').value;
    if (!title) return showToast('Введи заголовок', 'error');
    if (!body) return showToast('Введи текст новости', 'error');
    const when = raw ? new Date(raw) : null;
    if (when && when.getTime() < Date.now() - 60000 && !editingNewsId) return showToast('Время публикации уже прошло. Очисти поле, чтобы опубликовать сразу', 'error');
    const btn = $id('news-save-btn'); btn.disabled = true;
    try {
        let error;
        if (editingNewsId) {
            const patch = { title, body, updated_at: new Date().toISOString() };
            if (raw) patch.publish_at = when.toISOString();
            else if (isFuture(allNewsData.find(x => x.id === editingNewsId)?.publish_at)) patch.publish_at = new Date(Date.now() - 2000).toISOString();
            ({ error } = await supabase.from('news').update(patch).eq('id', editingNewsId));
        } else {
            const row = { title, body, author_id: currentUserId };
            if (raw) row.publish_at = when.toISOString();
            ({ error } = await supabase.from('news').insert(row));
        }
        if (error) throw error;
        showToast(raw ? 'Новость запланирована на ' + fmtDateTime(when) : 'Новость опубликована', 'success');
        closeNewsModal(); await loadNews(); renderNewsView();
    } catch (e) { showToast('Ошибка: ' + e.message + ' (выполнена ли SQL-миграция 4?)', 'error'); }
    btn.disabled = false;
};

window.deleteNews = function(id) {
    if (!isAdmin) return;
    showConfirm('Удалить эту новость? Это действие нельзя отменить.', async () => {
        const { data, error } = await supabase.from('news').delete().eq('id', id).select('id');
        if (error || !data || !data.length) return showToast('Не удалось удалить' + (error ? ': ' + error.message : ''), 'error');
        showToast('Новость удалена', 'success'); await loadNews(); renderNewsView();
    });
};

// Автопубликация: раз в минуту проверяем, не наступило ли время выхода новости или трека
async function checkContentUpdates() {
    try {
        if (document.hidden) return;
        const now = Date.now();
        if (isAdmin) {
            const due = [...scheduledTracksData.map(t => t.publish_at), ...allNewsData.map(n => n.publish_at)].map(x => new Date(x).getTime()).some(x => x > lastLoadAt && x <= now);
            if (due) { await loadData(); showToast('Запланированный контент опубликован', 'success'); }
            return;
        }
        const [a, b] = await Promise.all([supabase.from('tracks').select('id', { count: 'exact', head: true }), supabase.from('news').select('id', { count: 'exact', head: true })]);
        if (a.error || b.error) return;
        const newNews = b.count > allNewsData.length, newTracks = a.count > allTracksData.length;
        if (a.count !== allTracksData.length || b.count !== allNewsData.length) {
            await loadData();
            if (newNews) showToast('📰 Вышла новая новость', 'success'); else if (newTracks) showToast('🎵 На сайте появился новый трек', 'success');
        }
    } catch (e) {}
}
setInterval(checkContentUpdates, 60000);

// ---- журнал банов ----
let banLogData = [];
async function loadBanLog() {
    if (!isAdmin) return;
    const { data, error } = await supabase.from('ban_log').select('*').order('created_at', { ascending: false }).limit(30);
    if (!error) { banLogData = data || []; renderBanLog(); }
}
window.clearBanLog = function() {
    if (!isAdmin) return;
    if (!banLogData.length) return showToast('Журнал уже пуст', 'success');
    showConfirm('Удалить всю историю журнала банов? Это действие нельзя отменить. Сами баны останутся в силе.', async () => {
        const { data, error } = await supabase.from('ban_log').delete().gte('id', 0).select('id');
        if (error) return showToast('Ошибка: ' + error.message, 'error');
        if (!data || !data.length) return showToast('Не удалось очистить. Выполни SQL-миграцию для журнала банов', 'error');
        banLogData = []; renderBanLog();
        showToast('Журнал очищен', 'success');
    });
}
function renderBanLog() {
    const el = $id('admin-banlog-list'); if (!el) return;
    const nm = id => (allProfilesData.find(p => p.id === id) || {}).username || 'Удалён';
    el.innerHTML = banLogData.length ? banLogData.map(l => `<tr class="border-b border-white/5 text-sm">
        <td class="p-3 text-xs text-gray-400 whitespace-nowrap">${fmtDate(l.created_at)}</td><td class="p-3">${escapeHtml(l.admin_id ? nm(l.admin_id) : 'система')}</td>
        <td class="p-3">${l.action === 'ban' ? '<span class="ban-badge">БАН</span>' : '<span class="text-cyan-300 font-bold text-xs">РАЗБАН</span>'}</td>
        <td class="p-3 font-bold">${escapeHtml(nm(l.target_id))}</td>
        <td class="p-3 text-xs text-gray-400">${l.action === 'ban' ? (l.banned_until ? 'до ' + fmtDate(l.banned_until) : 'навсегда') + (l.reason ? ' · ' + escapeHtml(l.reason) : '') : ''}</td></tr>`).join('')
        : `<tr><td colspan="5" class="p-4 text-center text-gray-400">Банов пока не было</td></tr>`;
}

// ==========================================
// МОДЕРАЦИЯ КОММЕНТАРИЕВ
// ==========================================
let pendingReportRatingId = null; let commentsLimit = 20;
window.showMoreComments = function() { commentsLimit += 20; renderCommentsView(); };
function modButtons(c) {
    let out = '';
    if (c.hidden) out += `<span class="ban-badge ml-2" title="Скрыт после жалоб">СКРЫТ</span>`;
    if (currentUserId && c.user_id !== currentUserId)
        out += `<button onclick="reportComment(${c.id})" class="text-xs text-gray-500 hover:text-red-400 transition-colors ml-2 font-medium">Пожаловаться</button>`;
    if (isAdmin)
        out += `<button onclick="toggleHideComment(${c.id}, ${!c.hidden})" class="text-xs text-gray-500 hover:text-cyan-300 transition-colors ml-2 font-medium">${c.hidden ? 'Показать' : 'Скрыть'}</button>`;
    return out;
}
window.reportComment = function(ratingId) {
    const c = allCommentsData.find(x => x.id === ratingId); if (!c) return;
    if (guardBan && isBannedSelf()) { /* забаненный может обратиться в поддержку */ }
    const quote = String(c.comment).slice(0, 200);
    openSupportModal({ type: 'report', target: c.username, ratingId, message: `Жалоба на комментарий к «${c.trackTitle}»: «${quote}»\nПричина: ` });
}
window.toggleHideComment = async function(id, hide) {
    if (!isAdmin) return;
    const { error } = await supabase.from('ratings').update({ hidden: hide }).eq('id', id);
    if (error) return showToast('Ошибка: ' + error.message, 'error');
    showToast(hide ? 'Комментарий скрыт' : 'Комментарий снова виден', 'success'); await loadData();
}

// ==========================================
// ПЛЕЕР: очередь, горячие клавиши, управление с экрана блокировки
// ==========================================
let playQueue = [];
window.queueTrack = function(id, e) {
    if (e) e.stopPropagation();
    if (!currentTrackId) { playTrack(id); return; }
    playQueue.push(id); renderQueuePanel(); showToast('Добавлено в очередь', 'success');
}
window.removeFromQueue = function(i) { playQueue.splice(i, 1); renderQueuePanel(); }
window.clearQueue = function() { playQueue = []; renderQueuePanel(); }
window.playQueueItem = function(i) { const id = playQueue.splice(i, 1)[0]; renderQueuePanel(); if (id === currentTrackId) { globalAudio.currentTime = 0; globalAudio.play(); } else if (id) playTrack(id); }
window.toggleQueuePanel = function() {
    const p = $id('queue-panel'); p.classList.toggle('hidden'); p.classList.toggle('flex', !p.classList.contains('hidden')); renderQueuePanel();
}
function renderQueuePanel() {
    const cnt = $id('queue-count'), list = $id('queue-list');
    if (cnt) { cnt.innerText = playQueue.length; cnt.classList.toggle('hidden', !playQueue.length); }
    if (!list) return;
    const items = playQueue.map(id => allTracksData.find(t => t.id === id)).map((t, i) => t ? `<div class="flex items-center gap-3 px-3 py-2 hover:bg-white/5 group">
        ${coverImg(t, 'w-9 h-9 rounded-md flex-shrink-0')}<button onclick="playQueueItem(${i})" class="flex-1 min-w-0 text-left"><div class="text-sm font-bold truncate">${escapeHtml(t.title)}</div><div class="text-[11px] text-gray-400 truncate">${escapeHtml(t.artist || '')}</div></button>
        <button onclick="removeFromQueue(${i})" class="text-gray-500 hover:text-red-400 px-1" title="Убрать">✕</button></div>` : '').join('');
    list.innerHTML = items || `<div class="p-6 text-center text-sm text-gray-400">Очередь пуста.<br>Нажми значок «≡+» у трека, чтобы добавить.</div>`;
}

document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.fixed.inset-0:not(.hidden)[id$="-modal"]')) return; // открыта модалка
    if (!currentTrackId) return;
    switch (e.code) {
        case 'Space': e.preventDefault(); toggleGlobalPlay(); break;
        case 'ArrowRight': e.preventDefault(); if (e.shiftKey) playNext(); else globalAudio.currentTime = Math.min((globalAudio.duration || 1e9), globalAudio.currentTime + 5); break;
        case 'ArrowLeft': e.preventDefault(); if (e.shiftKey) playPrev(); else globalAudio.currentTime = Math.max(0, globalAudio.currentTime - 5); break;
        case 'ArrowUp': e.preventDefault(); changeVolume(Math.min(1, globalAudio.volume + 0.05)); break;
        case 'ArrowDown': e.preventDefault(); changeVolume(Math.max(0, globalAudio.volume - 0.05)); break;
        case 'KeyM': toggleMute(); break;
    }
});

function setMediaSession(track) {
    if (!('mediaSession' in navigator) || !track) return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist || 'TrueEstimation', album: 'TrueEstimation', artwork: track.cover_url ? [{ src: track.cover_url, sizes: '512x512' }] : [] });
    } catch (e) {}
}
(function initMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch (e) {} };
    set('play', () => globalAudio.play()); set('pause', () => globalAudio.pause());
    set('previoustrack', () => playPrev()); set('nexttrack', () => playNext());
    set('seekto', d => { if (d.seekTime != null) globalAudio.currentTime = d.seekTime; });
    set('seekbackward', d => { globalAudio.currentTime = Math.max(0, globalAudio.currentTime - (d.seekOffset || 10)); });
    set('seekforward', d => { globalAudio.currentTime = Math.min(globalAudio.duration || 1e9, globalAudio.currentTime + (d.seekOffset || 10)); });
    globalAudio.addEventListener('play', () => { navigator.mediaSession.playbackState = 'playing'; });
    globalAudio.addEventListener('pause', () => { navigator.mediaSession.playbackState = 'paused'; });
    globalAudio.addEventListener('timeupdate', () => {
        if (globalAudio.duration && isFinite(globalAudio.duration)) { try { navigator.mediaSession.setPositionState({ duration: globalAudio.duration, position: globalAudio.currentTime, playbackRate: globalAudio.playbackRate }); } catch (e) {} }
    });
})();

// ==========================================
// СОЦИАЛЬНОЕ: подписки, любимые треки, «трек недели», «сейчас слушают», лента
// ==========================================
let allFollowsData = [];
async function loadFollows() {
    try { const { data, error } = await supabase.from('follows').select('*'); allFollowsData = error ? [] : (data || []); } catch (e) { allFollowsData = []; }
}
function socialRowHtml(p) {
    const followers = allFollowsData.filter(f => f.followed_id === p.id).length, following = allFollowsData.filter(f => f.follower_id === p.id).length;
    const iFollow = !!currentUserId && allFollowsData.some(f => f.follower_id === currentUserId && f.followed_id === p.id);
    const btn = currentUserId && p.id !== currentUserId
        ? `<button onclick="toggleFollow('${p.id}')" class="px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${iFollow ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-cyan-500 text-black neon-btn'}">${iFollow ? 'Отписаться' : 'Подписаться'}</button>` : '';
    return `<div class="flex items-center justify-between mt-3 text-sm"><div class="text-gray-400"><b class="text-white">${followers}</b> подписчиков · <b class="text-white">${following}</b> подписок</div>${btn}</div>`;
}
function favoritesHtml(p) {
    const ids = new Set(allTrackLikesData.filter(l => l.user_id === p.id).map(l => l.track_id));
    const favs = allTracksData.filter(t => ids.has(t.id)).sort((a, b) => b.avgScore - a.avgScore).slice(0, 6);
    if (!favs.length) return '';
    return `<h4 class="text-sm font-bold text-gray-300 mt-6 mb-2">Любимые треки <span class="text-gray-500 font-normal">${ids.size}</span></h4>
    <div class="grid grid-cols-3 gap-2">${favs.map(t => `<button onclick="closeUserProfile(); playTrack(${Number(t.id)})" class="text-left group">${coverImg(t, 'w-full aspect-square rounded-xl group-hover:shadow-[0_0_16px_rgba(34,211,238,0.4)] transition-shadow')}<div class="text-[11px] font-bold truncate mt-1">${escapeHtml(t.title)}</div></button>`).join('')}</div>`;
}
window.toggleFollow = async function(uid) {
    if (!currentUserId) return showToast('Войди!', 'error');
    if (guardBan()) return;
    const has = allFollowsData.some(f => f.follower_id === currentUserId && f.followed_id === uid);
    const { error } = has ? await supabase.from('follows').delete().match({ follower_id: currentUserId, followed_id: uid })
                          : await supabase.from('follows').insert({ follower_id: currentUserId, followed_id: uid });
    if (error) return showToast('Ошибка: ' + error.message, 'error');
    allFollowsData = has ? allFollowsData.filter(f => !(f.follower_id === currentUserId && f.followed_id === uid)) : [...allFollowsData, { follower_id: currentUserId, followed_id: uid, created_at: new Date().toISOString() }];
    openUserProfile(uid); if (currentCategory === 'Главное меню') renderHomeExtras();
}

function weeklyTopTrack() {
    const since = Date.now() - 7 * 864e5, by = new Map();
    allRatingsData.forEach(r => { if (new Date(r.created_at || 0).getTime() < since) return; const a = by.get(r.track_id) || { sum: 0, n: 0 }; a.sum += r.score || 0; a.n++; by.set(r.track_id, a); });
    const arr = [...by.values()], N = arr.reduce((x, a) => x + a.n, 0); if (!N) return null;
    const C = arr.reduce((x, a) => x + a.sum, 0) / N, M = 2; let best = null;
    by.forEach((a, id) => { const avg = a.sum / a.n, w = (a.n / (a.n + M)) * avg + (M / (a.n + M)) * C; if (!best || w > best.w) best = { id, avg, n: a.n, w }; });
    const t = allTracksData.find(x => x.id === best.id); return t ? { t, avg: best.avg, n: best.n } : null;
}

let listeners = [], presenceChannel = null;
const hideListening = () => localStorage.getItem('te_hide_listening') === '1';
window.toggleHideListening = function() { localStorage.setItem('te_hide_listening', hideListening() ? '0' : '1'); announceListening(!globalAudio.paused); renderHomeExtras(); };
function announceListening(on) {
    if (!presenceChannel) return;
    try {
        if (on && currentTrackId && !hideListening()) presenceChannel.track({ track_id: currentTrackId, name: currentUserProfile ? currentUserProfile.username : null, uid: currentUserId || null, t: Date.now() });
        else presenceChannel.untrack();
    } catch (e) {}
}
(function initPresence() {
    try {
        presenceChannel = supabase.channel('now-listening', { config: { presence: { key: 'v_' + Math.random().toString(36).slice(2, 10) } } });
        presenceChannel.on('presence', { event: 'sync' }, () => {
            listeners = Object.values(presenceChannel.presenceState()).map(a => a[a.length - 1]).filter(x => x && x.track_id);
            if (currentCategory === 'Главное меню') renderHomeExtras();
        }).subscribe(st => { if (st === 'SUBSCRIBED' && !globalAudio.paused) announceListening(true); });
        globalAudio.addEventListener('play', () => announceListening(true));
        globalAudio.addEventListener('pause', () => announceListening(false));
        globalAudio.addEventListener('ended', () => announceListening(false));
    } catch (e) { console.error(e); }
})();

function renderHomeExtras() {
    const el = $id('home-extras'); if (!el) return;
    let html = '';
    const wk = weeklyTopTrack();
    if (wk) html += `<div class="ice-card p-4 flex items-center gap-4"><div class="relative">${coverImg(wk.t, 'w-20 h-20 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)]')}</div>
        <div class="flex-1 min-w-0"><div class="text-[11px] font-bold tracking-widest uppercase text-cyan-300 neon-text">Трек недели</div><div class="text-lg font-extrabold truncate">${escapeHtml(wk.t.title)}</div><div class="text-xs text-gray-400 truncate">${escapeHtml(wk.t.artist || 'TrueEstimation')}</div></div>
        <div class="text-right"><div class="text-yellow-400 font-extrabold text-xl">${wk.avg.toFixed(1)}<span class="text-xs text-gray-400 font-medium"> /30</span></div><div class="text-[10px] text-gray-400">${wk.n} оц. за 7 дней</div></div>
        <button onclick="playTrack(${Number(wk.t.id)})" class="w-11 h-11 rounded-full bg-cyan-500 text-black font-bold neon-btn flex-shrink-0">▶</button></div>`;

    const act = listeners.map(l => ({ ...l, t: allTracksData.find(x => x.id === l.track_id) })).filter(x => x.t);
    html += `<div class="ice-card p-4"><div class="flex items-center justify-between mb-3"><h3 class="text-sm font-bold text-gray-200 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-cyan-300 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.9)]"></span>Сейчас слушают <span class="text-gray-500 font-normal">${act.length}</span></h3>
        <button onclick="toggleHideListening()" class="text-[11px] text-gray-500 hover:text-cyan-300">${hideListening() ? 'Показывать меня' : 'Скрыть меня'}</button></div>`
        + (act.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${act.slice(0, 8).map(x => {
            const pr = x.uid && allProfilesData.find(p => p.id === x.uid);
            return `<button onclick="playTrack(${Number(x.t.id)})" class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-left transition-colors">${pr ? avatarMarkup(pr, 'w-8 h-8') : '<div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">?</div>'}
            <div class="min-w-0"><div class="text-xs font-bold truncate">${escapeHtml(x.name || 'Гость')}</div><div class="text-[11px] text-gray-400 truncate">♪ ${escapeHtml(x.t.title)}</div></div></button>`; }).join('')}</div>`
            : `<p class="text-xs text-gray-500">Пока тихо. Включи трек — и ты первый в списке.</p>`) + `</div>`;

    if (currentUserId) {
        const following = new Set(allFollowsData.filter(f => f.follower_id === currentUserId).map(f => f.followed_id));
        const feed = allRatingsData.filter(r => following.has(r.user_id)).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6);
        html += `<div class="ice-card p-4"><h3 class="text-sm font-bold text-gray-200 mb-3">Лента подписок</h3>` + (feed.length ? `<div class="space-y-1">${feed.map(r => {
            const pr = allProfilesData.find(p => p.id === r.user_id), t = allTracksData.find(x => x.id === r.track_id); if (!pr || !t) return '';
            return `<div class="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"><button onclick="openUserProfile('${pr.id}')">${avatarMarkup(pr, 'w-8 h-8')}</button>
            <button onclick="playTrack(${Number(t.id)})" class="flex-1 min-w-0 text-left"><div class="text-xs truncate"><b>${escapeHtml(pr.username)}</b> оценил(а) <span class="text-cyan-300">${escapeHtml(t.title)}</span></div>${r.comment ? `<div class="text-[11px] text-gray-400 truncate">«${escapeHtml(r.comment)}»</div>` : ''}</button>
            <div class="text-yellow-400 font-bold text-sm">${r.score}</div></div>`; }).join('')}</div>`
            : `<p class="text-xs text-gray-500">${following.size ? 'Твои подписки пока ничего не оценили.' : 'Подпишись на кого-нибудь в рейтинге пользователей — их оценки появятся здесь.'}</p>`) + `</div>`;
    }
    el.innerHTML = html;
}

// ==========================================
// PWA
// ==========================================
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// =====================================================================
// ЭКОНОМИКА: АЙС ❄ / КЕЙСЫ / КАРТОЧКИ / КОЛЛЕКЦИЯ
// Подключается автоматически (этот блок уже внутри script.js).
// Зависит от: supabase, currentUserId, isAdmin, allTracksData, showToast,
// escapeHtml, changeCategory (всё объявлено выше в этом же модуле).
// =====================================================================
const ECO_RARITY = {
  common:    { label: 'Обычная',     color: '#9ca3af' },
  rare:      { label: 'Редкая',      color: '#60a5fa' },
  epic:      { label: 'Эпическая',   color: '#c084fc' },
  legendary: { label: 'Легендарная', color: '#fbbf24' },
  mythic:    { label: 'МИФИЧЕСКАЯ',  color: '#22d3ee' }
};
const ECO_CRAFT_COST = { common: 50, rare: 150, epic: 400, legendary: 1500, mythic: 5000 };
const ECO_DUST_GAIN  = { common: 5,  rare: 15,   epic: 40,   legendary: 150,  mythic: 500 };

let ecoWallet = { balance: 0, dust: 0, daily_streak: 0, pity_counter: 0, daily_claimed_at: null };
let ecoCases = [], ecoCards = [], ecoUserCards = [], ecoOpens = [];
let ecoFilter = 'all', ecoOpening = false, ecoAnimTimer = null, ecoDailyBusy = false;

function eco$(id) { return document.getElementById(id); }

// ---------- ДАННЫЕ ----------
async function loadEconomy() {
  try {
    const [{ data: cases }, { data: cards }] = await Promise.all([
      supabase.from('cases').select('*').order('price'),
      supabase.from('cards').select('*').order('id')
    ]);
    ecoCases = cases || [];
    ecoCards = cards || [];
    if (currentUserId) {
      const [{ data: w }, { data: uc }, { data: co }] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', currentUserId).maybeSingle(),
        supabase.from('user_cards').select('*').eq('user_id', currentUserId),
        supabase.from('case_opens').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(20)
      ]);
      ecoWallet = w || { balance: 0, dust: 0, daily_streak: 0, pity_counter: 0, daily_claimed_at: null };
      ecoUserCards = uc || [];
      ecoOpens = co || [];
    } else {
      ecoWallet = { balance: 0, dust: 0, daily_streak: 0, pity_counter: 0, daily_claimed_at: null };
      ecoUserCards = []; ecoOpens = [];
    }
  } catch (e) { console.error('Economy load:', e); }
  updateCoinsUI();
}

function updateCoinsUI() {
  const wrap = eco$('coins-display'), bal = eco$('coins-balance');
  if (!wrap || !bal) return;
  if (!currentUserId) { wrap.classList.add('hidden'); wrap.classList.remove('flex'); return; }
  wrap.classList.remove('hidden'); wrap.classList.add('flex');
  bal.innerText = Number(ecoWallet.balance || 0).toLocaleString('ru-RU');
}

async function tryDailyClaim() {
  if (!currentUserId || ecoDailyBusy) return;
  const key = 'te_daily_' + currentUserId;
  if (localStorage.getItem(key) === new Date().toDateString()) return;
  ecoDailyBusy = true;
  try {
    const { data, error } = await supabase.rpc('claim_daily');
    if (!error && data && data.ok) {
      localStorage.setItem(key, new Date().toDateString());
      showToast(`❄ Ежедневный бонус: +${data.reward} (стрик ${data.streak} дн.)`, 'success');
      await loadEconomy();
    }
  } catch (e) {}
  ecoDailyBusy = false;
}

// ---------- ВИЗУАЛ КАРТОЧЕК ----------
function ecoCardImg(c, cls) {
  const track = c.track_id ? allTracksData.find(t => t.id === c.track_id) : null;
  const img = c.image_url || (track && track.cover_url);
  if (img) return `<img src="${escapeHtml(img)}" class="${cls} object-cover" onerror="this.style.display='none'">`;
  const emoji = (String(c.name).match(/\p{Extended_Pictographic}/u) || ['🎵'])[0];
  return `<div class="${cls} flex items-center justify-center text-4xl bg-white/5">emoji</div>`.replace('emoji', emoji);
}

function ecoCardRarityBar(rarity) {
  return `<div class="absolute bottom-0 inset-x-0 h-1.5" style="background:${ECO_RARITY[rarity].color}"></div>`;
}

// ---------- КЕЙСЫ ----------
function renderCasesView() {
  const el = eco$('cases-inner');
  if (!el) return;
  const adminBtn = isAdmin
    ? `<button onclick="ecoAdminGrant()" class="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-gray-300 transition-colors">🧪 +1000 ❄ (тест)</button>` : '';
  const caseEmojis = ['🧊', '🎁', '💠', '🗝️'];
  el.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight neon-text">Кейсы</h2>
      ${adminBtn}
    </div>
    <p class="text-xs text-gray-500 mb-6">Открывай кейсы за Айс ❄ и собирай коллекцию карточек.
      Шансы: мифик 1% · легенда 4% · эпик 10% · редкая 25%. Дубликаты превращаются в пыль ❆, из пыли можно скрафтить недостающее.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${ecoCases.map((cs, i) => {
        const opens = ecoOpens.filter(o => o.case_id === cs.id).length;
        return `<div class="ice-card p-6 text-center relative overflow-hidden">
          <div class="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl"></div>
          <div class="text-6xl mb-3 drop-shadow-[0_0_18px_rgba(34,211,238,0.5)]">${caseEmojis[i % caseEmojis.length]}</div>
          <h3 class="font-extrabold text-lg neon-text">${escapeHtml(cs.name)}</h3>
          <div class="text-xs text-gray-400 mt-1">открыто тобой: <b class="text-white">${opens}</b></div>
          ${cs.mythic_boost > 1
            ? `<div class="text-[11px] text-purple-300 mt-2">✦ шанс мифики ×${cs.mythic_boost} · пити: <b class="text-white">${ecoWallet.pity_counter}/10</b> (каждое 10-е = эпик+)</div>`
            : `<div class="text-[11px] text-gray-500 mt-2">стандартные шансы</div>`}
          <button onclick="ecoOpenCase(${cs.id})" ${ecoOpening ? 'disabled' : ''}
            class="mt-4 w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 rounded-xl neon-btn transition-all active:scale-95 ${ecoOpening ? 'opacity-50' : ''}">Открыть · ${cs.price} ❄</button>
        </div>`;
      }).join('') || '<p class="text-gray-400 text-sm col-span-2 text-center py-10">Кейсы появятся после запуска economy_setup.sql</p>'}
    </div>`;
}

window.ecoOpenCase = async function(caseId) {
  if (!currentUserId) return showToast('Войди!', 'error');
  if (guardBan && isBannedSelf()) return;
  if (ecoOpening) return;
  const cs = ecoCases.find(x => x.id === caseId);
  if (!cs) return;
  if ((ecoWallet.balance || 0) < cs.price) return showToast('Не хватает Айса ❄ — оценивай треки и заходи каждый день', 'error');
  ecoOpening = true;
  const { data, error } = await supabase.rpc('open_case', { p_case_id: caseId });
  ecoOpening = false;
  if (error) {
    const m = error.message || '';
    return showToast(m.includes('not_enough_coins') ? 'Не хватает Айса ❄'
      : m.includes('banned') ? 'Аккаунт заблокирован' : 'Ошибка: ' + m, 'error');
  }
  await loadEconomy();
  ecoOpenPackScene(data, cs);
};

// ---------- ФИЗИЧЕСКОЕ ВСКРЫТИЕ ПАКА (vanilla-версия pack-opening.jsx) ----------
// Сценарий: idle (парение+покачивание) → клик (зум) → отрыв края + вспышка
//           → вылет карточки → переворот (авто или клик) → панель результата
let packPhase = 'idle', packResult = null, packCase = null;
let packZoomTimer = null, packBurstTimer = null, packFlipTimer = null;

// SVG-пак с зубчатым отрывным краем: только градиенты, без картинок
function packGraphicSvg(name, price, boost) {
  const teeth = 12, w = 300, h = 46, tw = w / teeth;
  let d = `M 0 0 L ${w} 0 L ${w} ${h - tw * 0.6}`;
  for (let i = teeth; i >= 1; i--) {
    const x = i * tw;
    d += ` L ${x - tw / 2} ${h} L ${x - tw} ${h - tw * 0.6}`;
  }
  d += ' Z';
  const safeName = escapeHtml(String(name || 'Ледяной пак').toUpperCase());
  const boostText = boost > 1
    ? `<text x="150" y="352" text-anchor="middle" fill="#c084fc" font-size="11" font-weight="700">МИФИК ×${boost}</text>` : '';
  return `<svg viewBox="0 0 300 430" class="w-full h-full" style="filter:drop-shadow(0 18px 35px rgba(6,182,212,0.35))">
    <defs>
      <linearGradient id="foilBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0e7490"/><stop offset="35%" stop-color="#164e63"/>
        <stop offset="60%" stop-color="#0b2a33"/><stop offset="100%" stop-color="#020b0e"/>
      </linearGradient>
      <linearGradient id="foilTop" x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0%" stop-color="#a5f3fc"/><stop offset="45%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#0891b2"/>
      </linearGradient>
      <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="50%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="burst" cx="50%" cy="55%" r="55%">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.55"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </radialGradient>
      <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <ellipse cx="150" cy="230" rx="150" ry="185" fill="url(#burst)"/>
    <rect x="10" y="46" width="280" height="374" rx="18" fill="url(#foilBody)" stroke="#22d3ee" stroke-opacity="0.5" stroke-width="2"/>
    <g opacity="0.9">
      <circle cx="150" cy="205" r="86" fill="none" stroke="#22d3ee" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4 6"/>
      <circle cx="150" cy="205" r="64" fill="none" stroke="#a5f3fc" stroke-opacity="0.25" stroke-width="1"/>
      <g filter="url(#softGlow)" fill="#e6fdff">
        <circle cx="150" cy="205" r="46" fill="#020b0e" fill-opacity="0.55" stroke="#22d3ee" stroke-width="2"/>
        <rect x="150" y="172" width="7" height="66" rx="3"/>
        <rect x="120.5" y="201.5" width="66" height="7" rx="3"/>
        <rect x="150" y="172" width="7" height="66" rx="3" transform="rotate(45 150 205)"/>
        <rect x="150" y="172" width="7" height="66" rx="3" transform="rotate(-45 150 205)"/>
      </g>
    </g>
    <rect x="10" y="46" width="280" height="374" rx="18" fill="url(#shine)" pointer-events="none"/>
    <text x="150" y="112" text-anchor="middle" fill="#e6fdff" font-size="21" font-weight="800" font-family="Inter, system-ui, sans-serif" style="text-shadow:0 0 12px rgba(34,211,238,0.8)">${safeName}</text>
    <text x="150" y="330" text-anchor="middle" fill="#22d3ee" font-size="15" font-weight="700" font-family="Inter, system-ui, sans-serif">❄ ${price}</text>
    ${boostText}
    <text x="150" y="398" text-anchor="middle" fill="#67e8f9" fill-opacity="0.6" font-size="9" letter-spacing="3" font-family="Inter, system-ui, sans-serif">TRUEESTIMATION</text>
    <path d="${d}" fill="url(#foilTop)" stroke="#e6fdff" stroke-opacity="0.6" stroke-width="1.5"/>
    <path d="M 0 8 L 300 8" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="10 8"/>
  </svg>`;
}

// Карточка с 3D-переворотом: рубашка (паттерн ❄) → лицо (арт/эмодзи + редкость)
function packCardHtml(c, small) {
  const r = ECO_RARITY[c.rarity] || ECO_RARITY.common;
  const isUrl = c.image_url && String(c.image_url).startsWith('http');
  const emoji = (String(c.name).match(/\p{Extended_Pictographic}/u) || ['🎵'])[0];
  const art = isUrl
    ? `<img src="${escapeHtml(c.image_url)}" class="absolute inset-0 w-full h-full object-cover" draggable="false">`
    : `<div class="absolute inset-0 flex items-center justify-center text-5xl bg-white/5">${emoji}</div>`;
  return `<div class="pack-card${small ? ' pack-sm' : ''}" onclick="ecoFlipPackCard(this)">
    <div class="pack-card-inner">
      <div class="pack-face pack-back-pattern">
        <div class="absolute inset-2 rounded-lg border border-cyan-400/25 flex flex-col items-center justify-center gap-1">
          <span class="text-3xl" style="text-shadow:0 0 10px rgba(34,211,238,0.9)">❄</span>
          <span class="text-[8px] font-extrabold tracking-[0.25em] text-cyan-200/70">TRUEESTIMATION</span>
        </div>
      </div>
      <div class="pack-face pack-back" style="border:1px solid ${r.color}88;box-shadow:0 0 12px ${r.color}44">
        ${art}
        <div class="absolute inset-0" style="background:linear-gradient(to top, rgba(0,0,0,0.85), transparent 60%, rgba(0,0,0,0.3))"></div>
        <div class="absolute top-0 inset-x-0 h-1" style="background:${r.color}"></div>
        <div class="absolute bottom-0 inset-x-0 p-1.5">
          <div class="text-[10px] font-bold text-white leading-tight" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(c.name)}</div>
          <div class="text-[8px] font-extrabold" style="color:${r.color}">${r.label}</div>
        </div>
      </div>
    </div>
  </div>`;
}

// Вибрация на телефоне при эпик+ (опционально)
function ecoBuzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }

window.ecoFlipPackCard = function(el) {
  if (packPhase !== 'fan' || el.classList.contains('flipped')) return;
  if (packFlipTimer) { clearTimeout(packFlipTimer); packFlipTimer = null; }
  ecoFlipCard(el);
};

function ecoOpenPackScene(res, cs) {
  packPhase = 'idle'; packResult = res; packCase = cs;
  const modal = eco$('case-modal');
  modal.classList.remove('hidden'); modal.classList.add('flex');
  eco$('pack-hint').innerText = 'Нажми на пак, чтобы вскрыть';
  const body = eco$('pack-body');
  body.style.display = 'block';
  body.className = 'pack-idle';
  body.innerHTML = packGraphicSvg(cs.name, cs.price, cs.mythic_boost);
  const light = eco$('pack-light');
  light.classList.remove('light-burst'); light.style.opacity = '0';
  const fan = eco$('card-fan');
  fan.style.opacity = '0'; fan.style.pointerEvents = 'none'; fan.innerHTML = '';
  eco$('pack-actions').innerHTML = '<button onclick="ecoCloseCase()" class="text-gray-500 hover:text-white text-sm font-bold transition-colors">Закрыть (Esc)</button>';
  body.onclick = ecoPackClick;
}

function ecoPackClick() {
  if (packPhase !== 'idle') return;
  packPhase = 'zoom';
  const body = eco$('pack-body');
  body.classList.remove('pack-idle'); body.classList.add('pack-zoom');
  eco$('pack-hint').innerText = '';
  packZoomTimer = setTimeout(() => {
    packPhase = 'burst';
    body.classList.remove('pack-zoom'); body.classList.add('pack-burst');
    const light = eco$('pack-light');
    light.style.opacity = '1';
    void light.offsetWidth; // перезапуск CSS-анимации вспышки
    light.classList.add('light-burst');
  }, 620);
  packBurstTimer = setTimeout(() => { body.style.display = 'none'; ecoShowFan(); }, 1150);
}

function ecoShowFan() {
  packPhase = 'fan';
  const fan = eco$('card-fan');
  fan.innerHTML = packCardHtml(packResult.card, window.innerWidth < 640);
  fan.style.opacity = '1'; fan.style.pointerEvents = 'auto';
  const cardEl = fan.querySelector('.pack-card');
  cardEl.style.opacity = '0';
  cardEl.style.transform = 'translateY(60px) scale(0.25)';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    cardEl.style.transition = 'transform .6s cubic-bezier(.2,.9,.3,1.2), opacity .4s ease';
    cardEl.style.transform = 'translateY(0) scale(1)';
    cardEl.style.opacity = '1';
  }));
  // Автопереворот, если пользователь сам не кликнул
  packFlipTimer = setTimeout(() => {
    const el = fan.querySelector('.pack-card');
    if (el && !el.classList.contains('flipped')) ecoFlipCard(el);
  }, 1750);
}

function ecoFlipCard(cardEl) {
  if (!cardEl || cardEl.classList.contains('flipped')) return;
  cardEl.classList.add('flipped');
  const rar = packResult.card.rarity;
  if (rar === 'epic' || rar === 'legendary' || rar === 'mythic') {
    cardEl.classList.add('card-glow');
    ecoBuzz(rar === 'mythic' ? [40, 60, 40, 60, 120] : [35]);
  }
  setTimeout(ecoShowPackResult, 650);
}

function ecoShowPackResult() {
  const res = packResult, cs = packCase;
  eco$('pack-hint').innerText = res.duplicate ? `Дубликат → +${res.dust} ❆ пыли` : 'Твоё сегодняшнее пополнение ❄';
  eco$('pack-actions').innerHTML = `
    <button onclick="ecoOpenCase(${cs.id})" class="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-2.5 rounded-xl neon-btn transition-all active:scale-95">Ещё пак · ${cs.price} ❄</button>
    <button onclick="ecoCloseCase(); changeCategory('Collection')" class="bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl font-bold transition-colors">В коллекцию</button>`;
  if (currentCategory === 'Cases') renderCasesView();
}

window.ecoCloseCase = function() {
  [packZoomTimer, packBurstTimer, packFlipTimer].forEach(t => { if (t) clearTimeout(t); });
  packZoomTimer = packBurstTimer = packFlipTimer = null;
  packPhase = 'idle'; packResult = null; packCase = null;
  const modal = eco$('case-modal');
  modal?.classList.add('hidden'); modal?.classList.remove('flex');
};

// ---------- КОЛЛЕКЦИЯ ----------
window.ecoSetFilter = function(f) { ecoFilter = f; renderCollectionView(); };

function renderCollectionView() {
  const el = eco$('collection-inner');
  if (!el) return;
  const mine = new Map(ecoUserCards.map(x => [x.card_id, x.count]));
  const owned = ecoCards.filter(c => mine.has(c.id)).length;
  const byRar = r => ecoCards.filter(c => c.rarity === r);
  const ownedRar = r => byRar(r).filter(c => mine.has(c.id)).length;

  const filterBtn = (key, label) => `<button onclick="ecoSetFilter('${key}')"
    class="seg-btn ${ecoFilter === key ? 'active' : ''}">${label}</button>`;

  const list = ecoCards.filter(c => ecoFilter === 'all' || c.rarity === ecoFilter);
  el.innerHTML = `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight neon-text">Коллекция</h2>
        <p class="text-xs text-gray-400 mt-1">Собрано <b class="text-cyan-300">${owned} / ${ecoCards.length}</b> · пыль ❆: <b class="text-purple-300">${Number(ecoWallet.dust || 0).toLocaleString('ru-RU')}</b></p>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        ${filterBtn('all', `Все ${owned}/${ecoCards.length}`)}
        ${Object.keys(ECO_RARITY).map(r => filterBtn(r, `<span style="color:${ECO_RARITY[r].color}">${ECO_RARITY[r].label}</span> ${ownedRar(r)}/${byRar(r).length}`)).join('')}
      </div>
    </div>
    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      ${list.map(c => {
        const r = ECO_RARITY[c.rarity]; const n = mine.get(c.id);
        const craftCost = ECO_CRAFT_COST[c.rarity];
        const canCraft = !n && (ecoWallet.dust || 0) >= craftCost;
        return `<div class="rounded-2xl border ${n ? 'border-white/15' : 'border-dashed border-white/10 opacity-80'} bg-white/5 p-2 text-center flex flex-col">
          <div class="relative rounded-xl overflow-hidden" style="box-shadow:${n ? `0 0 12px ${r.color}33` : 'none'}">
            ${n
              ? `${ecoCardImg(c, 'w-full aspect-[3/4]')}${ecoCardRarityBar(c.rarity)}`
              : `<div class="w-full aspect-[3/4] bg-black/50 flex items-center justify-center text-3xl text-gray-600 font-black">?</div>`}
          </div>
          <div class="mt-1.5 text-[11px] font-bold truncate ${n ? 'text-white' : 'text-gray-500'}">${n ? escapeHtml(c.name) : '???'}</div>
          <div class="text-[9px] font-extrabold" style="color:${r.color}">${r.label}</div>
          ${n
            ? `<div class="text-[9px] text-gray-400">×${n}</div>`
            : `<button ${canCraft ? '' : 'disabled'} onclick="ecoCraft(${c.id})" title="Сколько дают за дубликат: ${ECO_DUST_GAIN[c.rarity]} ❆"
                class="mt-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${canCraft ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500 hover:text-white' : 'bg-white/5 text-gray-600 cursor-not-allowed'}">Крафт ${craftCost} ❆</button>`}
        </div>`;
      }).join('') || '<p class="text-gray-400 text-sm col-span-6 text-center py-10">Карточки появятся после запуска economy_setup.sql</p>'}
    </div>`;
}

window.ecoCraft = async function(cardId) {
  if (!currentUserId) return showToast('Войди!', 'error');
  const { data, error } = await supabase.rpc('craft_card', { p_card_id: cardId });
  if (error) {
    const m = error.message || '';
    return showToast(m.includes('not_enough_dust') ? 'Не хватает пыли ❆ (дубликаты = пыль)' : 'Ошибка: ' + m, 'error');
  }
  showToast('Создано! ✨', 'success');
  await loadEconomy();
  renderCollectionView();
};

// ---------- ПОДКЛЮЧЕНИЕ К СУЩЕСТВУЮЩЕМУ КОДУ ----------
// Оборачиваем loadData: после любой загрузки данных подтягиваем кошелёк
const _ecoLoadData = loadData;
loadData = async function() { await _ecoLoadData(); await loadEconomy(); };

// Оборачиваем updateProfileUI: обновляем ❄ в шапке и пробуем ежедневный бонус
const _ecoUpdateProfileUI = updateProfileUI;
updateProfileUI = async function() { await _ecoUpdateProfileUI(); updateCoinsUI(); if (currentUserId) tryDailyClaim(); };

// Оборачиваем renderView: наши экраны Cases / Collection
const _ecoRenderView = renderView;
renderView = function() {
  _ecoRenderView();
  const isCases = currentCategory === 'Cases';
  const isColl = currentCategory === 'Collection';
  eco$('cases-view-container')?.classList.toggle('hidden', !isCases);
  eco$('collection-view-container')?.classList.toggle('hidden', !isColl);
  if (isCases) renderCasesView();
  if (isColl) renderCollectionView();
  if (isCases || isColl) {
    ['hero-container', 'home-extras', 'list-view-container', 'comments-view-container',
     'admin-view-container', 'top-view-container', 'ranking-view-container', 'news-view-container']
      .forEach(id => document.getElementById(id)?.classList.add('hidden'));
  }
};

// Оборачиваем renderCategories: подсветка активных пунктов меню
const _ecoRenderCategories = renderCategories;
renderCategories = function() {
  _ecoRenderCategories();
  const navCls = active => 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors text-left ' +
    (active ? 'bg-white/10 text-white neon-text' : 'text-gray-300 hover:text-white hover:bg-white/10');
  eco$('nav-cases')?.setAttribute('class', navCls(currentCategory === 'Cases'));
  eco$('nav-collection')?.setAttribute('class', navCls(currentCategory === 'Collection'));
};

// Esc закрывает кейс
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ecoCloseCase();
});
