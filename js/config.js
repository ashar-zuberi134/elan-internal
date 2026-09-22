// Supabase connection details.
//
// The anon key is a public identifier, not a secret — it is designed to ship
// in client code. It grants nothing on its own: every table is behind RLS
// policies scoped to `authenticated`, so an unauthenticated caller holding
// this key can do exactly one thing, attempt a login.
export const SUPABASE_URL      = 'https://sofzlqjszuskvwlkxvhr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvZnpscWpzenVza3Z3bGt4dmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTcyMjYsImV4cCI6MjA5NjQ3MzIyNn0.SGkwZg1k89w5qxixLqfckCuVoPY5UPX4Af7QIc8bVFQ';

export const FOUNDED_ON = '2025-05-24';
