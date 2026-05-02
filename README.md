<p align="center">
  <img src="https://raw.githubusercontent.com/XsharklinX/Hoard/master/resources/hoard_hero.png" alt="Hoard Hero Banner" width="800">
</p>

<h1 align="center">💎 Hoard</h1>

<p align="center">
  <strong>Your personal digital hoard — links, notes, images, and code. All yours, all local.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Maintained%3F-yes-green?style=for-the-badge" alt="Maintained">
  <img src="https://img.shields.io/badge/Local-Privacy-orange?style=for-the-badge" alt="Privacy">
</p>

---

## ✨ Overview / Resumen

**Hoard** is a professional-grade, privacy-first digital vault designed to help you collect and organize everything that matters to you on the web. From code snippets and research links to inspiration images and markdown notes, Hoard keeps your data where it belongs: **on your machine.**

**Hoard** es una bóveda digital profesional diseñada con la privacidad como prioridad. Te ayuda a coleccionar y organizar todo lo que te importa en la web: fragmentos de código, enlaces de investigación, imágenes de inspiración y notas en Markdown. Hoard mantiene tus datos donde pertenecen: **en tu propia máquina.**

---

## 🚀 Key Features / Características Principales

- **📂 Multi-Vault Organization**: Create multiple vaults and nested folders to keep your collections perfectly structured.
- **🌐 Browser Extension**: Save content directly from your browser with the companion extension.
- **📝 Rich Text Notes**: Built-in Markdown editor powered by Tiptap for fast and beautiful note-taking.
- **💻 Code Snippets**: Save code with full syntax highlighting support for dozens of languages.
- **🖼️ Image Vault & OCR**: Store images and automatically extract text using integrated OCR (Tesseract.js).
- **🔍 Power Search**: Find anything instantly with a global search and Command Palette (`Cmd/Ctrl + K`).
- **🛡️ Privacy First**: Everything is stored locally in an SQLite database. No cloud, no tracking.
- **🌍 Bilingual Support**: Fully translated into English and Spanish.
- **🎨 Premium UI**: A modern, sleek interface built with Radix UI and Tailwind CSS, optimized for focus.

---

## 🛠️ Tech Stack / Tecnologías

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Desktop Framework**: [Electron](https://www.electronjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **Database**: [SQLite (sql.js)](https://sql.js.org/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Editor**: [Tiptap](https://tiptap.dev/)
- **OCR**: [Tesseract.js](https://tesseract.projectnaptha.com/)

---

## 📦 Installation / Instalación

### Developer Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/XsharklinX/Hoard.git
   cd Hoard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

### Browser Extension

The extension is located in the `/extension` directory. To install it:
1. Go to `chrome://extensions/` in your browser.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder in this repository.

---

## 🔒 Privacy / Privacidad

Hoard is built on the philosophy that your data should be yours.
- **Zero Cloud**: No data is sent to external servers.
- **Local Database**: All information is stored in a local SQLite file.
- **Open Source**: Review the code to see exactly how your data is handled.

---

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features or find a bug, feel free to open an issue or submit a pull request.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/XsharklinX">David Bonilla</a>
</p>
