// Firebase dosyalarını import et
self.importScripts(
    "firebase-app-compat.js",
    "firebase-database-compat.js",
    "firebase-auth-compat.js"
);

// Yüklenen tabları takip et
const loadedTabs = new Set();

// Sayfa yüklendiğinde Firebase'i başlat
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && (tab.url.includes("www.youtube.com") || tab.url.includes("music.youtube.com"))) {
        // Önce Firebase scriptleri yüklediğimizden emin olalım (ilk kez yükleniyorsa)
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: [
                "firebase-app-compat.js", 
                "firebase-database-compat.js", 
                "firebase-auth-compat.js",
                "firebaseConfig.js"
            ]
        }).then(() => {
            // Sonra content script'i yükle veya mesaj gönder
            if (loadedTabs.has(tabId)) {
                // Zaten yüklüyse sadece kontrol et
                chrome.tabs.sendMessage(tabId, { action: "checkFirebase" });
            } else {
                // İlk kez yükleniyorsa, content script'i yükle
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ["content.js"]
                }).then(() => {
                    // Firebase yüklendi eventi gönder
                    chrome.tabs.sendMessage(tabId, { action: "firebaseLoaded" });
                    // Tabı yüklendi olarak işaretle
                    loadedTabs.add(tabId);
                }).catch(err => {
                    console.error("Content script yüklenemedi:", err);
                });
            }
        }).catch(err => {
            console.error("Firebase scriptleri yüklenemedi:", err);
        });
    }
});

// Tab kapatıldığında takip listesinden çıkar
chrome.tabs.onRemoved.addListener((tabId) => {
    loadedTabs.delete(tabId);
});

// Tab yeniden yüklendiğinde işaretleri temizle
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        loadedTabs.delete(tabId);
    }
});

// Firebase'e ihtiyaç mesajı geldiğinde Firebase'i yükle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "needFirebase" && sender.tab) {
        const tabId = sender.tab.id;
        
        // Firebase scriptlerini yeniden yükle
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: [
                "firebase-app-compat.js", 
                "firebase-database-compat.js", 
                "firebase-auth-compat.js",
                "firebaseConfig.js"
            ]
        }).then(() => {
            // Firebase yüklendi mesajı gönder
            chrome.tabs.sendMessage(tabId, { action: "firebaseLoaded" });
        }).catch(err => {
            console.error("Firebase scriptleri yüklenemedi (istek üzerine):", err);
        });
    }
    return true; // Asenkron mesaj işleme için gerekli
});

// Eklenti ikonuna tıklandığında sadece veri gönder
chrome.action.onClicked.addListener(() => {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.url.includes("www.youtube.com") || tab.url.includes("music.youtube.com")) {
                chrome.tabs.sendMessage(tab.id, { action: "sendVideoInfo" });
            }
        });
    });
});
