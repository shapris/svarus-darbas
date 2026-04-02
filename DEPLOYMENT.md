# Langių Valymas CRM - Deployment Instructions

## Vercel — teisingas projektas (nesumaišykite)

**Produkcijos URL:** [https://svarus-darbas.vercel.app](https://svarus-darbas.vercel.app/)

Tai **ne** `svarus-darbas-1.vercel.app` — tai gali būti kitas Vercel projektas su panašiu pavadinimu.

- **Rekomenduota:** GitHub `shapris/svarus-darbas` → Vercel integracija, projektas **svarus-darbas** → deploy automatiškai po `git push` į `main`.
- **CLI iš šio repo:** `npx vercel link` → pasirinkite **svarus-darbas**, tada `npm run deploy:vercel`.

## Quick Start

### 1. Database Setup (Supabase)

1. Go to https://supabase.com and create a new project
2. Open SQL Editor and run the schema from `DATABASE_SETUP.md`
3. Enable Email provider in Authentication → Providers
4. Copy Project URL and Anon Key

### 2. Environment Configuration

```bash
# Copy example file
cp .env.example .env

# Edit .env with your credentials:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENROUTER_API_KEY=sk-or-v1-your-key  # Optional for AI
```

### 3. Deploy to Netlify

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Deploy (requires Netlify CLI)
npx netlify deploy --prod --dir=dist
```

Or use Git integration:
1. Push to GitHub
2. Connect repo to Netlify
3. Set environment variables in Netlify dashboard
4. Deploy automatically on push

## Features

### ✅ Completed
- **Authentication** - Full login/register with Supabase Auth
- **CRM Core** - Clients, Orders, Expenses management
- **SMS Reminders** - Automatic reminders to clients
- **Client Segmentation** - VIP, Regular, New, At Risk, Inactive
- **Analytics** - Real-time business metrics and forecasting
- **Mobile Responsive** - Works on all devices
- **PWA** - Install as app, works offline
- **Performance** - Optimized with caching and lazy loading
- **Security** - Input validation, rate limiting, secure headers

### 🔧 Technical Stack
- React 19 + TypeScript
- Tailwind CSS + Framer Motion
- Supabase (Postgres + Auth)
- Recharts (Analytics)
- PWA with Service Worker

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| VITE_SUPABASE_URL | ✅ | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | ✅ | Supabase anon key |
| VITE_OPENROUTER_API_KEY | ❌ | For AI chat assistant |
| VITE_USE_FIREBASE | ❌ | Set to `true` for Firebase instead |

## Security Checklist

- [ ] Enable RLS on all tables
- [ ] Set up proper auth policies
- [ ] Use strong passwords (8+ chars, mixed case, numbers)
- [ ] Enable 2FA in Supabase (optional)
- [ ] Regular API key rotation
- [ ] Monitor Supabase logs

## Troubleshooting

### "Failed to load resource" errors
- Check if Supabase URL is correct
- Verify tables exist with proper RLS policies
- Check browser console for CORS issues

### AI Assistant not working
- Verify OpenRouter API key is valid
- Check if key starts with `sk-or-v1-`
- Monitor OpenRouter dashboard for usage

### Charts not displaying
- Ensure container has explicit height
- Check if data is being fetched properly

## Support

For issues:
1. Check browser console for errors
2. Verify environment variables
3. Test database connection in Supabase dashboard
4. Review logs in Netlify/Supabase

## Production Checklist

- [ ] Environment variables set
- [ ] Database migrated
- [ ] RLS policies enabled
- [ ] Auth configured
- [ ] Custom domain (optional)
- [ ] SSL enabled (automatic on Netlify)
- [ ] Analytics/monitoring setup
- [ ] Backup strategy

## Next Steps

1. **Customize** - Update branding, colors, logo
2. **Integrate** - Add payment processing, email notifications
3. **Scale** - Add team management, multi-location support
4. **Optimize** - Monitor performance, optimize queries

**Ready for production!** 🚀
