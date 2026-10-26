import { isSupabaseConfigured } from './lib/supabase.js'
import './style.css'

const title = document.querySelector('#connection-title')
const message = document.querySelector('#connection-message')

if (isSupabaseConfigured) {
  title.textContent = 'Supabase is configured'
  message.textContent = 'The client is ready. Add your database tables and access policies when the app’s data needs are defined.'
} else {
  title.textContent = 'Supabase setup needed'
  message.textContent = 'Copy .env.example to .env and add your project URL and publishable key.'
}
