// Global Firebase bağlamı
if (!window.FIREBASE_CONTEXT) {
    window.FIREBASE_CONTEXT = {
        initialized: false,
        app: null,
        database: null,
        auth: null,
        sessionId: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        initializationCallbacks: []
    };
}

// Script dosyasını dinamik olarak yükle
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(src);
        script.onload = () => resolve();
        script.onerror = (error) => reject(error);
        (document.head || document.documentElement).appendChild(script);
    });
}

// Firebase ile ilgili bir işlem yapılmak istendiğinde çağrılacak
function withFirebase(callback) {
    if (window.FIREBASE_CONTEXT.initialized) {
        // Firebase zaten başlatıldıysa hemen çalıştır
        callback(window.FIREBASE_CONTEXT);
    } else {
        // Değilse sıraya ekle
        window.FIREBASE_CONTEXT.initializationCallbacks.push(callback);
        
        // Firebase başlatma işlemini başlat (eğer başlatılmamışsa)
        if (!window.FIREBASE_CONTEXT.initializing) {
            window.FIREBASE_CONTEXT.initializing = true;
            
            // Firebase var mı diye kontrol et
            if (typeof firebase !== 'undefined') {
                initializeFirebase();
            } else {
                // Yoksa mesaj gönder
                chrome.runtime.sendMessage({ action: "needFirebase" });
            }
        }
    }
}

// Firebase'i başlat
function initializeFirebase() {
    // Zaten başlatılmışsa çık
    if (window.FIREBASE_CONTEXT.initialized) {
        console.log("Firebase zaten başlatılmış, işlem iptal edildi.");
        return;
    }

    // Başlatılıyorsa çık
    if (window.FIREBASE_CONTEXT.initializing) {
        console.log("Firebase zaten başlatılıyor, işlem iptal edildi.");
        return;
    }

    try {
        console.log("Firebase başlatılıyor...");
        window.FIREBASE_CONTEXT.initializing = true;

        // Firebase tanımlı değilse bekle
        if (typeof firebase === 'undefined') {
            console.log("Firebase henüz yüklenmemiş, mesaj gönderiliyor...");
            chrome.runtime.sendMessage({ action: "needFirebase" });
            return;
        }

        // Zaten bir Firebase uygulaması varsa, mevcut uygulamayı kullan
        if (firebase.apps.length > 0) {
            console.log("Mevcut Firebase uygulaması kullanılıyor...");
            window.FIREBASE_CONTEXT.app = firebase.app();
            window.FIREBASE_CONTEXT.database = firebase.database();
            window.FIREBASE_CONTEXT.auth = firebase.auth();
            completeInitialization();
            return;
        }

        // Firebase yapılandırmasını getir
        let config;
        if (window.firebaseConfig) {
            config = window.firebaseConfig;
        } else {
            // firebaseConfig yüklü değilse yüklenmesini bekle
            console.log("Firebase yapılandırması bulunamadı, yüklenmeyi bekliyoruz...");
            loadScript("firebaseConfig.js").then(() => {
                initializeFirebase();
            }).catch(error => {
                console.error("firebaseConfig.js yüklenemedi:", error);
            });
            return;
        }

        // Zaten Firebase uygulaması varsa onu kullan, yoksa yeni başlat
        window.FIREBASE_CONTEXT.app = firebase.apps.length === 0 
            ? firebase.initializeApp(config) 
            : firebase.app();
        
        window.FIREBASE_CONTEXT.database = firebase.database();
        window.FIREBASE_CONTEXT.auth = firebase.auth();

// Anonim giriş yap
        window.FIREBASE_CONTEXT.auth.signInAnonymously()
    .then(() => {
        console.log("Anonim olarak giriş yapıldı.");
                
        // Firebase başarıyla başlatıldı
        window.FIREBASE_CONTEXT.initialized = true;
        window.FIREBASE_CONTEXT.initializing = false;
        
        // Chrome oturumunu kaydet
        registerChromeSession();
        
        // Video dinleyicilerini ekle
        addVideoListeners();
        setupCleanupListeners();
        
        // Firebase dinleyicilerini ekle
        setupFirebaseListeners();
        
        // Kayıtlı callback'leri çalıştır
        window.FIREBASE_CONTEXT.initializationCallbacks.forEach(callback => {
            try {
                callback(window.FIREBASE_CONTEXT);
            } catch (e) {
                console.error("Callback çalıştırılırken hata:", e);
            }
        });
        
        // Callback listesini temizle
        window.FIREBASE_CONTEXT.initializationCallbacks = [];
    })
    .catch((error) => {
        console.error("Giriş hatası:", error);
        window.FIREBASE_CONTEXT.initializing = false;
    });
    } catch (error) {
        console.error("Firebase başlatma hatası:", error);
        window.FIREBASE_CONTEXT.initializing = false;
        
        // Hata durumunda 3 saniye sonra tekrar dene
        setTimeout(initializeFirebase, 3000);
    }
}

