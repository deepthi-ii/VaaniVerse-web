# VaaniVerse 🇮🇳
https://vaani-verse-web.vercel.app/
### One India. Many Voices. One Trusted Digital Space.

VaaniVerse is an Indian-language-first social media platform concept designed to help people connect, share information, and communicate across language barriers in a safer digital environment.

Built with the vision of **Viksit Bharat @ 2047**, VaaniVerse aims to make digital participation more inclusive, accessible, and trustworthy for people across India.

## 🌟 About the Project

Social media helps millions of people share ideas and information, but misinformation, deepfakes, language barriers, and digital exclusion remain significant challenges.

VaaniVerse explores how a social platform can combine community participation with trust-focused features to help users make more informed decisions about the content they encounter.

Our goal is to build a platform where people can express themselves in their preferred Indian language, share knowledge, and participate in a more inclusive digital community.

## ✨ Key Features

- **Home Feed:** A central space to share posts and discover community content.
- **Trust Center:** A planned space for trust indicators and information-verification features.
- **Explore:** Discover content and ideas from across communities.
- **Agri Hub:** A dedicated space for agriculture-related information and discussions.
- **Careers:** A space intended to help users discover career-related information and opportunities.
- **Multilingual Communication:** A vision for making content accessible across Indian languages.
- **Voice-Based Sharing:** A planned way for users to share spoken updates alongside text.
- **Misinformation Awareness:** A planned approach to flagging content that needs further verification.
- **Community Participation:** Comments and discussion to encourage people to examine information together.

*Feature availability may vary as development progresses. Planned features are not necessarily implemented in the current version.*

## 🛠️ Technology Stack

- **Frontend:** React
- **Build Tool:** Vite
- **Backend Services and Database:** Supabase
- **Hosting and Deployment:** Vercel
- **Language:** JavaScript
- **Styling:** CSS

## 🏗️ Project Structure

```text
vaaniverse/
├── public/
├── src/
│   ├── assets/
│   ├── lib/
│   │   └── supabaseClient.js
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

*The exact folders and files may vary depending on the current implementation.*

## 🚀 Getting Started

### Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/)
- npm, included with Node.js
- A [Supabase](https://supabase.com/) project

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd vaaniverse
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your repository's actual GitHub URL.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root, alongside `package.json`.

Add your Supabase project URL and publishable key:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Replace the placeholder values with your own Supabase project details.

**Security:** Never commit `.env.local`, private keys, service-role keys, or other secrets to GitHub. Use Vercel Environment Variables for the deployed application.

### 4. Run the Development Server

```bash
npm run dev
```

Open the local URL printed in your terminal, usually `http://localhost:5173`.

### 5. Build for Production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## ☁️ Deployment

VaaniVerse can be deployed through Vercel using a connected GitHub repository.

1. Import the repository into Vercel.
2. Select **Vite** as the framework preset.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel Environment Variables.
6. Deploy the application.

When environment variables change, redeploy the application so the updated values are included in the production build.

## 🔐 Trust and Responsible Technology

VaaniVerse is being developed around the idea that technology should help people participate in digital spaces more safely and confidently.

The intended direction includes:

- Clear indicators for information that has or has not been verified.
- Community discussion and opportunities to challenge questionable claims.
- Greater accessibility for users who prefer regional languages or voice-based communication.
- Responsible use of automated verification tools.

Automated checks can make mistakes. Verification indicators should communicate uncertainty honestly and should not be treated as absolute proof that a claim is true or false.

## 🎯 Vision

**A more inclusive, multilingual, and trust-aware digital India.**

VaaniVerse aims to help people from different linguistic and social backgrounds connect, exchange knowledge, and participate in India's digital future.

## 🤝 Contributing

Contributions, suggestions, bug reports, and ideas are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test your changes.
5. Submit a pull request describing your contribution.

## 📌 Project Status

VaaniVerse is an evolving project. The current implementation and available features may change as development continues.

## 📄 License

No license has been specified yet. Add a `LICENSE` file before presenting the project as open source under a particular license.
