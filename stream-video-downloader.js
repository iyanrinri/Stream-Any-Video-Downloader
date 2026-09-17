// ==UserScript==
// @name         Stream Video Downloader (Overfetch & Direct Stream)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @author       iyanrinri
// @description  Catch and download stream videos directly with original headers
// @match        *://*/*
// @exclude      *://localhost/*
// @exclude      *://*whatsapp*/*
// @exclude      *://web.whatsapp.*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    let lastVideoUrl = '';

    // 1. Buat UI Tombol Floating
    const btn = document.createElement('button');
    btn.innerHTML = '📥 Download Video';
    btn.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 20px;
        z-index: 999999;
        padding: 8px 12px;
        background-color: #2563eb;
        color: #ffffff;
        font-family: sans-serif;
        font-size: 10px;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
        display: none;
    `;
    document.body.appendChild(btn);

    // 2. Fungsi untuk mendownload file menggunakan GM_xmlhttpRequest
    // Add // @grant GM_xmlhttpRequest ke metadata jika belum
    function downloadMedia(url) {
        btn.innerText = '⏳ Downloading... (0%)';
        btn.style.backgroundColor = '#d97706';
        btn.disabled = true;

        // Tentukan Referer terbaik: Domain asal / parent window
        let refererUrl = window.location.href;
        try {
            if (window.top !== window.self) {
                refererUrl = document.referrer || window.top.location.href;
            }
        } catch(e) {
            refererUrl = document.referrer || window.location.href;
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            // KUNCI 1: Sertakan Cookie browser agar tidak dianggap unauthorized
            anonymous: false,
            withCredentials: true,
            headers: {
                "Referer": refererUrl,
                "Origin": window.location.origin,
                "User-Agent": navigator.userAgent,
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Range": "bytes=0-"
            },
            responseType: "blob",
            onprogress: function(progress) {
                if (progress.lengthComputable) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    btn.innerText = `⏳ Downloading... (${percent}%)`;
                } else {
                    const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
                    btn.innerText = `⏳ Downloading... (${loadedMB} MB)`;
                }
            },
            onload: function(response) {
                if (response.status === 200 || response.status === 206) {
                    const blob = response.response;
                    const blobUrl = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = `video_${Date.now()}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(blobUrl);

                    btn.innerText = '✅ Download Selesai!';
                    btn.style.backgroundColor = '#16a34a';
                    setTimeout(resetBtn, 4000);
                } else if (response.status === 403) {
                    // KUNCI 2: Fallback jika GM_xmlhttpRequest terblokir (Buka Tab Baru / Native Download)
                    console.warn('GM_xmlhttpRequest 403, mencoba metode Fallback GM_download...');
                    fallbackDownload(url);
                } else {
                    alert('Gagal mendownload! Status HTTP: ' + response.status);
                    resetBtn();
                }
            },
            onerror: function(err) {
                console.error('Download error:', err);
                fallbackDownload(url);
            }
        });
    }

    // Fallback menggunakan native downloader Tampermonkey jika HTTP request diblokir CDN
    function fallbackDownload(url) {
        if (typeof GM_download !== 'undefined') {
            GM_download({
                url: url,
                name: `video_${Date.now()}.mp4`,
                onload: () => {
                    btn.innerText = '✅ Download Selesai!';
                    btn.style.backgroundColor = '#16a34a';
                    setTimeout(resetBtn, 4000);
                },
                onerror: (err) => {
                    alert('Gagal mendownload via GM_download. Coba buka video di tab baru.');
                    window.open(url, '_blank');
                    resetBtn();
                }
            });
        } else {
            window.open(url, '_blank');
            resetBtn();
        }
    }

    function resetBtn() {
        btn.innerText = '📥 Download Video';
        btn.style.backgroundColor = '#2563eb';
        btn.disabled = false;
    }

    // 3. Deteksi URL Video dari elemen <video> di DOM
    function findVideoSource() {
        const videoElem = document.querySelector('video');
        if (videoElem) {
            if (videoElem.src && !videoElem.src.startsWith('blob:')) {
                return videoElem.src;
            }
            const sourceElem = videoElem.querySelector('source');
            if (sourceElem && sourceElem.src && !sourceElem.src.startsWith('blob:')) {
                return sourceElem.src;
            }
        }
        return null;
    }

    // 4. Polling ringkas untuk menampilkan tombol jika ada video
    setInterval(() => {
        // Cek dulu dari URL spesifik target kamu jika match
        if (window.location.href.includes('overfetch.video')) {
            lastVideoUrl = window.location.href;
            btn.style.display = 'block';
            return;
        }

        const detectedUrl = findVideoSource();
        if (detectedUrl) {
            lastVideoUrl = detectedUrl;
            btn.style.display = 'block';
        }
    }, 1000);

    // Click handler
    btn.onclick = function() {
        // Jika sedang di halaman video langsung (seperti link mp4-01.overfetch.video/...)
        const urlToDownload = lastVideoUrl || window.location.href;
        downloadMedia(urlToDownload);
    };
})();