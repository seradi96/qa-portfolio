# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this QA Portfolio repository.

## Project Overview

This is a professional QA Automation Engineer portfolio website showcasing testing expertise, built with modern web technologies:

- **Next.js 14.0.4** (App Router) - React framework with server-side rendering
- **TypeScript** with strict mode - Type-safe development
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **React 18** - Component-based UI library
- **Heroicons 2.2.0** - Beautiful hand-crafted SVG icons

### Target Audience
QA professionals, hiring managers, and potential collaborators looking to understand testing capabilities and project experience.

### Live Status
✅ **Currently Working**: The portfolio is successfully rendering with proper styling, dark theme, and responsive design.

## Essential Commands

```bash
# Development
npm run dev          # Start development server at http://localhost:3000
npm install          # Install all dependencies from package.json

# Production
npm run build        # Build optimized production bundle
npm run start        # Start production server (requires build first)

# Code Quality
npm run lint         # Run ESLint with Next.js rules
npm run lint --fix   # Auto-fix linting issues where possible

# Package Management
npm install <package>     # Add new dependency
npm install -D <package>  # Add development dependency
npm update               # Update all packages to latest compatible versions

# Troubleshooting
rm -rf .next && npm run dev    # Clear cache and restart
rm -rf node_modules && npm install  # Reinstall dependencies
```

## Architecture & File Structure

### Current Directory Structure
```
qa-portfolio/
├── src/
│   └── app/
│       ├── page.tsx          # Main portfolio page (client component)
│       ├── layout.tsx        # Root layout with metadata and Inter/JetBrains fonts
│       ├── globals.css       # Global styles with Tailwind directives + smooth scroll
│       └── favicon.ico       # Site favicon
├── public/                   # Static assets (images, icons)
├── package.json              # Dependencies and scripts
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration with @/* path alias
├── next.config.js           # Next.js configuration (minimal)
├── postcss.config.js        # PostCSS configuration for Tailwind (CRITICAL)
└── CLAUDE.md               # This file
```

### Critical Configuration Files

#### PostCSS Configuration (ESSENTIAL)
**File**: `postcss.config.js`
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```
⚠️ **IMPORTANT**: This file is REQUIRED for Tailwind CSS to work. Without it, styles will not load.

#### Global CSS Setup
**File**: `src/app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html {
  scroll-behavior: smooth;  /* Enables smooth scrolling for navigation */
}

body {
  overflow-x: hidden;  /* Prevents horizontal scroll */
}
```

#### Layout Configuration
**File**: `src/app/layout.tsx`
- Uses **Inter** and **JetBrains Mono** fonts from Google Fonts
- Includes proper metadata for SEO
- Applies fonts with CSS variables (`--font-inter`, `--font-mono`)

#### Tailwind Configuration
**File**: `tailwind.config.js`
- Content paths configured for `src/` directory
- Extended theme with gradient utilities
- No custom plugins currently

## Current Implementation Details

### Component Architecture
- **Single Page Application**: All content on one scrollable page with sections
- **Client-Side Interactivity**: Uses React hooks for state management
- **Section-Based Layout**: Hero, About, Projects, Skills, Contact sections
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Fixed Navigation**: Sticky header with backdrop blur effect

### Active Features
```typescript
// Current state management patterns
const [activeProject, setActiveProject] = useState(0)  // Interactive project showcase
```

### Visual Design System
```css
/* Implemented color scheme */
Background: bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900
Primary Gradient: from-purple-400 to-pink-600
Navigation: bg-black/20 backdrop-blur-md
Cards: bg-white/5 border border-white/10
Text: text-white (primary), text-gray-300 (secondary), text-gray-400 (muted)
```

### Interactive Components
1. **Project Showcase**: Tabbed interface with clickable project cards
2. **Navigation**: Smooth scroll to sections with hover effects
3. **Buttons**: Gradient and outline styles with hover animations
4. **Status Badges**: Dynamic color-coding for project status

### Responsive Breakpoints
- **Mobile**: Default (< 640px)
- **Tablet**: md: (768px+) - 2-column layouts
- **Desktop**: lg: (1024px+) - Multi-column grids
- **Large**: xl: (1280px+) - Full layout width

## Dependencies & Package Management

### Production Dependencies
```json
{
  "@heroicons/react": "^2.2.0",    // Icon library
  "next": "14.0.4",                // React framework
  "react": "^18",                  // UI library
  "react-dom": "^18"               // React DOM rendering
}
```

### Development Dependencies
```json
{
  "@types/node": "^20",            // Node.js type definitions
  "@types/react": "^18",           // React type definitions
  "@types/react-dom": "^18",       // React DOM type definitions
  "autoprefixer": "^10.4.21",     // CSS vendor prefixing
  "eslint": "^8",                  // Code linting
  "eslint-config-next": "14.0.4", // Next.js ESLint rules
  "postcss": "^8.5.6",           // CSS processing
  "tailwindcss": "^3.4.17",      // CSS framework
  "typescript": "^5"               // Type checking
}
```

## Development Workflow

### Making Changes
1. **Content Updates**: Modify arrays in `src/app/page.tsx`
   - `projects` array for project information
   - `skills` object for technical skills
   - Contact information and social links

2. **Styling Changes**: Use Tailwind utility classes
   - Follow existing patterns: `bg-white/5`, `rounded-2xl`, `border-white/10`
   - Maintain consistent spacing: `px-6`, `py-20`, `mb-12`

3. **Adding Sections**: 
   - Add new section element in main component
   - Include navigation link in header
   - Follow responsive grid patterns

### Testing Changes
```bash
# Always test after changes
npm run dev
# Check browser at http://localhost:3000
# Verify Network tab shows CSS loading
# Test responsive design at different breakpoints
```

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. Styles Not Loading (White Background)
**Symptoms**: Page shows unstyled HTML with white background
**Cause**: Missing or incorrect PostCSS configuration
**Solution**:
```bash
# Ensure postcss.config.js exists in project root
# Content should be:
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

