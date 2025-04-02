// Firebase yapılandırma bilgileri örneği
// Bu dosyayı firebaseConfig.js olarak kopyalayın ve kendi değerlerinizle doldurun
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

// Diğer script'lerin erişebilmesi için dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig };
} else {
    // Tarayıcı ortamında window nesnesine ekle
    window.firebaseConfig = firebaseConfig;
} 