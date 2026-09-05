import { useState, useEffect, useCallback } from "react";
import { Upload, CloudUpload, FileIcon, X, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Security: Allowed file types and size limits
const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/wav"
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILENAME_LENGTH = 255;

interface StorageAccount {
  id: string;
  name: string;
  is_active: boolean;
}

interface UploadFile {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

// Sanitize filename client-side (server also sanitizes)
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, "")
    .replace(/[\/\\]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>'"&]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, MAX_FILENAME_LENGTH);
}

// Validate file before adding to queue
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Tipe berkas "${file.type}" tidak diizinkan` };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Berkas terlalu besar (maks ${MAX_FILE_SIZE / (1024 * 1024)}MB)` };
  }
  if (file.size === 0) {
    return { valid: false, error: "Berkas kosong" };
  }
  return { valid: true };
}

export default function UploadCenter() {
  const [accounts, setAccounts] = useState<StorageAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { user, session } = useAuth();

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("storage_credentials")
      .select("id, name, is_active")
      .eq("is_active", true);

    if (!error && data) {
      setAccounts(data);
      if (data.length > 0) {
        setSelectedAccount(data[0].id);
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (files: File[]) => {
    const validatedFiles: UploadFile[] = [];
    
    for (const file of files) {
      const validation = validateFile(file);
      if (validation.valid) {
        validatedFiles.push({
          file,
          progress: 0,
          status: "pending" as const,
        });
      } else {
        toast.error(`${file.name}: ${validation.error}`);
      }
    }
    
    if (validatedFiles.length > 0) {
      setUploadFiles((prev) => [...prev, ...validatedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadAllFiles = async () => {
    if (!selectedAccount) {
      toast.error("Silakan pilih akun penyimpanan terlebih dahulu");
      return;
    }

    if (!session?.access_token) {
      toast.error("Sesi tidak valid. Silakan login kembali.");
      return;
    }

    for (let i = 0; i < uploadFiles.length; i++) {
      if (uploadFiles[i].status !== "pending") continue;

      const currentFile = uploadFiles[i];

      setUploadFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading" as const, progress: 10 } : f
        )
      );

      try {
        // Convert file to base64
        const reader = new FileReader();
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(currentFile.file);
        });

        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, progress: 30 } : f
          )
        );

        // Upload to ImageKit via edge function
        const uploadResponse = await supabase.functions.invoke("imagekit-upload", {
          body: {
            storageAccountId: selectedAccount,
            filename: currentFile.file.name,
            fileBase64: fileBase64,
            fileType: currentFile.file.type,
            fileSize: currentFile.file.size,
          },
        });

        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, progress: 90 } : f
          )
        );

        if (uploadResponse.error || !uploadResponse.data?.success) {
          const errorMsg = uploadResponse.data?.error || uploadResponse.error?.message || "Upload gagal";
          setUploadFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: "error" as const, error: errorMsg } : f
            )
          );
          toast.error(`${currentFile.file.name}: ${errorMsg}`);
          continue;
        }

        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success" as const, progress: 100 } : f
          )
        );
        
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
        setUploadFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error" as const, error: errorMsg } : f
          )
        );
      }
    }

    toast.success("Unggahan selesai!");
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Pusat Unggah</h1>
        <p className="text-muted-foreground">Unggah berkas ke akun penyimpanan Anda</p>
      </div>

      {/* Account Selection */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Pilih Akun Penyimpanan</CardTitle>
          <CardDescription>Pilih akun untuk mengunggah berkas</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground">
              Belum ada akun penyimpanan dikonfigurasi.{" "}
              <a href="/storage-accounts" className="text-primary hover:underline">
                Tambahkan terlebih dahulu
              </a>
            </p>
          ) : (
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-full max-w-xs glass">
                <SelectValue placeholder="Pilih akun" />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center transition-all
              ${isDragging
                ? "border-primary bg-primary/10"
                : "border-border/50 hover:border-primary/50 hover:bg-accent/50"
              }
            `}
          >
            <CloudUpload className={`mx-auto h-16 w-16 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <p className="mt-4 text-lg font-medium">
              {isDragging ? "Lepaskan berkas di sini" : "Seret dan lepas berkas di sini"}
            </p>
            <p className="mt-2 text-muted-foreground">atau</p>
            <label>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button variant="outline" className="mt-4 glass hover-glow" asChild>
                <span>Jelajahi Berkas</span>
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Upload Queue */}
      {uploadFiles.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Antrian Unggah</CardTitle>
              <CardDescription>{uploadFiles.length} berkas dipilih</CardDescription>
            </div>
            <Button onClick={uploadAllFiles} className="aurora-gradient">
              <Upload className="mr-2 h-4 w-4" />
              Unggah Semua
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadFiles.map((uploadFile, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <FileIcon className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadFile.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatBytes(uploadFile.file.size)}
                    </p>
                    {uploadFile.status === "uploading" && (
                      <Progress value={uploadFile.progress} className="mt-2 h-1" />
                    )}
                  </div>
                  <div className="shrink-0">
                    {uploadFile.status === "pending" && (
                      <Button size="icon" variant="ghost" onClick={() => removeFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {uploadFile.status === "uploading" && (
                      <span className="text-sm text-muted-foreground">{uploadFile.progress}%</span>
                    )}
                    {uploadFile.status === "success" && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {uploadFile.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
