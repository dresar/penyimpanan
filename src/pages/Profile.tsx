import { useState, useEffect } from "react";
import { User, Mail, Calendar, Camera, Save, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      setFullName(data.full_name || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Gagal memperbarui profil");
    } else {
      toast.success("Profil berhasil diperbarui");
      fetchProfile();
    }

    setIsSaving(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Memuat profil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Profil</h1>
        <p className="text-muted-foreground">Kelola detail akun Anda</p>
      </div>

      {/* Profile Card */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center md:flex-row md:items-start gap-8">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="h-32 w-32 border-4 border-primary/20">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="text-3xl aurora-gradient text-white">
                  {getInitials(fullName || user?.email || "U")}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full glass"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-6 w-full">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Masukkan nama Anda"
                  className="glass"
                />
              </div>

              <div className="space-y-2">
                <Label>Alamat Email</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{user?.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Anggota Sejak</Label>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "N/A"}
                  </span>
                </div>
              </div>

              <Button onClick={handleSave} className="aurora-gradient" disabled={isSaving}>
                {isSaving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription>ID Pengguna</CardDescription>
            <CardTitle className="text-sm font-mono truncate">{user?.id}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription>Penyedia Autentikasi</CardDescription>
            <CardTitle className="text-sm">Email</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription>Status Akun</CardDescription>
            <CardTitle className="text-sm text-green-500">Aktif</CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
