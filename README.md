# YouTube Control Project

This project allows you to control YouTube playback remotely using a mobile application. The system consists of two parts:

1. **Chrome Extension**: Controls YouTube in the browser
2. **Flutter Mobile App**: Remote control interface

## Setup Instructions

### Chrome Extension Setup

1. Navigate to `chrome://extensions/` in your Chrome browser
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked" and select the `youtube-extension` folder
4. Rename `firebaseConfig.example.js` to `firebaseConfig.js` and update with your Firebase credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Flutter App Setup

1. Install Flutter if you haven't already: [Flutter Installation Guide](https://docs.flutter.dev/get-started/install)
2. Navigate to the `youtubecontrol` directory
3. Create a new file called `firebase_options.dart` in the `lib` folder based on the example file
4. Update your Firebase configuration in this file
5. Run the following commands:

```bash
flutter pub get
flutter run
```

## Usage

1. Open YouTube in Chrome with the extension enabled
2. Launch the mobile app
3. Connect to your browser session
4. Use the app controls to play, pause, skip, adjust volume, etc.

## Features

- Remote playback control (play, pause, next, previous)
- Volume adjustment
- Seek functionality
- Playlist navigation
- Real-time synchronization

## Troubleshooting

- Make sure both devices are connected to the internet
- Verify your Firebase configuration is correct
- Check that the extension is properly installed and enabled

## License

This project is licensed under the MIT License - see the LICENSE file for details. 