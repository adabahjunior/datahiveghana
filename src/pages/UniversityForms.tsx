import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatGHS } from "@/lib/format";
import { toast } from "sonner";
import {
  GraduationCap, Search, ArrowLeft, CheckCircle2, MessageCircle, Loader2, ChevronRight,
} from "lucide-react";

type School = {
  id: string;
  name: string;
  description: string | null;
};

type FormType = {
  id: string;
  name: string;
  price: number;
};

type SuccessOrder = {
  reference: string;
  school_name: string;
  form_type_name: string;
  amount_paid: number;
  full_name: string;
  phone: string;
  email: string;
};

type Step = "browse" | "select-form" | "details" | "confirm" | "success";

export default function UniversityForms() {
  const { profile, refreshProfile } = useAuth();

  // Data
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");

  // Navigation state
  const [step, setStep] = useState<Step>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [formTypes, setFormTypes] = useState<FormType[]>([]);
  const [loadingFormTypes, setLoadingFormTypes] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState<FormType | null>(null);

  // Purchase details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [buying, setBuying] = useState(false);

  // Success
  const [successOrder, setSuccessOrder] = useState<SuccessOrder | null>(null);

  // Load schools and WhatsApp number
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: schoolData }, { data: setting }] = await Promise.all([
        (supabase as any)
          .from("university_schools")
          .select("id, name, description")
          .eq("is_published", true)
          .order("display_order")
          .order("name"),
        supabase.from("app_settings").select("value").eq("key", "university_forms_whatsapp").maybeSingle(),
      ]);

      setSchools(schoolData || []);
      if (setting?.value) {
        const v = setting.value;
        setWhatsappNumber(typeof v === "string" ? v : "");
      }
      setLoading(false);
    };
    load();
  }, []);

  // Pre-fill email from profile
  useEffect(() => {
    if (profile?.email && !email) {
      setEmail(profile.email);
    }
  }, [profile?.email]);

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSchool = async (school: School) => {
    setSelectedSchool(school);
    setStep("select-form");
    setLoadingFormTypes(true);

    const { data } = await (supabase as any)
      .from("university_form_types")
      .select("id, name, price")
      .eq("school_id", school.id)
      .eq("is_active", true)
      .order("price");

    setFormTypes(data || []);
    setLoadingFormTypes(false);
  };

  const handleSelectFormType = (ft: FormType) => {
    setSelectedFormType(ft);
    setStep("details");
  };

  const handleProceedToConfirm = () => {
    if (!fullName.trim()) { toast.error("Enter your full name"); return; }
    if (phone.trim().length < 10) { toast.error("Enter a valid phone number (min 10 digits)"); return; }
    if (!email.trim().includes("@")) { toast.error("Enter a valid email address"); return; }
    setStep("confirm");
  };

  const handlePurchase = async () => {
    if (!selectedFormType) return;
    setBuying(true);

    const { data, error } = await supabase.functions.invoke("purchase-university-form", {
      body: {
        form_type_id: selectedFormType.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
      },
    });

    setBuying(false);

    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Purchase failed");
      return;
    }

    setSuccessOrder(data.order as SuccessOrder);
    setStep("success");
    await refreshProfile();
  };

  const handleContactAdmin = () => {
    if (!successOrder || !whatsappNumber) return;
    const num = whatsappNumber.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hello, I just purchased a university admission form.\n\n` +
      `🏫 School: ${successOrder.school_name}\n` +
      `📋 Form Type: ${successOrder.form_type_name}\n` +
      `💰 Amount Paid: ${formatGHS(successOrder.amount_paid)}\n` +
      `👤 Name: ${successOrder.full_name}\n` +
      `📞 Phone: ${successOrder.phone}\n` +
      `📧 Email: ${successOrder.email}\n` +
      `🔖 Reference: ${successOrder.reference}`
    );
    window.open(`https://wa.me/${num}?text=${message}`, "_blank");
  };

  const handleReset = () => {
    setStep("browse");
    setSelectedSchool(null);
    setSelectedFormType(null);
    setFormTypes([]);
    setFullName("");
    setPhone("");
    setEmail(profile?.email || "");
    setSuccessOrder(null);
    setSearchQuery("");
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === "success" && successOrder) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="University Forms" description="Purchase university admission forms." />
        <Card className="p-6 mb-6 border-green-500/40 bg-green-500/5 max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <h3 className="text-xl font-bold">Purchase Successful!</h3>
              <p className="text-sm text-muted-foreground">Your form order has been placed.</p>
            </div>
          </div>
          <div className="space-y-2 text-sm border rounded-lg p-4 bg-card">
            <div className="flex justify-between">
              <span className="text-muted-foreground">School</span>
              <span className="font-medium">{successOrder.school_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Form Type</span>
              <span className="font-medium">{successOrder.form_type_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-semibold text-green-600">{formatGHS(successOrder.amount_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{successOrder.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{successOrder.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{successOrder.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-xs">{successOrder.reference}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Tap the button below to contact the admin on WhatsApp with your order details.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            {whatsappNumber && (
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2" onClick={handleContactAdmin}>
                <MessageCircle className="h-4 w-4" />
                Contact Admin via WhatsApp
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              Buy Another Form
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Confirm screen ──────────────────────────────────────────────────────────
  if (step === "confirm" && selectedSchool && selectedFormType) {
    const balance = Number(profile?.wallet_balance ?? 0);
    const price = selectedFormType.price;
    const canAfford = balance >= price;

    return (
      <div className="animate-fade-in">
        <PageHeader title="University Forms" description="Confirm your purchase." />
        <Card className="p-6 max-w-lg">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
            onClick={() => setStep("details")}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">School</span>
              <span className="font-medium">{selectedSchool.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Form Type</span>
              <span className="font-medium">{selectedFormType.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Price</span>
              <span className="font-semibold text-lg">{formatGHS(price)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{fullName}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{phone}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Wallet Balance</span>
              <span className={canAfford ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                {formatGHS(balance)}
              </span>
            </div>
          </div>
          {!canAfford && (
            <p className="mt-3 text-sm text-red-500">
              Insufficient wallet balance. Please top up your wallet first.
            </p>
          )}
          <Button
            className="mt-5 w-full"
            onClick={handlePurchase}
            disabled={buying || !canAfford}
          >
            {buying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {buying ? "Processing…" : `Pay ${formatGHS(price)} from Wallet`}
          </Button>
        </Card>
      </div>
    );
  }

  // ── Details screen ──────────────────────────────────────────────────────────
  if (step === "details" && selectedSchool && selectedFormType) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="University Forms" description="Enter your details." />
        <Card className="p-6 max-w-lg">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
            onClick={() => setStep("select-form")}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="mb-5">
            <Badge variant="outline" className="text-xs">{selectedSchool.name}</Badge>
            <h3 className="text-lg font-semibold mt-1">{selectedFormType.name}</h3>
            <p className="text-2xl font-bold text-primary mt-1">{formatGHS(selectedFormType.price)}</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                placeholder="e.g. Kwame Mensah"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number (WhatsApp preferred)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g. 0241234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. kwame@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-5 w-full" onClick={handleProceedToConfirm}>
            Proceed to Payment <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Card>
      </div>
    );
  }

  // ── Select form type screen ─────────────────────────────────────────────────
  if (step === "select-form" && selectedSchool) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="University Forms" description="Select a form type." />
        <Card className="p-6 max-w-lg">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
            onClick={() => { setStep("browse"); setSelectedSchool(null); setFormTypes([]); }}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Schools
          </button>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{selectedSchool.name}</h3>
              {selectedSchool.description && (
                <p className="text-xs text-muted-foreground">{selectedSchool.description}</p>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Choose a form type:</p>
          {loadingFormTypes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : formTypes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No form types available for this school yet.</p>
          ) : (
            <div className="space-y-2">
              {formTypes.map((ft) => (
                <button
                  key={ft.id}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border hover:bg-muted/60 transition-colors text-left"
                  onClick={() => handleSelectFormType(ft)}
                >
                  <span className="font-medium text-sm">{ft.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold text-sm">{formatGHS(ft.price)}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ── Browse screen (default) ─────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="University Forms"
        description="Buy admission forms for any university listed below."
      />

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search schools…"
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSchools.length === 0 ? (
        <Card className="p-10 text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">
            {searchQuery ? "No schools match your search." : "No schools available yet."}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? "Try a different name." : "Check back later."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSchools.map((school) => (
            <button
              key={school.id}
              className="text-left rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 transition-all group"
              onClick={() => handleSelectSchool(school)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                    {school.name}
                  </p>
                  {school.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {school.description}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0 group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
