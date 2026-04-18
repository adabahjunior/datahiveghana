import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function SubAgents() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sub Agents"
        description="Manage recruited agents, performance, and commissions from one place."
      />

      <Card className="p-8 sm:p-10">
        <Badge variant="secondary" className="mb-4">Coming Soon</Badge>
        <h2 className="text-2xl font-bold tracking-tight">Sub Agent Management is on the way</h2>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          This page will include invitation tools, activity tracking, and commission breakdown for your team.
        </p>
      </Card>
    </div>
  );
}
