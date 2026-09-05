import { useEffect, useState } from "react";
import { HardDrive, FileIcon, Database, Upload, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StorageChart } from "@/components/dashboard/StorageChart";

interface Stats {
  totalFiles: number;
  totalSize: number;
  activeAccounts: number;
}

interface FileItem {
  id: string;
  name: string;
  file_type: string | null;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalFiles: 0, totalSize: 0, activeAccounts: 0 });
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch files count and size
      const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, size, name, file_type, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch storage accounts count
      const { count: accountsCount } = await supabase
        .from("storage_credentials")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Fetch all files for total stats
      const { data: allFiles } = await supabase
        .from("files")
        .select("size");

      if (!filesError && files) {
        setRecentFiles(files);
      }

      const totalSize = allFiles?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;
      
      setStats({
        totalFiles: allFiles?.length || 0,
        totalSize,
        activeAccounts: accountsCount || 0,
      });

      setLoading(false);
    };

    fetchData();

    // Set up realtime subscription for files
    const channel = supabase
      .channel('dashboard-files')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
        },
        () => {
          // Refetch data when files change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const statCards = [
    {
      title: "Total Penyimpanan Terpakai",
      value: formatBytes(stats.totalSize),
      icon: HardDrive,
      color: "from-blue-500 to-cyan-500",
    },
    {
      title: "Total Berkas",
      value: stats.totalFiles.toString(),
      icon: FileIcon,
      color: "from-purple-500 to-pink-500",
    },
    {
      title: "Akun Aktif",
      value: stats.activeAccounts.toString(),
      icon: Database,
      color: "from-teal-500 to-green-500",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Ringkasan akun penyimpanan Anda</p>
        </div>
        <Button onClick={() => navigate("/upload")} className="aurora-gradient">
          <Upload className="mr-2 h-4 w-4" />
          Unggah Berkas
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {statCards.map((stat, index) => (
          <Card key={stat.title} className="glass-card overflow-hidden animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg bg-gradient-to-br ${stat.color} p-2`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storage Chart */}
      <StorageChart />

      {/* Quick Actions & Recent Files */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Aksi Cepat
            </CardTitle>
            <CardDescription>Tugas umum untuk memulai</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start glass" onClick={() => navigate("/upload")}>
              <Upload className="mr-2 h-4 w-4" />
              Unggah Berkas Baru
            </Button>
            <Button variant="outline" className="justify-start glass" onClick={() => navigate("/storage-accounts")}>
              <Database className="mr-2 h-4 w-4" />
              Tambah Akun Penyimpanan
            </Button>
            <Button variant="outline" className="justify-start glass" onClick={() => navigate("/files")}>
              <FileIcon className="mr-2 h-4 w-4" />
              Jelajahi Manajer Berkas
            </Button>
          </CardContent>
        </Card>

        {/* Recent Files */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Unggahan Terbaru
            </CardTitle>
            <CardDescription>Berkas yang baru diunggah</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Memuat...</p>
            ) : recentFiles.length === 0 ? (
              <div className="text-center py-8">
                <FileIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">Belum ada berkas diunggah</p>
                <Button variant="link" onClick={() => navigate("/upload")}>
                  Unggah berkas pertama Anda
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {recentFiles.map((file) => (
                  <li key={file.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString("id-ID")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
