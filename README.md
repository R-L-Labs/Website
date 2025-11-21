# R&L Labs, LLC Website

A modern, responsive website for R&L Labs, LLC built with HTML, CSS (SASS), and JavaScript.

## Features

- **Home Page**: Introduction to the company with hero section, about section, and features
- **Projects Page**: Showcase of coding projects
- **Contact Page**: Contact form and company information
- **Responsive Design**: Mobile-friendly navigation and layout
- **Modern UI**: Clean, professional design with smooth animations

## Getting Started

### Prerequisites

- Node.js and npm installed on your system

### Installation

1. Install dependencies:
```bash
npm install
```

2. Compile SASS to CSS (one-time):
```bash
npm run sass
```

Or watch for changes:
```bash
npm run sass:watch
```

3. Open `index.html` in your browser or use a local server.

## Project Structure

```
.
├── index.html          # Home page
├── contact.html        # Contact page
├── projects.html       # Projects page
├── styles/
│   ├── main.scss       # SASS source file
│   └── main.css        # Compiled CSS
├── js/
│   └── main.js         # JavaScript for interactivity
└── package.json        # Dependencies and scripts
```

## Customization

- Edit `styles/main.scss` to change colors, fonts, and styling
- Update project information in `projects.html`
- Modify contact information in `contact.html`
- Adjust company description in `index.html`

## Notes

- The contact form currently shows an alert on submission. To make it functional, you'll need to add a backend service or use a form service like Formspree.
- Project cards are placeholders - update them with your actual projects.