// Firebase başlatma işlemini tamamla
function completeInitialization() {
    window.FIREBASE_CONTEXT.initialized = true;
    window.FIREBASE_CONTEXT.initializing = false;
    
    // Chrome oturumunu kaydet
    registerChromeSession();
    
    // Video dinleyicilerini ekle
    addVideoListeners();
    setupCleanupListeners();
    
    // Firebase dinleyicilerini ekle
    setupFirebaseListeners();
    
    // Kayıtlı callback'leri çalıştır
    while (window.FIREBASE_CONTEXT.initializationCallbacks.length > 0) {
        const callback = window.FIREBASE_CONTEXT.initializationCallbacks.shift();
        try {
            callback(window.FIREBASE_CONTEXT);
        } catch (e) {
            console.error("Callback çalıştırılırken hata:", e);
        }
    }
    
    console.log("Firebase başarıyla başlatıldı!");
}

// Firebase dinleyicilerini ekle - güncelleme
function setupFirebaseListeners() {
    withFirebase((firebase) => {
        const videoUrl = window.location.href;
        
        // Önce eski dinleyicileri temizle
        removeFirebaseListeners();
        
        if (videoUrl.includes("music.youtube.com")) {
            // Mevcut şarkı başlığını al ve dinleyiciyi ekle
            getCurrentMusicTitle().then(title => {
                if (title) {
                    console.log("Music dinleyicisi ekleniyor:", title);
                    const musicId = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    const musicRef = firebase.database.ref(`musicTracks/${musicId}`);
                    
                    // Dinleyiciyi sakla
                    window.currentMusicRef = musicRef;
                    window.currentMusicId = musicId;
                    
                    // Dinleyiciyi ekle
                    musicRef.on('value', (snapshot) => {
                        const data = snapshot.val();
                        if (data && data.status) {
                            console.log("Music komutu alındı:", data.status);
                            if (data.status === "play" || data.status === "pause") {
                                handlePlayPauseCommand(data.status);
                            } else {
                                handleMusicCommand(data.status);
                            }
                        }
                    });
                    
                    // İlk durumu güncelle
                    const video = document.querySelector("video");
                    if (video) {
                        sendVideoInfo();
                    }
                }
            });
        } else if (videoUrl.includes("youtube.com")) {
            // YouTube için mevcut kod aynı kalacak
            const videoId = getVideoId(videoUrl);
            if (videoId) {
                window.currentVideoId = videoId; // Mevcut video ID'sini sakla
                const videoRef = firebase.database.ref(`youtubeVideos/${videoId}`);
                videoRef.on('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        if (data.status) {
                            if (data.status === "play" || data.status === "pause") {
                                handlePlayPauseCommand(data.status);
                            } else {
                                handleYoutubeCommand(data.status);
                            }
                        }
                    }
                });
            }
        }
    });
}

// Firebase dinleyicilerini kaldır - yeni fonksiyon
function removeFirebaseListeners() {
    withFirebase((firebase) => {
        // Music dinleyicisini kaldır
        if (window.currentMusicRef) {
            window.currentMusicRef.off();
            // Eski şarkı verisini temizle
            if (window.currentMusicId) {
                const oldMusicRef = firebase.database.ref(`musicTracks/${window.currentMusicId}`);
                oldMusicRef.remove();
                console.log("Eski müzik verisi silindi:", window.currentMusicId);
            }
        }
        
        // YouTube video dinleyicisini kaldır
        if (window.currentVideoRef) {
            window.currentVideoRef.off();
        }
    });
}

// Ses değişikliğini işle
// function handleVolumeChange(volume) {
//     try {
//         const video = document.querySelector("video");
//         if (video) {
//             // Volume değeri 0-1 arasında olmalı
//             const normalizedVolume = Math.min(Math.max(volume / 100, 0), 1);
//             video.volume = normalizedVolume;
//             console.log("Ses seviyesi güncellendi:", volume);
//         }
//     } catch (error) {
//         console.error("Ses seviyesi güncellenirken hata:", error);
//     }
// }

