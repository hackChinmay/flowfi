# FlowFi 💸

**FlowFi** is a modern, cross-platform personal finance management application designed to help users track expenses, manage budgets, analyze spending trends, and achieve financial freedom. Built with React, TypeScript, Tailwind CSS, Firebase, and Capacitor for native Android deployment.

🚀 **Live Demo**: [https://flowfi-iota.vercel.app](https://flowfi-iota.vercel.app/)

---

## 🌟 Key Features

- **🔐 Dual Authentication**: Secure Email/Password sign-up & Google OAuth integration (optimized for both Web popups and Android APK redirects).
- **📊 Interactive Analytics**: Comprehensive charts and visualizations powered by Recharts to track income vs. expenses, monthly trends, and category breakdowns.
- **💸 Transaction Management**: Effortlessly log income and expenses, filter by categories, and search historical records.
- **🎯 Budgeting & Goals**: Set spending limits and track progress towards financial milestones in real-time.
- **📱 Native Mobile Integration**: Built with Capacitor for seamless cross-platform deployment, including Android support and native biometric authentication.
- **🌓 Dark & Light Mode**: Sleek, customizable UI powered by Radix UI primitives and Tailwind CSS.
- **⚡ Real-time Data Sync**: Instant synchronization across devices powered by Google Cloud Firestore.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **State & Routing**: React Router v6, React Context API, TanStack Query
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

### **Backend & Database**
- **Authentication**: Firebase Auth (Email/Password, Google Sign-In)
- **Database**: Firebase Cloud Firestore

### **Mobile & Cross-Platform**
- **Framework**: [Capacitor 8](https://capacitorjs.com/) (Android)
- **Biometrics**: `capacitor-native-biometric`

### **Testing & Tooling**
- **Test Runner**: [Vitest](https://vitest.dev/)
- **Linting**: ESLint

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18.0.0 or higher
- **npm** or **bun** / **yarn**
- **Git**

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/hackChinmay/flowfi.git
   cd flowfi
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📱 Mobile Build (Capacitor / Android)

To sync and run the project as a native Android app:

```bash
# Build web assets
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

---

## 📜 Available Scripts

In the project directory, you can run:

- `npm run dev`: Starts the Vite local development server.
- `npm run build`: Compiles and builds the production bundle in `dist/`.
- `npm run preview`: Previews the local production build.
- `npm test`: Runs the Vitest test suite.
- `npm run lint`: Runs ESLint for code quality checks.

---

## 📂 Project Structure

```
flowfi/
├── android/               # Capacitor Android native project files
├── public/                # Static public assets
├── src/
│   ├── components/        # Reusable UI components & navigation
│   │   └── ui/            # Radix UI primitives & styled components
│   ├── contexts/          # React contexts (AuthContext, ThemeContext)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Firebase config, storage, and utility functions
│   ├── pages/             # App views (Dashboard, Analytics, Transactions, Profile, Auth)
│   ├── test/              # Unit test files
│   ├── App.tsx            # Main application component & routes
│   └── main.tsx           # Entry point
├── capacitor.config.ts    # Capacitor configuration
├── vite.config.ts         # Vite bundler configuration
└── package.json           # Dependencies and scripts
```

---

## 🌐 Deployment

The web app is live and deployed on **Vercel**:
🔗 **Live URL**: [https://flowfi-iota.vercel.app](https://flowfi-iota.vercel.app/)

> **Important for Firebase Auth**: Make sure `flowfi-iota.vercel.app` is added to **Firebase Console -> Authentication -> Settings -> Authorized Domains** so Google Sign-In works on production.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
