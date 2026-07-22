/* ================================================================
   TENKA — CONFIGURATION
   Seul fichier à modifier pour brancher le site sur ton projet.
   ================================================================ */

const SUPABASE_URL = "https://nliyuzzvsqizhafzdmsq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5saXl1enp2c3FpemhhZnpkbXNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTM0NjQsImV4cCI6MjEwMDI4OTQ2NH0.CQLbPeR3pJuyGu2sb_Nej5LKp5gvgmju3_pHVCvstBw";

// Adresse du serveur Minecraft (affichée + utilisée pour le statut)
const MC_HOST = "play.tenka.fr"; // ← à remplacer par ta vraie IP

// Mode démo automatique si l'URL n'est pas configurée
const DEMO_MODE = SUPABASE_URL.includes("TON-PROJET");
