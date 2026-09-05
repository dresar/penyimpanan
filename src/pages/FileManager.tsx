import { useState, useEffect } from "react";
import { Search, Grid, List, FileIcon, Image, Video, FileText, Trash2, Download, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FileItem {
  id: string;
  name: string;
  url: string;
  file_type: string | null;
  size: number;
  created_at: string;
  storage_account_id: string | null;
}

export default function FileManager() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    fetchFiles();

    // Set up realtime subscription
    const channel = supabase
      .channel('file-manager-files')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setFiles((prev) => [payload.new as FileItem, ...prev]);
            toast.success(`Berkas baru ditambahkan: ${(payload.new as FileItem).name}`);
          } else if (payload.eventType === 'DELETE') {
            setFiles((prev) => prev.filter((f) => f.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setFiles((prev) =>
              prev.map((f) => (f.id === payload.new.id ? (payload.new as FileItem) : f))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    filterFiles();
  }, [files, searchQuery, typeFilter]);

  const fetchFiles = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Gagal mengambil berkas");
    } else {
      setFiles(data || []);
    }
    setLoading(false);
  };

  const filterFiles = () => {
    let result = [...files];

    if (searchQuery) {
      result = result.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((f) => f.file_type?.startsWith(typeFilter));
    }

    setFilteredFiles(result);
  };

  const deleteFile = async (id: string) => {
    const { error } = await supabase.from("files").delete().eq("id", id);

    if (error) {
      toast.error("Gagal menghapus berkas");
    } else {
      toast.success("Berkas dihapus");
      setFiles(files.filter((f) => f.id !== id));
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return FileIcon;
    if (type.startsWith("image")) return Image;
    if (type.startsWith("video")) return Video;
    return FileText;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kelola Berkas</h1>
          <p className="text-muted-foreground">Kelola berkas yang telah diunggah</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari berkas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 glass"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40 glass">
                <SelectValue placeholder="Filter berdasarkan tipe" />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="image">Gambar</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="application">Dokumen</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "aurora-gradient" : "glass"}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "aurora-gradient" : "glass"}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Memuat berkas...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileIcon className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-xl font-medium">Tidak ada berkas ditemukan</p>
            <p className="text-muted-foreground">Unggah beberapa berkas untuk memulai</p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredFiles.map((file) => {
            const Icon = getFileIcon(file.file_type);
            return (
              <Card key={file.id} className="glass-card hover-scale cursor-pointer group">
                <CardContent className="p-4">
                  <div className="aspect-square rounded-lg bg-muted/50 flex items-center justify-center mb-3 relative overflow-hidden">
                    {file.file_type?.startsWith("image") ? (
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <Icon className="h-12 w-12 text-primary" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="icon" variant="secondary" onClick={() => setSelectedFile(file)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="secondary" asChild>
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => deleteFile(file.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {filteredFiles.map((file) => {
                const Icon = getFileIcon(file.file_type);
                return (
                  <div key={file.id} className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatBytes(file.size)} • {new Date(file.created_at).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => setSelectedFile(file)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" asChild>
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteFile(file.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="max-w-3xl glass-strong" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{selectedFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {selectedFile?.file_type?.startsWith("image") ? (
              <img src={selectedFile.url} alt={selectedFile.name} className="w-full rounded-lg" />
            ) : selectedFile?.file_type?.startsWith("video") ? (
              <video src={selectedFile.url} controls className="w-full rounded-lg" />
            ) : (
              <div className="flex flex-col items-center py-12">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Pratinjau tidak tersedia</p>
                <Button className="mt-4" asChild>
                  <a href={selectedFile?.url} target="_blank" rel="noopener noreferrer">
                    Buka di tab baru
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