// Debounce fonksiyonu ekle
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// YouTube Music komutlarını işle - güncelleme
async function handleMusicCommand(status) {
    try {
        // Eğer son komut üzerinden 1 saniye geçmediyse işlemi iptal et
        if (window.lastCommandTime && Date.now() - window.lastCommandTime < 1000) {
            console.log("Komut çok hızlı tekrarlandı, işlem iptal edildi");
            return;
        }
        
        window.lastCommandTime = Date.now();
        
        if (status === "next" || status === "previous") {
            // Şarkı değişikliği için flag'leri ayarla
            window.skipStatusUpdate = true;
            window.musicCommandInProgress = true;
            
            const buttonSelector = status === "next" ? '.next-button' : '.previous-button';
            const button = document.querySelector(buttonSelector);
            
            if (button) {
                console.log(`${status} komutu işleniyor...`);
                button.click();
                
                // Şarkı değişikliğini bekle ve yeni şarkının yüklenmesini kontrol et
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Şarkı değişikliğini doğrula
                const checkSongChange = async () => {
                    const newTitle = await getCurrentMusicTitle();
                    if (newTitle && newTitle !== window.oldMusicTitle) {
                        console.log("Yeni şarkı tespit edildi:", newTitle);
                        window.musicCommandInProgress = false;
                        return true;
                    }
                    return false;
                };
                
                // Maksimum 5 saniye boyunca şarkı değişikliğini bekle
                let attempts = 0;
                while (attempts < 10) {
                    if (await checkSongChange()) break;
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }
                
                // Timeout sonrası flag'leri temizle
                setTimeout(() => {
                    window.skipStatusUpdate = false;
                    window.musicCommandInProgress = false;
                }, 1000);
            }
        }
    } catch (error) {
        console.error("Music komutu işlenirken hata:", error);
        // Hata durumunda flag'leri sıfırla
        window.skipStatusUpdate = false;
        window.musicCommandInProgress = false;
    }
}

// YouTube komutlarını işle
async function handleYoutubeCommand(status) {
    try {
        if (status === "next") {
            // Sonraki video butonunu bul ve tıkla
            const nextButton = document.querySelector('.ytp-next-button');
            if (nextButton) {
                nextButton.click();
                // Status'u playing olarak güncelle
                await updateYoutubeStatus("playing");
            }
        } else if (status === "previous") {
            // Önceki video butonunu bul ve tıkla
            const prevButton = document.querySelector('.ytp-prev-button');
            if (prevButton) {
                prevButton.click();
                // Status'u playing olarak güncelle
                await updateYoutubeStatus("playing");
            }
        }
    } catch (error) {
        console.error("YouTube komutu işlenirken hata:", error);
    }
}

// Music status'unu güncelle
async function updateMusicStatus(status) {
    withFirebase(async (firebase) => {
        try {
            const title = await getCurrentMusicTitle();
            if (title) {
                const musicId = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                const dbRef = firebase.database.ref(`musicTracks/${musicId}`);
                const snapshot = await dbRef.get();
                const currentData = snapshot.val() || {};
                
                await dbRef.update({
                    ...currentData,
                    status: status,
                    timestamp: getIstanbulTimestamp()
                });
            }
        } catch (error) {
            console.error("Music status güncellenirken hata:", error);
        }
    });
}

// YouTube status'unu güncelle
async function updateYoutubeStatus(status) {
    withFirebase(async (firebase) => {
        try {
            const videoId = getVideoId(window.location.href);
            if (videoId) {
                const dbRef = firebase.database.ref(`youtubeVideos/${videoId}`);
                const snapshot = await dbRef.get();
                const currentData = snapshot.val() || {};
                
                // Mevcut ses seviyesini koru
                const video = document.querySelector("video");
                // const currentVolume = video ? Math.round(video.volume * 100) : undefined;
                
                await dbRef.update({
                    ...currentData,
                    status: status,
                    // volume: currentVolume, // Ses seviyesini ekle
                    timestamp: getIstanbulTimestamp()
                });
            }
        } catch (error) {
            console.error("YouTube status güncellenirken hata:", error);
        }
    });
}

// Chrome oturumunu veritabanına kaydet - güncelleme
function registerChromeSession() {
    withFirebase(async (firebase) => {
        try {
            // Chrome oturumunu veritabanına kaydet
            const sessionRef = firebase.database.ref(`sessions/${firebase.sessionId}`);
            await sessionRef.set({
                timestamp: getIstanbulTimestamp(),
                status: 'active'
            });

            // Mevcut video/müzik verisi için onDisconnect ayarla
            setupDisconnectCleanup(firebase);
            
            // Chrome kapatıldığında temizleme yapacak onunload işleyicisi ekle
            window.addEventListener('beforeunload', () => {
                cleanupTabData();
                clearAllData();
            });
            
            // Database temizleme işlemi için persistence ekle
            sessionRef.onDisconnect().remove();
            
            console.log("Chrome oturumu kaydedildi:", firebase.sessionId);
        } catch (error) {
            console.error("Chrome oturumu kaydedilirken hata:", error);
        }
    });
}

