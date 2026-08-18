# memVault

A secure, feature-rich memo application built with React Native and Expo. Store, manage, and organize your notes with built-in security features.

## Features

- 📝 **Create & Manage Memos** - Easily create, edit, and organize your notes
- 🔐 **Lock Screen Protection** - Secure your app with a lock screen
- 🎨 **Customizable Theme** - Light and dark mode support
- ⚙️ **Settings** - Personalize your experience
- 💾 **Local Storage** - All data stored securely on your device

## Project Structure

```
memVault/
├── app/                          # Application routes and screens
│   ├── _layout.tsx              # Root layout
│   ├── +not-found.tsx           # 404 page
│   └── (tabs)/                  # Tab-based navigation
│       ├── _layout.tsx          # Tab layout configuration
│       ├── index.tsx            # Home screen
│       ├── memos.tsx            # Memos screen
│       └── settings.tsx         # Settings screen
├── components/                   # Reusable React components
│   └── LockScreen.tsx           # Lock screen component
├── hooks/                        # Custom React hooks
│   └── useFrameworkReady.ts     # Framework initialization hook
├── lib/                          # Utility functions and context
│   ├── format.ts                # Text formatting utilities
│   ├── lock-context.tsx         # Lock screen state management
│   ├── storage.ts               # Device storage operations
│   ├── theme.ts                 # Theme configuration
│   └── types.ts                 # TypeScript type definitions
├── assets/                       # Static assets
│   └── images/                  # Image files
├── app.json                      # Expo configuration
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
└── expo-env.d.ts                # Expo environment types
```

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Styling**: Theme system with light/dark mode support
- **Storage**: Local device storage for data persistence

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
