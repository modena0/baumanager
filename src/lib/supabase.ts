import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://npcygxhgwqodmnqjwjnp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wY3lneGhnd3FvZG1ucWp3am5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzA5MDksImV4cCI6MjA5MjAwNjkwOX0.VCW_I_W9SVGA5DPi5R_q7leiy5t335sVucM75eYiWWY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);