// Bağlantı koptuğunda temizlenecek verileri ayarla
function setupDisconnectCleanup(firebase) {
    try {
        const videoUrl = window.location.href;
        
        // YouTube videosu için
        if (videoUrl.includes("youtube.com") && !videoUrl.includes("music.youtube.com")) {
            const videoId = getVideoId(videoUrl);
            if (videoId) {
                const videoRef = firebase.database.ref(`youtubeVideos/${videoId}`);
                videoRef.onDisconnect().remove();
            }
        }
        
        // YouTube Music için
        if (videoUrl.includes("music.youtube.com")) {
            getCurrentMusicTitle().then(title => {
                if (title) {
                    const musicId = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    const musicRef = firebase.database.ref(`musicTracks/${musicId}`);
                    musicRef.onDisconnect().remove();
                }
            });
        }
    } catch (error) {
        console.error("Disconnect cleanup ayarlanırken hata:", error);
    }
}

// Video/müzik değiştiğinde onDisconnect'i güncelle
function updateDisconnectCleanup() {
    withFirebase((firebase) => {
        setupDisconnectCleanup(firebase);
    });
}

// Temizleme dinleyicilerini ekle
function setupCleanupListeners() {
    // Sekme kapatıldığında temizleme yap
    window.addEventListener('beforeunload', () => {
        console.log("Sekme kapatılıyor, veriler temizleniyor...");
        cleanupTabData();
    });
    
    // Video değiştiğinde eski verileri temizle
    setupVideoChangeObserver();
}

// Video içeriği değişimini izle - güncelleme
function setupVideoChangeObserver() {
    window.oldVideoId = null;
    window.oldMusicTitle = null;
    window.lastUpdateTime = null;
    
    // Debounced şarkı değişikliği işleyicisi
    const handleMusicChange = debounce(async (currentMusicTitle) => {
        // Eğer komut işleniyorsa bekle
        if (window.musicCommandInProgress) {
            console.log("Komut işleniyor, şarkı değişikliği kontrolü ertelendi");
            return;
        }
        
        console.log("Şarkı değişikliği tespit edildi:", currentMusicTitle);
        
        // Eski dinleyicileri ve veriyi temizle
        removeFirebaseListeners();
        
        // Yeni şarkı için dinleyicileri ekle
        const video = document.querySelector("video");
        if (video) {
            removeVideoListeners(video);
            attachListenersToVideo();
            setupFirebaseListeners();
            
            // İlk yüklemede veya şarkı değiştiğinde mevcut durumu güncelle
            if (!window.skipStatusUpdate) {
                if (!video.paused) {
                    await updateMusicStatus("playing");
                } else {
                    await updateMusicStatus("paused");
                }
            }
        }
        
        window.oldMusicTitle = currentMusicTitle;
        window.skipStatusUpdate = false;
    }, 500); // 500ms debounce
    
    // YouTube Music için kontrol
    if (window.location.href.includes("music.youtube.com")) {
        setInterval(async () => {
            const currentMusicTitle = await getCurrentMusicTitle();
            
            if (currentMusicTitle && (!window.oldMusicTitle || currentMusicTitle !== window.oldMusicTitle)) {
                handleMusicChange(currentMusicTitle);
            }
        }, 500);
    }
    
    // YouTube videoları için normal kontrol (her 2 saniyede bir)
    setInterval(async () => {
        const videoUrl = window.location.href;
        
        if (videoUrl.includes("youtube.com") && !videoUrl.includes("music.youtube.com")) {
            const currentVideoId = getVideoId(videoUrl);
            
            // Video değiştiyse
            if (currentVideoId && window.oldVideoId && currentVideoId !== window.oldVideoId) {
                console.log("Video değişti, eski video verisi temizleniyor:", window.oldVideoId);
                await cleanupOldYoutubeVideo(window.oldVideoId);
                updateDisconnectCleanup();
                
                // Video değiştiğinde dinleyicileri yeniden ekle
                const video = document.querySelector("video");
                if (video) {
                    removeVideoListeners(video);
                    attachListenersToVideo();
                    setupFirebaseListeners();
                }
            }
            
            window.oldVideoId = currentVideoId;
        }
    }, 2000);
}

