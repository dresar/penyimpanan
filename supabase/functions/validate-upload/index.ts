import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

// Allowed file types with their MIME types and magic numbers
const ALLOWED_FILE_TYPES: Record<string, { mimeTypes: string[]; magicBytes?: number[][] }> = {
  image: {
    mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
    magicBytes: [
      [0xff, 0xd8, 0xff], // JPEG
      [0x89, 0x50, 0x4e, 0x47], // PNG
      [0x47, 0x49, 0x46], // GIF
      [0x52, 0x49, 0x46, 0x46], // WebP (RIFF)
    ],
  },
  document: {
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ],
    magicBytes: [
      [0x25, 0x50, 0x44, 0x46], // PDF
      [0x50, 0x4b, 0x03, 0x04], // DOCX/XLSX (ZIP-based)
      [0xd0, 0xcf, 0x11, 0xe0], // DOC/XLS (OLE)
    ],
  },
  media: {
    mimeTypes: ["video/mp4", "video/webm", "audio/mpeg", "audio/wav"],
  },
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILENAME_LENGTH = 255;

// Sanitize filename to prevent path traversal and XSS
function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\./g, "").replace(/[\/\\]/g, "");

  // Remove HTML/script injection attempts
  sanitized = sanitized.replace(/<[^>]*>/g, "").replace(/[<>'"&]/g, "");

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, "");

  // Limit length
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const ext = sanitized.split(".").pop() || "";
    const base = sanitized.slice(0, MAX_FILENAME_LENGTH - ext.length - 1);
    sanitized = `${base}.${ext}`;
  }

  // If nothing left, generate a random name
  if (!sanitized || sanitized === ".") {
    sanitized = `file_${crypto.randomUUID().slice(0, 8)}`;
  }

  return sanitized;
}

// Validate file type matches claimed MIME type
function isAllowedMimeType(mimeType: string): boolean {
  const allMimeTypes = Object.values(ALLOWED_FILE_TYPES).flatMap((t) => t.mimeTypes);
  return allMimeTypes.includes(mimeType);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Tidak terautentikasi" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Token tidak valid" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claims.claims.sub;

    // Parse request body
    const body = await req.json();
    const { filename, fileType, fileSize, storageAccountId } = body;

    // Validate required fields
    if (!filename || !fileType || fileSize === undefined || !storageAccountId) {
      return new Response(
        JSON.stringify({ error: "Data berkas tidak lengkap" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size
    if (typeof fileSize !== "number" || fileSize <= 0) {
      return new Response(
        JSON.stringify({ error: "Ukuran berkas tidak valid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ 
          error: `Berkas terlalu besar. Maksimal ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    if (!isAllowedMimeType(fileType)) {
      return new Response(
        JSON.stringify({ 
          error: "Tipe berkas tidak diizinkan",
          allowedTypes: Object.values(ALLOWED_FILE_TYPES).flatMap((t) => t.mimeTypes)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(filename);

    // Verify storage account belongs to user
    const { data: account, error: accountError } = await supabase
      .from("storage_credentials")
      .select("id, name, is_active")
      .eq("id", storageAccountId)
      .eq("user_id", userId)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "Akun penyimpanan tidak ditemukan" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!account.is_active) {
      return new Response(
        JSON.stringify({ error: "Akun penyimpanan tidak aktif" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user's current storage usage (optional quota check)
    const { data: usageData } = await supabase
      .from("files")
      .select("size")
      .eq("user_id", userId);

    const totalUsed = (usageData || []).reduce((sum, f) => sum + (f.size || 0), 0);
    const USER_QUOTA = 1024 * 1024 * 1024; // 1GB per user

    if (totalUsed + fileSize > USER_QUOTA) {
      return new Response(
        JSON.stringify({ 
          error: "Kuota penyimpanan terlampaui",
          used: totalUsed,
          quota: USER_QUOTA
        }),
        { status: 507, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a secure file path
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const securePath = `${userId}/${timestamp}_${randomId}_${sanitizedFilename}`;

    // Return validation success with sanitized data
    return new Response(
      JSON.stringify({
        valid: true,
        sanitizedFilename,
        securePath,
        storageAccount: {
          id: account.id,
          name: account.name,
        },
        quotaRemaining: USER_QUOTA - totalUsed - fileSize,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ error: "Kesalahan validasi internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
