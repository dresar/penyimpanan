import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Database, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface StorageCredential {
  id: string;
  name: string;
  public_key: string;
  private_key_encrypted: string;
  url_endpoint: string;
  is_active: boolean;
  created_at: string;
}

export default function StorageAccounts() {
  const [accounts, setAccounts] = useState<StorageCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<StorageCredential | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    public_key: "",
    private_key: "",
    url_endpoint: "",
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("storage_credentials")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Gagal mengambil akun");
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.public_key || !formData.url_endpoint) {
      toast.error("Mohon isi semua kolom yang wajib");
      return;
    }

    if (!editingAccount && !formData.private_key) {
      toast.error("Private key wajib untuk akun baru");
      return;
    }

    const payload = {
      name: formData.name,
      public_key: formData.public_key,
      url_endpoint: formData.url_endpoint,
      ...(formData.private_key && { private_key_encrypted: formData.private_key }),
      user_id: user?.id,
    };

    if (editingAccount) {
      const { error } = await supabase
        .from("storage_credentials")
        .update(payload)
        .eq("id", editingAccount.id);

      if (error) {
        toast.error("Gagal memperbarui akun");
      } else {
        toast.success("Akun berhasil diperbarui");
        fetchAccounts();
      }
    } else {
      const { error } = await supabase
        .from("storage_credentials")
        .insert({ ...payload, private_key_encrypted: formData.private_key });

      if (error) {
        toast.error("Gagal membuat akun");
      } else {
        toast.success("Akun berhasil dibuat");
        fetchAccounts();

        // Log activity
        await supabase.from("activity_logs").insert({
          user_id: user?.id,
          action_type: "account_created",
          details: { account_name: formData.name },
        });
      }
    }

    resetForm();
  };

  const toggleAccountStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("storage_credentials")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("Gagal memperbarui status");
    } else {
      toast.success(`Akun ${!currentStatus ? "diaktifkan" : "dinonaktifkan"}`);
      fetchAccounts();
    }
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase
      .from("storage_credentials")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Gagal menghapus akun");
    } else {
      toast.success("Akun dihapus");
      fetchAccounts();
    }
  };

  const resetForm = () => {
    setFormData({ name: "", public_key: "", private_key: "", url_endpoint: "" });
    setEditingAccount(null);
    setIsDialogOpen(false);
  };

  const openEditDialog = (account: StorageCredential) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      public_key: account.public_key,
      private_key: "",
      url_endpoint: account.url_endpoint,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Akun Penyimpanan</h1>
          <p className="text-muted-foreground">Kelola kredensial penyimpanan ImageKit Anda</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="aurora-gradient">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Akun
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader>
              <DialogTitle>{editingAccount ? "Edit Akun" : "Tambah Akun Penyimpanan"}</DialogTitle>
              <DialogDescription>
                {editingAccount
                  ? "Perbarui kredensial ImageKit Anda"
                  : "Hubungkan akun ImageKit baru untuk mengunggah berkas"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Akun</Label>
                <Input
                  id="name"
                  placeholder="Akun ImageKit Saya"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="glass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="public_key">Public Key</Label>
                <Input
                  id="public_key"
                  placeholder="public_xxx..."
                  value={formData.public_key}
                  onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                  className="glass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="private_key">
                  Private Key {editingAccount && "(kosongkan untuk mempertahankan yang ada)"}
                </Label>
                <Input
                  id="private_key"
                  type="password"
                  placeholder="private_xxx..."
                  value={formData.private_key}
                  onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                  className="glass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url_endpoint">URL Endpoint</Label>
                <Input
                  id="url_endpoint"
                  placeholder="https://ik.imagekit.io/your_id"
                  value={formData.url_endpoint}
                  onChange={(e) => setFormData({ ...formData, url_endpoint: e.target.value })}
                  className="glass"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>Batal</Button>
              <Button onClick={handleSubmit} className="aurora-gradient">
                {editingAccount ? "Perbarui" : "Buat"} Akun
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Memuat akun...</p>
        </div>
      ) : accounts.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-xl font-medium">Belum ada akun penyimpanan</p>
            <p className="text-muted-foreground">Tambahkan akun ImageKit pertama Anda untuk mulai mengunggah</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="glass-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{account.name}</CardTitle>
                  <Badge variant={account.is_active ? "default" : "secondary"}>
                    {account.is_active ? (
                      <><CheckCircle className="mr-1 h-3 w-3" /> Aktif</>
                    ) : (
                      <><XCircle className="mr-1 h-3 w-3" /> Nonaktif</>
                    )}
                  </Badge>
                </div>
                <CardDescription className="truncate">{account.url_endpoint}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Switch
                    checked={account.is_active}
                    onCheckedChange={() => toggleAccountStatus(account.id, account.is_active)}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dibuat</span>
                  <span>{new Date(account.created_at).toLocaleDateString("id-ID")}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 glass"
                    onClick={() => openEditDialog(account)}
                  >
                    <Edit2 className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass"
                    asChild
                  >
                    <a href={account.url_endpoint} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteAccount(account.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