// Eski YouTube videosunu temizle
function cleanupOldYoutubeVideo(videoId) {
    if (videoId) {
        withFirebase(async (firebase) => {
            try {
                // Video verisini sil
                const dbRef = firebase.database.ref(`youtubeVideos/${videoId}`);
                await dbRef.remove();
                console.log("Eski video verisi silindi:", videoId);
            } catch (error) {
                console.error("Eski video verisi silinirken hata:", error);
            }
        });
    }
}

// Eski müzik parçasını temizle - yeni fonksiyon
function cleanupOldMusicTrack(title) {
    if (title) {
        withFirebase(async (firebase) => {
            try {
                const musicId = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                const dbRef = firebase.database.ref(`musicTracks/${musicId}`);
                await dbRef.remove();
                console.log("Eski şarkı verisi silindi:", title);
            } catch (error) {
                console.error("Eski şarkı verisi silinirken hata:", error);
            }
        });
    }
}

// Sekme verisini temizle
function cleanupTabData() {
    withFirebase(async (firebase) => {
        try {
            const videoUrl = window.location.href;
            
            // YouTube videosu için
            if (videoUrl.includes("youtube.com") && !videoUrl.includes("music.youtube.com")) {
                const videoId = getVideoId(videoUrl);
                if (videoId) {
                    const dbRef = firebase.database.ref(`youtubeVideos/${videoId}`);
                    await dbRef.remove();
                }
            }
            
            // YouTube Music için
            if (videoUrl.includes("music.youtube.com")) {
                const title = await getCurrentMusicTitle();
                if (title) {
                    const musicId = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    const dbRef = firebase.database.ref(`musicTracks/${musicId}`);
                    await dbRef.remove();
                }
            }
        } catch (error) {
            console.error("Sekme verisi temizlenirken hata:", error);
        }
    });
}

// Tüm verileri temizle - güncelleme
function clearAllData() {
    withFirebase(async (firebase) => {
        try {
            const videoUrl = window.location.href;
            
            // YouTube videosu için sadece mevcut video verisini sil
            if (videoUrl.includes("youtube.com") && !videoUrl.includes("music.youtube.com")) {
                const videoId = getVideoId(videoUrl);
                if (videoId) {
                    const videoRef = firebase.database.ref(`youtubeVideos/${videoId}`);
                    await videoRef.remove();
                }
            }
            
            // YouTube Music için sadece mevcut şarkı verisini sil
            if (videoUrl.includes("music.youtube.com")) {
                const title = await getCurrentMusicTitle();
                if (title) {
                    const musicId = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                    const musicRef = firebase.database.ref(`musicTracks/${musicId}`);
                    await musicRef.remove();
                }
            }
            
            // Oturum verisini temizle
            const sessionRef = firebase.database.ref(`sessions/${firebase.sessionId}`);
            await sessionRef.remove();
            
            console.log("Sekme verileri temizlendi");
        } catch (error) {
            console.error("Veriler temizlenirken hata:", error);
        }
    });
}

