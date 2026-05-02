import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatGHS } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type RowItem = {
  formTypeId: string;
  schoolName: string;
  formTypeName: string;
  basePrice: number;
};

export default function MyStoreUniversityForms() {
  const { profile, isSeller } = useAuth();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [rows, setRows] = useState<RowItem[]>([]);
  const [prices, setPrices] = useState<Record<string, { price: number; listed: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !isSeller) return;

    const load = async () => {
      setLoading(true);

      const { data: storeRow } = await supabase
        .from("agent_stores")
        .select("id,store_name,slug")
        .eq("agent_id", profile.user_id)
        .maybeSingle();

      setStore(storeRow || null);

      if (!storeRow) {
        setLoading(false);
        return;
      }

      const [{ data: formTypes }, { data: storePrices }] = await Promise.all([
        (supabase as any)
          .from("university_form_types")
          .select("id,name,price,is_active,school:university_schools(id,name,is_published)")
          .eq("is_active", true),
        (supabase as any)
          .from("store_university_form_prices")
          .select("form_type_id,selling_price,is_listed")
          .eq("store_id", storeRow.id),
      ]);

      const available = (formTypes || [])
        .filter((ft: any) => ft.school?.is_published)
        .map((ft: any) => ({
          formTypeId: ft.id,
          schoolName: String(ft.school?.name || "School"),
          formTypeName: String(ft.name || "Form"),
          basePrice: Number(ft.price || 0),
        }))
        .sort((a: RowItem, b: RowItem) => {
          const schoolSort = a.schoolName.localeCompare(b.schoolName);
          if (schoolSort !== 0) return schoolSort;
          return a.formTypeName.localeCompare(b.formTypeName);
        });

      const map: Record<string, { price: number; listed: boolean }> = {};
      available.forEach((item: RowItem) => {
        const existing = (storePrices || []).find((sp: any) => sp.form_type_id === item.formTypeId);
        map[item.formTypeId] = {
          price: existing ? Number(existing.selling_price) : item.basePrice,
          listed: existing ? Boolean(existing.is_listed) : true,
        };
      });

      setRows(available);
      setPrices(map);
      setLoading(false);
    };

    load();
  }, [profile, isSeller]);

  const saveRow = async (item: RowItem) => {
    if (!store) return;
    const row = prices[item.formTypeId];
    if (!row) return;

    if (Number(row.price) < Number(item.basePrice)) {
      toast.error(`Selling price must be at least ${formatGHS(item.basePrice)}`);
      return;
    }

    setSavingId(item.formTypeId);
    const { error } = await (supabase as any)
      .from("store_university_form_prices")
      .upsert(
        {
          store_id: store.id,
          form_type_id: item.formTypeId,
          selling_price: Number(row.price),
          is_listed: row.listed,
        },
        { onConflict: "store_id,form_type_id" },
      );
    setSavingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("University form pricing saved");
  };

  if (!isSeller) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Store University Forms" description="You need an active seller account to manage this page." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Store University Forms" description="Loading your store catalog..." />
        <Card className="p-10 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading...
        </Card>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Store University Forms" description="Create your store first to manage university forms." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Store University Forms"
        description="List admin-approved university forms on your mini store and set your own profit."
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Store</p>
          <p className="font-semibold mt-1">{store.store_name}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Available Forms</p>
          <p className="font-semibold mt-1">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Public URL</p>
          <p className="font-mono text-xs mt-1">/store/{store.slug}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No admin-published university forms are available yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Form Type</TableHead>
                <TableHead>Admin Price</TableHead>
                <TableHead>Your Selling Price</TableHead>
                <TableHead>Your Profit</TableHead>
                <TableHead>Listed</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const row = prices[item.formTypeId] || { price: item.basePrice, listed: true };
                const profit = Number(row.price || 0) - Number(item.basePrice || 0);

                return (
                  <TableRow key={item.formTypeId}>
                    <TableCell className="font-medium">{item.schoolName}</TableCell>
                    <TableCell>{item.formTypeName}</TableCell>
                    <TableCell>{formatGHS(item.basePrice)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={item.basePrice}
                        step="0.01"
                        value={row.price}
                        onChange={(e) => setPrices((prev) => ({
                          ...prev,
                          [item.formTypeId]: {
                            ...(prev[item.formTypeId] || { listed: true }),
                            price: Number(e.target.value || 0),
                          },
                        }))}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell className={profit > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                      {formatGHS(Math.max(0, profit))}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.listed}
                        onCheckedChange={(checked) => setPrices((prev) => ({
                          ...prev,
                          [item.formTypeId]: {
                            ...(prev[item.formTypeId] || { price: item.basePrice }),
                            listed: checked,
                          },
                        }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => saveRow(item)}
                        disabled={savingId === item.formTypeId}
                      >
                        {savingId === item.formTypeId && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
