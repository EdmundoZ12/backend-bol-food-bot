// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDLHG_KSyaFhobi74qG3y98hmzFje-XJu8",
    authDomain: "bol-food-bot.firebaseapp.com",
    projectId: "bol-food-bot",
    storageBucket: "bol-food-bot.firebasestorage.app",
    messagingSenderId: "729502275382",
    appId: "1:729502275382:web:6497ae278694b0e3fbc597"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.image
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