// İstanbul saati için timestamp oluştur (UTC+3)
function getIstanbulTimestamp() {
    const now = new Date();
    
    // İstanbul'un UTC+3 saat dilimindeki zamanı al
    const istanbulOptions = { 
        timeZone: 'Europe/Istanbul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    
    return new Intl.DateTimeFormat('tr-TR', istanbulOptions).format(now).replace(',', '');
}

// Video ID'sini URL'den al (sadece YouTube için)
function getVideoId(url) {
    if (url.includes("youtube.com") && !url.includes("music.youtube.com")) {
        return new URL(url).searchParams.get("v");
    }
    return null;
}

// YouTube Music mini player'dan video bilgilerini al
function getMusicPlayerInfo() {
    try {
        // Mini player'daki video başlığını al
        const titleElement = document.querySelector("ytmusic-player-bar .title");
        if (!titleElement) return null;

        return {
            title: titleElement.textContent
        };
    } catch (error) {
        console.error("YouTube Music player bilgileri alınamadı:", error);
        return null;
    }
}

// Mevcut müzik başlığını al
async function getCurrentMusicTitle() {
    const getTitle = async () => {
        // YouTube Music için mini player kontrolü
        const playerInfo = getMusicPlayerInfo();
        if (playerInfo && playerInfo.title && playerInfo.title.trim() !== '') {
            return playerInfo.title;
        }
        
        // Normal sayfa kontrolü
        const titleElement = document.querySelector("#title > h1");
        if (titleElement && titleElement.innerText && titleElement.innerText.trim() !== '') {
            return titleElement.innerText;
        }
        
        return null;
    };
    
    return await getTitle();
}

// Video dinleyicilerini ekle (play/pause olaylarını izle)
function addVideoListeners() {
    console.log("Video dinleyicileri ekleniyor...");
    
    // Mevcut dinleyicileri kaldır (tekrar eklemeden önce)
    removeExistingListeners();
    
    // Sayfa üzerindeki video elementi için dinleyicileri ekle
    attachListenersToVideo();
    
    // MutationObserver ile DOM değişikliklerini izle (YouTube ve YouTube Music için)
    setupMutationObserver();
    
    // Sayfa yükleme durumunu izle
    if (document.readyState !== 'complete') {
        window.addEventListener('load', () => {
            console.log("Sayfa yüklendi, dinleyiciler tekrar ekleniyor...");
            attachListenersToVideo();
        });
    }
    
    // URL değişikliklerini izle (SPA navigasyonu için)
    setupURLChangeListener();
}

// Mevcut dinleyicileri kaldır
function removeExistingListeners() {
    if (window.ytVideoListenerAttached) {
        const video = document.querySelector("video");
        if (video) {
            video.removeEventListener('play', window.ytPlayHandler);
            video.removeEventListener('pause', window.ytPauseHandler);
        }
        window.ytVideoListenerAttached = false;
    }
}

// Video elementine dinleyicileri ekle - güncelleme
function attachListenersToVideo() {
    const video = document.querySelector("video");
    if (!video) {
        console.log("Video elementi bulunamadı, 500ms sonra tekrar denenecek...");
        setTimeout(attachListenersToVideo, 500); // Daha sık kontrol
        return;
    }

    // Video hazır değilse bekle
    if (!video.readyState >= 1) {
        console.log("Video henüz hazır değil, bekleniyor...");
        video.addEventListener('loadedmetadata', () => {
            console.log("Video hazır, dinleyiciler ekleniyor...");
            setupVideoListeners(video);
            setupFirebaseListeners();
        }, { once: true });
        return;
    }

    setupVideoListeners(video);
    setupFirebaseListeners();
}

// Video dinleyicilerini ayarla - yeni fonksiyon
function setupVideoListeners(video) {
    // Önce eski dinleyicileri kaldır
    removeVideoListeners(video);
    
    // Dinleyici fonksiyonlarını global değişkenlere kaydet
    window.ytPlayHandler = () => {
        // Eğer son güncelleme üzerinden 500ms geçmediyse işlemi iptal et
        if (window.lastUpdateTime && Date.now() - window.lastUpdateTime < 500) {
            return;
        }
        window.lastUpdateTime = Date.now();

        console.log("Video başlatıldı, bilgileri güncelleniyor...");
        sendVideoInfo();
        
        // Video oynatıldığında Firebase'e "playing" durumunu gönder
        const videoUrl = window.location.href;
        if (videoUrl.includes("music.youtube.com")) {
            updateMusicStatus("playing");
        } else if (videoUrl.includes("youtube.com")) {
            updateYoutubeStatus("playing");
        }
    };
    
    window.ytPauseHandler = () => {
        // Eğer son güncelleme üzerinden 500ms geçmediyse işlemi iptal et
        if (window.lastUpdateTime && Date.now() - window.lastUpdateTime < 500) {
            return;
        }
        window.lastUpdateTime = Date.now();

        console.log("Video durduruldu, bilgileri güncelleniyor...");
        sendVideoInfo();
        
        // Video durduğunda Firebase'e "paused" durumunu gönder
        const videoUrl = window.location.href;
        if (videoUrl.includes("music.youtube.com")) {
            updateMusicStatus("paused");
        } else if (videoUrl.includes("youtube.com")) {
            updateYoutubeStatus("paused");
        }
    };
    
    // Dinleyicileri ekle ve flag'i ayarla
    if (!video.hasPlayPauseListeners) {
        video.addEventListener('play', window.ytPlayHandler);
        video.addEventListener('pause', window.ytPauseHandler);
        video.hasPlayPauseListeners = true;
        window.ytVideoListenerAttached = true;
        console.log("Video dinleyicileri başarıyla eklendi.");
    }
    
    // İlk açılışta da bilgileri gönder
    if (!video.paused) {
        sendVideoInfo();
    }
}

// Eski dinleyicileri kaldır
function removeVideoListeners(video) {
    if (window.ytPlayHandler) {
        video.removeEventListener('play', window.ytPlayHandler);
    }
    if (window.ytPauseHandler) {
        video.removeEventListener('pause', window.ytPauseHandler);
    }
    video.hasPlayPauseListeners = false;
    window.ytVideoListenerAttached = false;
}

// DOM değişikliklerini izle - güncelleme
function setupMutationObserver() {
    // Daha önce oluşturulmuş bir observer varsa kaldır
    if (window.ytMutationObserver) {
        window.ytMutationObserver.disconnect();
    }
    
    // Yeni bir MutationObserver oluştur
    window.ytMutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // DOM'a yeni elementler eklendiğinde video elementi kontrolü yap
                const videoAdded = Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeName === 'VIDEO') return true;
                    if (node.querySelector && node.querySelector('video')) return true;
                    return false;
                });
                
                if (videoAdded) {
                    console.log("Yeni video elementi tespit edildi, dinleyiciler ekleniyor...");
                    // Biraz bekleyip dinleyicileri ekle
                    setTimeout(() => {
                        attachListenersToVideo();
                    }, 500);
                }
            }
        }
    });
    
    // Tüm sayfa değişikliklerini izle
    window.ytMutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
    
    // Sayfa yüklendiğinde de kontrol et
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log("Sayfa yüklendi, ilk dinleyiciler ekleniyor...");
            attachListenersToVideo();
        });
    } else {
        attachListenersToVideo();
    }
    
    console.log("DOM değişiklik gözlemcisi başlatıldı.");
}

