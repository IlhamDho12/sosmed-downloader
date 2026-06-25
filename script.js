// ========================================
// IlhamdhoSaver — Social Media Downloader
// Main Application Logic
// ========================================

(function () {
    'use strict';

    // === DOM Elements ===
    const urlInput = document.getElementById('urlInput');
    const pasteBtn = document.getElementById('pasteBtn');
    const formatVideo = document.getElementById('formatVideo');
    const formatAudio = document.getElementById('formatAudio');
    const qualitySelector = document.getElementById('qualitySelector');
    const audioQualitySelector = document.getElementById('audioQualitySelector');
    const qualitySelect = document.getElementById('qualitySelect');
    const audioQualitySelect = document.getElementById('audioQualitySelect');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusContainer = document.getElementById('statusContainer');
    const statusCard = document.getElementById('statusCard');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const resultCard = document.getElementById('resultCard');
    const resultTitle = document.getElementById('resultTitle');
    const resultMeta = document.getElementById('resultMeta');
    const resultThumb = document.getElementById('resultThumb');
    const resultDownloadLink = document.getElementById('resultDownloadLink');
    const resultTip = document.getElementById('resultTip');
    const navbar = document.getElementById('navbar');
    const commentForm = document.getElementById('commentForm');
    const commentName = document.getElementById('commentName');
    const commentText = document.getElementById('commentText');
    const commentsList = document.getElementById('commentsList');

    // === State ===
    let currentFormat = 'video'; // 'video' | 'audio'
    let isProcessing = false;

    // === Cobalt API Instances (Community, sorted by reliability) ===
    // These are open community instances from cobalt.directory that don't require auth.
    // We use multiple instances as fallback for reliability.
    const API_INSTANCES = [
        'https://fox.kittycat.boo',
        'https://dog.kittycat.boo',
        'https://cobaltapi.kittycat.boo',
        'https://rue-cobalt.xenon.zone',
        'https://api.cobalt.liubquanti.click',
        'https://api.cobalt.blackcat.sweeux.org',
        'https://cobaltapi.cjs.nz',
    ];

    // Track which instance is currently working best
    let currentInstanceIndex = 0;

    // === Platform Detection ===
    const PLATFORMS = {
        youtube: {
            name: 'YouTube',
            patterns: [
                /youtube\.com/,
                /youtu\.be/,
            ],
        },
        tiktok: {
            name: 'TikTok',
            patterns: [
                /tiktok\.com/,
            ],
        },
        instagram: {
            name: 'Instagram',
            patterns: [
                /instagram\.com/,
            ],
        },
        twitter: {
            name: 'X / Twitter',
            patterns: [
                /twitter\.com/,
                /x\.com/,
            ],
        },
        facebook: {
            name: 'Facebook',
            patterns: [
                /facebook\.com/,
                /fb\.watch/,
                /fb\.com/,
            ],
        },
        reddit: {
            name: 'Reddit',
            patterns: [
                /reddit\.com/,
            ],
        },
    };

    // === Utility Functions ===

    function detectPlatform(url) {
        for (const [key, platform] of Object.entries(PLATFORMS)) {
            for (const pattern of platform.patterns) {
                if (pattern.test(url)) {
                    return { id: key, name: platform.name };
                }
            }
        }
        return null;
    }

    function isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    function showStatus(message, type = 'info') {
        statusContainer.style.display = 'block';
        statusCard.className = `status-card ${type}`;

        const icons = {
            error: '❌',
            success: '✅',
            info: 'ℹ️',
        };

        statusIcon.textContent = icons[type] || 'ℹ️';
        statusText.textContent = message;

        // Auto-hide after 8 seconds for non-error
        if (type !== 'error') {
            setTimeout(() => {
                statusContainer.style.display = 'none';
            }, 8000);
        }
    }

    function hideStatus() {
        statusContainer.style.display = 'none';
    }

    function setLoading(loading) {
        isProcessing = loading;
        downloadBtn.classList.toggle('loading', loading);

        const dlIcon = downloadBtn.querySelector('.dl-icon');
        const dlText = downloadBtn.querySelector('.dl-text');
        const dlLoader = downloadBtn.querySelector('.dl-loader');

        if (loading) {
            dlIcon.style.display = 'none';
            dlText.style.display = 'none';
            dlLoader.style.display = 'flex';
        } else {
            dlIcon.style.display = 'block';
            dlText.style.display = 'block';
            dlLoader.style.display = 'none';
        }
    }

    function showResult(data) {
        resultCard.style.display = 'block';

        resultTitle.textContent = data.title || 'Media dari Sosial Media';
        resultMeta.textContent = data.meta || '';

        // Set thumbnail safely to prevent DOM XSS
        if (data.thumb) {
            resultThumb.innerHTML = '';
            const img = document.createElement('img');
            img.alt = 'Thumbnail';
            img.src = data.thumb;
            img.onerror = () => {
                resultThumb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="4"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`;
            };
            resultThumb.appendChild(img);
        }

        // Validate URL schema to prevent javascript: or data: URI injection
        const downloadUrl = data.url || '#';
        if (downloadUrl.startsWith('http://') || downloadUrl.startsWith('https://') || downloadUrl.startsWith('blob:')) {
            resultDownloadLink.href = downloadUrl;
        } else {
            resultDownloadLink.href = '#';
        }
        resultDownloadLink.setAttribute('download', '');

        // Show mobile tips if on mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            resultTip.style.display = 'block';
        } else {
            resultTip.style.display = 'none';
        }
    }

    function hideResult() {
        resultCard.style.display = 'none';
        resultTip.style.display = 'none';
    }

    // === Try a single Cobalt instance ===
    async function tryInstance(apiUrl, requestBody) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

        try {
            const response = await fetch(`${apiUrl}/`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errorBody}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }

    // === API Call with Fallback ===
    async function processDownload(url) {
        if (isProcessing) return;

        hideStatus();
        hideResult();

        // Validate URL
        if (!url || !url.trim()) {
            showStatus('Silakan masukkan link video terlebih dahulu.', 'error');
            urlInput.focus();
            return;
        }

        if (!isValidUrl(url.trim())) {
            showStatus('Link yang dimasukkan tidak valid. Pastikan dimulai dengan http:// atau https://', 'error');
            return;
        }

        const platform = detectPlatform(url.trim());
        if (!platform) {
            showStatus('Platform tidak didukung. Coba link dari YouTube, TikTok, Instagram, Twitter, Facebook, atau Reddit.', 'error');
            return;
        }

        setLoading(true);
        showStatus(`Memproses link dari ${platform.name}...`, 'info');

        // Build request body for cobalt API
        const requestBody = {
            url: url.trim(),
            downloadMode: currentFormat === 'audio' ? 'audio' : 'auto',
            filenameStyle: 'pretty',
        };

        // Add quality settings
        if (currentFormat === 'video') {
            requestBody.videoQuality = qualitySelect.value;
        } else {
            requestBody.audioFormat = 'mp3';
            requestBody.audioBitrate = audioQualitySelect.value;
        }

        // Try instances with fallback
        let lastError = null;
        const startIndex = currentInstanceIndex;

        for (let attempt = 0; attempt < API_INSTANCES.length; attempt++) {
            const instanceIndex = (startIndex + attempt) % API_INSTANCES.length;
            const apiUrl = API_INSTANCES[instanceIndex];

            try {
                showStatus(`Memproses dari ${platform.name}... (server ${attempt + 1})`, 'info');

                const data = await tryInstance(apiUrl, requestBody);

                if (data.status === 'error') {
                    const errCode = data.error?.code || data.error || 'unknown';
                    // If it's a content error (not server error), don't try other instances
                    if (errCode.includes('content.') || errCode.includes('link.') || errCode.includes('fetch.empty')) {
                        throw new ContentError(translateError(errCode));
                    }
                    throw new Error(errCode);
                }

                // Success! Remember this working instance for next time
                currentInstanceIndex = instanceIndex;

                if (data.status === 'redirect' || data.status === 'tunnel' || data.status === 'stream') {
                    const downloadUrl = data.url;
                    if (!downloadUrl) {
                        throw new Error('Tidak ada URL download yang ditemukan.');
                    }

                    hideStatus();
                    showResult({
                        title: data.filename || `${currentFormat === 'audio' ? 'Audio' : 'Video'} dari ${platform.name}`,
                        meta: `${platform.name} • ${currentFormat === 'video' ? qualitySelect.value + 'p' : audioQualitySelect.value + 'kbps'} • ${currentFormat.toUpperCase()}`,
                        thumb: data.thumbnail || null,
                        url: downloadUrl,
                    });

                    showStatus('Berhasil! Klik tombol "Simpan File" di bawah. Suka dengan IlhamdhoSaver? Tolong berikan rating & komentar di bawah ya! ⭐', 'success');
                    setLoading(false);
                    return;

                } else if (data.status === 'picker') {
                    // Multiple options available (e.g. Instagram carousel)
                    const firstPick = data.picker?.[0];
                    if (firstPick?.url) {
                        hideStatus();
                        showResult({
                            title: `Media dari ${platform.name}`,
                            meta: `${platform.name} • ${currentFormat.toUpperCase()}`,
                            thumb: firstPick.thumb || data.picker?.[0]?.thumb || null,
                            url: firstPick.url,
                        });
                        showStatus('Berhasil! Klik tombol "Simpan File" di bawah. Suka dengan IlhamdhoSaver? Tolong berikan rating & komentar di bawah ya! ⭐', 'success');
                        setLoading(false);
                        return;
                    } else {
                        throw new Error('Format media tidak didukung.');
                    }
                } else {
                    throw new Error('Respons tidak dikenali dari server.');
                }

            } catch (error) {
                lastError = error;

                // If it's a content-level error, stop trying other servers
                if (error instanceof ContentError) {
                    break;
                }

                console.warn(`Instance ${apiUrl} failed:`, error.message);
                // Continue to next instance
            }
        }

        // All instances failed
        const errorMessage = getFriendlyErrorMessage(lastError);

        showStatus(errorMessage, 'error');
        hideResult();
        setLoading(false);
    }

    // Custom error class for content-level errors (no need to retry other servers)
    class ContentError extends Error {
        constructor(message) {
            super(message);
            this.name = 'ContentError';
        }
    }

    // Get a friendly Indonesian error message from any error object
    function getFriendlyErrorMessage(error) {
        if (!error) return 'Terjadi kesalahan yang tidak diketahui. Coba lagi nanti.';

        if (error instanceof ContentError) {
            return error.message;
        }

        if (error.name === 'AbortError') {
            return 'Server terlalu lambat merespons. Coba lagi nanti atau gunakan kualitas yang lebih rendah.';
        }

        const msg = error.message || '';
        
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('TypeError')) {
            return 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu atau coba lagi nanti.';
        }

        // Check if the error is an HTTP error containing JSON
        if (msg.startsWith('HTTP ')) {
            try {
                const jsonStr = msg.substring(msg.indexOf('{'));
                const errJson = JSON.parse(jsonStr);
                const code = errJson.error?.code || errJson.error || '';
                return translateError(code);
            } catch (e) {
                // fall through
            }
        }

        return translateError(msg);
    }

    // Translate cobalt error codes to friendly Indonesian messages
    function translateError(code) {
        if (!code) return 'Terjadi kesalahan yang tidak diketahui.';

        const translations = {
            'error.api.fetch.empty': 'Konten ini tidak tersedia, sudah dihapus, atau bersifat private.',
            'error.api.fetch.fail': 'Gagal mengambil data dari platform. Coba lagi nanti.',
            'error.api.fetch.rate': 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
            'error.api.content.video.unavailable': 'Video ini tidak tersedia atau sudah dihapus.',
            'error.api.content.video.live': 'Live stream tidak bisa didownload.',
            'error.api.content.video.private': 'Video ini bersifat private dan tidak bisa didownload.',
            'error.api.content.video.age': 'Video ini memiliki batasan usia.',
            'error.api.content.post.unavailable': 'Konten ini tidak tersedia atau sudah dihapus.',
            'error.api.content.post.private': 'Konten ini bersifat private.',
            'error.api.link.unsupported': 'Link ini tidak didukung.',
            'error.api.youtube.login': 'YouTube memerlukan login untuk video ini. Coba video lain.',
            'error.api.youtube.decipher': 'Gagal memproses video YouTube. Coba lagi nanti.',
            'error.api.auth.jwt.missing': 'Server ini memerlukan autentikasi JWT (login/API key).',
        };

        // Check for exact matches first
        if (translations[code]) {
            return translations[code];
        }

        // Check for partial matches
        for (const [key, msg] of Object.entries(translations)) {
            if (code.includes(key.replace('error.api.', '')) || code.includes(key)) {
                return msg;
            }
        }

        // If it's already a friendly message
        if (code.includes(' ') || code.length > 50) {
            return code;
        }

        return `Terjadi kesalahan: ${code}`;
    }

    // === Event Listeners ===

    // Paste button
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
            urlInput.focus();

            // Visual feedback
            pasteBtn.style.color = '#22c55e';
            setTimeout(() => {
                pasteBtn.style.color = '';
            }, 1000);
        } catch {
            showStatus('Tidak dapat mengakses clipboard. Silakan tempel secara manual (Ctrl+V).', 'error');
        }
    });

    // Format toggle
    formatVideo.addEventListener('click', () => {
        currentFormat = 'video';
        formatVideo.classList.add('active');
        formatAudio.classList.remove('active');
        qualitySelector.style.display = 'block';
        audioQualitySelector.style.display = 'none';
    });

    formatAudio.addEventListener('click', () => {
        currentFormat = 'audio';
        formatAudio.classList.add('active');
        formatVideo.classList.remove('active');
        qualitySelector.style.display = 'none';
        audioQualitySelector.style.display = 'block';
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        processDownload(urlInput.value);
    });

    // Save File Button click handler (to fetch blob and force direct download without new tab)
    resultDownloadLink.addEventListener('click', async (e) => {
        const downloadUrl = resultDownloadLink.href;
        if (!downloadUrl || downloadUrl === '#' || downloadUrl.startsWith('javascript:')) {
            e.preventDefault();
            return;
        }

        // If it's already a blob URL, let it download normally (same-origin, so no new tab)
        if (downloadUrl.startsWith('blob:')) {
            return;
        }

        e.preventDefault();

        // Visual feedback - disable pointer events and opacity
        resultDownloadLink.style.pointerEvents = 'none';
        resultDownloadLink.style.opacity = '0.7';
        const originalContent = resultDownloadLink.innerHTML;

        try {
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            // Get total length from headers
            const totalBytes = parseInt(response.headers.get('Estimated-Content-Length') || response.headers.get('Content-Length') || '0', 10);
            
            // Check if file is too large for mobile RAM (e.g. > 25MB)
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile && totalBytes > 25 * 1024 * 1024) {
                console.log(`File size (${(totalBytes / 1024 / 1024).toFixed(1)}MB) is too large for mobile memory download. Redirecting.`);
                // Reset button immediately
                resultDownloadLink.innerHTML = originalContent;
                resultDownloadLink.style.pointerEvents = 'auto';
                resultDownloadLink.style.opacity = '1';
                
                // Fallback to direct navigation
                window.location.href = downloadUrl;
                return;
            }

            const reader = response.body.getReader();
            let receivedBytes = 0;
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedBytes += value.length;

                if (totalBytes > 0) {
                    const percent = Math.round((receivedBytes / totalBytes) * 100);
                    resultDownloadLink.querySelector('span').textContent = `Mengunduh: ${percent}%`;
                } else {
                    const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
                    resultDownloadLink.querySelector('span').textContent = `Mengunduh: ${mb} MB`;
                }
            }

            // Create blob and local object URL
            const blob = new Blob(chunks);
            const blobUrl = URL.createObjectURL(blob);
            
            // Extract filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition') || '';
            let filename = '';
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            } else {
                filename = resultTitle.textContent + (currentFormat === 'audio' ? '.mp3' : '.mp4');
            }

            // Trigger download using a temporary anchor tag
            const tempLink = document.createElement('a');
            tempLink.href = blobUrl;
            tempLink.download = filename;
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);

            // Reset button to original state
            resultDownloadLink.innerHTML = originalContent;
            resultDownloadLink.style.pointerEvents = 'auto';
            resultDownloadLink.style.opacity = '1';

            // Show comment reminder status
            showStatus('Unduhan selesai! Suka dengan IlhamdhoSaver? Jangan lupa berikan rating & komentar Anda di kolom ulasan di bawah ya! ❤️', 'success');

            // Automatically scroll to comments section after a short delay
            setTimeout(() => {
                const target = document.getElementById('comments');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }, 1200);

            // Clean up blob URL after a short delay
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

        } catch (error) {
            console.error('Blob download failed, falling back to direct navigation:', error);
            // Reset button
            resultDownloadLink.innerHTML = originalContent;
            resultDownloadLink.style.pointerEvents = 'auto';
            resultDownloadLink.style.opacity = '1';

            // Show comment reminder status for fallback download
            showStatus('Memulai unduhan... Suka dengan IlhamdhoSaver? Tolong berikan ulasan & komentar Anda di kolom di bawah ya! ❤️', 'success');

            // Automatically scroll to comments section after a short delay
            setTimeout(() => {
                const target = document.getElementById('comments');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }, 1200);

            // Fallback: Open in the same window (direct fallback)
            window.location.href = downloadUrl;
        }
    });

    // Enter key on input
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            processDownload(urlInput.value);
        }
    });

    // Clear status when typing
    urlInput.addEventListener('input', () => {
        hideStatus();
        hideResult();
    });

    // Navbar scroll effect
    let lastScrollY = 0;
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        navbar.classList.toggle('scrolled', scrollY > 20);
        lastScrollY = scrollY;
    }, { passive: true });

    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Add fade-in class to animatable elements
    document.querySelectorAll('.feature-card, .platform-card, .step-card, .faq-item').forEach((el, i) => {
        el.classList.add('fade-in');
        el.style.transitionDelay = `${i * 0.05}s`;
        observer.observe(el);
    });

    // === Smooth anchor scroll ===
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // Jika href sudah berubah (bukan jangkar lokal diawali '#') atau hanya '#', biarkan aksi bawaan browser berjalan
            if (!href || !href.startsWith('#') || href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // === Comments & Reviews System ===
    const defaultComments = [
        {
            name: "Rian Hidayat",
            rating: 5,
            text: "Keren banget IlhamdhoSaver! Download video YouTube FHD 1080p cepet banget prosesnya dan yang paling penting ga ada iklannya sama sekali. Sukses terus!",
            date: "2026-06-25 15:30"
        },
        {
            name: "Siti Rahma",
            rating: 5,
            text: "Akhirnya nemu downloader sosmed yang clean dan ga ribet. Tampilannya modern, pas banget dipake di HP Android saya langsung keliatan semua fiturnya.",
            date: "2026-06-24 10:15"
        },
        {
            name: "Budi Santoso",
            rating: 4,
            text: "Sangat membantu buat download reels Instagram dan video TikTok tanpa watermark. Tombol simpan langsung unduh di latar belakang top markotop!",
            date: "2026-06-23 18:45"
        }
    ];

    // Load comments from localStorage or fallback to default
    let comments = [];
    try {
        const stored = localStorage.getItem('ilhamdhosaver_comments');
        if (stored) {
            comments = JSON.parse(stored);
        } else {
            comments = [...defaultComments];
            localStorage.setItem('ilhamdhosaver_comments', JSON.stringify(comments));
        }
    } catch (e) {
        console.warn('Failed to load comments from localStorage, using defaults.', e);
        comments = [...defaultComments];
    }

    // Function to render comments
    function renderComments() {
        if (!commentsList) return;
        commentsList.innerHTML = '';

        comments.forEach(comment => {
            const card = document.createElement('div');
            card.className = 'comment-card';

            // Get initials for avatar and sanitize to alphanumeric only to prevent HTML markup breakage
            let initials = 'U';
            if (comment.name) {
                const parts = comment.name.trim().split(/\s+/);
                const rawInitials = parts.map(n => n[0]).join('').substring(0, 2).toUpperCase();
                initials = rawInitials.replace(/[^A-Z0-9]/g, '') || 'U';
            }

            // Generate stars HTML
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                starsHtml += i <= comment.rating ? '★' : '☆';
            }

            card.innerHTML = `
                <div class="comment-avatar">${initials}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-name">${escapeHTML(comment.name)}</span>
                        <div class="comment-meta">
                            <span class="comment-stars">${starsHtml}</span>
                            <span class="comment-date">${comment.date}</span>
                        </div>
                    </div>
                    <p class="comment-body">${escapeHTML(comment.text)}</p>
                </div>
            `;
            commentsList.appendChild(card);
        });
    }

    // Escape HTML helper to prevent XSS in comments
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // Submit comment form handler
    if (commentForm) {
        commentForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const nameVal = commentName.value.trim();
            const textVal = commentText.value.trim();
            
            // Get selected rating
            const selectedRatingEl = commentForm.querySelector('input[name="rating"]:checked');
            const ratingVal = selectedRatingEl ? parseInt(selectedRatingEl.value, 10) : 5;

            if (!nameVal || !textVal) return;

            // Form date string format: YYYY-MM-DD HH:MM
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            const newComment = {
                name: nameVal,
                rating: ratingVal,
                text: textVal,
                date: dateStr
            };

            // Prepend new comment to list
            comments.unshift(newComment);

            // Save to localStorage
            try {
                localStorage.setItem('ilhamdhosaver_comments', JSON.stringify(comments));
            } catch (err) {
                console.error('Failed to save comment to localStorage', err);
            }

            // Render and reset form
            renderComments();
            commentForm.reset();

            // Reset stars rating to 5
            const star5 = document.getElementById('star-5');
            if (star5) star5.checked = true;

            // Show confirmation toast/status
            showStatus('Komentar Anda berhasil dipublikasikan! Terima kasih.', 'success');
        });
    }

    // Render initial comments
    renderComments();

    // === Keyboard Accessibility ===
    urlInput.setAttribute('aria-label', 'Masukkan URL video dari sosial media');
    downloadBtn.setAttribute('aria-label', 'Download video atau audio');

    console.log('🚀 IlhamdhoSaver initialized successfully');
    console.log(`📡 ${API_INSTANCES.length} API instances configured for fallback`);
})();
