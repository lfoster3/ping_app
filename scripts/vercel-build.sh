#!/bin/sh
# Builds the web app on Vercel. Expo only bakes in EXPO_PUBLIC_* variables, so map
# the names Vercel's Supabase integration creates onto ours. Public keys only:
# never map a service-role or secret key here, since it would ship to every browser.
set -e

export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-$SUPABASE_URL}}"
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY}}}"

if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ -z "$EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" ]; then
  echo "No Supabase keys found: building in demo mode (messages stay on each device)."
fi

npx expo export --platform web