// URL değişikliklerini izle - güncelleme
function setupURLChangeListener() {
    // Önceki URL'yi sakla
    window.ytPreviousUrl = window.location.href;
    
    // Periyodik olarak URL'yi kontrol et
    setInterval(() => {
        const currentUrl = window.location.href;
        
        // URL değiştiyse dinleyicileri yeniden ekle
        if (currentUrl !== window.ytPreviousUrl) {
            console.log("URL değişikliği tespit edildi, dinleyiciler yenileniyor...");
            
            // Eski URL'deki video verisi temizlenecek
            if (window.ytPreviousUrl.includes("youtube.com") && !window.ytPreviousUrl.includes("music.youtube.com")) {
                const oldVideoId = getVideoId(window.ytPreviousUrl);
                if (oldVideoId) {
                    cleanupOldYoutubeVideo(oldVideoId);
                }
            }
            
            window.ytPreviousUrl = currentUrl;
            
            // URL değiştiğinde biraz bekleyip dinleyicileri ekle
            setTimeout(() => {
                attachListenersToVideo();
                // Firebase dinleyicilerini yeniden ekle
                setupFirebaseListeners();
            }, 1000);
        }
    }, 1000);
    
    console.log("URL değişiklik dinleyicisi başlatıldı.");
}

// Video bilgilerini Firebase'e gönder
function sendVideoInfo() {
    withFirebase(async (firebase) => {
        try {
            const video = document.querySelector("video");
            if (!video) {
                console.log("Video elementi bulunamadı.");
                return;
            }
            
        const videoUrl = window.location.href;

            // URL kontrol et ve sadece o platformun verilerini güncelle
            if (videoUrl.includes("music.youtube.com")) {
                await updateMusicInfo(firebase, video, videoUrl);
            } else if (videoUrl.includes("youtube.com")) {
                await updateYoutubeInfo(firebase, video, videoUrl);
            }
        } catch (error) {
            console.error("Video bilgileri gönderilirken hata:", error);
        }
    });
}

