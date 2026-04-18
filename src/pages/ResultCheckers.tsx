import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function ResultCheckers() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Result Checkers"
        description="Offer digital checker products to customers from your dashboard."
      />

      <Card className="p-8 sm:p-10">
        <Badge variant="secondary" className="mb-4">Coming Soon</Badge>
        <h2 className="text-2xl font-bold tracking-tight">Result Checker tools are coming soon</h2>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          You will be able to list result checker products, process purchases, and track sales here.
        </p>
      </Card>
    </div>
  );
}
