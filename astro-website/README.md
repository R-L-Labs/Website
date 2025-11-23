# R&L Labs, LLC Website (Astro)

A modern, responsive website for R&L Labs, LLC built with Astro, Vue, and SCSS.

## Features

- **Astro Framework**: Fast, modern static site generator
- **Vue Components**: Interactive components using Vue 3
- **SCSS Styling**: Professional monochrome design with warm accents
- **Contact Form**: EmailJS integration for form submissions
- **Environment Variables**: Secure configuration using Astro's built-in env support
- **Responsive Design**: Mobile-friendly navigation and layout

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` and add your EmailJS credentials:
```
PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
PUBLIC_EMAILJS_SERVICE_ID=your_service_id
PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
PUBLIC_EMAILJS_TO_EMAIL=support@rl-labs.org
```

### Development

Start the development server:
```bash
npm run dev
```

The site will be available at `http://localhost:4321`

### Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Project Structure

```
.
├── src/
│   ├── components/      # Vue components
│   │   ├── Navbar.vue
│   │   ├── Footer.vue
│   │   └── ContactForm.vue
│   ├── layouts/         # Astro layouts
│   │   └── Layout.astro
│   ├── pages/           # Astro pages (routes)
│   │   ├── index.astro
│   │   ├── projects.astro
│   │   └── contact.astro
│   └── styles/          # SCSS styles
│       └── main.scss
├── public/              # Static assets
└── .env                 # Environment variables (not in git)
```

## Environment Variables

Astro uses the `PUBLIC_` prefix for environment variables that should be exposed to the client. These are available via `import.meta.env.PUBLIC_*`.

Required variables:
- `PUBLIC_EMAILJS_PUBLIC_KEY` - Your EmailJS public key
- `PUBLIC_EMAILJS_SERVICE_ID` - Your EmailJS service ID
- `PUBLIC_EMAILJS_TEMPLATE_ID` - Your EmailJS template ID
- `PUBLIC_EMAILJS_TO_EMAIL` - Email address to receive form submissions (optional)

## Deployment

### Netlify

1. Connect your repository to Netlify
2. Set environment variables in Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add all `PUBLIC_EMAILJS_*` variables
3. Deploy! Netlify will automatically detect Astro and build your site

The build command is already configured in `package.json`.

## Notes

- Vue components are used for interactive elements (Navbar, Footer, ContactForm)
- Astro pages handle routing automatically based on file structure
- SCSS is compiled automatically during build
- Environment variables with `PUBLIC_` prefix are exposed to the browser
- The contact form uses EmailJS for sending emails