# Then restart:
rm -rf .next
npm run dev
```

#### 2. TypeScript Errors
**Check**: Import paths and component props
**Solution**: Use proper typing, avoid `any`

#### 3. Build Errors
**Check**: All imports are correct, no unused variables
**Solution**: Run `npm run lint` to identify issues

#### 4. Icons Not Displaying
**Check**: Heroicons import syntax
**Correct Format**: `import { IconName } from '@heroicons/react/24/outline'`

### Performance Considerations
- **Bundle Size**: Current setup is optimized for fast loading
- **Images**: Use Next.js `Image` component when adding photos
- **CSS**: Tailwind automatically purges unused styles in production

## Customization Guide

### Updating Personal Information
1. **Name**: Update in navigation and hero section
2. **Email**: Change `mailto:your.email@example.com` to actual email
3. **LinkedIn**: Verify URL is correct
4. **Location**: Update "Romania" if needed
5. **Experience**: Modify "3+ Years Experience" as appropriate

### Adding New Projects
```typescript
// Add to projects array in page.tsx
{
  title: "Your Project Name",
  description: "Detailed description of the project",
  technologies: ["Tech1", "Tech2", "Tech3"],
  highlights: ["Feature 1", "Feature 2", "Feature 3"],
  status: "Production" // or "In Progress"
}
```

### Modifying Skills
```typescript
// Update skills object in page.tsx
const skills = {
  "Category Name": ["Skill 1", "Skill 2", "Skill 3"],
  // Add new categories as needed
}
```

## Deployment Ready

### Build Process
```bash
npm run build    # Creates optimized production build
npm run start    # Serves production build locally
```

### Deployment Platforms
1. **Vercel** (Recommended): 
   - Connect GitHub repository
   - Automatic deployments on push
   - Zero configuration needed

2. **Netlify**: 
   - Drag and drop build folder
   - Or connect to Git repository

3. **GitHub Pages**: 
   - Requires static export configuration

### SEO Optimizations (Already Included)
- Proper meta tags in layout.tsx
- Semantic HTML structure
- Accessible navigation
- Performance optimized

## Future Enhancement Opportunities

### Quick Wins
- Add project screenshots/demos
- Include real email address
- Add more detailed project descriptions
- Include certifications section

### Advanced Features
- Contact form with email service
- Blog section for technical articles
- Project filtering by technology
- Dark/light theme toggle
- Analytics integration

## QA Professional Focus

This portfolio is specifically designed for QA Automation Engineers:

### Current Emphasis
- **Testing Frameworks**: Selenium, Cypress, TestNG, Appium
- **Programming Languages**: Java, JavaScript, Python, C#
- **CI/CD Integration**: Jenkins, Docker, Git
- **Quality Assurance**: Comprehensive testing strategies

### Recommended Additions
- **Certifications**: ISTQB, Selenium certifications
- **Testing Methodologies**: Agile, BDD, TDD approaches
- **Metrics**: Test coverage, defect detection rates
- **Case Studies**: Specific testing challenges solved

Remember: This portfolio represents professional QA expertise and should emphasize quality, reliability, and comprehensive testing approaches that align with industry standards.