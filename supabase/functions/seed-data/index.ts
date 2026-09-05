import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.user.id;

    // Seed Categories
    const categories = [
      { name: "Dokumen Skripsi", color: "#3B82F6", icon: "folder", sort_order: 0 },
      { name: "Aset Website Invywed", color: "#8B5CF6", icon: "folder", sort_order: 1 },
      { name: "Foto Pribadi", color: "#EC4899", icon: "folder", sort_order: 2 },
      { name: "Bahan Desain", color: "#22C55E", icon: "folder", sort_order: 3 },
    ];

    const { data: insertedCategories, error: categoriesError } = await supabase
      .from("categories")
      .upsert(
        categories.map((cat) => ({ ...cat, user_id: userId })),
        { onConflict: 'id' }
      )
      .select();

    if (categoriesError) {
      console.error("Error seeding categories:", categoriesError);
    }

    // Seed Storage Credentials (dummy accounts)
    const storageAccounts = [
      {
        name: "Akun ImageKit Utama",
        public_key: "dummy_public_key_1",
        private_key_encrypted: "dummy_private_key_encrypted_1",
        url_endpoint: "https://ik.imagekit.io/dummy_account_1",
        is_active: true,
      },
      {
        name: "Akun ImageKit Cadangan",
        public_key: "dummy_public_key_2",
        private_key_encrypted: "dummy_private_key_encrypted_2",
        url_endpoint: "https://ik.imagekit.io/dummy_account_2",
        is_active: true,
      },
    ];

    const { data: insertedAccounts, error: accountsError } = await supabase
      .from("storage_credentials")
      .upsert(
        storageAccounts.map((acc) => ({ ...acc, user_id: userId })),
        { onConflict: 'id' }
      )
      .select();

    if (accountsError) {
      console.error("Error seeding storage accounts:", accountsError);
    }

    // Get the first account ID for file seeding
    const firstAccountId = insertedAccounts?.[0]?.id;

    // Seed Files (dummy files)
    if (firstAccountId) {
      const files = [
        { name: "proposal-skripsi.pdf", file_type: "application/pdf", size: 2458624, url: "https://via.placeholder.com/150" },
        { name: "bab-1-pendahuluan.docx", file_type: "application/msword", size: 1024000, url: "https://via.placeholder.com/150" },
        { name: "hero-image.png", file_type: "image/png", size: 512000, url: "https://via.placeholder.com/600x400" },
        { name: "logo-invywed.svg", file_type: "image/svg+xml", size: 24576, url: "https://via.placeholder.com/200" },
        { name: "foto-wisuda.jpg", file_type: "image/jpeg", size: 3145728, url: "https://via.placeholder.com/800x600" },
        { name: "foto-keluarga.jpg", file_type: "image/jpeg", size: 2621440, url: "https://via.placeholder.com/800x600" },
        { name: "mockup-website.psd", file_type: "application/octet-stream", size: 15728640, url: "https://via.placeholder.com/150" },
        { name: "icon-pack.zip", file_type: "application/zip", size: 5242880, url: "https://via.placeholder.com/150" },
        { name: "presentasi-sidang.pptx", file_type: "application/vnd.ms-powerpoint", size: 8388608, url: "https://via.placeholder.com/150" },
        { name: "video-dokumentasi.mp4", file_type: "video/mp4", size: 52428800, url: "https://via.placeholder.com/150" },
      ];

      const { error: filesError } = await supabase
        .from("files")
        .insert(
          files.map((file, index) => ({
            ...file,
            user_id: userId,
            storage_account_id: index % 2 === 0 ? firstAccountId : insertedAccounts?.[1]?.id || firstAccountId,
          }))
        );

      if (filesError) {
        console.error("Error seeding files:", filesError);
      }

      // Seed Activity Logs
      const activityLogs = [
        { action_type: "file_upload", details: { file_name: "proposal-skripsi.pdf", size: 2458624 } },
        { action_type: "file_upload", details: { file_name: "hero-image.png", size: 512000 } },
        { action_type: "account_created", details: { account_name: "Akun ImageKit Utama" } },
        { action_type: "file_upload", details: { file_name: "foto-wisuda.jpg", size: 3145728 } },
      ];

      const { error: logsError } = await supabase
        .from("activity_logs")
        .insert(activityLogs.map((log) => ({ ...log, user_id: userId })));

      if (logsError) {
        console.error("Error seeding activity logs:", logsError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data dummy berhasil ditambahkan",
        data: {
          categories: insertedCategories?.length || 0,
          storageAccounts: insertedAccounts?.length || 0,
          files: 10,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in seed-data function:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
