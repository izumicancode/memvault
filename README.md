# memVault 🎙️

[![React Native](https://img.shields.io/badge/React%20Native-0.81.4-61dafb?style=flat&logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54.0-000020?style=flat&logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A secure, feature-rich memo application built with React Native and Expo. Capture, store, and manage your audio and video memos with built-in security features, offline-first architecture, and an intuitive user interface.

## 🌟 Features

- 📝 **Create & Manage Memos** - Capture audio and video memos with ease
- 🔐 **Lock Screen Protection** - Secure your app with a customizable lock screen to protect sensitive memories
- 🎨 **Customizable Theme** - Seamless light and dark mode support with automatic system preference detection
- ⚙️ **Personalized Settings** - Customize your experience with flexible configuration options
- 💾 **Local Storage** - All memos stored securely on your device with no cloud dependency
- 📱 **Cross-Platform** - Works on iOS, Android, and Web platforms
- ⏱️ **Duration Tracking** - Automatic duration tracking for audio and video memos
- 🏷️ **Easy Organization** - Organize memos with custom titles and metadata
- 🔄 **Seamless Sync** - Offline-first approach with local storage persistence

## 🎯 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **Expo CLI** (install globally with `npm install -g expo-cli`)
- For Android development: Android Studio and SDK
- For iOS development: Xcode and CocoaPods

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd memVault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   This will start the Expo development server. Use the Expo Go app on your phone to scan the QR code and test the app.

### Running on Different Platforms

**Android:**
```bash
npm run android
```
Requires Android Studio and an Android emulator or physical device.

**iOS:**
```bash
npm run ios
```
Requires Xcode and an iOS simulator or physical device (macOS only).

**Web:**
```bash
npm run build:web
```
Builds the web version. Useful for testing web-specific features.

## 📁 Project Structure

```
memVault/
├── app/                              # Expo Router application routes
│   ├── _layout.tsx                  # Root layout wrapper with navigation setup
│   ├── +not-found.tsx               # 404 error page for undefined routes
│   └── (tabs)/                      # Tab-based navigation group
│       ├── _layout.tsx              # Tab navigator configuration and tab bar styling
│       ├── index.tsx                # Home/Dashboard screen
│       ├── memos.tsx                # Memos list and management screen
│       └── settings.tsx             # Settings and preferences screen
│
├── components/                       # Reusable React components
│   └── LockScreen.tsx               # Lock screen component with security UI
│
├── hooks/                            # Custom React hooks
│   └── useFrameworkReady.ts         # Hook to detect when Expo framework is ready
│
├── lib/                              # Shared utilities and context
│   ├── format.ts                    # Text and data formatting utilities
│   ├── lock-context.tsx             # React Context for lock screen state management
│   ├── storage.ts                   # Local device storage operations and API
│   ├── theme.ts                     # Theme configuration (colors, typography, spacing)
│   └── types.ts                     # TypeScript interfaces and type definitions
│
├── assets/                           # Static assets and resources
│   └── images/                      # Icon, favicon, and image files
│
├── android/                          # Android-specific native code and configurations
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml      # Android app manifest
│   │   ├── java/com/anonymous/memovault/
│   │   │   ├── MainActivity.kt       # Main Android activity
│   │   │   └── MainApplication.kt   # Application class configuration
│   │   └── res/                     # Android resources (drawables, values)
│   └── gradle/                      # Gradle build configuration
│
├── app.json                          # Expo app configuration (name, version, plugins, etc)
├── package.json                      # Project dependencies and scripts
├── tsconfig.json                     # TypeScript compiler configuration
├── expo-env.d.ts                    # Expo type definitions
└── README.md                         # This file
```

## 🔧 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React Native 0.81.4 | Cross-platform mobile UI framework |
| **Build Tool** | Expo 54.0 | Managed React Native development platform |
| **Language** | TypeScript 5.x | Static typing for JavaScript |
| **Routing** | Expo Router v6.0 | File-based navigation system |
| **Navigation** | React Navigation v7.0 | Tab-based and stack navigation |
| **Storage** | AsyncStorage (local) | Persistent device storage |
| **UI Components** | Lucide React Native | Icon library and UI components |
| **Styling** | Custom Theme System | Light/dark mode with CSS-in-JS approach |
| **Animations** | React Native Reanimated | Smooth gesture and transition animations |
| **Fonts** | Expo Google Fonts | Typography with Inter font family |
| **Backend** | Supabase (optional) | Backend services and authentication |

## 📋 Available Scripts

```bash
npm run dev              # Start development server with Expo CLI
npm run build:web       # Build web version for production
npm run lint            # Run ESLint to check code quality
npm run typecheck       # Run TypeScript compiler to check types
npm run android         # Build and run on Android device/emulator
npm run ios             # Build and run on iOS device/simulator
```

## 🔐 Security Features

### Lock Screen
The lock screen component provides a secure entry point to the application. Features include:
- Customizable PIN/passcode entry
- State management through React Context
- Visual feedback during authentication

### Local Storage
All data is stored locally on the device using AsyncStorage:
- No cloud synchronization (unless explicitly configured)
- Data persists across app sessions
- Accessible through the `storage.ts` utilities

## 🎨 Theming

The app includes a comprehensive theme system supporting:
- **Light Mode**: Optimized for daytime usage
- **Dark Mode**: Reduced eye strain in low-light environments
- **System Preference Detection**: Automatic mode switching based on device settings
- **Custom Colors**: Easy customization through `theme.ts`

## 📦 Data Structure

### Memo Interface
```typescript
interface Memo {
  id: string;                    // Unique identifier
  type: 'audio' | 'video';       // Memo type
  title: string;                 // User-defined title
  blob: Blob;                    // Media file data
  mimeType: string;              // MIME type (e.g., 'audio/mp4')
  durationMs: number;            // Duration in milliseconds
  createdAt: number;             // Unix timestamp
  size: number;                  // File size in bytes
}
```

## 🚀 Development Workflow

### Setting Up Development Environment

1. **Create a new branch for features:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Run type checking during development:**
   ```bash
   npm run typecheck
   ```

3. **Lint your code before committing:**
   ```bash
   npm run lint
   ```

### Testing

When adding new features:
- Test on actual devices when possible
- Test both light and dark themes
- Test on iOS and Android separately
- Verify lock screen functionality
- Test storage persistence

## 🔌 Integrations

### Supabase
The project includes Supabase integration for optional backend services:
```typescript
import { createClient } from '@supabase/supabase-js';
```

Configure Supabase credentials in environment variables for cloud features.

## 📱 Platform-Specific Notes

### Android
- Package name: `com.anonymous.memovault`
- Minimum API Level: 24
- Build system: Gradle
- Permissions: Camera (for video recording), Microphone (for audio recording)

### iOS
- Supports iPad (multitasking)
- Requires iOS 12.0+
- Permissions: Camera access, Microphone access, Photo library access

### Web
- Built with Metro bundler
- Single output bundle
- Responsive design for desktop browsers

## 🐛 Troubleshooting

### App won't start
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear Expo cache: `expo start -c`
- Check Node.js version: `node -v` (should be v18+)

### Memos not saving
- Check device storage availability
- Verify AsyncStorage permissions
- Check console logs for storage errors

### Theme not switching
- Ensure device theme is set correctly
- Restart the app
- Check `theme.ts` configuration

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues, questions, or suggestions, please create an issue in the repository.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (optional, but recommended)

### Installation

1. Clone the repository
```bash
cd memVault
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm start
```

4. Run on your device or emulator
- **iOS**: Press `i` in the terminal
- **Android**: Press `a` in the terminal
- **Web**: Press `w` in the terminal

## Available Scripts

- `npm start` - Start the Expo development server
- `npm run ios` - Build and run on iOS
- `npm run android` - Build and run on Android
- `npm run web` - Run in web browser

## Project Features Explained

### Lock Screen
The app includes a lock screen feature (`components/LockScreen.tsx` and `lib/lock-context.tsx`) that provides security for your notes.

### Storage Management
All user data is managed through `lib/storage.ts`, ensuring data persistence across app sessions.

### Theme System
The app supports customizable themes configured in `lib/theme.ts` with built-in light and dark mode support.

## Development

This project uses TypeScript for type safety and better development experience. Make sure to:

- Follow the existing folder structure
- Add new components to the `components/` folder
- Add utilities to the `lib/` folder
- Create custom hooks in the `hooks/` folder

## License

This project is provided as-is for personal use.

## Contributing

Feel free to fork and submit pull requests for any improvements.