// YouTube Music bilgilerini güncelle
async function updateMusicInfo(firebase, video, videoUrl) {
    try {
        // Başlık bilgisini almayı dene
        const getTitle = async () => {
            // YouTube Music için mini player kontrolü
            const playerInfo = getMusicPlayerInfo();
            if (playerInfo && playerInfo.title && playerInfo.title.trim() !== '') {
                return playerInfo.title;
            }
            
            // Normal sayfa kontrolü
            const titleElement = document.querySelector("#title > h1");
            if (titleElement && titleElement.innerText && titleElement.innerText.trim() !== '') {
                return titleElement.innerText;
            }
            
            return null;
        };
        
        // Başlık bilgisini al
        let title = await getTitle();
        
        // Başlık yoksa veya boşsa, 5 defa deneyerek bekle
        if (!title) {
            console.log("YouTube Music: Başlık yükleniyor, bekleniyor...");
            
            let attempts = 0;
            const maxAttempts = 5;
            
            while (!title && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 300));
                title = await getTitle();
                attempts++;
                
                if (!title) {
                    console.log(`YouTube Music: Başlık bulunamadı, tekrar deneniyor (${attempts}/${maxAttempts})...`);
                }
            }
            
            if (!title) {
                console.log("YouTube Music: Başlık bulunamadı, işlem iptal ediliyor.");
                return;
            }
        }

        // Başlıktan benzersiz bir ID oluştur
        const musicId = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9]/g, '_'));
        
        // Thumbnail URL'sini al
        const thumbnailElement = document.querySelector(".image.ytmusic-player-bar");
        const thumbnailUrl = thumbnailElement ? thumbnailElement.src : null;

        const data = {
            site: "YouTube Music",
            title: title,
            status: !video.paused ? "playing" : "paused",
            thumbnail: thumbnailUrl,
            timestamp: getIstanbulTimestamp(),
            sessionId: firebase.sessionId
        };

        // Music ID'yi kullanarak veriyi güncelle
        const dbRef = firebase.database.ref(`musicTracks/${musicId}`);
        await dbRef.set(data);
        console.log("Music bilgileri güncellendi:", data);
        
        // Şarkı başlığını sakla
        window.oldMusicTitle = title;
    } catch (error) {
        console.error("Music bilgileri güncellenirken hata oluştu:", error);
    }
}

// YouTube bilgilerini güncelle
async function updateYoutubeInfo(firebase, video, videoUrl) {
    try {
        // YouTube için normal kontrol
        const titleElement = document.querySelector("#title > h1");
        const videoId = getVideoId(videoUrl);
        if (!video || !titleElement || !videoId) {
            console.log("YouTube: Video bilgileri bulunamadı.");
            return;
        }
        const title = titleElement.innerText;

        const data = {
            site: "YouTube",
            title: title,
            status: !video.paused ? "playing" : "paused",
            thumbnail: `https://img.youtube.com/vi/${videoId}/default.jpg`,
            timestamp: getIstanbulTimestamp(),
            sessionId: firebase.sessionId
        };

        // Video ID'yi kullanarak veriyi güncelle
        const dbRef = firebase.database.ref(`youtubeVideos/${videoId}`);
        await dbRef.set(data);
        console.log("Video bilgileri güncellendi:", data);
        
        // Video ID'yi sakla
        window.oldVideoId = videoId;
    } catch (error) {
        console.error("YouTube bilgileri güncellenirken hata oluştu:", error);
    }
}

// Play/Pause komutlarını işle
function handlePlayPauseCommand(status) {
    try {
        const videoUrl = window.location.href;
        const video = document.querySelector("video");
        
        if (videoUrl.includes("youtube.com") && !videoUrl.includes("music.youtube.com")) {
            // YouTube için video ID kontrolü
            const currentVideoId = getVideoId(videoUrl);
            const targetVideoId = window.currentVideoId; // Firebase'den gelen veri için
            
            // Video ID'ler eşleşmiyorsa komutu işleme
            if (currentVideoId !== targetVideoId) {
                console.log("Video ID'ler eşleşmiyor, komut işlenmeyecek");
                return;
            }
        }

        if (video) {
            if (status === "play" && video.paused) {
                video.play();
            } else if (status === "pause" && !video.paused) {
                video.pause();
            }
        }
    } catch (error) {
        console.error("Play/Pause komutu işlenirken hata:", error);
    }
}

// Chrome mesaj dinleyicisini düzelt
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendVideoInfo") {
        sendVideoInfo();
        sendResponse({}); // Hemen yanıt ver
    } else if (request.action === "firebaseLoaded") {
        console.log("Firebase yüklendi eventi alındı");
        if (typeof firebase === 'undefined') {
            console.log("Firebase henüz global scope'ta değil, 1 saniye beklenecek...");
            setTimeout(() => {
                initializeFirebase();
                sendResponse({}); // İşlem tamamlandığında yanıt ver
            }, 1000);
        } else {
            initializeFirebase();
            sendResponse({}); // Hemen yanıt ver
        }
    } else if (request.action === "checkFirebase") {
        if (!window.FIREBASE_CONTEXT.initialized && typeof firebase !== 'undefined') {
            console.log("Firebase kontrolü: başlatılmamış, başlatılıyor...");
            initializeFirebase();
        }
        sendResponse({}); // Hemen yanıt ver
    }
    return false; // Senkron yanıt ver
});

// Firebase başlatmayı dene
if (typeof firebase !== 'undefined') {
    console.log("Firebase bulundu, başlatılıyor...");
    initializeFirebase();
} else {
    console.log("Firebase bulunamadı, yüklendikten sonra başlatılacak.");
}