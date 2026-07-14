# ✍️ ScribeDoc UI

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=Vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

A beautiful, responsive React web interface designed to turn multi-format media into clean, structured, and LLM-optimized Markdown. 

This UI serves as the interactive frontend for the ScribeDoc API, wrapping around and interacting with Microsoft's open-source `MarkItDown` engine alongside advanced OCR, transcription, and chatbot APIs.

---

## ✨ Features

*   **📁 Multi-Format Batch Conversion:** Drag and drop up to 20 files at once (PDF, DOCX, XLSX, PPTX, HTML, TXT, CSV, JSON) and convert them dynamically.
*   **🖼️ Image OCR Extraction:** Optical Character Recognition (OCR) to pull readable text straight out of screenshots and images.
*   **🎙️ Audio Transcription:** Integrated voice note and audio file conversion using Whisper Large V3.
*   **🔗 YouTube & Web Parser:** Converts full websites or fetches clean YouTube video transcripts directly from a URL.
*   **📊 Token & Size Analytics:** Real-time character, word, and token ballpark counters with file size reduction percentage metrics.
*   **💬 Interactive Feedback:** A modern, rate-limited Community Reviews section where users can leave ratings and comments.

---

## 🎨 Professional Layout

*   **Two-Column Grid:** On desktop screens, the interface balances Frequently Asked Questions (FAQ) on the left with a scroll-constrained Community Feedback board on the right.
*   **Optimal Scroll Behavior:** Keeps the page compact and prevents long reviews from cluttering the viewport.

---

## 🚀 Quick Start

### Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed.

### 1. Clone the Repository
```bash
git clone https://github.com/Alihussnain1919/markdown_frontend.git
cd markdown_frontend


### Installation
npm install
npm run dev