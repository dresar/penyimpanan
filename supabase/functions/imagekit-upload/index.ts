import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

// Generate ImageKit authentication signature
function generateSignature(privateKey: string, token: string, expire: number): string {
  const signaturePayload = token + expire;
  
  // Use Web Crypto API for HMAC-SHA1
  const encoder = new TextEncoder();
  const keyData = encoder.encode(privateKey);
  const data = encoder.encode(signaturePayload);
  
  // Simple hash for demo - in production use proper HMAC
  let hash = 0;
  const str = signaturePayload + privateKey;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
    
    // Parse request body
    const { storageAccountId, filename, fileBase64, fileType, fileSize } = await req.json();

    if (!storageAccountId || !filename || !fileBase64 || !fileType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get storage credentials from database using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: credentials, error: credError } = await supabaseAdmin
      .from("storage_credentials")
      .select("*")
      .eq("id", storageAccountId)
      .eq("user_id", userId)
      .single();

    if (credError || !credentials) {
      return new Response(
        JSON.stringify({ error: "Storage account not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ImageKit private key from the stored credentials or environment
    // For this implementation, we'll use the stored private key from the database
    // The private_key_encrypted field should contain the actual private key
    const privateKey = credentials.private_key_encrypted;
    const publicKey = credentials.public_key;
    const urlEndpoint = credentials.url_endpoint;

    if (!privateKey || !publicKey || !urlEndpoint) {
      return new Response(
        JSON.stringify({ error: "Invalid storage account configuration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize filename
    const sanitizedFilename = filename
      .replace(/\.\./g, "")
      .replace(/[\/\\]/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/[<>'"&]/g, "")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .slice(0, 255);

    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${sanitizedFilename}`;
    const folder = `/${userId}`;

    // Upload to ImageKit using their Upload API
    const formData = new FormData();
    
    // Convert base64 to blob
    const base64Data = fileBase64.split(",")[1] || fileBase64;
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const blob = new Blob([binaryData], { type: fileType });
    
    formData.append("file", blob, uniqueFilename);
    formData.append("fileName", uniqueFilename);
    formData.append("folder", folder);
    formData.append("useUniqueFileName", "false");

    // Create Basic Auth header for ImageKit
    const authString = btoa(`${privateKey}:`);

    const uploadResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("ImageKit upload failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to upload to ImageKit", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const uploadResult = await uploadResponse.json();

    // Save file metadata to database
    const { data: fileData, error: fileError } = await supabaseAdmin
      .from("files")
      .insert({
        user_id: userId,
        storage_account_id: storageAccountId,
        name: sanitizedFilename,
        url: uploadResult.url,
        file_type: fileType,
        size: fileSize || uploadResult.size,
      })
      .select()
      .single();

    if (fileError) {
      console.error("Database insert error:", fileError);
      return new Response(
        JSON.stringify({ error: "Failed to save file metadata", details: fileError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log activity
    await supabaseAdmin.from("activity_logs").insert({
      user_id: userId,
      action_type: "file_upload",
      details: { file_name: sanitizedFilename, size: fileSize, imagekit_file_id: uploadResult.fileId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          id: fileData.id,
          name: sanitizedFilename,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          fileId: uploadResult.fileId,
          size: uploadResult.size,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
