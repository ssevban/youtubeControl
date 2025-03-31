// Firebase yapılandırma bilgileri örneği
// Bu dosyayı firebaseConfig.js olarak kopyalayın ve kendi değerlerinizle doldurun
const firebaseConfig = {
    apiKey: "API_KEY",
    authDomain: "APP_NAME.firebaseapp.com",
    databaseURL: "https://APP_NAME-default-rtdb.firebaseio.com",
    projectId: "PROJECT_ID",
    storageBucket: "APP_NAME.firebasestorage.app",
    messagingSenderId: "MESSAGING_SENDER_ID",
    appId: "APP_ID",
    measurementId: "MEASUREMENT_ID"
};

// Diğer script'lerin erişebilmesi için dışa aktar
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig };
} else {
    // Tarayıcı ortamında window nesnesine ekle
    window.firebaseConfig = firebaseConfig;
} 